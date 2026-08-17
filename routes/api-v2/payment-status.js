/* ---------------------------------------------------------------------------
 * Function: GET /api/v2/payment-status
 * Owner:    payments-platform-team
 * Control:  SI-10, AC-3   (SOX: ITGC change management; PCI-DSS Req. 6.5.1)
 * Reviewed: 2026-08-14
 * ---------------------------------------------------------------------------
 * Replaces the legacy /api/payment-status handler (server.js:525-586).
 * Uses parameterized queries and express-validator input validation.
 * Response shape is IDENTICAL to legacy — zero key renames, zero format
 * changes — preserving compatibility with all downstream consumers.
 * Approved under KAN-84, Swayam Barik, 2026-08-13.
 * ------------------------------------------------------------------------- */

'use strict';

var { query, validationResult } = require('express-validator');
var utils = require('../../utils');

var AS_OF_DATE          = process.env.AS_OF_DATE || '2026-08-01';
var APPROVAL_LIMIT_CENTS = parseInt(process.env.APPROVAL_LIMIT_CENTS || '5000000', 10);

/* status descriptions — verbatim from server.js:statusDescription */
function statusDescription(s) {
	if (s === 'PENDING')   return 'Pending review';
	if (s === 'REVIEW')    return 'Under review';
	if (s === 'HOLD')      return 'Payment held';
	if (s === 'ESCALATED') return 'Escalated for approval';
	if (s === 'RESOLVED')  return 'Resolved';
	return s;
}

var validators = [
	query('ref').optional().isLength({ max: 64 }).trim(),
	query('invoice').optional().isLength({ max: 64 }).trim()
];

function handler(dbOrGetter) {
	return function (req, res) {
		var db = (typeof dbOrGetter === 'function') ? dbOrGetter() : dbOrGetter;
		/* 400 — missing both params */
		var ref     = req.query.ref     || null;
		var invoice = req.query.invoice || null;
		if (!ref && !invoice) {
			return res.status(400).json({
				ERR: 'MISSING_REF',
				msg: 'ref or invoice parameter is required'
			});
		}

		/* validation errors */
		var errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				ERR: 'MISSING_REF',
				msg: 'ref or invoice parameter is required'
			});
		}

		/* parameterized lookup — replaces string-concatenated SQL at server.js:535-544 */
		var row;
		if (ref) {
			row = db.prepare(
				'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
				'k.initials AS clerk_initials FROM exceptions e, vendors v ' +
				'LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
				'WHERE e.vendor_id = v.id AND e.payment_ref = ?'
			).get(ref);
		} else {
			row = db.prepare(
				'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
				'k.initials AS clerk_initials FROM exceptions e, vendors v ' +
				'LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
				'WHERE e.vendor_id = v.id AND e.invoice_no = ?'
			).get(invoice);
		}

		/* 404 — not found */
		if (!row) {
			return res.status(404).json({
				ERR: 'NOT_FOUND',
				PaymentRef: (ref     ? ref     : ''),
				InvoiceNo:  (invoice ? invoice : '')
			});
		}

		/* response assembly — key names and value formats are IDENTICAL to legacy */
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

module.exports = { validators: validators, handler: handler };
