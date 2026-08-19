/* ---------------------------------------------------------------------------
 * Function: Modern AP payments API
 * Owner:    payments-platform-team
 * Control:  AC-3, AC-6, SI-10   (SOX/PCI: SOX 404; PCI Req. 6.5, Req. 7)
 * Reviewed: 2026-08-17
 * ------------------------------------------------------------------------- */
/**
 * payments.js — the /api/v2 payments contract.
 *
 *   GET  /api/v2/payments/:ref                typed payment record
 *   GET  /api/v2/payments?invoice=INV-...     the same record, by invoice
 *   GET  /api/v2/payments?status=&vendor=&q=&page=   paginated list
 *   POST /api/v2/payments/:ref/release        write operation
 *   POST /api/v2/payments/:ref/hold           write operation
 *
 * Read routes require the `inquiry` scope, write routes the `ops` scope. The
 * scope is not checked in the handler: it is mounted on the route, so a route
 * that forgets its scope is visible as a missing middleware in this file rather
 * than as a missing `if` buried in a function.
 *
 * The store is the same SQLite database the console reads: one schema, one set
 * of numbers, which is what makes the equivalence suite meaningful.
 *
 * The legacy field names stay in SQL and stop at the mapper. Everything above
 * `toPayment` speaks the v2 contract only.
 */

'use strict';

const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const { requireScope } = require('../vault/middleware/vault-scope');

const router = express.Router();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'payops.db');
let db;

function database() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

const PAGE_SIZE = 20;
const MAX_QUERY_LENGTH = 120;
const MAX_NOTE_LENGTH = 500;

function boundedText(res, value, name, maxLength) {
  if (value === undefined || value === null || value === '') return '';
  const text = String(value).trim();
  if (text.length > maxLength) {
    res.status(400).json({
      error: 'invalid_request',
      detail: `${name} must be ${maxLength} characters or fewer`,
    });
    return null;
  }
  return text;
}

const boundedQuery = (res, value, name) =>
  boundedText(res, value, name, MAX_QUERY_LENGTH);

/* ------------------------------------------------------------------ *
 * Legacy row -> v2 record                                             *
 * ------------------------------------------------------------------ */

const SELECT = `
  SELECT e.*, v.name AS vendor_name, v.country AS vendor_country
    FROM exceptions e
    JOIN vendors v ON v.id = e.vendor_id
`;

/**
 * Risk as a number and a band. The extract carries a band only (`risk_flag`);
 * the score is derived from the band and the age of the item so the contract
 * can expose the numeric field callers ask for without inventing a second
 * source of truth. Deterministic — the same row always scores the same.
 */
function riskFor(row) {
  const base = { HIGH: 81, MED: 52, LOW: 18 }[row.risk_flag];
  const age = Math.min(Number(row.age_days) || 0, 14);
  return {
    score: Math.min(99, (base === undefined ? 18 : base) + age),
    band: row.risk_flag,
  };
}

/** The v2 payment record. The only place legacy column names are read. */
function toPayment(row) {
  return {
    ref: row.payment_ref,
    invoiceNo: row.invoice_no,
    poNo: row.po_no,
    vendor: { name: row.vendor_name, country: row.vendor_country },
    amount: { value: row.amount_cents / 100, currency: row.currency },
    status: row.status,
    holdReason: row.reason_text,
    dates: {
      invoice: row.invoice_date,
      due: row.due_date,
      expectedPay: row.expected_pay_date,
    },
    risk: riskFor(row),
  };
}

const notFound = (res, what) =>
  res.status(404).json({ error: 'not_found', detail: what });

/* ------------------------------------------------------------------ *
 * Reads                                                               *
 * ------------------------------------------------------------------ */

const byRef = () => database().prepare(`${SELECT} WHERE e.payment_ref = ?`);
const byInvoice = () => database().prepare(`${SELECT} WHERE e.invoice_no = ?`);

/**
 * List, or single-record lookup by invoice.
 *
 * `?invoice=` is a lookup, not a filter: an invoice identifies one payment, and
 * the tool layer's status lookup uses this form. It returns the record itself
 * so a caller holding an invoice number and a caller holding a payment
 * reference parse the same shape.
 */
