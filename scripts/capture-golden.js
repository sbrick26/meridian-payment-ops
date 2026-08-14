/* ---------------------------------------------------------------------------
 * Function: golden-fixture capture (legacy payment-status + risk-score)
 * Owner:    payments-platform-team
 * Control:  SOX 404 change control - behavioral-equivalence evidence (rule 08)
 * Reviewed: 2026-08-14
 * ------------------------------------------------------------------------- */
/*
 * Records the LEGACY responses for the equivalence surface before any code
 * changes. Run against the console serving the unmodified legacy app
 * (http://localhost:4600), then commit tests/golden/ ALONE - that commit's
 * position in history is the capture-first evidence the gate verifies.
 */
const { writeFileSync, mkdirSync } = require('node:fs');
const BASE = process.env.CONSOLE_URL || 'http://localhost:4600';
const CASES = [
  ['payment-status-nominal',   '/api/payment-status?ref=MT-2026-08822'],
  ['payment-status-second',    '/api/payment-status?ref=MT-2026-09328'],
  ['payment-status-missing',   '/api/payment-status'],
  ['payment-status-unknown',   '/api/payment-status?ref=MT-0000-00000'],
  ['risk-score-nominal',       '/api/risk-score?ref=MT-2026-08822'],
  ['risk-score-high',          '/api/risk-score?ref=MT-2026-09441'],
  ['risk-score-missing',       '/api/risk-score'],
  ['risk-score-unknown',       '/api/risk-score?ref=MT-0000-00000'],
];
(async () => {
  mkdirSync('tests/golden', { recursive: true });
  for (const [name, path] of CASES) {
    const res = await fetch(BASE + path);
    const body = await res.text();
    let parsed; try { parsed = JSON.parse(body); } catch { parsed = body; }
    writeFileSync(`tests/golden/${name}.json`, JSON.stringify(
      { captured: 'pre-change legacy response', path, status: res.status, body: parsed }, null, 2) + '\n');
    console.log(`${name}: ${res.status}`);
  }
  console.log(`captured ${CASES.length} fixtures to tests/golden/`);
})();
