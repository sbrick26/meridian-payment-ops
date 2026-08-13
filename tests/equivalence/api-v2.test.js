/* tests/equivalence/api-v2.test.js
 *
 * Equivalence suite for /api/v2/payment-status and /api/v2/risk-score.
 *
 * For every golden fixture in tests/golden/:
 *   1. Load the golden JSON captured from the legacy endpoint.
 *   2. Call the v2 endpoint with the same query params (via supertest).
 *   3. Assert every field in the golden response matches the v2 response.
 *
 * The suite deliberately FAILS against an empty v2 implementation —
 * at least `retcode` must be present for nominal cases.
 *
 * Run:
 *   npx jest tests/equivalence/api-v2.test.js
 */

'use strict';

var path       = require('path');
var fs         = require('fs');
var request    = require('supertest');
var { app }    = require('../../server');

/* ------------------------------------------------------------------
 * helpers
 * ------------------------------------------------------------------ */

function goldenDir(endpoint) {
	return path.join(__dirname, '..', 'golden', endpoint);
}

/* derive the query string from the fixture filename */
function qsFromFile(filename) {
	var base = path.basename(filename, '.json');

	if (base === 'missing-param') { return ''; }
	if (base === 'not-found')     { return '?ref=NOT-EXIST-999'; }

	/* ref-MT-2026-08815 → ?ref=MT-2026-08815 */
	if (base.startsWith('ref-'))     { return '?ref='     + base.slice(4); }
	/* invoice-INV-2026-4403 → ?invoice=INV-2026-4403 */
	if (base.startsWith('invoice-')) { return '?invoice=' + base.slice(8); }

	throw new Error('Cannot derive query string from fixture filename: ' + filename);
}

/* ------------------------------------------------------------------
 * payment-status equivalence
 * ------------------------------------------------------------------ */

describe('GET /api/v2/payment-status — golden equivalence', function () {
	var dir = goldenDir('payment-status');
	var files = fs.readdirSync(dir).filter(function (f) { return f.endsWith('.json'); });

	test('at least 15 golden fixtures exist', function () {
		expect(files.length).toBeGreaterThanOrEqual(15);
	});

	files.forEach(function (file) {
		var golden = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
		var qs     = qsFromFile(file);

		test('payment-status: ' + file, async function () {
			var res = await request(app).get('/api/v2/payment-status' + qs);

			/* status code must match */
			var expectedStatus = 200;
			if (golden.ERR === 'MISSING_REF') { expectedStatus = 400; }
			if (golden.ERR === 'NOT_FOUND')   { expectedStatus = 404; }
			expect(res.status).toBe(expectedStatus);

			/* every field in the golden must exist in v2 with the same value */
			var v2 = res.body;
			Object.keys(golden).forEach(function (key) {
				expect(v2).toHaveProperty(key);
				expect(v2[key]).toEqual(golden[key]);
			});
		});
	});
});

/* ------------------------------------------------------------------
 * risk-score equivalence
 * ------------------------------------------------------------------ */

describe('GET /api/v2/risk-score — golden equivalence', function () {
	var dir = goldenDir('risk-score');
	var files = fs.readdirSync(dir).filter(function (f) { return f.endsWith('.json'); });

	test('at least 15 golden fixtures exist', function () {
		expect(files.length).toBeGreaterThanOrEqual(15);
	});

	files.forEach(function (file) {
		var golden = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
		var qs     = qsFromFile(file);

		test('risk-score: ' + file, async function () {
			var res = await request(app).get('/api/v2/risk-score' + qs);

			var expectedStatus = 200;
			if (golden.ERR === 'MISSING_REF') { expectedStatus = 400; }
			if (golden.ERR === 'NOT_FOUND')   { expectedStatus = 404; }
			expect(res.status).toBe(expectedStatus);

			var v2 = res.body;
			Object.keys(golden).forEach(function (key) {
				expect(v2).toHaveProperty(key);
				expect(v2[key]).toEqual(golden[key]);
			});
		});
	});
});

/* ------------------------------------------------------------------
 * input validation — independent of golden fixtures
 * ------------------------------------------------------------------ */

describe('GET /api/v2/payment-status — input validation', function () {
	test('missing both ref and invoice → 400', async function () {
		var res = await request(app).get('/api/v2/payment-status');
		expect(res.status).toBe(400);
		expect(res.body.ERR).toBe('MISSING_REF');
	});

	test('non-existent ref → 404', async function () {
		var res = await request(app).get('/api/v2/payment-status?ref=NOT-EXIST-999');
		expect(res.status).toBe(404);
		expect(res.body.ERR).toBe('NOT_FOUND');
	});

	test('nominal ref → retcode 0000', async function () {
		var res = await request(app).get('/api/v2/payment-status?ref=MT-2026-08815');
		expect(res.status).toBe(200);
		expect(res.body.retcode).toBe('0000');
	});
});

describe('GET /api/v2/risk-score — input validation', function () {
	test('missing ref → 400', async function () {
		var res = await request(app).get('/api/v2/risk-score');
		expect(res.status).toBe(400);
		expect(res.body.ERR).toBe('MISSING_REF');
	});

	test('non-existent ref → 404', async function () {
		var res = await request(app).get('/api/v2/risk-score?ref=NOT-EXIST-999');
		expect(res.status).toBe(404);
		expect(res.body.ERR).toBe('NOT_FOUND');
	});

	test('nominal ref → retcode 0000', async function () {
		var res = await request(app).get('/api/v2/risk-score?ref=MT-2026-08815');
		expect(res.status).toBe(200);
		expect(res.body.retcode).toBe('0000');
	});
});
