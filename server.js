/* ==================================================================
 * AP Payment Operations Console
 * Meridian Corp - Internal Applications - IT Dept
 *
 * server.js - main application. Serves the AP screens, the CSV
 * extract, the JSON lookups used by the vendor enquiry desk and the
 * XML feed the ERP batch team poll every 15 minutes.
 *
 * Change log
 *   2.0.0  ported off the old finance portal, moved to node
 *   2.1.0  added risk score endpoint for the vendor enquiry desk
 *   2.2.0  XML feed for the ERP batch bridge (see /api/exceptions.xml)
 *   2.3.0  CSV extract on the reports screen
 *   2.4.0  filter + paging on the held payments screen
 *   2.4.1  fix for the blank clerk column
 *
 * Contact: finance-apps@meridiancorp.example  (ext 4471)
 * ================================================================== */

var http = require('http');
var fs = require('fs');
var path = require('path');
var express = require('express');
var Database = require('better-sqlite3');
var utils = require('./utils');
var seed = require('./seed');

/* ---------------------------------------------------------------------------
 * Function: v2 route loader
 * Owner:    payments-platform-team
 * Control:  SI-10, AC-3   (SOX: ITGC change management; PCI-DSS Req. 6.5.1)
 * Reviewed: 2026-08-14
 * Approved under KAN-98, Swayam Barik, 2026-08-13.
 * ------------------------------------------------------------------------- */
var psV2    = require('./routes/api-v2/payment-status');
var rsV2    = require('./routes/api-v2/risk-score');
var mcpRouter = require('./routes/mcp-endpoint');

/* ------------------------------------------------------------------
 * CONFIGURATION - edit here, there is no properties file
 * ------------------------------------------------------------------ */

var PORT = 4600;
var APP_NAME = 'AP Payment Operations';
var APP_VERSION = '2.4.1';
var ENVIRONMENT = 'PROD-DR';
var DB_FILE = path.join(__dirname, 'payops.db');
var PAGE_SIZE = 25;
var AS_OF_DATE = '2026-08-01';

/* mail relay - used by the overnight vendor chaser job, not by the screens */
var SMTP_HOST = 'smtprelay.meridiancorp.internal';
var SMTP_PORT = 25;
var SMTP_USER = 'svc_payops';
var SMTP_PASS = 'meridian2013!';
var AP_DISTRIBUTION_LIST = 'ap-desk@meridiancorp.example';

/* ERP feed - the batch bridge box, polls the XML endpoint */
var ERP_FEED_USER = 'ERPBATCH01';
var ERP_FEED_KEY = 'ERP-POLL-KEY-8842';
var ERP_FEED_ROWS = 200;

/* the approval limit above which an item must be second-checked */
var APPROVAL_LIMIT_CENTS = 5000000;

var db = null;
var app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: false }));
app.use('/public', express.static(path.join(__dirname, 'public')));

/* ------------------------------------------------------------------
 * database
 * ------------------------------------------------------------------ */

function openDatabase() {
	if (!fs.existsSync(DB_FILE)) {
		console.log('payops.db not found - running the extract load');
		seed.build();
	}
	db = new Database(DB_FILE);
}

function queryAll(sql) {
	return db.prepare(sql).all();
}

function queryOne(sql) {
	var rows = db.prepare(sql).all();
	if (rows.length === 0) { return null; }
	return rows[0];
}

/* every screen shows the header counts */
function headerCounts() {
	var out = {};
	out.open = queryOne("SELECT COUNT(*) AS c FROM exceptions WHERE status <> 'RESOLVED'").c;
	out.escalated = queryOne("SELECT COUNT(*) AS c FROM exceptions WHERE status = 'ESCALATED'").c;
	return out;
}

/* ------------------------------------------------------------------
 * DASHBOARD
 * ------------------------------------------------------------------ */

