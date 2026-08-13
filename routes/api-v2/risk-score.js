/* routes/api-v2/risk-score.js
 *
 * GET /api/v2/risk-score
 *
 * Modernized replacement for the legacy /api/risk-score handler.
 * Behaviour is byte-for-byte equivalent on all nominal and error paths.
 *
 * Compliance
 *   Function : risk-score-v2
 *   Owner    : payments-platform-team
 *   Control  : SI-10 / AU-6
 *   Reviewed : 2026-08-13
 */

'use strict';

var { query, validationResult } = require('express-validator');
var utils       = require('../../utils');
var utilsServer = require('../../utils-server');

var COMPLIANCE_HEADERS = {
	'X-Function' : 'risk-score-v2',
	'X-Owner'    : 'payments-platform-team',
	'X-Control'  : 'SI-10 / AU-6',
	'X-Reviewed' : '2026-08-13'
};

var APPROVAL_LIMIT_CENTS = parseInt(process.env.APPROVAL_LIMIT_CENTS, 10) || 5000000;

/* ------------------------------------------------------------------
 * validation chain
 * ------------------------------------------------------------------ */

var validate = [
	query('ref').optional().isString().trim().isLength({ max: 50 })
];

/* ------------------------------------------------------------------
 * handler
 * ------------------------------------------------------------------ */

function handler(req, res) {
	var errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.set(COMPLIANCE_HEADERS);
		return res.status(400).json({ ERR: 'MISSING_REF' });
	}

	var ref = req.query.ref ? String(req.query.ref).trim() : null;

	if (!ref) {
		res.set(COMPLIANCE_HEADERS);
		return res.status(400).json({ ERR: 'MISSING_REF' });
	}

	var db  = req.app.locals.db;
	var row = db.prepare(
		'SELECT e.*, v.country AS country, v.new_vendor AS new_vendor FROM exceptions e, vendors v ' +
		'WHERE e.vendor_id = v.id AND e.payment_ref = ?'
	).get(ref);

	res.set(COMPLIANCE_HEADERS);

	if (!row) {
		return res.status(404).json({ ERR: 'NOT_FOUND', REF: ref });
	}

	var scored = utilsServer.scoreRow(row);

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
	out.dup_suspect   = (row.reason_code == 'H21') ? 'Y' : 'N';
	out.bank_chg_days = String(row.bank_chg_days);
	out.over_limit    = (row.amount_cents >= APPROVAL_LIMIT_CENTS) ? 'Y' : 'N';
	out.round_amt     = utils.isRoundDollar(row.amount_cents) ? 'Y' : 'N';
	out.new_vend      = row.new_vendor;
	out.model         = 'APRSK01';
	out.retcode       = '0000';

	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify(out));
}

module.exports = { validate: validate, handler: handler };
