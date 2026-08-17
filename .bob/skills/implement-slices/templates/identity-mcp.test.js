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

  const api = express();
  api.get('/api/v2/payments/:ref', (req, res) => res.json({
    ref: req.params.ref,
    status: 'HOLD',
  }));
  const apiServer = await listen(api);

  process.env.VAULT_ADDR = `http://127.0.0.1:${vaultServer.address().port}`;
  process.env.API_BASE_URL = `http://127.0.0.1:${apiServer.address().port}`;
  process.env.VAULT_SCOPE_CACHE_MS = '0';

  const mcp = express();
  mcp.use('/mcp', require('../routes/mcp-endpoint'));
  const mcpServer = await listen(mcp);
  t.after(async () => {
    await close(mcpServer);
    await close(apiServer);
    await close(vaultServer);
  });

  async function call(name, args) {
    const response = await fetch(`http://127.0.0.1:${mcpServer.address().port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer demo-inquiry-token',
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name, arguments: args },
      }),
    });
    assert.equal(response.status, 200);
    return response.json();
  }

  const allowed = await call('payment_status_lookup', { ref: 'MT-2026-08812' });
  const allowedBody = JSON.parse(allowed.result.content[0].text);
  assert.equal(allowedBody.ref, 'MT-2026-08812');
  console.log('IDENTITY ALLOW: ap-inquiry-agent -> payment_status_lookup');

  const refused = await call('payment_release', { ref: 'MT-2026-08812' });
  const refusedBody = JSON.parse(refused.result.content[0].text);
  assert.equal(refusedBody.refusal, true);
  assert.equal(refusedBody.identity, 'ap-inquiry-agent');
  assert.equal(refusedBody.required_scope, 'ops');
  console.log('IDENTITY REFUSE: ap-inquiry-agent lacks ops -> payment_release');
});
