/* ---------------------------------------------------------------------------
 * Function: GET /api/v2/payment-status — vendor payment enquiry (ref or invoice)
 * Owner:    payments-platform-team
 * Control:  SI-10 (input validation), AC-3 (data access), AU-2 (audit)
 *           SOX/PCI: PCI Req. 6.5.1 (injection prevention); PCI Req. 7
 * Reviewed: 2026-08-13
 * ------------------------------------------------------------------------- */

'use strict';

const express = require('express');
const { query, validationResult } = require('express-validator');
const Database = require('better-sqlite3');
const path = require('path');
const utils = require('../../utils');

const router = express.Router();

const DB_FILE = path.join(__dirname, '../../payops.db');
const APPROVAL_LIMIT_CENTS = Number(process.env.APPROVAL_LIMIT_CENTS || 5000000);
const AS_OF_DATE = process.env.AS_OF_DATE || '2026-08-01';

function openDb() {
  return new Database(DB_FILE, { readonly: true });
}

function statusDescription(status) {
  if (status === 'PENDING')   return 'Awaiting first review';
  if (status === 'REVIEW')    return 'Under review by an AP clerk';
  if (status === 'HOLD')      return 'Held - awaiting vendor or goods receipt';
  if (status === 'ESCALATED') return 'Escalated to AP controls';
  if (status === 'RESOLVED')  return 'Closed - released or returned';
  return 'Unknown';
}

/**
 * GET /api/v2/payment-status?ref=MT-2026-08815
 * GET /api/v2/payment-status?invoice=INV-2026-4403
 *
 * Behaviorally identical to the legacy GET /api/payment-status.
 * SQL is parameterized; no string concatenation.
 */
router.get(
  '/',
  [
    query('ref').optional().isString().trim().isLength({ max: 64 }),
    query('invoice').optional().isString().trim().isLength({ max: 64 }),
  ],
  function paymentStatusHandler(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ERR: 'MISSING_REF', msg: 'ref or invoice parameter is required' });
    }

    const ref     = req.query.ref     ? String(req.query.ref).trim()     : null;
    const invoice = req.query.invoice ? String(req.query.invoice).trim() : null;

    if (!ref && !invoice) {
      return res.status(400).json({ ERR: 'MISSING_REF', msg: 'ref or invoice parameter is required' });
    }

    const db = openDb();
    let row;
    try {
      if (ref) {
        row = db.prepare(
          'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
          'k.initials AS clerk_initials ' +
          'FROM exceptions e, vendors v ' +
          'LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
          'WHERE e.vendor_id = v.id AND e.payment_ref = ?'
        ).get(ref);
      } else {
        row = db.prepare(
          'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
          'k.initials AS clerk_initials ' +
          'FROM exceptions e, vendors v ' +
          'LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
          'WHERE e.vendor_id = v.id AND e.invoice_no = ?'
        ).get(invoice);
      }
    } finally {
      db.close();
    }

    if (!row) {
      return res.status(404).json({
        ERR: 'NOT_FOUND',
        PaymentRef: ref    || '',
        InvoiceNo:  invoice || '',
      });
    }

    res.setHeader('Deprecation', 'false'); // this IS the modern endpoint
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
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
      resolved_dt:          row.resolved_date  || '',
      Resolution:           row.resolution     || '',
      over_approval_limit:  row.amount_cents >= APPROVAL_LIMIT_CENTS ? 'Y' : 'N',
      retcode:              '0000',
      asOfDate:             AS_OF_DATE,
    });
  }
);

module.exports = router;
