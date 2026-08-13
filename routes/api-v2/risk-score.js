/* ---------------------------------------------------------------------------
 * Function: GET /api/v2/risk-score
 * Owner:    payments-platform-team
 * Control:  SI-10 (input validation), AC-3 (data access), AU-6 (risk scoring)
 *           SOX/PCI: PCI Req. 6.5.1 (injection prevention), FFIEC operational risk
 * Reviewed: 2026-08-13
 * ------------------------------------------------------------------------- */

'use strict';

const { Router } = require('express');
const { query, validationResult } = require('express-validator');
const utils = require('../../utils');

const router = Router();

/*
 * scoreRow() — exact copy of server.js:407-516.
 * Copied, not referenced, so the v2 module is self-contained and the
 * equivalence suite can verify the two implementations independently.
 * Any intentional change to risk logic must update BOTH and be documented
 * in PLAN.md as an intended difference.
 */
function scoreRow(row) {
	let score = 0;
	const amt = row.amount_cents;

	if (amt >= 25000000)      { score += 45; }
	else if (amt >= 10000000) { score += 35; }
	else if (amt >= 5000000)  { score += 28; }
	else if (amt >= 1000000)  { score += 18; }
	else if (amt >= 250000)   { score += 10; }
	else                      { score += 4; }

	if (row.ptype === 'WIRE') {
		score += amt >= 5000000 ? 14 : 9;
	} else if (row.ptype === 'SEPA') {
		score += 6;
	} else {
		score += row.channel === 'EDI' ? 5 : 3;
	}

	if (row.country === 'US')      { score += 2; }
	else if (row.country === 'GB') { score += 3; }
	else if (row.country === 'DE') { score += 3; }
	else if (row.country === 'SG') { score += 7; }
	else if (row.country === 'MX') { score += 11; }
	else                           { score += 8; }

	if (row.age_days >= 14)     { score += 16; }
	else if (row.age_days >= 7) { score += 11; }
	else if (row.age_days >= 4) { score += 6; }
	else if (row.age_days >= 2) { score += 2; }

	if (utils.isRoundDollar(amt)) {
		score += amt >= 1000000 ? 9 : 4;
	}

	if (row.bank_chg_days >= 0) {
		if (row.bank_chg_days <= 30)      { score += 14; }
		else if (row.bank_chg_days <= 90) { score += 7; }
		else                              { score += 2; }
	}

	if (row.new_vendor === 'Y') { score += 6; }

	if (row.reason_code === 'H21')      { score += 12; }
	else if (row.reason_code === 'H07') { score += 9; }
	else if (row.reason_code === 'H41') { score += 7; }
	else if (row.reason_code === 'H09') { score += 5; }

	if (row.risk_flag === 'HIGH')     { score += 10; }
	else if (row.risk_flag === 'MED') { score += 4; }

	if (score > 100) { score = 100; }
	if (score < 0)   { score = 0; }

	return { score, band: utils.bandFor(score) };
}

/*
 * GET /api/v2/risk-score?ref=<ref>
 *
 * Equivalent to legacy GET /api/risk-score (server.js:588-625).
 * Field names and value shapes are preserved verbatim.
 * risk_flag field name preserved (not renamed to risk_band) per KAN-37
 * decision recorded 2026-08-13.
 */
router.get('/',
	[
		query('ref').optional().isString().trim().isLength({ max: 40 })
	],
	function (req, res) {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ ERR: 'MISSING_REF' });
		}

		const ref = req.query.ref;
		if (!ref) {
			return res.status(400).json({ ERR: 'MISSING_REF' });
		}

		const db = req.app.locals.db;
		const approvalLimitCents = parseInt(process.env.APPROVAL_LIMIT_CENTS || '5000000', 10);

		const row = db.prepare(
			'SELECT e.*, v.country AS country, v.new_vendor AS new_vendor ' +
			'FROM exceptions e ' +
			'JOIN vendors v ON v.id = e.vendor_id ' +
			'WHERE e.payment_ref = ?'
		).get(ref);

		if (!row) {
			return res.status(404).json({ ERR: 'NOT_FOUND', REF: ref });
		}

		const scored = scoreRow(row);

		/* Field names and order match legacy response exactly (server.js:605-621) */
		const out = {
			REF:          row.payment_ref,
			INV:          row.invoice_no,
			SCORE:        String(scored.score),
			BAND:         scored.band,
			amt_cents:    String(row.amount_cents),
			ccy:          row.currency,
			TYPE:         row.ptype,
			ctry:         row.country,
			age:          String(row.age_days),
			dup_suspect:  row.reason_code === 'H21' ? 'Y' : 'N',
			bank_chg_days: String(row.bank_chg_days),
			over_limit:   row.amount_cents >= approvalLimitCents ? 'Y' : 'N',
			round_amt:    utils.isRoundDollar(row.amount_cents) ? 'Y' : 'N',
			new_vend:     row.new_vendor,
			model:        'APRSK01',
			retcode:      '0000'
		};

		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(out));
	}
);

module.exports = router;
