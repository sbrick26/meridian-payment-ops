/* tests/golden/capture.js
 *
 * Golden fixture capture script for /api/payment-status and /api/risk-score.
 *
 * Run ONCE against the LEGACY server before any v2 changes:
 *   node tests/golden/capture.js
 *
 * Requires the legacy server to be running on localhost:4600.
 * Writes JSON files to tests/golden/payment-status/ and tests/golden/risk-score/.
 * This script is documentation / reproducibility — the fixtures already
 * exist in the repo (captured 2026-08-13).
 */

'use strict';

var http = require('http');
var fs   = require('fs');
var path = require('path');

var BASE = 'http://localhost:4600';

var PAYMENT_STATUS_CASES = [
	/* 10 real payment refs */
	{ file: 'ref-MT-2026-08815.json', qs: '?ref=MT-2026-08815' },
	{ file: 'ref-MT-2026-08816.json', qs: '?ref=MT-2026-08816' },
	{ file: 'ref-MT-2026-08820.json', qs: '?ref=MT-2026-08820' },
	{ file: 'ref-MT-2026-08822.json', qs: '?ref=MT-2026-08822' },
	{ file: 'ref-MT-2026-08823.json', qs: '?ref=MT-2026-08823' },
	{ file: 'ref-MT-2026-08826.json', qs: '?ref=MT-2026-08826' },
	{ file: 'ref-MT-2026-08830.json', qs: '?ref=MT-2026-08830' },
	{ file: 'ref-MT-2026-08832.json', qs: '?ref=MT-2026-08832' },
	{ file: 'ref-MT-2026-08834.json', qs: '?ref=MT-2026-08834' },
	{ file: 'ref-MT-2026-08838.json', qs: '?ref=MT-2026-08838' },
	/* 5 invoice lookups */
	{ file: 'invoice-INV-2026-4403.json', qs: '?invoice=INV-2026-4403' },
	{ file: 'invoice-INV-2026-4405.json', qs: '?invoice=INV-2026-4405' },
	{ file: 'invoice-INV-2026-4407.json', qs: '?invoice=INV-2026-4407' },
	{ file: 'invoice-INV-2026-4411.json', qs: '?invoice=INV-2026-4411' },
	{ file: 'invoice-INV-2026-4414.json', qs: '?invoice=INV-2026-4414' },
	/* edge cases */
	{ file: 'not-found.json',    qs: '?ref=NOT-EXIST-999' },
	{ file: 'missing-param.json', qs: '' }
];

var RISK_SCORE_CASES = [
	/* 15 real payment refs */
	{ file: 'ref-MT-2026-08815.json', qs: '?ref=MT-2026-08815' },
	{ file: 'ref-MT-2026-08816.json', qs: '?ref=MT-2026-08816' },
	{ file: 'ref-MT-2026-08820.json', qs: '?ref=MT-2026-08820' },
	{ file: 'ref-MT-2026-08822.json', qs: '?ref=MT-2026-08822' },
	{ file: 'ref-MT-2026-08823.json', qs: '?ref=MT-2026-08823' },
	{ file: 'ref-MT-2026-08826.json', qs: '?ref=MT-2026-08826' },
	{ file: 'ref-MT-2026-08830.json', qs: '?ref=MT-2026-08830' },
	{ file: 'ref-MT-2026-08832.json', qs: '?ref=MT-2026-08832' },
	{ file: 'ref-MT-2026-08834.json', qs: '?ref=MT-2026-08834' },
	{ file: 'ref-MT-2026-08838.json', qs: '?ref=MT-2026-08838' },
	{ file: 'ref-MT-2026-08839.json', qs: '?ref=MT-2026-08839' },
	{ file: 'ref-MT-2026-08843.json', qs: '?ref=MT-2026-08843' },
	{ file: 'ref-MT-2026-08844.json', qs: '?ref=MT-2026-08844' },
	{ file: 'ref-MT-2026-08848.json', qs: '?ref=MT-2026-08848' },
	{ file: 'ref-MT-2026-08849.json', qs: '?ref=MT-2026-08849' },
	/* edge cases */
	{ file: 'not-found.json',     qs: '?ref=NOT-EXIST-999' },
	{ file: 'missing-param.json', qs: '' }
];

function fetch(url) {
	return new Promise(function (resolve, reject) {
		http.get(url, function (res) {
			var body = '';
			res.on('data', function (chunk) { body += chunk; });
			res.on('end', function () {
				resolve({ status: res.statusCode, body: body });
			});
		}).on('error', reject);
	});
}

async function capture(endpoint, cases, dir) {
	fs.mkdirSync(dir, { recursive: true });
	for (var i = 0; i < cases.length; i++) {
		var c   = cases[i];
		var url = BASE + endpoint + c.qs;
		try {
			var result = await fetch(url);
			var dest   = path.join(dir, c.file);
			fs.writeFileSync(dest, result.body);
			console.log('  [' + result.status + '] ' + c.file);
		} catch (e) {
			console.error('  FAILED ' + c.file + ': ' + e.message);
		}
	}
}

async function main() {
	var psDir = path.join(__dirname, 'payment-status');
	var rsDir = path.join(__dirname, 'risk-score');

	console.log('Capturing /api/payment-status fixtures...');
	await capture('/api/payment-status', PAYMENT_STATUS_CASES, psDir);

	console.log('Capturing /api/risk-score fixtures...');
	await capture('/api/risk-score', RISK_SCORE_CASES, rsDir);

	console.log('Done. Fixtures written to tests/golden/');
}

main().catch(function (e) { console.error(e); process.exit(1); });
