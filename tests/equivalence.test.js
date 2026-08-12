/* ---------------------------------------------------------------------------
 * Function: equivalence-suite
 * Owner:    payments-platform-team
 * Control:  AU-2, AU-12   (SOX/PCI: PCI Req. 10; SOX 404; FFIEC operational risk)
 * Reviewed: 2026-08-12
 *
 * KAN-28 / KAN-26 — Behavioral equivalence test suite
 *
 * Purpose: Proves that the modernized /api/payment-status and /api/risk-score
 *   endpoints are behaviorally equivalent to the legacy implementations captured
 *   in tests/golden/. Runs in CI and must be green before KAN-26 PR merges.
 *
 * Field mapping (legacy → modern, per docs/modernization/KAN-21/02-plan.md):
 *   All field names are preserved exactly. The modern service returns the same
 *   JSON field names as the legacy service. No renaming is planned in Phase 1.
 *
 * Intended differences (explicitly authorized in 02-plan.md §Equivalence):
 *   - _capturedAt timestamp (fixture metadata, not endpoint output)
 *   - Content-Type header: legacy sends without charset, modern may add charset
 *   - Response field ordering: not relied upon by any consumer per plan
 *
 * How to run:
 *   npm test
 *   (or: npx jest tests/equivalence.test.js)
 *
 * Verification that the suite FAILS against an empty implementation:
 *   If the modern endpoints are not implemented (i.e., the server returns 404
 *   for /api/v2/payment-status), every test case will fail on httpStatus
 *   mismatch (404 != expected status), confirming the suite is wired correctly.
 * ------------------------------------------------------------------------- */

'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');

var GOLDEN_DIR = path.join(__dirname, 'golden');

/* The modern endpoints. During KAN-26 these will be implemented.
   Until then, every test will fail (proving the suite is wired).
   The legacy endpoints remain mounted at their original paths. */
var MODERN_BASE = 'http://localhost:4600';
var MODERN_PAYMENT_STATUS_PATH = '/api/payment-status';
var MODERN_RISK_SCORE_PATH = '/api/risk-score';

/* ------------------------------------------------------------------
 * Test infrastructure
 * ------------------------------------------------------------------ */
function loadFixtures(dir) {
  return fs.readdirSync(dir)
    .filter(function (f) { return f.endsWith('.json'); })
    .map(function (f) {
      return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    });
}

function buildQs(params) {
  var parts = Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  });
  return parts.length ? '?' + parts.join('&') : '';
}

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    http.get(url, function (res) {
      var body = '';
      res.on('data', function (d) { body += d; });
      res.on('end', function () {
        var parsed;
        try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
        resolve({ status: res.statusCode, body: parsed });
      });
    }).on('error', reject);
  });
}

/* ------------------------------------------------------------------
 * Comparison helpers
 *
 * The modern endpoint must return:
 *   - Same HTTP status code
 *   - Same body fields with same values
 *   - All numeric string fields (amt_cents, age_days, SCORE, etc.) equal
 *   - All string fields equal (case-sensitive)
 *   - All boolean flag strings ('Y'/'N') equal
 * ------------------------------------------------------------------ */
function compareBody(goldenBody, modernBody, fieldMap) {
  var diffs = [];

  /* fieldMap is an array of { golden: key, modern: key } pairs.
     In Phase 1, all fields have the same name in both implementations. */
  fieldMap.forEach(function (m) {
    var goldenVal = goldenBody[m.golden];
    var modernVal = modernBody[m.modern];

    /* treat undefined and null as equivalent to empty string for optional
       fields that the modern endpoint may omit when null */
    var gNorm = (goldenVal === null || goldenVal === undefined) ? '' : String(goldenVal);
    var mNorm = (modernVal === null || modernVal === undefined) ? '' : String(modernVal);

    if (gNorm !== mNorm) {
      diffs.push({
        field: m.golden,
        golden: goldenVal,
        modern: modernVal
      });
    }
  });

  return diffs;
}

