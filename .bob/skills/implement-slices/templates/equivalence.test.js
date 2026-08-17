/* ---------------------------------------------------------------------------
 * Equivalence test suite — KAN-84
 * Owner:    payments-platform-team
 * Control:  AU-2, AU-12   (SOX: change management; PCI-DSS Req. 10)
 * Reviewed: 2026-08-14
 * ---------------------------------------------------------------------------
 * Rule 08 live-vs-live comparison: both the legacy handler and the v2 handler
 * are mounted in a single in-process Express server and hit with identical
 * inputs. The comparator is the live legacy response, not a static fixture.
 *
 * Golden fixtures in tests/golden/ are retained as a captured historical
 * record (rule 08(a)) but are NOT used as the comparator here.
 *
 * Input matrix (12 cases):
 *   PS-01  payment-status nominal hit by ref
 *   PS-02  payment-status nominal hit by invoice
 *   PS-03  payment-status ESCALATED / HIGH risk row
 *   PS-04  payment-status RESOLVED row (resolved_date + resolution populated)
 *   PS-05  payment-status 404 miss by ref
 *   PS-06  payment-status 404 miss by invoice
 *   PS-07  payment-status 400 missing param
 *   RS-01  risk-score nominal hit by ref (LOW)
 *   RS-02  risk-score HIGH risk row
 *   RS-03  risk-score MED risk row
 *   RS-04  risk-score 404 miss
 *   RS-05  risk-score 400 missing ref
 *
 * Comparison: HTTP status code + every response body field, field by field.
 * Intended differences: none.
 * Exit criteria: 12/12 pass, zero unexplained differences.
 *
 * Uses Node built-in test runner (node:test + assert). No test dependencies.
 * Wired to: npm test
 * Approved under KAN-84, Swayam Barik, 2026-08-13.
 * ------------------------------------------------------------------------- */

'use strict';

var test     = require('node:test');
var assert   = require('node:assert/strict');
var http     = require('node:http');
var path     = require('node:path');
var Database = require('better-sqlite3');
var express  = require('express');
var psV2     = require('../routes/api-v2/payment-status');
var rsV2     = require('../routes/api-v2/risk-score');

/* -------------------------------------------------------------------------
 * Legacy handler functions — reproduced verbatim from server.js so the test
 * server has no dependency on the main server process.
 * These MUST NOT be changed except to track changes to the legacy routes in
 * server.js; any divergence would defeat the equivalence proof.
 * ---------------------------------------------------------------------- */
var AS_OF_DATE           = '2026-08-01';
var APPROVAL_LIMIT_CENTS = 5000000;
var utils                = require('../utils');

function statusDescription(s) {
	if (s === 'PENDING')   return 'Pending review';
	if (s === 'REVIEW')    return 'Under review';
	if (s === 'HOLD')      return 'Payment held';
	if (s === 'ESCALATED') return 'Escalated for approval';
	if (s === 'RESOLVED')  return 'Resolved';
	return s;
}

