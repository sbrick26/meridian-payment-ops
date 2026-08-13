/* routes/api-v2/payment-status.js
 *
 * GET /api/v2/payment-status
 *
 * Modernized replacement for the legacy /api/payment-status handler.
 * Behaviour is byte-for-byte equivalent on all nominal and error paths;
 * the only intentional differences are:
 *   - parameterized SQL (no string concatenation)
 *   - express-validator input validation
 *   - credentials / limits read from process.env
 *
 * Compliance
 *   Function : payment-status-v2
 *   Owner    : payments-platform-team
 *   Control  : SI-10 (PCI Req. 6.5.1)
 *   Reviewed : 2026-08-13
 */

'use strict';

var { query, validationResult } = require('express-validator');
var utils       = require('../../utils');
var utilsServer = require('../../utils-server');

var COMPLIANCE_HEADERS = {
	'X-Function'  : 'payment-status-v2',
	'X-Owner'     : 'payments-platform-team',
	'X-Control'   : 'SI-10 (PCI Req. 6.5.1)',
	'X-Reviewed'  : '2026-08-13'
};

var APPROVAL_LIMIT_CENTS = parseInt(process.env.APPROVAL_LIMIT_CENTS, 10) || 5000000;
var AS_OF_DATE           = process.env.AS_OF_DATE || '2026-08-01';

/* ------------------------------------------------------------------
 * validation chain
 * ------------------------------------------------------------------ */

var validate = [
	query('ref').optional().isString().trim().isLength({ max: 50 }),
	query('invoice').optional().isString().trim().isLength({ max: 50 })
];

/* ------------------------------------------------------------------
 * handler
 * ------------------------------------------------------------------ */

function handler(req, res) {
	var errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.set(COMPLIANCE_HEADERS);
		return res.status(400).json({ ERR: 'MISSING_REF', msg: 'ref or invoice parameter is required' });
	}

	var ref     = req.query.ref     ? String(req.query.ref).trim()     : null;
	var invoice = req.query.invoice ? String(req.query.invoice).trim() : null;

	if (!ref && !invoice) {
		res.set(COMPLIANCE_HEADERS);
		return res.status(400).json({ ERR: 'MISSING_REF', msg: 'ref or invoice parameter is required' });
	}

	var db  = req.app.locals.db;
	var row = null;

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

	res.set(COMPLIANCE_HEADERS);

	if (!row) {
		return res.status(404).json({
			ERR       : 'NOT_FOUND',
			PaymentRef: ref     ? ref     : '',
			InvoiceNo : invoice ? invoice : ''
		});
	}

	var out = {};
	out.PaymentRef          = row.payment_ref;
	out.InvoiceNo           = row.invoice_no;
	out.PO_NUM              = row.po_no;
	out.sts                 = row.status;
	out.sts_desc            = utilsServer.statusDescription(row.status);
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
	out.Clerk               = row.clerk_initials ? row.clerk_initials : '';
	out.resolved_dt         = row.resolved_date  ? row.resolved_date  : '';
	out.Resolution          = row.resolution     ? row.resolution     : '';
	out.over_approval_limit = (row.amount_cents >= APPROVAL_LIMIT_CENTS) ? 'Y' : 'N';
	out.retcode             = '0000';
	out.asOfDate            = AS_OF_DATE;

	res.setHeader('Content-Type', 'application/json');
	res.send(JSON.stringify(out));
}

module.exports = { validate: validate, handler: handler };
