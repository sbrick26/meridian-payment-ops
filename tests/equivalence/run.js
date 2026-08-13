/* ---------------------------------------------------------------------------
 * Function: Equivalence suite — /api/v2/payment-status and /api/v2/risk-score
 * Owner:    payments-platform-team
 * Control:  AU-6 (audit review), SI-4 (monitoring)
 *           SOX/PCI: FFIEC operational risk — behavioral equivalence
 * Reviewed: 2026-08-13
 * ------------------------------------------------------------------------- */

'use strict';

/**
 * Equivalence test suite for KAN-39.
 *
 * For each golden fixture captured from the legacy endpoints, this suite
 * exercises the v2 endpoint with the same input and compares:
 *   - HTTP status code
 *   - Every response body field, value by value
 *
 * Intended difference (documented in PLAN.md, KAN-37):
 *   - Dates: legacy returns raw SQLite text strings; v2 returns the same
 *     values (stored identically in SQLite), so this is NOT a difference
 *     in practice. No exclusion needed.
 *
 * This suite MUST FAIL if run against an empty implementation.
 * It MUST PASS with 0 diffs when both implementations are equivalent.
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const LEGACY_BASE  = 'http://localhost:4600';
const V2_BASE      = 'http://localhost:4600';
const GOLDEN_DIR   = path.join(__dirname, '../golden');

/* Map legacy path prefix → v2 path prefix */
const PATH_MAP = {
	'/api/payment-status': '/api/v2/payment-status',
	'/api/risk-score':     '/api/v2/risk-score'
};

function get(baseUrl, urlPath) {
	return new Promise((resolve) => {
		const full = baseUrl + urlPath;
		http.get(full, (res) => {
			let body = '';
			res.on('data', c => { body += c; });
			res.on('end', () => resolve({ status: res.statusCode, body }));
		}).on('error', (e) => resolve({ status: 0, error: e.message }));
	});
}

function parseBody(raw) {
	try { return JSON.parse(raw); } catch (_) { return raw; }
}

function diffObjects(golden, modern, prefix) {
	const diffs = [];
	if (typeof golden !== 'object' || golden === null ||
	    typeof modern !== 'object' || modern === null) {
		if (String(golden) !== String(modern)) {
			diffs.push({ field: prefix, golden: golden, modern: modern });
		}
		return diffs;
	}
	const allKeys = new Set([...Object.keys(golden), ...Object.keys(modern)]);
	for (const k of allKeys) {
		const g = golden[k];
		const m = modern[k];
		if (g === undefined) {
			diffs.push({ field: prefix + k, golden: '(missing)', modern: m });
		} else if (m === undefined) {
			diffs.push({ field: prefix + k, golden: g, modern: '(missing)' });
		} else if (String(g) !== String(m)) {
			diffs.push({ field: prefix + k, golden: g, modern: m });
		}
	}
	return diffs;
}

async function runSuite() {
	const endpoints = ['payment-status', 'risk-score'];
	let totalCases   = 0;
	let totalDiffs   = 0;
	let totalFailed  = 0;
	const report     = [];

	for (const ep of endpoints) {
		const dir = path.join(GOLDEN_DIR, ep);
		if (!fs.existsSync(dir)) {
			console.error('ERROR: golden directory missing: ' + dir);
			process.exit(1);
		}
		const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
		for (const file of files) {
			const fixture = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
			const legacyPath = fixture.input;

			/* Derive v2 path by substituting the path prefix */
			let v2Path = null;
			for (const [legacyPrefix, v2Prefix] of Object.entries(PATH_MAP)) {
				if (legacyPath.startsWith(legacyPrefix)) {
					v2Path = legacyPath.replace(legacyPrefix, v2Prefix);
					break;
				}
			}
			if (!v2Path) {
				console.error('No v2 mapping for path: ' + legacyPath);
				process.exit(1);
			}

			totalCases++;
			const v2Result = await get(V2_BASE, v2Path);

			const goldenStatus = fixture.status;
			const goldenBody   = parseBody(fixture.body);
			const modernBody   = parseBody(v2Result.body);

			const caseDiffs = [];

			/* Status code must match */
			if (goldenStatus !== v2Result.status) {
				caseDiffs.push({
					field: 'HTTP status',
					golden: goldenStatus,
					modern: v2Result.status
				});
			}

			/* Body fields must match */
			if (v2Result.status !== 0) {
				const bodyDiffs = diffObjects(goldenBody, modernBody, '');
				caseDiffs.push(...bodyDiffs);
			}

			const passed = caseDiffs.length === 0;
			if (!passed) { totalDiffs += caseDiffs.length; totalFailed++; }

			report.push({
				case: ep + '/' + file.replace('.json', ''),
				input: legacyPath,
				goldenStatus,
				modernStatus: v2Result.status,
				passed,
				diffs: caseDiffs
			});
		}
	}

	/* ---- Print report ---- */
	console.log('\n=== KAN-39 Equivalence Suite ===\n');
	for (const r of report) {
		const mark = r.passed ? '✓' : '✗';
		console.log(mark + ' ' + r.case + '  [' + r.goldenStatus + ']');
		if (!r.passed) {
			for (const d of r.diffs) {
				console.log('    DIFF  ' + d.field + ': golden=' + JSON.stringify(d.golden) + '  modern=' + JSON.stringify(d.modern));
			}
		}
	}

	console.log('\n--------------------------------');
	console.log('Cases:           ' + totalCases);
	console.log('Passed:          ' + (totalCases - totalFailed));
	console.log('Failed:          ' + totalFailed);
	console.log('Unexplained diffs: ' + totalDiffs);
	console.log('--------------------------------\n');

	if (totalDiffs > 0) {
		console.error('FAIL — ' + totalDiffs + ' unexplained difference(s). See above.');
		process.exit(1);
	}
	console.log('PASS — ' + totalCases + ' cases, 0 diffs.\n');
	process.exit(0);
}

runSuite();