/* scoreRow — verbatim copy of server.js:407-516 */
function scoreRow(row) {
	var score = 0, amt = row.amount_cents;
	if      (amt >= 25000000) { score += 45; }
	else if (amt >= 10000000) { score += 35; }
	else if (amt >= 5000000)  { score += 28; }
	else if (amt >= 1000000)  { score += 18; }
	else if (amt >= 250000)   { score += 10; }
	else                      { score += 4;  }
	if (row.ptype === 'WIRE') {
		score += (amt >= 5000000 ? 14 : 9);
	} else if (row.ptype === 'SEPA') {
		score += 6;
	} else {
		score += (row.channel === 'EDI' ? 5 : 3);
	}
	if      (row.country === 'US') { score += 2;  }
	else if (row.country === 'GB') { score += 3;  }
	else if (row.country === 'DE') { score += 3;  }
	else if (row.country === 'SG') { score += 7;  }
	else if (row.country === 'MX') { score += 11; }
	else                           { score += 8;  }
	if      (row.age_days >= 14) { score += 16; }
	else if (row.age_days >= 7)  { score += 11; }
	else if (row.age_days >= 4)  { score += 6;  }
	else if (row.age_days >= 2)  { score += 2;  }
	if (utils.isRoundDollar(amt)) { score += (amt >= 1000000 ? 9 : 4); }
	if (row.bank_chg_days >= 0) {
		if      (row.bank_chg_days <= 30) { score += 14; }
		else if (row.bank_chg_days <= 90) { score += 7;  }
		else                              { score += 2;  }
	}
	if (row.new_vendor === 'Y') { score += 6; }
	if      (row.reason_code === 'H21') { score += 12; }
	else if (row.reason_code === 'H07') { score += 9;  }
	else if (row.reason_code === 'H41') { score += 7;  }
	else if (row.reason_code === 'H09') { score += 5;  }
	if      (row.risk_flag === 'HIGH') { score += 10; }
	else if (row.risk_flag === 'MED')  { score += 4;  }
	if (score > 100) { score = 100; }
	if (score < 0)   { score = 0;   }
	return { score: score, band: utils.bandFor(score) };
}

/* Legacy route handlers — mounted at /legacy/* paths */
function legacyPaymentStatus(db) {
	return function (req, res) {
		var ref     = req.query.ref     || null;
		var invoice = req.query.invoice || null;
		if (!ref && !invoice) {
			return res.status(400).json({ ERR: 'MISSING_REF', msg: 'ref or invoice parameter is required' });
		}
		var lookup = ref
			? ' AND e.payment_ref = ? '
			: ' AND e.invoice_no = ? ';
		var rows = db.prepare(
			'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
			'k.initials AS clerk_initials FROM exceptions e, vendors v ' +
			'LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
			'WHERE e.vendor_id = v.id ' + lookup
		).all(ref || invoice);
		var row = rows.length ? rows[0] : null;
		if (!row) {
			return res.status(404).json({ ERR: 'NOT_FOUND', PaymentRef: (ref ? ref : ''), InvoiceNo: (invoice ? invoice : '') });
		}
		var out = {};
		out.PaymentRef          = row.payment_ref;
		out.InvoiceNo           = row.invoice_no;
		out.PO_NUM              = row.po_no;
		out.sts                 = row.status;
		out.sts_desc            = statusDescription(row.status);
		out.amt_cents           = String(row.amount_cents);
		out.Amount_Formatted    = utils.money(row.amount_cents);
		out.ccy                 = row.currency;
		out.Type                = row.ptype;
		out.vendorName          = row.vendor;
		out.vend_ctry           = row.country;
		out.VendorNo            = row.vendor_no;
		out.remit_TO            = row.remit_to;
		out.BankBIC             = row.bank_bic;
		out.rsn                 = row.reason_code;
		out.rsnText             = row.reason_text;
		out.age_days            = String(row.age_days);
		out.CreatedDate         = row.created_date;
		out.invoice_dt          = row.invoice_date;
		out.due_dt              = row.due_date;
		out.expected_pay_dt     = row.expected_pay_date;
		out.value_dt            = row.value_date;
		out.PaymentRun          = row.payment_run_id;
		out.risk                = row.risk_flag;
		out.Clerk               = (row.clerk_initials ? row.clerk_initials : '');
		out.resolved_dt         = (row.resolved_date  ? row.resolved_date  : '');
		out.Resolution          = (row.resolution     ? row.resolution     : '');
		out.over_approval_limit = (row.amount_cents >= APPROVAL_LIMIT_CENTS ? 'Y' : 'N');
		out.retcode             = '0000';
		out.asOfDate            = AS_OF_DATE;
		res.setHeader('Content-Type', 'application/json');
		return res.send(JSON.stringify(out));
	};
}

