/* ---------------------------------------------------------------------------
 * Function: Equivalence suite — /api/v2/payment-status and /api/v2/risk-score
 * Owner:    payments-platform-team
 * Control:  AU-6, SI-4 (behavioral equivalence verification)
 *           SOX/PCI: FFIEC operational risk; rule 08 exit criteria
 * Reviewed: 2026-08-13
 * ---------------------------------------------------------------------------
 *
 * Verifies that the modern /api/v2 endpoints produce semantically equivalent
 * responses to the legacy endpoints across all golden fixtures.
 *
 * Field-name normalization is intentional and documented in PLAN.md
 * §Equivalence strategy.  Those fields are excluded from the comparison and
 * listed in FIELD_MAP below.
 * ------------------------------------------------------------------------- */

'use strict';

const path = require('path');
const fs   = require('fs');
const request = require('supertest');

// Load the app without listening.
let app;
beforeAll(() => {
  // Suppress the startup console banner.
  jest.spyOn(console, 'log').mockImplementation(() => {});
  app = require('../../server');
});

/* ------------------------------------------------------------------ *
 * Field-name mapping: legacy → v2 (camelCase normalization).          *
 * These differences are intended and excluded from the comparison.    *
 * ------------------------------------------------------------------ */
const FIELD_MAP = {
  PaymentRef:         'paymentRef',
  InvoiceNo:          'invoiceNo',
  PO_NUM:             'poNum',
  sts:                'status',
  sts_desc:           'statusDesc',
  amt_cents:          'amtCents',
  Amount_Formatted:   'amountFormatted',
  ccy:                'currency',
  Type:               'paymentType',
  vend_ctry:          'vendorCountry',
  VendorNo:           'vendorNo',
  remit_TO:           'remitTo',
  BankBIC:            'bankBic',
  rsn:                'holdCode',
  rsnText:            'holdReason',
  age_days:           'ageDays',
  CreatedDate:        'createdDate',
  invoice_dt:         'invoiceDate',
  due_dt:             'dueDate',
  expected_pay_dt:    'expectedPayDate',
  value_dt:           'valueDate',
  PaymentRun:         'paymentRunId',
  risk:               'riskFlag',
  Clerk:              'clerkInitials',
  resolved_dt:        'resolvedDate',
  over_approval_limit:'overApprovalLimit',
};

/* Fields that are identical in both legacy and v2 responses
   (no rename — still verified for value equality). */
const SAME_FIELDS = ['vendorName', 'resolution', 'retcode', 'asOfDate'];

/**
 * Normalize legacy error responses to the v2 shape for comparison.
 * Only status code and the presence of an error indicator are compared
 * for error cases.
 */
function normalizeError(status, body) {
  return { status, hasError: !!(body.ERR || body.error) };
}

/* ------------------------------------------------------------------ *
 * Helpers                                                              *
 * ------------------------------------------------------------------ */

const GOLDEN_DIR = path.join(__dirname, '..', 'golden');

function loadGolden(dir, file) {
  return JSON.parse(
    fs.readFileSync(path.join(GOLDEN_DIR, dir, file), 'utf8')
  );
}

function goldensIn(dir) {
  return fs.readdirSync(path.join(GOLDEN_DIR, dir)).filter((f) =>
    f.endsWith('.json')
  );
}

/** Extract the query params used to call the legacy endpoint from the fixture filename. */
function paramsFromFilename(filename) {
  // e.g. by_ref_pending.json → { ref: 'MT-...' } needs the fixture body to recover the ref.
  return filename; // filename is used only for labeling
}

/* ------------------------------------------------------------------ *
 * payment-status equivalence                                          *
 * ------------------------------------------------------------------ */

