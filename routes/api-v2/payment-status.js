/* ---------------------------------------------------------------------------
 * Function: GET /api/v2/payments/:ref  and  GET /api/v2/payments?invoice=
 * Owner:    payments-platform-team
 * Control:  SI-10 (input validation), AC-3 (database access)
 *           SOX/PCI: PCI Req. 6.5.1 (injection), PCI Req. 7 (access), FFIEC operational risk
 * Reviewed: 2026-08-13
 * ---------------------------------------------------------------------------
 *
 * Modern replacement for GET /api/payment-status.
 *
 * Functional equivalence: all response values are semantically identical to
 * the legacy endpoint.  Field names are normalised to camelCase; the mapping
 * is recorded in PLAN.md §Equivalence strategy and excluded from the
 * equivalence comparison.
 *
 * Kept differences (plan-approved, excluded from golden comparison):
 *   legacy                v2
 *   PaymentRef            paymentRef
 *   InvoiceNo             invoiceNo
 *   PO_NUM                poNum
 *   sts                   status
 *   sts_desc              statusDesc
 *   amt_cents             amtCents
 *   Amount_Formatted      amountFormatted
 *   ccy                   currency
 *   Type                  paymentType
 *   vendorName            vendorName          (unchanged)
 *   vend_ctry             vendorCountry
 *   VendorNo              vendorNo
 *   remit_TO              remitTo
 *   BankBIC               bankBic
 *   rsn                   holdCode
 *   rsnText               holdReason
 *   age_days              ageDays
 *   CreatedDate           createdDate
 *   invoice_dt            invoiceDate
 *   due_dt                dueDate
 *   expected_pay_dt       expectedPayDate
 *   value_dt              valueDate
 *   PaymentRun            paymentRunId
 *   risk                  riskFlag
 *   Clerk                 clerkInitials
 *   resolved_dt           resolvedDate
 *   Resolution            resolution          (unchanged)
 *   over_approval_limit   overApprovalLimit
 *   retcode               retcode             (unchanged)
 *   asOfDate              asOfDate            (unchanged)
 * ------------------------------------------------------------------------- */

'use strict';

const express = require('express');
const { param, query, validationResult } = require('express-validator');

const router = express.Router();

const APPROVAL_LIMIT_CENTS = 5000000;
const AS_OF_DATE = process.env.AS_OF_DATE || '2026-08-01';

function statusDescription(status) {
  if (status === 'PENDING')   return 'Awaiting first review';
  if (status === 'REVIEW')    return 'Under review by an AP clerk';
  if (status === 'HOLD')      return 'Held - awaiting vendor or goods receipt';
  if (status === 'ESCALATED') return 'Escalated to AP controls';
  if (status === 'RESOLVED')  return 'Closed - released or returned';
  return 'Unknown';
}

function formatRow(row) {
  return {
    paymentRef:         row.payment_ref,
    invoiceNo:          row.invoice_no,
    poNum:              row.po_no,
    status:             row.status,
    statusDesc:         statusDescription(row.status),
    amtCents:           String(row.amount_cents),
    amountFormatted:    row.amount_formatted,
    currency:           row.currency,
    paymentType:        row.ptype,
    vendorName:         row.vendor,
    vendorCountry:      row.country,
    vendorNo:           row.vendor_no,
    remitTo:            row.remit_to,
    bankBic:            row.bank_bic,
    holdCode:           row.reason_code,
    holdReason:         row.reason_text,
    ageDays:            String(row.age_days),
    createdDate:        row.created_date,
    invoiceDate:        row.invoice_date,
    dueDate:            row.due_date,
    expectedPayDate:    row.expected_pay_date,
    valueDate:          row.value_date,
    paymentRunId:       row.payment_run_id,
    riskFlag:           row.risk_flag,
    clerkInitials:      (row.clerk_initials ? row.clerk_initials : ''),
    resolvedDate:       (row.resolved_date ? row.resolved_date : ''),
    resolution:         (row.resolution ? row.resolution : ''),
    overApprovalLimit:  (row.amount_cents >= APPROVAL_LIMIT_CENTS ? 'Y' : 'N'),
    retcode:            '0000',
    asOfDate:           AS_OF_DATE,
  };
}