function legacyRiskScore(db) {
	return function (req, res) {
		var ref = req.query.ref || null;
		if (!ref) {
			return res.status(400).json({ ERR: 'MISSING_REF' });
		}
		var rows = db.prepare(
			'SELECT e.*, v.country AS country, v.new_vendor AS new_vendor FROM exceptions e, vendors v ' +
			'WHERE e.vendor_id = v.id AND e.payment_ref = ?'
		).all(ref);
		var row = rows.length ? rows[0] : null;
		if (!row) {
			return res.status(404).json({ ERR: 'NOT_FOUND', REF: ref });
		}
		var scored = scoreRow(row);
		var out = {};
		out.REF           = row.payment_ref;
		out.INV           = row.invoice_no;
		out.SCORE         = String(scored.score);
		out.BAND          = scored.band;
		out.amt_cents     = String(row.amount_cents);
		out.ccy           = row.currency;
		out.TYPE          = row.ptype;
		out.ctry          = row.country;
		out.age           = String(row.age_days);
		out.dup_suspect   = (row.reason_code === 'H21' ? 'Y' : 'N');
		out.bank_chg_days = String(row.bank_chg_days);
		out.over_limit    = (row.amount_cents >= APPROVAL_LIMIT_CENTS ? 'Y' : 'N');
		out.round_amt     = (utils.isRoundDollar(row.amount_cents) ? 'Y' : 'N');
		out.new_vend      = row.new_vendor;
		out.model         = 'APRSK01';
		out.retcode       = '0000';
		res.setHeader('Content-Type', 'application/json');
		return res.send(JSON.stringify(out));
	};
}

/* -------------------------------------------------------------------------
 * In-process test server: legacy routes at /legacy/*, v2 routes at /api/v2/*
 * Single DB connection shared by both sets of handlers — same data, same
 * instant, so any difference is a logic difference, not a data race.
 * ---------------------------------------------------------------------- */
var DB_FILE = path.join(__dirname, '..', 'payops.db');
var db;
var server;
var port;

function startServer() {
	db = new Database(DB_FILE);
	var app = express();

	function getDb() { return db; }

	/* Legacy handlers */
	app.get('/legacy/payment-status', legacyPaymentStatus(db));
	app.get('/legacy/risk-score',     legacyRiskScore(db));

	/* v2 handlers */
	app.get('/api/v2/payment-status', psV2.validators, psV2.handler(getDb));
	app.get('/api/v2/risk-score',     rsV2.validators, rsV2.handler(getDb));

	return new Promise(function (resolve) {
		server = http.createServer(app);
		server.listen(0, '127.0.0.1', function () {
			port = server.address().port;
			resolve();
		});
	});
}

function stopServer() {
	if (!server) {
		if (db) db.close();
		return Promise.resolve();
	}
	return new Promise(function (resolve) {
		server.close(function () {
			db.close();
			resolve();
		});
		server.closeAllConnections();
	});
}

/* -------------------------------------------------------------------------
 * HTTP helper — returns { status, body (parsed JSON) }
 * ---------------------------------------------------------------------- */
function get(urlPath) {
	return new Promise(function (resolve, reject) {
		var req = http.request(
			{ hostname: '127.0.0.1', port: port, path: urlPath, method: 'GET' },
			function (res) {
				var chunks = [];
				res.on('data', function (c) { chunks.push(c); });
				res.on('end', function () {
					var raw = Buffer.concat(chunks).toString('utf8');
					var body;
					try { body = JSON.parse(raw); } catch (_) { body = raw; }
					resolve({ status: res.statusCode, body: body });
				});
			}
		);
		req.on('error', reject);
		req.end();
	});
}

/* -------------------------------------------------------------------------
 * Live-vs-live comparison helper.
 * Hits legacy and v2 with the same query string, compares status + every
 * body field bidirectionally. Fails with a descriptive message on any diff.
 * ---------------------------------------------------------------------- */