app.get('/', function (req, res) {
	var tiles = {};
	tiles.open = queryOne("SELECT COUNT(*) AS c FROM exceptions WHERE status <> 'RESOLVED'").c;
	tiles.heldCents = queryOne("SELECT SUM(amount_cents) AS s FROM exceptions WHERE status <> 'RESOLVED'").s;
	tiles.avgAge = queryOne("SELECT AVG(age_days) AS a FROM exceptions WHERE status <> 'RESOLVED'").a;
	tiles.highRisk = queryOne("SELECT COUNT(*) AS c FROM exceptions WHERE status <> 'RESOLVED' AND risk_flag = 'HIGH'").c;

	var byStatus = queryAll(
		"SELECT status, COUNT(*) AS n, SUM(amount_cents) AS v FROM exceptions " +
		"WHERE status <> 'RESOLVED' GROUP BY status ORDER BY n DESC"
	);
	var byType = queryAll(
		"SELECT ptype, COUNT(*) AS n, SUM(amount_cents) AS v FROM exceptions " +
		"WHERE status <> 'RESOLVED' GROUP BY ptype ORDER BY n DESC"
	);
	var oldest = queryAll(
		"SELECT e.id, e.payment_ref, e.invoice_no, e.age_days, e.amount_cents, e.currency, e.status, " +
		"e.risk_flag, v.name AS vendor FROM exceptions e, vendors v " +
		"WHERE e.vendor_id = v.id AND e.status <> 'RESOLVED' " +
		"ORDER BY e.age_days DESC, e.amount_cents DESC LIMIT 8"
	);
	var desk = queryAll(
		"SELECT k.name AS clerk, k.team, COUNT(*) AS n, SUM(e.amount_cents) AS v " +
		"FROM exceptions e, ap_clerks k WHERE e.clerk_id = k.id AND e.status <> 'RESOLVED' " +
		"GROUP BY k.name, k.team ORDER BY n DESC"
	);

	res.render('dashboard', {
		page: 'dashboard',
		appName: APP_NAME,
		appVersion: APP_VERSION,
		environment: ENVIRONMENT,
		asOf: AS_OF_DATE,
		counts: headerCounts(),
		tiles: tiles,
		byStatus: byStatus,
		byType: byType,
		oldest: oldest,
		desk: desk,
		u: utils
	});
});

/* ------------------------------------------------------------------
 * HELD PAYMENTS LIST
 * filter + paging. the form does a GET so the desk can bookmark it.
 * ------------------------------------------------------------------ */

app.get('/exceptions', function (req, res) {
	var status = req.query.status;
	var q = req.query.q;
	var ptype = req.query.type;
	var sort = req.query.sort;
	var page = parseInt(req.query.page, 10);
	if (!page || page < 1) { page = 1; }

	var where = " WHERE e.vendor_id = v.id ";
	if (status && status != 'ALL') {
		where = where + " AND e.status = '" + status + "' ";
	} else {
		where = where + " AND e.status <> 'RESOLVED' ";
	}
	if (ptype && ptype != 'ALL') {
		where = where + " AND e.ptype = '" + ptype + "' ";
	}
	if (q && q != '') {
		where = where + " AND (e.payment_ref LIKE '%" + q + "%' OR v.name LIKE '%" + q +
			"%' OR e.invoice_no LIKE '%" + q + "%' OR e.po_no LIKE '%" + q +
			"%' OR e.reason_code LIKE '%" + q + "%') ";
	}

	var orderBy = " ORDER BY e.age_days DESC, e.id ASC ";
	if (sort == 'amount') { orderBy = " ORDER BY e.amount_cents DESC, e.id ASC "; }
	if (sort == 'ref') { orderBy = " ORDER BY e.payment_ref ASC "; }
	if (sort == 'vendor') { orderBy = " ORDER BY v.name ASC, e.id ASC "; }
	if (sort == 'invoice') { orderBy = " ORDER BY e.invoice_no ASC "; }
	if (sort == 'status') { orderBy = " ORDER BY e.status ASC, e.age_days DESC "; }

	var countSql = "SELECT COUNT(*) AS c FROM exceptions e, vendors v " + where;
	var total = queryOne(countSql).c;
	var pages = Math.ceil(total / PAGE_SIZE);
	if (pages < 1) { pages = 1; }
	if (page > pages) { page = pages; }
	var offset = (page - 1) * PAGE_SIZE;

	var sql = "SELECT e.id, e.payment_ref, e.invoice_no, e.po_no, e.ptype, e.amount_cents, e.currency, " +
		"e.status, e.risk_flag, e.age_days, e.reason_code, e.reason_text, e.created_date, " +
		"v.name AS vendor, v.country AS country, k.initials AS clerk_initials, k.name AS clerk_name " +
		"FROM exceptions e, vendors v LEFT JOIN ap_clerks k ON k.id = e.clerk_id " +
		where + orderBy + " LIMIT " + PAGE_SIZE + " OFFSET " + offset;
	var rows = queryAll(sql);

	var sumSql = "SELECT SUM(e.amount_cents) AS s FROM exceptions e, vendors v " + where;
	var filteredValue = queryOne(sumSql).s;
	if (!filteredValue) { filteredValue = 0; }

	res.render('exceptions', {
		page: 'exceptions',
		appName: APP_NAME,
		appVersion: APP_VERSION,
		environment: ENVIRONMENT,
		asOf: AS_OF_DATE,
		counts: headerCounts(),
		rows: rows,
		total: total,
		pageNo: page,
		pages: pages,
		pageSize: PAGE_SIZE,
		filteredValue: filteredValue,
		fStatus: (status ? status : ''),
		fType: (ptype ? ptype : ''),
		fQuery: (q ? q : ''),
		fSort: (sort ? sort : ''),
		u: utils
	});
});