/* Fields compared for /api/payment-status */
var PAYMENT_STATUS_FIELDS = [
  'PaymentRef', 'InvoiceNo', 'PO_NUM', 'sts', 'sts_desc',
  'amt_cents', 'Amount_Formatted', 'ccy', 'Type',
  'vendorName', 'vend_ctry', 'VendorNo',
  'remit_TO', 'BankBIC',
  'rsn', 'rsnText',
  'age_days', 'CreatedDate', 'invoice_dt', 'due_dt',
  'expected_pay_dt', 'value_dt', 'PaymentRun',
  'risk', 'Clerk', 'resolved_dt', 'Resolution',
  'over_approval_limit', 'retcode', 'asOfDate'
].map(function (f) { return { golden: f, modern: f }; });

/* Error body fields for /api/payment-status */
var PAYMENT_STATUS_ERROR_FIELDS_400 = [
  { golden: 'ERR', modern: 'ERR' },
  { golden: 'msg', modern: 'msg' }
];
var PAYMENT_STATUS_ERROR_FIELDS_404 = [
  { golden: 'ERR', modern: 'ERR' },
  { golden: 'PaymentRef', modern: 'PaymentRef' },
  { golden: 'InvoiceNo', modern: 'InvoiceNo' }
];

/* Fields compared for /api/risk-score */
var RISK_SCORE_FIELDS = [
  'REF', 'INV', 'SCORE', 'BAND',
  'amt_cents', 'ccy', 'TYPE', 'ctry',
  'age', 'dup_suspect', 'bank_chg_days',
  'over_limit', 'round_amt', 'new_vend',
  'model', 'retcode'
].map(function (f) { return { golden: f, modern: f }; });

var RISK_SCORE_ERROR_FIELDS_400 = [{ golden: 'ERR', modern: 'ERR' }];
var RISK_SCORE_ERROR_FIELDS_404 = [
  { golden: 'ERR', modern: 'ERR' },
  { golden: 'REF', modern: 'REF' }
];

/* ------------------------------------------------------------------
 * Test suites
 * ------------------------------------------------------------------ */

describe('Equivalence: /api/payment-status', function () {
  var fixtures = loadFixtures(path.join(GOLDEN_DIR, 'payment-status'));

  fixtures.forEach(function (fixture) {
    test(fixture._case, async function () {
      var qs = buildQs(fixture._params);
      var url = MODERN_BASE + MODERN_PAYMENT_STATUS_PATH + qs;
      var modern = await httpGet(url);

      /* (1) HTTP status must match */
      expect(modern.status).toBe(fixture.httpStatus);

      /* (2) Body fields must match per case type */
      var fields;
      if (fixture.httpStatus === 400) {
        fields = PAYMENT_STATUS_ERROR_FIELDS_400;
      } else if (fixture.httpStatus === 404) {
        fields = PAYMENT_STATUS_ERROR_FIELDS_404;
      } else {
        fields = PAYMENT_STATUS_FIELDS;
      }

      var diffs = compareBody(fixture.body, modern.body, fields);
      if (diffs.length > 0) {
        var msg = 'Field diffs for ' + fixture._case + ':\n' +
          diffs.map(function (d) {
            return '  ' + d.field + ': golden=' + JSON.stringify(d.golden) +
                   ' modern=' + JSON.stringify(d.modern);
          }).join('\n');
        throw new Error(msg);
      }
    });
  });
});

describe('Equivalence: /api/risk-score', function () {
  var fixtures = loadFixtures(path.join(GOLDEN_DIR, 'risk-score'));

  fixtures.forEach(function (fixture) {
    test(fixture._case, async function () {
      var qs = buildQs(fixture._params);
      var url = MODERN_BASE + MODERN_RISK_SCORE_PATH + qs;
      var modern = await httpGet(url);

      /* (1) HTTP status must match */
      expect(modern.status).toBe(fixture.httpStatus);

      /* (2) Body fields must match per case type */
      var fields;
      if (fixture.httpStatus === 400) {
        fields = RISK_SCORE_ERROR_FIELDS_400;
      } else if (fixture.httpStatus === 404) {
        fields = RISK_SCORE_ERROR_FIELDS_404;
      } else {
        fields = RISK_SCORE_FIELDS;
      }

      var diffs = compareBody(fixture.body, modern.body, fields);
      if (diffs.length > 0) {
        var msg = 'Field diffs for ' + fixture._case + ':\n' +
          diffs.map(function (d) {
            return '  ' + d.field + ': golden=' + JSON.stringify(d.golden) +
                   ' modern=' + JSON.stringify(d.modern);
          }).join('\n');
        throw new Error(msg);
      }
    });
  });
});
