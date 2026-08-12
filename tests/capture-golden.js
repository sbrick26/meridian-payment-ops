/* ---------------------------------------------------------------------------
 * Function: capture-golden
 * Owner:    payments-platform-team
 * Control:  AU-2, AU-12   (SOX/PCI: PCI Req. 10; SOX 404 change management)
 * Reviewed: 2026-08-12
 *
 * KAN-28 — Golden capture script for /api/payment-status and /api/risk-score
 *
 * Purpose: Exercises the LEGACY endpoints across the input matrix and writes
 *   response fixtures to tests/golden/. Must be run BEFORE any server.js edits.
 *   The committed fixtures are the ground truth for the equivalence suite.
 *
 * Usage:
 *   node tests/capture-golden.js
 *
 * The script starts the app internally (does not require a running server) by
 * loading server.js in child process and hitting it via HTTP once it is ready,
 * then shuts it down and writes fixtures.
 * ------------------------------------------------------------------------- */

'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var { execFileSync, spawn } = require('child_process');

var BASE_URL = 'http://localhost:4600';
var GOLDEN_DIR = path.join(__dirname, 'golden');

/* ------------------------------------------------------------------
 * Input matrix
 *
 * Cases cover:
 *   - All seeded status values: PENDING, REVIEW, HOLD, ESCALATED, RESOLVED
 *   - All risk bands: LOW, MED, HIGH
 *   - payment-type variants: WIRE, ACH, SEPA
 *   - Lookup by invoice_no as well as payment_ref
 *   - Well-known hotline invoice INV-2026-4471
 *   - H21 duplicate-suspect reason code (affects risk scoring)
 *   - H07 bank-change reason code
 *   - H41 over-approval-limit reason code
 *   - Bank-change-days <= 30 (payment diversion risk factor)
 *   - Bank-change-days 31-90
 *   - New vendor flag (Y)
 *   - Over approval limit (>= $50,000 = 5,000,000 cents)
 *   - Missing ref parameter (400 error path)
 *   - Non-existent ref (404 error path)
 * ------------------------------------------------------------------ */
var PAYMENT_STATUS_CASES = [
  /* nominal - by payment_ref */
  { id: 'ps-pending-low-ach',    params: { ref: 'MT-2026-08822' } },
  { id: 'ps-pending-med-ach',    params: { ref: 'MT-2026-08832' } },
  { id: 'ps-review-low-wire',    params: { ref: 'MT-2026-08820' } },   /* also new_vendor=Y, H21, small amount */
  { id: 'ps-review-med-sepa',    params: { ref: 'MT-2026-08901' } },
  { id: 'ps-review-high-wire',   params: { ref: 'MT-2026-09123' } },
  { id: 'ps-hold-low-ach',       params: { ref: 'MT-2026-08815' } },   /* H07 bank change */
  { id: 'ps-hold-med-sepa',      params: { ref: 'MT-2026-08863' } },
  { id: 'ps-hold-high-wire',     params: { ref: 'MT-2026-08948' } },   /* over approval limit */
  { id: 'ps-escalated-high-sepa',params: { ref: 'MT-2026-08816' } },   /* H41, large amount EUR */
  { id: 'ps-escalated-low-wire', params: { ref: 'MT-2026-08834' } },   /* bank_chg_days 31-90 */
  { id: 'ps-escalated-med-ach',  params: { ref: 'MT-2026-08987' } },
  { id: 'ps-resolved-low-wire',  params: { ref: 'MT-2026-09439' } },
  { id: 'ps-resolved-med-wire',  params: { ref: 'MT-2026-09443' } },
  { id: 'ps-resolved-high-wire', params: { ref: 'MT-2026-09473' } },
  /* lookup by invoice_no */
  { id: 'ps-by-invoice-hotline', params: { invoice: 'INV-2026-4471' } }, /* well-known AP hotline invoice */
  { id: 'ps-by-invoice-hold',    params: { invoice: 'INV-2026-4403' } },
  /* additional bank-change case */
  { id: 'ps-pending-med-bankchg',params: { ref: 'MT-2026-08839' } },   /* bank_chg_days <= 30 */
  /* error paths */
  { id: 'ps-error-missing-ref',  params: {},                            expectStatus: 400 },
  { id: 'ps-error-not-found-ref',params: { ref: 'MT-DOES-NOT-EXIST' }, expectStatus: 404 },
  { id: 'ps-error-not-found-inv',params: { invoice: 'INV-DOES-NOT-EXIST' }, expectStatus: 404 }
];

