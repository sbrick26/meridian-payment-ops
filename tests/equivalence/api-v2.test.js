/* ---------------------------------------------------------------------------
 * Function: Jest test suite — /api/v2/payment-status and /api/v2/risk-score
 * Owner:    payments-platform-team
 * Control:  AU-6 (audit review), SI-10 (input validation)
 *           SOX/PCI: FFIEC operational risk
 * Reviewed: 2026-08-13
 * ------------------------------------------------------------------------- */

'use strict';

const request  = require('supertest');
const path     = require('path');
const fs       = require('fs');
const Database = require('better-sqlite3');
const express  = require('express');
const { query, validationResult } = require('express-validator');

/* Build a minimal Express app wired to the real DB and v2 routes */
function buildApp() {
	const app = express();
	app.use(express.json());
	const db = new Database(path.join(__dirname, '../../payops.db'));
	app.locals.db = db;
	app.use('/api/v2/payment-status', require('../../routes/api-v2/payment-status'));
	app.use('/api/v2/risk-score',     require('../../routes/api-v2/risk-score'));
	return app;
}

const app = buildApp();

/* Load golden fixtures to drive the equivalence assertions */
function loadGolden(endpoint) {
	const dir = path.join(__dirname, '../golden', endpoint);
	return fs.readdirSync(dir)
		.filter(f => f.endsWith('.json'))
		.map(f => ({
			name: f.replace('.json', ''),
			fixture: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
		}));
}

const PATH_MAP = {
	'/api/payment-status': '/api/v2/payment-status',
	'/api/risk-score':     '/api/v2/risk-score'
};

function v2Path(legacyPath) {
	for (const [leg, v2] of Object.entries(PATH_MAP)) {
		if (legacyPath.startsWith(leg)) return legacyPath.replace(leg, v2);
	}
	throw new Error('No v2 mapping for ' + legacyPath);
}

/* ---- payment-status golden equivalence ---- */
describe('GET /api/v2/payment-status — equivalence', () => {
	const cases = loadGolden('payment-status');

	test.each(cases)('$name matches golden fixture', async ({ fixture }) => {
		const qs = fixture.input.split('?')[1] || '';
		const res = await request(app).get('/api/v2/payment-status?' + qs);
		expect(res.status).toBe(fixture.status);
		const goldenBody = JSON.parse(fixture.body);
		expect(res.body).toEqual(goldenBody);
	});
});

/* ---- risk-score golden equivalence ---- */
describe('GET /api/v2/risk-score — equivalence', () => {
	const cases = loadGolden('risk-score');

	test.each(cases)('$name matches golden fixture', async ({ fixture }) => {
		const qs = fixture.input.split('?')[1] || '';
		const res = await request(app).get('/api/v2/risk-score?' + qs);
		expect(res.status).toBe(fixture.status);
		const goldenBody = JSON.parse(fixture.body);
		expect(res.body).toEqual(goldenBody);
	});
});

/* ---- input validation ---- */
describe('GET /api/v2/payment-status — validation', () => {
	test('missing both params → 400 with ERR:MISSING_REF', async () => {
		const res = await request(app).get('/api/v2/payment-status');
		expect(res.status).toBe(400);
		expect(res.body.ERR).toBe('MISSING_REF');
	});

	test('unknown ref → 404 with ERR:NOT_FOUND', async () => {
		const res = await request(app).get('/api/v2/payment-status?ref=MT-UNKNOWN-00000');
		expect(res.status).toBe(404);
		expect(res.body.ERR).toBe('NOT_FOUND');
	});

	test('unknown invoice → 404 with ERR:NOT_FOUND', async () => {
		const res = await request(app).get('/api/v2/payment-status?invoice=INV-UNKNOWN-00000');
		expect(res.status).toBe(404);
		expect(res.body.ERR).toBe('NOT_FOUND');
	});

	test('ref takes priority over invoice when both supplied', async () => {
		/* If ref resolves, that result is used regardless of invoice param */
		const res = await request(app).get('/api/v2/payment-status?ref=MT-2026-09328&invoice=INV-UNKNOWN');
		expect(res.status).toBe(200);
		expect(res.body.PaymentRef).toBe('MT-2026-09328');
	});
});

describe('GET /api/v2/risk-score — validation', () => {
	test('missing ref → 400 with ERR:MISSING_REF', async () => {
		const res = await request(app).get('/api/v2/risk-score');
		expect(res.status).toBe(400);
		expect(res.body.ERR).toBe('MISSING_REF');
	});

	test('unknown ref → 404 with ERR:NOT_FOUND', async () => {
		const res = await request(app).get('/api/v2/risk-score?ref=MT-UNKNOWN-00000');
		expect(res.status).toBe(404);
		expect(res.body.ERR).toBe('NOT_FOUND');
	});
});

/* ---- response shape sanity ---- */
describe('GET /api/v2/payment-status — response shape', () => {
	test('200 response contains all required fields', async () => {
		const res = await request(app).get('/api/v2/payment-status?ref=MT-2026-09328');
		expect(res.status).toBe(200);
		const required = ['PaymentRef','InvoiceNo','PO_NUM','sts','sts_desc',
			'amt_cents','Amount_Formatted','ccy','Type','vendorName','vend_ctry',
			'VendorNo','remit_TO','BankBIC','rsn','rsnText','age_days',
			'CreatedDate','invoice_dt','due_dt','expected_pay_dt','value_dt',
			'PaymentRun','risk','Clerk','resolved_dt','Resolution',
			'over_approval_limit','retcode','asOfDate'];
		for (const f of required) {
			expect(res.body).toHaveProperty(f);
		}
	});
});

describe('GET /api/v2/risk-score — response shape', () => {
	test('200 response contains all required fields', async () => {
		const res = await request(app).get('/api/v2/risk-score?ref=MT-2026-09328');
		expect(res.status).toBe(200);
		const required = ['REF','INV','SCORE','BAND','amt_cents','ccy','TYPE',
			'ctry','age','dup_suspect','bank_chg_days','over_limit','round_amt',
			'new_vend','model','retcode'];
		for (const f of required) {
			expect(res.body).toHaveProperty(f);
		}
	});

	test('model field is always APRSK01', async () => {
		const res = await request(app).get('/api/v2/risk-score?ref=MT-2026-09328');
		expect(res.body.model).toBe('APRSK01');
	});

	test('retcode is always 0000 on success', async () => {
		const res = await request(app).get('/api/v2/risk-score?ref=MT-2026-09328');
		expect(res.body.retcode).toBe('0000');
	});
});