/* ------------------------------------------------------------------
 * HELD PAYMENT DETAIL
 * ------------------------------------------------------------------ */

app.get('/exceptions/:id', function (req, res) {
	var id = req.params.id;
	var row = queryOne(
		"SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, " +
		"v.category AS category, v.new_vendor AS new_vendor, k.name AS clerk_name, " +
		"k.initials AS clerk_initials, k.team AS clerk_team " +
		"FROM exceptions e, vendors v LEFT JOIN ap_clerks k ON k.id = e.clerk_id " +
		"WHERE e.vendor_id = v.id AND e.id = " + id
	);
	if (row === null) {
		res.status(404).send('<h3>Held payment ' + utils.esc(id) + ' not found.</h3>' +
			'<p><a href="/exceptions">Back to the held payments queue</a></p>');
		return;
	}

	var notes = queryAll("SELECT * FROM notes WHERE exception_id = " + id + " ORDER BY note_date DESC, id DESC");
	var clerks = queryAll("SELECT * FROM ap_clerks ORDER BY team, name");
	var scored = scoreRow(row);
	var related = queryAll(
		"SELECT id, payment_ref, invoice_no, amount_cents, currency, status, age_days FROM exceptions " +
		"WHERE vendor_id = " + row.vendor_id + " AND id <> " + id + " ORDER BY id DESC LIMIT 5"
	);

	res.render('detail', {
		page: 'exceptions',
		appName: APP_NAME,
		appVersion: APP_VERSION,
		environment: ENVIRONMENT,
		asOf: AS_OF_DATE,
		counts: headerCounts(),
		row: row,
		notes: notes,
		clerks: clerks,
		related: related,
		score: scored.score,
		band: scored.band,
		approvalLimit: APPROVAL_LIMIT_CENTS,
		saved: req.query.saved,
		u: utils
	});
});