router.get('/payments', requireScope('inquiry'), (req, res) => {
  const invoice = boundedQuery(res, req.query.invoice, 'invoice');
  const status = boundedQuery(res, req.query.status, 'status');
  const vendor = boundedQuery(res, req.query.vendor, 'vendor');
  const q = boundedQuery(res, req.query.q, 'q');
  if ([invoice, status, vendor, q].includes(null)) return;

  if (invoice) {
    const row = byInvoice().get(String(invoice));
    if (!row) return notFound(res, `No payment for invoice ${invoice}`);
    return res.json(toPayment(row));
  }

  const where = [];
  const args = [];
  if (status) { where.push('e.status = ?'); args.push(String(status).toUpperCase()); }
  if (vendor) { where.push('v.name LIKE ?'); args.push(`%${vendor}%`); }
  if (q) {
    where.push('(e.payment_ref LIKE ? OR e.invoice_no LIKE ? OR e.po_no LIKE ? OR v.name LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const page = Math.max(1, Number(req.query.page) || 1);
  const total = database().prepare(
    `SELECT COUNT(*) AS c FROM exceptions e JOIN vendors v ON v.id = e.vendor_id${clause}`,
  ).get(...args).c;

  const rows = database().prepare(
    `${SELECT}${clause} ORDER BY e.payment_ref LIMIT ? OFFSET ?`,
  ).all(...args, PAGE_SIZE, (page - 1) * PAGE_SIZE);

  res.json({
    page,
    pageSize: PAGE_SIZE,
    total,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    items: rows.map(toPayment),
  });
});

/**
 * The most recently raised held payments, newest first.
 *
 * This is the route a caller with no identifier lands on: someone ringing the AP
 * line about "my latest invoice" knows their own vendor name at best, and often
 * not even that. `?vendor=` narrows by vendor name substring; without it the
 * route answers across the whole held book.
 *
 * Held means the item is still open — anything the extract has not resolved.
 * Ordering is by the date the item was raised, with the payment reference as a
 * tie-break so two items raised on the same day never swap places between two
 * calls: a caller who rings back must hear the same "latest" payment.
 *
 * Mounted above `/payments/:ref` deliberately — otherwise `recent` is read as a
 * payment reference and this route is unreachable.
 */
const recentAll = () => database().prepare(
  `${SELECT} WHERE e.status <> 'RESOLVED'
     ORDER BY e.created_date DESC, e.payment_ref DESC LIMIT ?`,
);
const recentByVendor = () => database().prepare(
  `${SELECT} WHERE e.status <> 'RESOLVED' AND v.name LIKE ?
     ORDER BY e.created_date DESC, e.payment_ref DESC LIMIT ?`,
);

router.get('/payments/recent', requireScope('inquiry'), (req, res) => {
  const vendor = boundedQuery(res, req.query.vendor, 'vendor');
  if (vendor === null) return;
  const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 3));

  const rows = vendor
    ? recentByVendor().all(`%${vendor}%`, limit)
    : recentAll().all(limit);

  res.json({
    vendor: vendor || null,
    count: rows.length,
    items: rows.map(toPayment),
  });
});

router.get('/payments/:ref', requireScope('inquiry'), (req, res) => {
  const ref = boundedQuery(res, req.params.ref, 'ref');
  if (ref === null) return;
  const row = byRef().get(ref);
  if (!row) return notFound(res, `No payment with reference ${ref}`);
  res.json(toPayment(row));
});

/* ------------------------------------------------------------------ *
 * Writes                                                              *
 *                                                                     *
 * These exist so that an identity which must never move money can be   *
 * refused by the same mechanism that lets it read. They are mounted    *
 * with the `ops` scope and are otherwise ordinary handlers.            *
 * ------------------------------------------------------------------ */

const setStatus = () => database().prepare(
  'UPDATE exceptions SET status = ?, reason_text = ?, resolution = ? WHERE payment_ref = ?',
);
const addNote = () => database().prepare(
  'INSERT INTO notes (exception_id, author, note_date, body) VALUES (?, ?, ?, ?)',
);

/** Record the change and who made it, then return the updated record. */
function write(req, res, { status, reasonText, resolution, noteBody }, ref) {
  const row = byRef().get(ref);
  if (!row) return notFound(res, `No payment with reference ${ref}`);

  const actor = (req.vaultIdentity && req.vaultIdentity.identity) || 'unknown';
  setStatus().run(status, reasonText(row), resolution, row.payment_ref);
  addNote().run(row.id, actor, row.value_date, `${noteBody} (by ${actor})`);

  return res.json({ ...toPayment(byRef().get(ref)), actedBy: actor });
}

router.post('/payments/:ref/release', requireScope('ops'), (req, res) => {
  const ref = boundedQuery(res, req.params.ref, 'ref');
  const note = boundedText(res, req.body && req.body.note, 'note', MAX_NOTE_LENGTH);
  if ([ref, note].includes(null)) return;
  return write(req, res, {
    status: 'RELEASED',
    reasonText: (row) => row.reason_text,
    resolution: 'RELEASED_FOR_SETTLEMENT',
    noteBody: `Payment released for settlement. ${note}`.trim(),
  }, ref);
});

router.post('/payments/:ref/hold', requireScope('ops'), (req, res) => {
  const ref = boundedQuery(res, req.params.ref, 'ref');
  const reason = boundedText(res, req.body && req.body.reason, 'reason', MAX_NOTE_LENGTH);
  if ([ref, reason].includes(null)) return;
  return write(req, res, {
    status: 'HOLD',
    reasonText: (row) => reason || row.reason_text,
    resolution: null,
    noteBody: `Payment placed on hold. ${reason}`.trim(),
  }, ref);
});

module.exports = router;