var RISK_SCORE_CASES = [
  /* nominal - covers all risk bands */
  { id: 'rs-review-low-wire-h21',  params: { ref: 'MT-2026-08820' } }, /* LOW score, H21, new vendor */
  { id: 'rs-hold-low-ach-h07',     params: { ref: 'MT-2026-08815' } }, /* H07 bank change */
  { id: 'rs-hold-high-wire-h41',   params: { ref: 'MT-2026-08948' } }, /* HIGH, over limit */
  { id: 'rs-escalated-high-sepa',  params: { ref: 'MT-2026-08816' } }, /* HIGH, large EUR, H41 */
  { id: 'rs-review-high-wire',     params: { ref: 'MT-2026-09123' } }, /* HIGH, very large USD */
  { id: 'rs-hold-med-sepa',        params: { ref: 'MT-2026-08863' } }, /* MED */
  { id: 'rs-escalated-med-ach',    params: { ref: 'MT-2026-08987' } }, /* MED */
  { id: 'rs-pending-med-bankchg',  params: { ref: 'MT-2026-08839' } }, /* bank_chg_days <= 30 */
  { id: 'rs-escalated-low-bankmed',params: { ref: 'MT-2026-08834' } }, /* bank_chg_days 31-90 */
  { id: 'rs-review-med-sepa',      params: { ref: 'MT-2026-08901' } }, /* MED, SEPA, H41 */
  /* error paths */
  { id: 'rs-error-missing-ref',    params: {},                           expectStatus: 400 },
  { id: 'rs-error-not-found',      params: { ref: 'MT-DOES-NOT-EXIST' },expectStatus: 404 }
];

/* ------------------------------------------------------------------
 * HTTP helpers
 * ------------------------------------------------------------------ */
function get(urlPath, cb) {
  http.get(BASE_URL + urlPath, function (res) {
    var body = '';
    res.on('data', function (chunk) { body += chunk; });
    res.on('end', function () {
      cb(null, { status: res.statusCode, body: body });
    });
  }).on('error', cb);
}

function buildQs(params) {
  var parts = Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  });
  return parts.length ? '?' + parts.join('&') : '';
}

/* ------------------------------------------------------------------
 * Wait for the server to be ready
 * ------------------------------------------------------------------ */
function waitForServer(maxMs, cb) {
  var start = Date.now();
  function attempt() {
    http.get(BASE_URL + '/', function (res) {
      res.resume();
      cb();
    }).on('error', function () {
      if (Date.now() - start > maxMs) { cb(new Error('Server did not start in time')); return; }
      setTimeout(attempt, 200);
    });
  }
  attempt();
}

/* ------------------------------------------------------------------
 * Main
 * ------------------------------------------------------------------ */
var serverProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
  cwd: path.join(__dirname, '..'),
  env: Object.assign({}, process.env),
  stdio: ['ignore', 'pipe', 'pipe']
});

serverProcess.stdout.on('data', function (d) { process.stdout.write('[server] ' + d); });
serverProcess.stderr.on('data', function (d) { process.stderr.write('[server] ' + d); });

console.log('Waiting for server to start on port 4600...');
waitForServer(15000, function (err) {
  if (err) { console.error('ERROR:', err.message); serverProcess.kill(); process.exit(1); }
  console.log('Server ready. Capturing golden fixtures...');

  var pending = PAYMENT_STATUS_CASES.length + RISK_SCORE_CASES.length;
  var errors = [];

  function done() {
    pending--;
    if (pending === 0) {
      serverProcess.kill();
      if (errors.length > 0) {
        console.error('\nCapture errors:');
        errors.forEach(function (e) { console.error(' -', e); });
        process.exit(1);
      }
      console.log('\nGolden capture complete.');
      console.log('  payment-status cases:', PAYMENT_STATUS_CASES.length);
      console.log('  risk-score cases:    ', RISK_SCORE_CASES.length);
      console.log('  total:               ', PAYMENT_STATUS_CASES.length + RISK_SCORE_CASES.length);
      console.log('Fixtures written to tests/golden/');
    }
  }

  PAYMENT_STATUS_CASES.forEach(function (c) {
    var urlPath = '/api/payment-status' + buildQs(c.params);
    get(urlPath, function (err, resp) {
      if (err) { errors.push(c.id + ': ' + err.message); done(); return; }
      var expectStatus = c.expectStatus || 200;
      if (resp.status !== expectStatus) {
        errors.push(c.id + ': expected HTTP ' + expectStatus + ' got ' + resp.status);
        done(); return;
      }
      var fixture = {
        _case: c.id,
        _endpoint: '/api/payment-status',
        _params: c.params,
        _capturedAt: new Date().toISOString(),
        httpStatus: resp.status,
        body: JSON.parse(resp.body)
      };
      var file = path.join(GOLDEN_DIR, 'payment-status', c.id + '.json');
      fs.writeFileSync(file, JSON.stringify(fixture, null, 2));
      console.log('  captured', c.id, '(' + resp.status + ')');
      done();
    });
  });

  RISK_SCORE_CASES.forEach(function (c) {
    var urlPath = '/api/risk-score' + buildQs(c.params);
    get(urlPath, function (err, resp) {
      if (err) { errors.push(c.id + ': ' + err.message); done(); return; }
      var expectStatus = c.expectStatus || 200;
      if (resp.status !== expectStatus) {
        errors.push(c.id + ': expected HTTP ' + expectStatus + ' got ' + resp.status);
        done(); return;
      }
      var fixture = {
        _case: c.id,
        _endpoint: '/api/risk-score',
        _params: c.params,
        _capturedAt: new Date().toISOString(),
        httpStatus: resp.status,
        body: JSON.parse(resp.body)
      };
      var file = path.join(GOLDEN_DIR, 'risk-score', c.id + '.json');
      fs.writeFileSync(file, JSON.stringify(fixture, null, 2));
      console.log('  captured', c.id, '(' + resp.status + ')');
      done();
    });
  });
});