app.post('/exceptions/:id/resolve', function (req, res) {
	var id = req.params.id;
	var action = req.body.action;
	var note = req.body.note;
	var clerk = req.body.clerk;

	var row = queryOne("SELECT * FROM exceptions WHERE id = " + id);
	if (row === null) {
		res.redirect('/exceptions');
		return;
	}

	var newStatus = row.status;
	var resolution = null;
	var resolvedDate = null;

	if (action == 'RELEASE') {
		newStatus = 'RESOLVED';
		resolution = 'RELEASED';
		resolvedDate = AS_OF_DATE;
	} else if (action == 'RETURN') {
		newStatus = 'RESOLVED';
		resolution = 'RETURNED';
		resolvedDate = AS_OF_DATE;
	} else if (action == 'HOLD') {
		newStatus = 'HOLD';
	} else if (action == 'ESCALATE') {
		newStatus = 'ESCALATED';
	} else if (action == 'REVIEW') {
		newStatus = 'REVIEW';
	}

	var sql = "UPDATE exceptions SET status = '" + newStatus + "'";
	if (resolution !== null) {
		sql = sql + ", resolution = '" + resolution + "', resolved_date = '" + resolvedDate + "'";
	}
	if (clerk && clerk != '') {
		sql = sql + ", clerk_id = " + clerk;
	}
	sql = sql + " WHERE id = " + id;
	db.exec(sql);

	if (note && note != '') {
		var author = 'SYS';
		var clerkRow = queryOne("SELECT initials FROM ap_clerks WHERE id = " + (clerk ? clerk : row.clerk_id));
		if (clerkRow !== null) { author = clerkRow.initials; }
		db.prepare('INSERT INTO notes (exception_id, author, note_date, body) VALUES (?,?,?,?)')
			.run(id, author, AS_OF_DATE + ' 09:00:00', note);
	}

	res.redirect('/exceptions/' + id + '?saved=1');
});

/* ------------------------------------------------------------------
 * REPORTS
 * The desk print this every morning and staple it to the handover.
 * ------------------------------------------------------------------ */

app.get('/reports', function (req, res) {
    var byStatus = queryAll(
        "SELECT status, COUNT(*) AS n, SUM(amount_cents) AS v, AVG(age_days) AS a " +
        "FROM exceptions GROUP BY status ORDER BY status");
    var byType = queryAll(
        "SELECT ptype, COUNT(*) AS n, SUM(amount_cents) AS v FROM exceptions " +
        "WHERE status <> 'RESOLVED' GROUP BY ptype ORDER BY ptype");
    var byCountry = queryAll(
        "SELECT v.country AS country, COUNT(*) AS n, SUM(e.amount_cents) AS v " +
        "FROM exceptions e, vendors v WHERE e.vendor_id = v.id AND e.status <> 'RESOLVED' " +
        "GROUP BY v.country ORDER BY n DESC");
    var byReason = queryAll(
        "SELECT reason_code, reason_text, COUNT(*) AS n FROM exceptions " +
        "WHERE status <> 'RESOLVED' GROUP BY reason_code, reason_text ORDER BY n DESC");
    var byAge = queryAll(
        "SELECT CASE WHEN age_days <= 1 THEN '0-1 days' " +
        "WHEN age_days <= 3 THEN '2-3 days' " +
        "WHEN age_days <= 6 THEN '4-6 days' " +
        "WHEN age_days <= 10 THEN '7-10 days' " +
        "ELSE 'over 10 days' END AS bucket, COUNT(*) AS n, SUM(amount_cents) AS v " +
        "FROM exceptions WHERE status <> 'RESOLVED' GROUP BY bucket ORDER BY MIN(age_days)");
    var byClerk = queryAll(
        "SELECT k.name AS clerk, k.team AS team, COUNT(*) AS n, SUM(e.amount_cents) AS v, " +
        "AVG(e.age_days) AS a FROM exceptions e, ap_clerks k " +
        "WHERE e.clerk_id = k.id AND e.status <> 'RESOLVED' GROUP BY k.name, k.team ORDER BY n DESC");

    res.render('reports', {
        page: 'reports',
        appName: APP_NAME,
        appVersion: APP_VERSION,
        environment: ENVIRONMENT,
        asOf: AS_OF_DATE,
        counts: headerCounts(),
        byStatus: byStatus,
        byType: byType,
        byCountry: byCountry,
        byReason: byReason,
        byAge: byAge,
        byClerk: byClerk,
        u: utils
    });
});

