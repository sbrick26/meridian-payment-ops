/* ---------------------------------------------------------------------------
 * Function: jest.setup
 * Owner:    payments-platform-team
 * Control:  AU-2   (SOX/PCI: PCI Req. 10; SOX 404 change management)
 * Reviewed: 2026-08-12
 *
 * KAN-26 — Jest global setup: starts the server before the equivalence suite
 * and tears it down afterwards.
 * ------------------------------------------------------------------------- */
'use strict';

var { spawn } = require('child_process');
var http = require('http');
var path = require('path');

var serverProcess = null;

function waitForServer(maxMs) {
  return new Promise(function (resolve, reject) {
    var start = Date.now();
    function attempt() {
      http.get('http://localhost:4600/', function (res) {
        res.resume();
        resolve();
      }).on('error', function () {
        if (Date.now() - start > maxMs) {
          reject(new Error('Server did not start within ' + maxMs + 'ms'));
          return;
        }
        setTimeout(attempt, 200);
      });
    }
    attempt();
  });
}

module.exports = async function () {
  serverProcess = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: Object.assign({}, process.env),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.on('data', function (d) { process.stdout.write('[server] ' + d); });
  serverProcess.stderr.on('data', function (d) { /* suppress pino JSON noise */ });

  await waitForServer(15000);

  /* expose the process handle so teardown can kill it */
  global.__SERVER_PROCESS__ = serverProcess;
};