/**
 * GET /api/v2/payments/:ref — look up by payment reference.
 * Used by payment_status_lookup (ref path) and payment_risk tools.
 */
router.get(
  '/:ref',
  [
    param('ref')
      .isString()
      .trim()
      .isLength({ min: 1, max: 60 })
      .withMessage('ref must be a non-empty string up to 60 characters'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'INVALID_INPUT', details: errors.array() });
    }

    const ref = req.params.ref;
    const db = req.app.locals.db;

    const row = db.prepare(
      'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
      'k.initials AS clerk_initials, ' +
      'CAST(e.amount_cents AS TEXT) AS amount_formatted_raw ' +
      'FROM exceptions e, vendors v ' +
      'LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
      'WHERE e.vendor_id = v.id AND e.payment_ref = ?'
    ).get(ref);

    if (!row) {
      return res.status(404).json({ error: 'NOT_FOUND', paymentRef: ref, invoiceNo: '' });
    }

    // amount_formatted is computed here so tests can verify it matches legacy
    const utils = require('../../utils');
    row.amount_formatted = utils.money(row.amount_cents);

    return res.json(formatRow(row));
  }
);

/**
 * GET /api/v2/payments — look up by invoice number (query param).
 * Used by payment_status_lookup (invoice path) and payments_search tool.
 */
router.get(
  '/',
  [
    query('invoice')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 60 })
      .withMessage('invoice must be a string up to 60 characters'),
    query('status')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 20 }),
    query('vendor')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 120 }),
    query('q')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 60 }),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .toInt(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'INVALID_INPUT', details: errors.array() });
    }

    const { invoice, status, vendor, q, page } = req.query;
    const db = req.app.locals.db;
    const utils = require('../../utils');

    // Single invoice lookup (mirrors legacy /api/payment-status?invoice=)
    if (invoice) {
      const row = db.prepare(
        'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
        'k.initials AS clerk_initials ' +
        'FROM exceptions e, vendors v ' +
        'LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
        'WHERE e.vendor_id = v.id AND e.invoice_no = ?'
      ).get(invoice);

      if (!row) {
        return res.status(404).json({ error: 'NOT_FOUND', paymentRef: '', invoiceNo: invoice });
      }

      row.amount_formatted = utils.money(row.amount_cents);
      return res.json(formatRow(row));
    }

    // Missing both ref and invoice → 400
    if (!invoice && !status && !vendor && !q) {
      return res.status(400).json({ error: 'MISSING_REF', msg: 'invoice, status, vendor, or q parameter is required' });
    }

    // List / search — used by payments_search tool
    const PAGE_SIZE = 25;
    const pageNo = (page && page >= 1) ? page : 1;
    const offset = (pageNo - 1) * PAGE_SIZE;

    let conditions = 'e.vendor_id = v.id';
    const binds = [];

    if (status && status !== 'ALL') {
      conditions += ' AND e.status = ?';
      binds.push(status);
    } else if (!status) {
      conditions += " AND e.status <> 'RESOLVED'";
    }

    if (vendor) {
      conditions += ' AND v.name LIKE ?';
      binds.push('%' + vendor + '%');
    }

    if (q) {
      conditions += ' AND (e.payment_ref LIKE ? OR v.name LIKE ? OR e.invoice_no LIKE ?)';
      binds.push('%' + q + '%', '%' + q + '%', '%' + q + '%');
    }

    const total = db.prepare(
      'SELECT COUNT(*) AS c FROM exceptions e, vendors v WHERE ' + conditions
    ).get(...binds).c;

    const rows = db.prepare(
      'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
      'k.initials AS clerk_initials ' +
      'FROM exceptions e, vendors v LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
      'WHERE ' + conditions + ' ORDER BY e.age_days DESC, e.id ASC ' +
      'LIMIT ? OFFSET ?'
    ).all(...binds, PAGE_SIZE, offset);

    return res.json({
      total,
      page: pageNo,
      pageSize: PAGE_SIZE,
      results: rows.map((row) => {
        row.amount_formatted = utils.money(row.amount_cents);
        return formatRow(row);
      }),
    });
  }
);

module.exports = router;