app.get('/reports/export.csv', function (req, res) {
	var status = req.query.status;
	var where = " WHERE e.vendor_id = v.id ";
	if (status && status != 'ALL') {
		where = where + " AND e.status = '" + status + "' ";
	} else {
		where = where + " AND e.status <> 'RESOLVED' ";
	}
	var rows = queryAll(
		"SELECT e.payment_ref, e.invoice_no, e.po_no, v.name AS vendor, v.country AS country, e.ptype, " +
		"e.amount_cents, e.currency, e.status, e.risk_flag, e.age_days, e.created_date, " +
		"e.invoice_date, e.due_date, e.expected_pay_date, e.payment_run_id, " +
		"e.reason_code, e.reason_text, e.remit_to, e.bank_bic, e.channel " +
		"FROM exceptions e, vendors v " + where + " ORDER BY e.payment_ref ASC"
	);

	var out = 'PAYMENT_REF,INVOICE_NO,PO_NO,VENDOR,COUNTRY,TYPE,AMOUNT,CURRENCY,STATUS,RISK,AGE_DAYS,' +
		'CREATED,INVOICE_DATE,DUE_DATE,EXPECTED_PAY_DATE,PAYMENT_RUN,HOLD_CODE,HOLD_REASON,' +
		'REMIT_TO,BANK_BIC,CHANNEL\r\n';
	for (var i = 0; i < rows.length; i++) {
		var r = rows[i];
		out = out + utils.csvCell(r.payment_ref) + ',' + utils.csvCell(r.invoice_no) + ',' +
			utils.csvCell(r.po_no) + ',' + utils.csvCell(r.vendor) + ',' +
			utils.csvCell(r.country) + ',' + utils.csvCell(r.ptype) + ',' +
			utils.csvCell(utils.money(r.amount_cents)) + ',' + utils.csvCell(r.currency) + ',' +
			utils.csvCell(r.status) + ',' + utils.csvCell(r.risk_flag) + ',' +
			utils.csvCell(r.age_days) + ',' + utils.csvCell(r.created_date) + ',' +
			utils.csvCell(r.invoice_date) + ',' + utils.csvCell(r.due_date) + ',' +
			utils.csvCell(r.expected_pay_date) + ',' + utils.csvCell(r.payment_run_id) + ',' +
			utils.csvCell(r.reason_code) + ',' + utils.csvCell(r.reason_text) + ',' +
			utils.csvCell(r.remit_to) + ',' + utils.csvCell(r.bank_bic) + ',' +
			utils.csvCell(r.channel) + '\r\n';
	}

	res.setHeader('Content-Type', 'text/csv');
	res.setHeader('Content-Disposition', 'attachment; filename=payops_held_payments.csv');
	res.send(out);
});

/* ------------------------------------------------------------------
 * AP PAYMENT RISK SCORING
 * Ported from the COBOL routine APRSK01. Do not change the bands
 * without raising a change request - the vendor enquiry desk traffic
 * lights are keyed off the same numbers.
 * ------------------------------------------------------------------ */

function scoreRow(row) {
	var score = 0;
	var amt = row.amount_cents;

	/* invoice value bands */
	if (amt >= 25000000) {
		score = score + 45;
	} else if (amt >= 10000000) {
		score = score + 35;
	} else if (amt >= 5000000) {
		score = score + 28;
	} else if (amt >= 1000000) {
		score = score + 18;
	} else if (amt >= 250000) {
		score = score + 10;
	} else {
		score = score + 4;
	}

	/* payment method */
	if (row.ptype == 'WIRE') {
		if (amt >= 5000000) {
			score = score + 14;
		} else {
			score = score + 9;
		}
	} else if (row.ptype == 'SEPA') {
		score = score + 6;
	} else {
		if (row.channel == 'EDI') {
			score = score + 5;
		} else {
			score = score + 3;
		}
	}

	/* vendor country */
	if (row.country == 'US') {
		score = score + 2;
	} else if (row.country == 'GB') {
		score = score + 3;
	} else if (row.country == 'DE') {
		score = score + 3;
	} else if (row.country == 'SG') {
		score = score + 7;
	} else if (row.country == 'MX') {
		score = score + 11;
	} else {
		score = score + 8;
	}

	/* how long the item has sat on the AP queue */
	if (row.age_days >= 14) {
		score = score + 16;
	} else if (row.age_days >= 7) {
		score = score + 11;
	} else if (row.age_days >= 4) {
		score = score + 6;
	} else if (row.age_days >= 2) {
		score = score + 2;
	}

	/* round amounts are a duplicate / manual keying indicator */
	if (utils.isRoundDollar(amt)) {
		if (amt >= 1000000) {
			score = score + 9;
		} else {
			score = score + 4;
		}
	}

	/* vendor bank details amended recently - payment diversion risk */
	if (row.bank_chg_days >= 0) {
		if (row.bank_chg_days <= 30) {
			score = score + 14;
		} else if (row.bank_chg_days <= 90) {
			score = score + 7;
		} else {
			score = score + 2;
		}
	}

	/* vendor onboarded inside the current year */
	if (row.new_vendor == 'Y') {
		score = score + 6;
	}

	/* hold reason overlay */
	if (row.reason_code == 'H21') {
		score = score + 12;   /* duplicate invoice suspected */
	} else if (row.reason_code == 'H07') {
		score = score + 9;    /* bank details changed */
	} else if (row.reason_code == 'H41') {
		score = score + 7;    /* over approval limit */
	} else if (row.reason_code == 'H09') {
		score = score + 5;    /* vendor on payment block */
	}

	/* already flagged by the overnight ERP batch */
	if (row.risk_flag == 'HIGH') {
		score = score + 10;
	} else if (row.risk_flag == 'MED') {
		score = score + 4;
	}

	if (score > 100) { score = 100; }
	if (score < 0) { score = 0; }

	return { score: score, band: utils.bandFor(score) };
}

