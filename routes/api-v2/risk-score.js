/* ---------------------------------------------------------------------------
 * Function: GET /api/v2/risk-score — vendor enquiry desk risk traffic-light
 * Owner:    payments-platform-team
 * Control:  SI-10 (input validation), AC-3 (data access), AU-6 (operational risk)
 *           SOX/PCI: PCI Req. 6.5.1; FFIEC operational risk
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

function openDb() {
  return new Database(DB_FILE, { readonly: true });
}

/**
 * Ported from COBOL APRSK01. Scoring bands are production — do not change
 * without a governed change request. Identical to scoreRow() in server.js.
 */
function scoreRow(row) {
  var score = 0;
  var amt   = row.amount_cents;

  if      (amt >= 25000000) { score += 45; }
  else if (amt >= 10000000) { score += 35; }
  else if (amt >= 5000000)  { score += 28; }
  else if (amt >= 1000000)  { score += 18; }
  else if (amt >= 250000)   { score += 10; }
  else                      { score +=  4; }

  if (row.ptype === 'WIRE') {
    score += amt >= 5000000 ? 14 : 9;
  } else if (row.ptype === 'SEPA') {
    score += 6;
  } else {
    score += row.channel === 'EDI' ? 5 : 3;
  }

  if      (row.country === 'US') { score += 2; }
  else if (row.country === 'GB') { score += 3; }
  else if (row.country === 'DE') { score += 3; }
  else if (row.country === 'SG') { score += 7; }
  else if (row.country === 'MX') { score += 11; }
  else                           { score += 8; }

  if      (row.age_days >= 14) { score += 16; }
  else if (row.age_days >= 7)  { score += 11; }
  else if (row.age_days >= 4)  { score +=  6; }
  else if (row.age_days >= 2)  { score +=  2; }

  if (utils.isRoundDollar(amt)) {
    score += amt >= 1000000 ? 9 : 4;
  }

  if (row.bank_chg_days >= 0) {
    if      (row.bank_chg_days <= 30) { score += 14; }
    else if (row.bank_chg_days <= 90) { score +=  7; }
    else                              { score +=  2; }
  }

  if (row.new_vendor === 'Y') { score += 6; }

  if      (row.reason_code === 'H21') { score += 12; }
  else if (row.reason_code === 'H07') { score +=  9; }
  else if (row.reason_code === 'H41') { score +=  7; }
  else if (row.reason_code === 'H09') { score +=  5; }

  if      (row.risk_flag === 'HIGH') { score += 10; }
  else if (row.risk_flag === 'MED')  { score +=  4; }

  if (score > 100) { score = 100; }
  if (score < 0)   { score = 0;   }

  return { score: score, band: utils.bandFor(score) };
}

/**
 * GET /api/v2/risk-score?ref=MT-2026-08815
 *
 * Behaviorally identical to the legacy GET /api/risk-score.
 * SQL is parameterized; scoring logic is character-for-character identical.
 */
router.get(
  '/',
  [
    query('ref').notEmpty().isString().trim().isLength({ max: 64 }),
  ],
  function riskScoreHandler(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ERR: 'MISSING_REF' });
    }

    const ref = String(req.query.ref).trim();

    const db = openDb();
    let row;
    try {
      row = db.prepare(
        'SELECT e.*, v.country AS country, v.new_vendor AS new_vendor ' +
        'FROM exceptions e, vendors v ' +
        'WHERE e.vendor_id = v.id AND e.payment_ref = ?'
      ).get(ref);
    } finally {
      db.close();
    }

    if (!row) {
      return res.status(404).json({ ERR: 'NOT_FOUND', REF: ref });
    }

    const scored = scoreRow(row);

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      REF:           row.payment_ref,
      INV:           row.invoice_no,
      SCORE:         String(scored.score),
      BAND:          scored.band,
      amt_cents:     String(row.amount_cents),
      ccy:           row.currency,
      TYPE:          row.ptype,
      ctry:          row.country,
      age:           String(row.age_days),
      dup_suspect:   row.reason_code === 'H21' ? 'Y' : 'N',
      bank_chg_days: String(row.bank_chg_days),
      over_limit:    row.amount_cents >= APPROVAL_LIMIT_CENTS ? 'Y' : 'N',
      round_amt:     utils.isRoundDollar(row.amount_cents) ? 'Y' : 'N',
      new_vend:      row.new_vendor,
      model:         'APRSK01',
      retcode:       '0000',
    });
  }
);

module.exports = router;
