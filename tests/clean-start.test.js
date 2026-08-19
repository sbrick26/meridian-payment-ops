/* ---------------------------------------------------------------------------
 * Function: Clean-start deployment proof
 * Owner:    payments-platform-team
 * Control:  CP-10, SI-13   (SOX: ITGC change and availability controls)
 * Reviewed: 2026-08-19
 * ------------------------------------------------------------------------- */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

test('server seeds a missing DB before modern routes prepare statements', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian-clean-start-'));
  const dbPath = path.join(dir, 'payops.db');
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DB_PATH: dbPath, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  t.after(() => {
    child.kill('SIGTERM');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error(`startup timed out: ${output}`)), 10000);
    const inspect = () => {
      if (output.includes('Listening')) {
        clearTimeout(deadline);
        resolve();
      } else if (child.exitCode !== null) {
        clearTimeout(deadline);
        reject(new Error(`server exited ${child.exitCode}: ${output}`));
      } else {
        setTimeout(inspect, 50);
      }
    };
    inspect();
  });

  assert.equal(fs.existsSync(dbPath), true);
  const db = new Database(dbPath, { readonly: true });
  t.after(() => db.close());
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM exceptions").get().c > 0, true);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM vendors").get().c > 0, true);
});