/* ------------------------------------------------------------------
 * INTERFACES
 * /api/payment-status  - vendor payment enquiry (ref or invoice)
 * /api/risk-score      - vendor enquiry desk traffic light
 * /api/exceptions.xml  - ERP nightly extract (ERPBATCH01)
 * ------------------------------------------------------------------ */

/* v2 endpoints — parameterized, validated, env-configured (KAN-98) */
app.get('/api/v2/payment-status', psV2.validators, psV2.handler(function () { return db; }));
app.get('/api/v2/risk-score',     rsV2.validators, rsV2.handler(function () { return db; }));

/* legacy endpoints retained for dual-stack compatibility; retire in follow-on epic */
app.get('/api/payment-status', function (req, res) {
	res.setHeader('Deprecation', 'true');
	res.setHeader('Link', '</api/v2/payment-status>; rel="successor-version"');
}, function (req, res) {
	var ref = req.query.ref;
	var invoice = req.query.invoice;
	if (!ref && !invoice) {
		res.status(400).json({ ERR: 'MISSING_REF', msg: 'ref or invoice parameter is required' });
		return;
	}

	/* the enquiry desk pass the payment reference, the vendors on the
	   phone only ever have their own invoice number */
	var lookup = " AND e.payment_ref = '" + ref + "' ";
	if (!ref) {
		lookup = " AND e.invoice_no = '" + invoice + "' ";
	}

	var row = queryOne(
		"SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, " +
		"k.initials AS clerk_initials FROM exceptions e, vendors v " +
		"LEFT JOIN ap_clerks k ON k.id = e.clerk_id " +
		"WHERE e.vendor_id = v.id " + lookup
	);

	if (row === null) {
		res.status(404).json({ ERR: 'NOT_FOUND', PaymentRef: (ref ? ref : ''), InvoiceNo: (invoice ? invoice : '') });
		return;
	}

	var out = {};
	out.PaymentRef = row.payment_ref;
	out.InvoiceNo = row.invoice_no;
	out.PO_NUM = row.po_no;
	out.sts = row.status;
	out.sts_desc = statusDescription(row.status);
	out.amt_cents = String(row.amount_cents);
	out.Amount_Formatted = utils.money(row.amount_cents);
	out.ccy = row.currency;
	out.Type = row.ptype;
	out.vendorName = row.vendor;
	out.vend_ctry = row.country;
	out.VendorNo = row.vendor_no;
	out.remit_TO = row.remit_to;
	out.BankBIC = row.bank_bic;
	out.rsn = row.reason_code;
	out.rsnText = row.reason_text;
	out.age_days = String(row.age_days);
	out.CreatedDate = row.created_date;
	out.invoice_dt = row.invoice_date;
	out.due_dt = row.due_date;
	out.expected_pay_dt = row.expected_pay_date;
	out.value_dt = row.value_date;
	out.PaymentRun = row.payment_run_id;
	out.risk = row.risk_flag;
	out.Clerk = (row.clerk_initials ? row.clerk_initials : '');
	out.resolved_dt = (row.resolved_date ? row.resolved_date : '');
	out.Resolution = (row.resolution ? row.resolution : '');
	out.over_approval_limit = (row.amount_cents >= APPROVAL_LIMIT_CENTS ? 'Y' : 'N');
	out.retcode = '0000';
	out.asOfDate = AS_OF_DATE;

	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify(out));
});

