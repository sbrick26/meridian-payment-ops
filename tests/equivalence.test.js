/* ---------------------------------------------------------------------------
 * Function: Equivalence test suite — payment-status and risk-score
 * Owner:    payments-platform-team
 * Control:  AU-6, SI-4 (FFIEC operational risk — behavioral equivalence)
 *           SOX/PCI: PCI Req. 6.5.1; rule 08 (behavioral equivalence)
 * Reviewed: 2026-08-13
 * ------------------------------------------------------------------------- */

/**
 * equivalence.test.js — KAN-78 behavioral equivalence suite.
 *
 * Runs the same 14-case input matrix against:
 *   - Legacy:  GET /api/payment-status   and GET /api/risk-score
 *   - Modern:  GET /api/v2/payment-status and GET /api/v2/risk-score
 *
 * For each case it asserts:
 *   (a) HTTP status codes are identical
 *   (b) Response body is identical field-by-field
 *   (c) Content-Type header is application/json on both
 *   (d) Modern endpoint does NOT return Deprecation: true
 *   (e) Legacy endpoint DOES return Deprecation: true
 *
 * The comparison is the golden fixture captured from the unmodified legacy
 * handlers (tests/golden/*.json, committed before any code change per rule 08).
 *
 * Zero unexplained differences is the exit criterion. Every case is logged so
 * the PR body can quote the count directly.
 */

'use strict';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

// The test spins up the full app (server.js) so the comparison is end-to-end:
// the same DB, same utils, same middleware — just different route implementations.
// Set the env vars the modernized config reads so the app boots deterministically.
process.env.APPROVAL_LIMIT_CENTS = '5000000';
process.env.AS_OF_DATE           = '2026-08-01';
process.env.ERP_FEED_USER        = 'ERPBATCH01';
process.env.ERP_FEED_KEY         = 'test-key';
process.env.SMTP_HOST            = 'localhost';
process.env.SMTP_USER            = 'svc_payops';
process.env.SMTP_PASS            = 'test-pass';
process.env.AP_DISTRIBUTION_LIST = 'ap-desk@example.com';

const app = require('../server');

const GOLDEN_DIR = path.join(__dirname, 'golden');

function loadGolden(id) {
  return JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, `${id}.json`), 'utf8'));
}

function qs(params) {
  const p = new URLSearchParams(params).toString();
  return p ? `?${p}` : '';
}

/** Deep-equality check: returns array of diff lines or empty if equal. */
function diffObjects(a, b, prefix) {
  const diffs = [];
  const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of allKeys) {
    const aVal = JSON.stringify((a || {})[k]);
    const bVal = JSON.stringify((b || {})[k]);
    if (aVal !== bVal) {
      diffs.push(`  field "${prefix || ''}${k}": legacy=${aVal} modern=${bVal}`);
    }
  }
  return diffs;
}

/* ------------------------------------------------------------------ *
 * payment-status cases                                                 *
 * ------------------------------------------------------------------ */

const PS_CASES = [
  { id: 'ps-01-nominal-ref',        legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    params: { ref: 'MT-2026-08815' } },
  { id: 'ps-02-nominal-invoice',    legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    params: { invoice: 'INV-2026-4403' } },
  { id: 'ps-03-multicurrency',      legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    params: { ref: 'MT-2026-08816' } },
  { id: 'ps-04-resolved',           legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    params: { ref: 'MT-2026-09439' } },
  { id: 'ps-05-invoice-resolved',   legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    params: { invoice: 'INV-2026-5049' } },
  { id: 'ps-06-404-unknown-ref',    legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    params: { ref: 'MT-UNKNOWN-99999' } },
  { id: 'ps-07-404-unknown-invoice',legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    params: { invoice: 'INV-UNKNOWN-99999' } },
  { id: 'ps-08-400-missing',        legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    params: {} },
];

const RS_CASES = [
  { id: 'rs-01-nominal',            legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        params: { ref: 'MT-2026-08815' } },
  { id: 'rs-02-high-risk',          legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        params: { ref: 'MT-2026-08816' } },
  { id: 'rs-03-dup-suspect',        legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        params: { ref: 'MT-2026-08820' } },
  { id: 'rs-04-resolved',           legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        params: { ref: 'MT-2026-09439' } },
  { id: 'rs-05-404-unknown',        legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        params: { ref: 'MT-UNKNOWN-99999' } },
  { id: 'rs-06-400-missing',        legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        params: {} },
];

const ALL_CASES = [...PS_CASES, ...RS_CASES];

describe('KAN-78 equivalence suite', () => {
  describe(`Total cases: ${ALL_CASES.length}`, () => {
    for (const tc of ALL_CASES) {
      // eslint-disable-next-line no-loop-func
      test(`[${tc.id}] status and body identical, Deprecation headers correct`, async () => {
        const golden = loadGolden(tc.id);

        const [legacyRes, modernRes] = await Promise.all([
          request(app).get(tc.legacy + qs(tc.params)),
          request(app).get(tc.modern + qs(tc.params)),
        ]);

        // (a) Both match the golden status code
        expect(legacyRes.status).toBe(golden.result.status);
        expect(modernRes.status).toBe(golden.result.status);

        // (b) Body field-by-field: legacy matches golden, modern matches golden
        const legacyDiffs = diffObjects(legacyRes.body, golden.result.body, '');
        const modernDiffs = diffObjects(modernRes.body, golden.result.body, '');

        if (legacyDiffs.length > 0) {
          throw new Error(`Legacy body differs from golden fixture:\n${legacyDiffs.join('\n')}`);
        }
        if (modernDiffs.length > 0) {
          throw new Error(`Modern body differs from golden fixture (unexplained diff):\n${modernDiffs.join('\n')}`);
        }

        // (c) Content-Type
        expect(legacyRes.headers['content-type']).toMatch(/application\/json/);
        expect(modernRes.headers['content-type']).toMatch(/application\/json/);

        // (d) Legacy carries Deprecation: true
        expect(legacyRes.headers['deprecation']).toBe('true');

        // (e) Modern does NOT carry Deprecation: true
        expect(modernRes.headers['deprecation']).not.toBe('true');
      });
    }
  });
});
