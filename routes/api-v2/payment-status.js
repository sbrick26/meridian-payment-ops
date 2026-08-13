/* ---------------------------------------------------------------------------
 * Function: GET /api/v2/payment-status
 * Owner:    payments-platform-team
 * Control:  SI-10 (input validation), AC-3 (data access), AU-2 (audit)
 *           SOX/PCI: PCI Req. 6.5.1 (injection prevention), PCI Req. 7
 * Reviewed: 2026-08-13
 * ------------------------------------------------------------------------- */

'use strict';

const { Router } = require('express');
const { query, validationResult } = require('express-validator');
const utils = require('../../utils');

const router = Router();

/* Status descriptions match legacy statusDescription() in server.js:676 */
function statusDescription(status) {
	if (status === 'PENDING')   { return 'Awaiting first review'; }
	if (status === 'REVIEW')    { return 'Under review by an AP clerk'; }
	if (status === 'HOLD')      { return 'Held - awaiting vendor or goods receipt'; }
	if (status === 'ESCALATED') { return 'Escalated to AP controls'; }
	if (status === 'RESOLVED')  { return 'Closed - released or returned'; }
	return 'Unknown';
}

/*
 * GET /api/v2/payment-status?ref=<ref>
 * GET /api/v2/payment-status?invoice=<invoice>
 *
 * Equivalent to legacy GET /api/payment-status (server.js:525-586).
 * Field names and value shapes are preserved verbatim.
 * Intended difference from legacy: dates are already stored as ISO-8601
 * strings in SQLite; the v2 route surfaces them unchanged, same as legacy.
 */
router.get('/',
	[
		query('ref').optional().isString().trim().isLength({ max: 40 }),
		query('invoice').optional().isString().trim().isLength({ max: 40 })
	],
	function (req, res) {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ ERR: 'MISSING_REF', msg: 'ref or invoice parameter is required' });
		}

		const ref = req.query.ref;
		const invoice = req.query.invoice;

		if (!ref && !invoice) {
			return res.status(400).json({ ERR: 'MISSING_REF', msg: 'ref or invoice parameter is required' });
		}

		const db = req.app.locals.db;
		const approvalLimitCents = parseInt(process.env.APPROVAL_LIMIT_CENTS || '5000000', 10);
		const asOfDate = process.env.AS_OF_DATE || '2026-08-01';

		let row;
		if (ref) {
			row = db.prepare(
				'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
				'k.initials AS clerk_initials FROM exceptions e ' +
				'JOIN vendors v ON v.id = e.vendor_id ' +
				'LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
				'WHERE e.payment_ref = ?'
			).get(ref);
		} else {
			row = db.prepare(
				'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
				'k.initials AS clerk_initials FROM exceptions e ' +
				'JOIN vendors v ON v.id = e.vendor_id ' +
				'LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
				'WHERE e.invoice_no = ?'
			).get(invoice);
		}

		if (!row) {
			return res.status(404).json({
				ERR: 'NOT_FOUND',
				PaymentRef: ref || '',
				InvoiceNo: invoice || ''
			});
		}

		/* Field names and order match legacy response exactly (server.js:552-582) */
		const out = {
			PaymentRef:           row.payment_ref,
			InvoiceNo:            row.invoice_no,
			PO_NUM:               row.po_no,
			sts:                  row.status,
			sts_desc:             statusDescription(row.status),
			amt_cents:            String(row.amount_cents),
			Amount_Formatted:     utils.money(row.amount_cents),
			ccy:                  row.currency,
			Type:                 row.ptype,
			vendorName:           row.vendor,
			vend_ctry:            row.country,
			VendorNo:             row.vendor_no,
			remit_TO:             row.remit_to,
			BankBIC:              row.bank_bic,
			rsn:                  row.reason_code,
			rsnText:              row.reason_text,
			age_days:             String(row.age_days),
			CreatedDate:          row.created_date,
			invoice_dt:           row.invoice_date,
			due_dt:               row.due_date,
			expected_pay_dt:      row.expected_pay_date,
			value_dt:             row.value_date,
			PaymentRun:           row.payment_run_id,
			risk:                 row.risk_flag,
			Clerk:                row.clerk_initials || '',
			resolved_dt:          row.resolved_date || '',
			Resolution:           row.resolution || '',
			over_approval_limit:  row.amount_cents >= approvalLimitCents ? 'Y' : 'N',
			retcode:              '0000',
			asOfDate:             asOfDate
		};

		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(out));
	}
);

module.exports = router;