app.get('/api/risk-score', function (req, res) {
	res.setHeader('Deprecation', 'true');
	res.setHeader('Link', '</api/v2/risk-score>; rel="successor-version"');
}, function (req, res) {
	var ref = req.query.ref;
	if (!ref) {
		res.status(400).json({ ERR: 'MISSING_REF' });
		return;
	}

	var row = queryOne(
		"SELECT e.*, v.country AS country, v.new_vendor AS new_vendor FROM exceptions e, vendors v " +
		"WHERE e.vendor_id = v.id AND e.payment_ref = '" + ref + "'"
	);
	if (row === null) {
		res.status(404).json({ ERR: 'NOT_FOUND', REF: ref });
		return;
	}

	var scored = scoreRow(row);
	var out = {};
	out.REF = row.payment_ref;
	out.INV = row.invoice_no;
	out.SCORE = String(scored.score);
	out.BAND = scored.band;
	out.amt_cents = String(row.amount_cents);
	out.ccy = row.currency;
	out.TYPE = row.ptype;
	out.ctry = row.country;
	out.age = String(row.age_days);
	out.dup_suspect = (row.reason_code == 'H21' ? 'Y' : 'N');
	out.bank_chg_days = String(row.bank_chg_days);
	out.over_limit = (row.amount_cents >= APPROVAL_LIMIT_CENTS ? 'Y' : 'N');
	out.round_amt = (utils.isRoundDollar(row.amount_cents) ? 'Y' : 'N');
	out.new_vend = row.new_vendor;
	out.model = 'APRSK01';
	out.retcode = '0000';

	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify(out));
});

