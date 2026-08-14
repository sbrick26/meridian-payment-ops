/* ---------------------------------------------------------------------------
 * Function: GET /api/v2/risk-score
 * Owner:    payments-platform-team
 * Control:  SI-10, AC-3   (SOX: ITGC change management; PCI-DSS Req. 6.5.1)
 * Reviewed: 2026-08-14
 * ---------------------------------------------------------------------------
 * Replaces the legacy /api/risk-score handler (server.js:588-625).
 * Uses parameterized queries and express-validator input validation.
 * scoreRow logic is IDENTICAL to server.js:407-516 — no scoring changes.
 * Response shape is IDENTICAL to legacy — zero key renames.
 * Approved under KAN-87, Swayam Barik, 2026-08-13.
 * ------------------------------------------------------------------------- */

'use strict';

var { query, validationResult } = require('express-validator');
var utils = require('../../utils');

var APPROVAL_LIMIT_CENTS = parseInt(process.env.PAYOPS_APPROVAL_LIMIT_CENTS || process.env.APPROVAL_LIMIT_CENTS || '5000000', 10);

/* scoreRow — verbatim copy of server.js scoring logic. Must not diverge. */
function scoreRow(row) {
	var score = 0;
	var amt   = row.amount_cents;

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

	if (utils.isRoundDollar(amt)) {
		score += (amt >= 1000000 ? 9 : 4);
	}

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

var validators = [
	query('ref').notEmpty().isLength({ max: 64 }).trim()
];

function handler(dbOrGetter) {
	return function (req, res) {
		var db = (typeof dbOrGetter === 'function') ? dbOrGetter() : dbOrGetter;
		var ref = req.query.ref || null;

		/* 400 — missing ref */
		if (!ref) {
			return res.status(400).json({ ERR: 'MISSING_REF' });
		}

		var errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ ERR: 'MISSING_REF' });
		}

		/* parameterized lookup — replaces string-concatenated SQL at server.js:595-598 */
		var row = db.prepare(
			'SELECT e.*, v.country AS country, v.new_vendor AS new_vendor ' +
			'FROM exceptions e, vendors v ' +
			'WHERE e.vendor_id = v.id AND e.payment_ref = ?'
		).get(ref);

		/* 404 — not found */
		if (!row) {
			return res.status(404).json({ ERR: 'NOT_FOUND', REF: ref });
		}

		/* response assembly — IDENTICAL to legacy server.js:605-621 */
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

module.exports = { validators: validators, handler: handler };
