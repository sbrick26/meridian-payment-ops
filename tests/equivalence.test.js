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
 * Rewritten on Node built-in test runner (node:test + node:assert) after
 * guardrail finding 04-approved-libraries: jest and supertest pull unapproved
 * transitive packages. Both devDependencies removed from package.json.
 *
 * Runs the same 14-case input matrix against:
 *   Legacy:  GET /api/payment-status   and GET /api/risk-score
 *   Modern:  GET /api/v2/payment-status and GET /api/v2/risk-score
 *
 * For each case asserts:
 *   (a) HTTP status codes identical
 *   (b) Response body identical field-by-field
 *   (c) Content-Type application/json on both
 *   (d) Legacy endpoint carries Deprecation: true
 *   (e) Modern endpoint does NOT carry Deprecation: true
 *
 * Run: node --test tests/equivalence.test.js
 * npm test script: node --test tests/equivalence.test.js
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');
const path   = require('node:path');
const fs     = require('node:fs');

// Set env vars before requiring server so the modernized config reads correctly.
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

/** Make an HTTP GET against the test server and resolve with { status, headers, body }. */
function get(server, pathname) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const opts = { hostname: '127.0.0.1', port: addr.port, path: pathname, method: 'GET' };
    const req  = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw  = Buffer.concat(chunks).toString('utf8');
        let body;
        try { body = JSON.parse(raw); } catch { body = raw; }
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/** Deep diff: returns array of human-readable lines for each mismatch. */
function diffObjects(a, b) {
  const diffs = [];
  const keys  = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const av = JSON.stringify((a || {})[k]);
    const bv = JSON.stringify((b || {})[k]);
    if (av !== bv) diffs.push(`  "${k}": was ${av}, got ${bv}`);
  }
  return diffs;
}

const ALL_CASES = [
  { id: 'ps-01-nominal-ref',         legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    qs: 'ref=MT-2026-08815' },
  { id: 'ps-02-nominal-invoice',     legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    qs: 'invoice=INV-2026-4403' },
  { id: 'ps-03-multicurrency',       legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    qs: 'ref=MT-2026-08816' },
  { id: 'ps-04-resolved',            legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    qs: 'ref=MT-2026-09439' },
  { id: 'ps-05-invoice-resolved',    legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    qs: 'invoice=INV-2026-5049' },
  { id: 'ps-06-404-unknown-ref',     legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    qs: 'ref=MT-UNKNOWN-99999' },
  { id: 'ps-07-404-unknown-invoice', legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    qs: 'invoice=INV-UNKNOWN-99999' },
  { id: 'ps-08-400-missing',         legacy: '/api/payment-status',    modern: '/api/v2/payment-status',    qs: '' },
  { id: 'rs-01-nominal',             legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        qs: 'ref=MT-2026-08815' },
  { id: 'rs-02-high-risk',           legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        qs: 'ref=MT-2026-08816' },
  { id: 'rs-03-dup-suspect',         legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        qs: 'ref=MT-2026-08820' },
  { id: 'rs-04-resolved',            legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        qs: 'ref=MT-2026-09439' },
  { id: 'rs-05-404-unknown',         legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        qs: 'ref=MT-UNKNOWN-99999' },
  { id: 'rs-06-400-missing',         legacy: '/api/risk-score',        modern: '/api/v2/risk-score',        qs: '' },
];

describe('KAN-78 equivalence suite', () => {
  let server;

  before(() => new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', resolve);
  }));

  after(() => new Promise((resolve) => server.close(resolve)));

  for (const tc of ALL_CASES) {
    test(`[${tc.id}] status and body identical, Deprecation headers correct`, async () => {
      const golden   = loadGolden(tc.id);
      const legacyQ  = tc.qs ? `${tc.legacy}?${tc.qs}` : tc.legacy;
      const modernQ  = tc.qs ? `${tc.modern}?${tc.qs}` : tc.modern;

      const [legacyRes, modernRes] = await Promise.all([
        get(server, legacyQ),
        get(server, modernQ),
      ]);

      // (a) Both match golden status
      assert.equal(legacyRes.status, golden.result.status,
        `legacy status: expected ${golden.result.status}, got ${legacyRes.status}`);
      assert.equal(modernRes.status, golden.result.status,
        `modern status: expected ${golden.result.status}, got ${modernRes.status}`);

      // (b) Body field-for-field against golden fixture
      const legacyDiffs = diffObjects(legacyRes.body, golden.result.body);
      const modernDiffs = diffObjects(modernRes.body, golden.result.body);

      assert.equal(legacyDiffs.length, 0,
        `Legacy body differs from golden:\n${legacyDiffs.join('\n')}`);
      assert.equal(modernDiffs.length, 0,
        `Modern body differs from golden (unexplained diff):\n${modernDiffs.join('\n')}`);

      // (c) Content-Type
      assert.match(legacyRes.headers['content-type'] || '', /application\/json/,
        'legacy Content-Type must be application/json');
      assert.match(modernRes.headers['content-type'] || '', /application\/json/,
        'modern Content-Type must be application/json');

      // (d) Legacy carries Deprecation: true
      assert.equal(legacyRes.headers['deprecation'], 'true',
        'legacy endpoint must carry Deprecation: true header');

      // (e) Modern does NOT carry Deprecation: true
      assert.notEqual(modernRes.headers['deprecation'], 'true',
        'modern endpoint must NOT carry Deprecation: true header');
    });
  }
});