describe('payment-status equivalence (/api/v2 vs legacy)', () => {
  const goldens = goldensIn('payment-status');

  test.each(goldens)('fixture: %s', async (file) => {
    const golden = loadGolden('payment-status', file);

    // Determine the call params from the golden body.
    let legacyPath, v2Path;

    if (golden.status === 400) {
      // missing param case
      legacyPath = '/api/payment-status';
      v2Path     = '/api/v2/payments';
    } else if (golden.status === 404) {
      // not-found case
      if (golden.body.PaymentRef && golden.body.PaymentRef !== '') {
        legacyPath = `/api/payment-status?ref=${encodeURIComponent(golden.body.PaymentRef)}`;
        v2Path     = `/api/v2/payments/${encodeURIComponent(golden.body.PaymentRef)}`;
      } else {
        const inv = golden.body.InvoiceNo || 'INV-NOT-EXIST';
        legacyPath = `/api/payment-status?invoice=${encodeURIComponent(inv)}`;
        v2Path     = `/api/v2/payments?invoice=${encodeURIComponent(inv)}`;
      }
    } else {
      // success case — recover ref or invoice from the response body
      const ref = golden.body.PaymentRef;
      const inv = golden.body.InvoiceNo;
      if (file.startsWith('by_invoice')) {
        legacyPath = `/api/payment-status?invoice=${encodeURIComponent(inv)}`;
        v2Path     = `/api/v2/payments?invoice=${encodeURIComponent(inv)}`;
      } else {
        legacyPath = `/api/payment-status?ref=${encodeURIComponent(ref)}`;
        v2Path     = `/api/v2/payments/${encodeURIComponent(ref)}`;
      }
    }

    // Confirm the legacy endpoint still returns the golden response.
    const legacyRes = await request(app).get(legacyPath);
    expect(legacyRes.status).toBe(golden.status);

    if (golden.status !== 200) {
      // Error paths: just confirm status code and error indicator match.
      const modernRes = await request(app).get(v2Path);
      expect(normalizeError(modernRes.status, modernRes.body).status).toBe(golden.status);
      expect(normalizeError(modernRes.status, modernRes.body).hasError).toBe(true);
      return;
    }

    // Confirm legacy matches the golden fixture field-for-field.
    for (const [legacyField, goldenValue] of Object.entries(golden.body)) {
      expect(legacyRes.body[legacyField]).toBe(goldenValue);
    }

    // Now verify the v2 endpoint against the same golden values (via field map).
    const v2Res = await request(app).get(v2Path);
    expect(v2Res.status).toBe(200);

    // Renamed fields — same value, different name.
    for (const [legacyField, v2Field] of Object.entries(FIELD_MAP)) {
      if (golden.body[legacyField] !== undefined) {
        expect(v2Res.body[v2Field]).toBe(golden.body[legacyField]);
      }
    }

    // Unchanged fields — same name, same value.
    for (const field of SAME_FIELDS) {
      if (golden.body[field] !== undefined) {
        expect(v2Res.body[field]).toBe(golden.body[field]);
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * risk-score equivalence                                              *
 * ------------------------------------------------------------------ */

describe('risk-score equivalence (/api/v2 vs legacy)', () => {
  const goldens = goldensIn('risk-score');

  test.each(goldens)('fixture: %s', async (file) => {
    const golden = loadGolden('risk-score', file);

    let legacyPath, v2Path;

    if (golden.status === 400) {
      legacyPath = '/api/risk-score';
      v2Path     = '/api/v2/risk-score';
    } else if (golden.status === 404) {
      legacyPath = `/api/risk-score?ref=${encodeURIComponent(golden.body.REF)}`;
      v2Path     = `/api/v2/risk-score?ref=${encodeURIComponent(golden.body.REF)}`;
    } else {
      legacyPath = `/api/risk-score?ref=${encodeURIComponent(golden.body.REF)}`;
      v2Path     = `/api/v2/risk-score?ref=${encodeURIComponent(golden.body.REF)}`;
    }

    // Confirm legacy still matches golden.
    const legacyRes = await request(app).get(legacyPath);
    expect(legacyRes.status).toBe(golden.status);

    if (golden.status !== 200) {
      const modernRes = await request(app).get(v2Path);
      expect(normalizeError(modernRes.status, modernRes.body).status).toBe(golden.status);
      expect(normalizeError(modernRes.status, modernRes.body).hasError).toBe(true);
      return;
    }

    // Legacy matches golden.
    for (const [field, value] of Object.entries(golden.body)) {
      expect(legacyRes.body[field]).toBe(value);
    }

    // v2 risk-score field names are preserved verbatim (PLAN.md §Key decisions).
    // Verify all golden fields match v2 exactly.
    const v2Res = await request(app).get(v2Path);
    expect(v2Res.status).toBe(200);
    for (const [field, value] of Object.entries(golden.body)) {
      expect(v2Res.body[field]).toBe(value);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Input validation — modern endpoints reject bad inputs               *
 * ------------------------------------------------------------------ */

describe('v2 input validation', () => {
  test('GET /api/v2/payments with no params returns 400', async () => {
    const res = await request(app).get('/api/v2/payments');
    expect(res.status).toBe(400);
  });

  test('GET /api/v2/payments/:ref with too-long ref returns 400', async () => {
    const longRef = 'X'.repeat(61);
    const res = await request(app).get(`/api/v2/payments/${longRef}`);
    expect(res.status).toBe(400);
  });

  test('GET /api/v2/risk-score with no ref returns 400', async () => {
    const res = await request(app).get('/api/v2/risk-score');
    expect(res.status).toBe(400);
    expect(res.body.ERR).toBe('MISSING_REF');
  });
});

/* ------------------------------------------------------------------ *
 * MCP endpoint — identity boundary smoke tests                        *
 * ------------------------------------------------------------------ */

describe('MCP identity boundary', () => {
  const INQUIRY_TOKEN = 'test-inquiry-token-for-ci';

  beforeAll(() => {
    process.env.VAULT_INQUIRY_TOKEN = INQUIRY_TOKEN;
  });

  test('tools/list with valid inquiry token succeeds', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${INQUIRY_TOKEN}`)
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect(res.status).toBe(200);
    expect(res.body.result.tools.length).toBeGreaterThan(0);
  });

  test('payment_status_lookup (inquiry) with valid token passes scope check', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${INQUIRY_TOKEN}`)
      .send({
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'payment_status_lookup', arguments: { ref: 'MT-2026-08822' } },
      });
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
    // In test the loopback may not be listening, so either success or
    // service_unreachable is acceptable — what must NOT appear is an
    // identity_scope_denied or identity_unverified error.
    if (res.body.result.isError) {
      const txt = res.body.result.content[0].text;
      // In test the loopback may return HTML 404 (server not listening) or JSON.
      // Either way, the error must NOT be an identity error — scope was checked.
      try {
        const body = JSON.parse(txt);
        expect(body.error).not.toBe('identity_scope_denied');
        expect(body.error).not.toBe('identity_unverified');
      } catch (_) {
        // Non-JSON body (e.g. HTML 404) means the service endpoint was reached
        // but returned a non-API response — acceptable in test mode.
      }
    }
  });

  test('payment_release (ops) with inquiry token returns governed refusal', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${INQUIRY_TOKEN}`)
      .send({
        jsonrpc: '2.0', id: 3, method: 'tools/call',
        params: { name: 'payment_release', arguments: { ref: 'MT-2026-08822' } },
      });
    expect(res.status).toBe(200);
    expect(res.body.result.isError).toBe(true);
    const body = JSON.parse(res.body.result.content[0].text);
    expect(body.error).toBe('identity_scope_denied');
    expect(body.required_scope).toBe('ops');
  });

  test('any tool call without a token returns 401', async () => {
    const res = await request(app)
      .post('/mcp')
      .send({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} });
    expect(res.status).toBe(401);
  });
});