/* the ERP batch bridge cannot consume JSON so this stays XML */
app.get('/api/exceptions.xml', function (req, res) {
	var status = req.query.status;
	var where = " WHERE e.vendor_id = v.id ";
	if (status && status != 'ALL') {
		where = where + " AND e.status = '" + status + "' ";
	} else {
		where = where + " AND e.status <> 'RESOLVED' ";
	}
	var limit = parseInt(req.query.max, 10);
	if (!limit || limit < 1) { limit = ERP_FEED_ROWS; }

	var rows = queryAll(
		"SELECT e.payment_ref, e.invoice_no, e.po_no, e.ptype, e.amount_cents, e.currency, e.status, " +
		"e.risk_flag, e.age_days, e.created_date, e.due_date, e.expected_pay_date, e.value_date, " +
		"e.reason_code, v.name AS vendor, v.country AS country FROM exceptions e, vendors v " + where +
		" ORDER BY e.payment_ref ASC LIMIT " + limit
	);

	var xml = '<?xml version="1.0" encoding="ISO-8859-1"?>\n';
	xml = xml + '<PAYOPSEXTRACT SYSTEM="PAYOPS" VERSION="' + APP_VERSION + '" ASOF="' + AS_OF_DATE +
		'" USERID="' + ERP_FEED_USER + '" COUNT="' + rows.length + '">\n';
	for (var i = 0; i < rows.length; i++) {
		var r = rows[i];
		xml = xml + '  <EXCEPTION>\n';
		xml = xml + '    <PAYMENTREF>' + utils.xmlEsc(r.payment_ref) + '</PAYMENTREF>\n';
		xml = xml + '    <INVNO>' + utils.xmlEsc(r.invoice_no) + '</INVNO>\n';
		xml = xml + '    <PONO>' + utils.xmlEsc(r.po_no) + '</PONO>\n';
		xml = xml + '    <VENDNAME>' + utils.xmlEsc(r.vendor) + '</VENDNAME>\n';
		xml = xml + '    <VENDCTRY>' + utils.xmlEsc(r.country) + '</VENDCTRY>\n';
		xml = xml + '    <PAYTYPE>' + utils.xmlEsc(r.ptype) + '</PAYTYPE>\n';
		xml = xml + '    <AMTCENTS>' + r.amount_cents + '</AMTCENTS>\n';
		xml = xml + '    <CCY>' + utils.xmlEsc(r.currency) + '</CCY>\n';
		xml = xml + '    <STATUS>' + utils.xmlEsc(r.status) + '</STATUS>\n';
		xml = xml + '    <RISKFLAG>' + utils.xmlEsc(r.risk_flag) + '</RISKFLAG>\n';
		xml = xml + '    <AGEDAYS>' + r.age_days + '</AGEDAYS>\n';
		xml = xml + '    <CREATEDT>' + utils.xmlEsc(r.created_date) + '</CREATEDT>\n';
		xml = xml + '    <DUEDT>' + utils.xmlEsc(r.due_date) + '</DUEDT>\n';
		xml = xml + '    <EXPPAYDT>' + utils.xmlEsc(r.expected_pay_date) + '</EXPPAYDT>\n';
		xml = xml + '    <VALUEDT>' + utils.xmlEsc(r.value_date) + '</VALUEDT>\n';
		xml = xml + '    <RSNCODE>' + utils.xmlEsc(r.reason_code) + '</RSNCODE>\n';
		xml = xml + '  </EXCEPTION>\n';
	}
	xml = xml + '</PAYOPSEXTRACT>\n';

	res.setHeader('Content-Type', 'text/xml');
	res.send(xml);
});

function statusDescription(status) {
	if (status == 'PENDING') { return 'Awaiting first review'; }
	if (status == 'REVIEW') { return 'Under review by an AP clerk'; }
	if (status == 'HOLD') { return 'Held - awaiting vendor or goods receipt'; }
	if (status == 'ESCALATED') { return 'Escalated to AP controls'; }
	if (status == 'RESOLVED') { return 'Closed - released or returned'; }
	return 'Unknown';
}

/* ------------------------------------------------------------------
 * misc pages
 * ------------------------------------------------------------------ */

app.get('/help', function (req, res) {
	res.render('help', {
		page: 'help',
		appName: APP_NAME,
		appVersion: APP_VERSION,
		environment: ENVIRONMENT,
		asOf: AS_OF_DATE,
		counts: headerCounts(),
		smtpHost: SMTP_HOST,
		feedUser: ERP_FEED_USER,
		u: utils
	});
});

/* MCP tool layer — governed AI agent identity boundary (KAN-98) */
app.use('/mcp', mcpRouter);

app.use(function (req, res) {
	res.status(404).send(
		'<html><head><title>Not found</title>' +
		'<link rel="stylesheet" href="/public/vendor/bootstrap.css">' +
		'<link rel="stylesheet" href="/public/payops.css"></head><body>' +
		'<div class="container"><h3>Page not found</h3>' +
		'<p>The address <code>' + utils.esc(req.path) + '</code> is not part of this application.</p>' +
		'<p><a href="/">Return to the dashboard</a></p>' +
		'<p class="muted">If you reached this page from a bookmark, please raise a call with the ' +
		'service desk quoting application PAYOPS.</p></div></body></html>'
	);
});

/* ------------------------------------------------------------------
 * start up
 * ------------------------------------------------------------------ */

openDatabase();

http.createServer(app).listen(PORT, function () {
	console.log('====================================================');
	console.log(' ' + APP_NAME + ' v' + APP_VERSION);
	console.log(' Meridian Corp - IT Dept - Internal Use Only');
	console.log(' Environment : ' + ENVIRONMENT);
	console.log(' Listening   : http://localhost:' + PORT + '/');
	console.log(' Database    : ' + DB_FILE);
	console.log('====================================================');
});
