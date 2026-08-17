/* ---------------------------------------------------------------------------
 * Function: MCP assistant-identity acceptance proof
 * Owner:    payments-platform-team
 * Control:  AC-3, AC-6, AU-12   (SOX/PCI: SOX 404; PCI Req. 7, Req. 10)
 * Reviewed: 2026-08-17
 * ------------------------------------------------------------------------- */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test('inquiry identity is allowed to read and refused an ops tool', async (t) => {
  const vault = express();
  vault.get('/v1/auth/token/lookup-self', (req, res) => res.json({
    data: { policies: ['default', 'ap-inquiry-read'] },
  }));
  const vaultServer = await listen(vault);
  process.env.VAULT_ADDR = `http://127.0.0.1:${vaultServer.address().port}`;
  process.env.VAULT_SCOPE_CACHE_MS = '0';

  const api = express();
  api.use(express.json());
  api.use('/api/v2', require('../routes/payments'));
  const apiServer = await listen(api);

  process.env.API_BASE_URL = `http://127.0.0.1:${apiServer.address().port}`;

  const mcp = express();
  mcp.use('/mcp', require('../routes/mcp-endpoint'));
  const mcpServer = await listen(mcp);
  t.after(async () => {
    await close(mcpServer);
    await close(apiServer);
    await close(vaultServer);
  });

  async function rpc(method, params) {
    const response = await fetch(`http://127.0.0.1:${mcpServer.address().port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-inquiry-token',
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method, params,
      }),
    });
    assert.equal(response.status, 200);
    return response.json();
  }

  const listed = await rpc('tools/list', {});
  assert.deepEqual(listed.result.tools.map((tool) => tool.name), [
    'payment_status_lookup', 'payments_search', 'payments_recent',
    'payment_risk', 'payment_release', 'payment_hold',
  ]);

  const allowed = await rpc('tools/call', {
    name: 'payment_status_lookup', arguments: { ref: 'MT-2026-08815' },
  });
  const allowedBody = JSON.parse(allowed.result.content[0].text);
  assert.equal(allowedBody.ref, 'MT-2026-08815');
  console.log('IDENTITY ALLOW: ap-inquiry-agent -> payment_status_lookup');

  const refused = await rpc('tools/call', {
    name: 'payment_release', arguments: { ref: 'MT-2026-08815' },
  });
  const refusedBody = JSON.parse(refused.result.content[0].text);
  assert.equal(refusedBody.refusal, true);
  assert.equal(refusedBody.identity, 'ap-inquiry-agent');
  assert.equal(refusedBody.required_scope, 'ops');
  console.log('IDENTITY REFUSE: ap-inquiry-agent lacks ops -> payment_release');
});