function compare(caseName, legacyPath, v2Path) {
	return Promise.all([get(legacyPath), get(v2Path)]).then(function (results) {
		var legacy = results[0];
		var v2     = results[1];

		assert.strictEqual(
			v2.status,
			legacy.status,
			caseName + ': HTTP status mismatch — legacy=' + legacy.status + ' v2=' + v2.status
		);

		var legacyBody = legacy.body;
		var v2Body     = v2.body;

		/* Every key in legacy must be present and equal in v2 */
		var legacyKeys = Object.keys(legacyBody);
		for (var i = 0; i < legacyKeys.length; i++) {
			var k = legacyKeys[i];
			assert.strictEqual(
				String(v2Body[k]),
				String(legacyBody[k]),
				caseName + ': field "' + k + '" mismatch — legacy=' +
					JSON.stringify(legacyBody[k]) + ' v2=' + JSON.stringify(v2Body[k])
			);
		}

		/* No unexpected extra keys in v2 */
		var v2Keys = Object.keys(v2Body);
		for (var j = 0; j < v2Keys.length; j++) {
			var vk = v2Keys[j];
			assert.ok(
				Object.prototype.hasOwnProperty.call(legacyBody, vk),
				caseName + ': v2 returned unexpected extra field "' + vk + '" not present in legacy'
			);
		}
	});
}

/* -------------------------------------------------------------------------
 * Tests
 * ---------------------------------------------------------------------- */
test.before(startServer);
test.after(stopServer);

/* -- /api/v2/payment-status  vs  /legacy/payment-status ---------------- */

test('PS-01  nominal hit by ref (HOLD/LOW)', function () {
	return compare('PS-01',
		'/legacy/payment-status?ref=MT-2026-08815',
		'/api/v2/payment-status?ref=MT-2026-08815');
});

test('PS-02  nominal hit by invoice number', function () {
	return compare('PS-02',
		'/legacy/payment-status?invoice=INV-2026-4403',
		'/api/v2/payment-status?invoice=INV-2026-4403');
});

test('PS-03  ESCALATED / HIGH risk row', function () {
	return compare('PS-03',
		'/legacy/payment-status?ref=MT-2026-08816',
		'/api/v2/payment-status?ref=MT-2026-08816');
});

test('PS-04  RESOLVED row (resolved_date and resolution populated)', function () {
	return compare('PS-04',
		'/legacy/payment-status?ref=MT-2026-09439',
		'/api/v2/payment-status?ref=MT-2026-09439');
});

test('PS-05  404 miss by ref', function () {
	return compare('PS-05',
		'/legacy/payment-status?ref=MT-DOES-NOT-EXIST',
		'/api/v2/payment-status?ref=MT-DOES-NOT-EXIST');
});

test('PS-06  404 miss by invoice', function () {
	return compare('PS-06',
		'/legacy/payment-status?invoice=INV-DOES-NOT-EXIST',
		'/api/v2/payment-status?invoice=INV-DOES-NOT-EXIST');
});

test('PS-07  400 missing param', function () {
	return compare('PS-07',
		'/legacy/payment-status',
		'/api/v2/payment-status');
});

/* -- /api/v2/risk-score  vs  /legacy/risk-score ------------------------- */

test('RS-01  nominal hit by ref (LOW risk)', function () {
	return compare('RS-01',
		'/legacy/risk-score?ref=MT-2026-08815',
		'/api/v2/risk-score?ref=MT-2026-08815');
});

test('RS-02  HIGH risk row', function () {
	return compare('RS-02',
		'/legacy/risk-score?ref=MT-2026-08816',
		'/api/v2/risk-score?ref=MT-2026-08816');
});

test('RS-03  MED risk row', function () {
	return compare('RS-03',
		'/legacy/risk-score?ref=MT-2026-08832',
		'/api/v2/risk-score?ref=MT-2026-08832');
});

test('RS-04  404 miss', function () {
	return compare('RS-04',
		'/legacy/risk-score?ref=MT-DOES-NOT-EXIST',
		'/api/v2/risk-score?ref=MT-DOES-NOT-EXIST');
});

test('RS-05  400 missing ref', function () {
	return compare('RS-05',
		'/legacy/risk-score',
		'/api/v2/risk-score');
});
