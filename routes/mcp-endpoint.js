/* ---------------------------------------------------------------------------
 * Function: POST /mcp (JSON-RPC tools/list, tools/call) — AP Payment Agent
 * Owner:    payments-platform-team
 * Control:  AC-6 (least privilege), AC-2, IA-2 (agent identity)
 *           SOX/PCI: SOX 404 segregation of duties; PCI Req. 8
 * Reviewed: 2026-08-13
 * ------------------------------------------------------------------------- */

/**
 * mcp-endpoint.js — MCP tool interface for the AP Payment Agent (KAN-78).
 *
 * Adapted from .bob/skills/agent-enablement/templates/mcp-endpoint.js.
 * Upstream routes: /api/v2/payment-status and /api/v2/risk-score.
 * Agent data surface: status, risk_band, vendor_name, amount, reason_text.
 * bank_bic and clerk names are NOT surfaced (PCI scope / operator PII).
 *
 * Tool catalogue:
 *   payment_status_lookup  — inquiry scope  — GET /api/v2/payment-status
 *   payment_risk           — inquiry scope  — GET /api/v2/risk-score
 *   payment_release        — ops scope      — permanently refused (no ops identity)
 *
 * Mounted in server.js:
 *   app.use('/mcp', require('./routes/mcp-endpoint'));
 */

'use strict';

const express = require('express');
const { requireScope, checkScope } = require('../vault/middleware/vault-scope');

const router = express.Router();
router.use(express.json({ limit: '256kb' }));

const API_BASE = () =>
  (process.env.API_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4600}`)
    .replace(/\/+$/, '');

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'ap-payments-tools', version: '1.0.0' };

/* ------------------------------------------------------------------ *
 * Tool catalogue                                                       *
 * ------------------------------------------------------------------ */

const TOOLS = [
  {
    name: 'payment_status_lookup',
    scope: 'inquiry',
    description:
      'Look up an AP payment by payment reference or invoice number. ' +
      'Returns vendor name, amount, currency, status, hold reason, dates and risk band. ' +
      'Does NOT return bank details or clerk names.',
    inputSchema: {
      type: 'object',
      properties: {
        ref:     { type: 'string', description: 'Payment reference, e.g. MT-2026-08815' },
        invoice: { type: 'string', description: 'Invoice number, e.g. INV-2026-4403' },
      },
      additionalProperties: false,
    },
    call: (a) =>
      a.ref
        ? { method: 'GET', path: `/api/v2/payment-status?ref=${encodeURIComponent(a.ref)}` }
        : { method: 'GET', path: `/api/v2/payment-status?invoice=${encodeURIComponent(a.invoice || '')}` },
  },
  {
    name: 'payment_risk',
    scope: 'inquiry',
    description:
      'Return the risk score and risk band (LOW / MEDIUM / HIGH) for one payment ' +
      'by payment reference. Use when the caller asks how risky a payment is.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Payment reference' },
      },
      required: ['ref'],
      additionalProperties: false,
    },
    call: (a) => ({ method: 'GET', path: `/api/v2/risk-score?ref=${encodeURIComponent(a.ref)}` }),
  },
  {
    name: 'payment_release',
    scope: 'ops',
    description:
      'Release a held AP payment for settlement. ' +
      'Write operation — this agent identity does not hold the operations scope; ' +
      'the call will always be refused.',
    inputSchema: {
      type: 'object',
      properties: {
        ref:  { type: 'string', description: 'Payment reference' },
        note: { type: 'string', description: 'Reason for release' },
      },
      required: ['ref'],
      additionalProperties: false,
    },
    call: () => ({ method: 'POST', path: '/api/v2/payments/release-not-implemented' }),
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

function callerToken(req) {
  const h = req.headers || {};
  return String(h.authorization || h['x-vault-token'] || '');
}

/* ------------------------------------------------------------------ *
 * Transport plumbing (identical to template)                           *
 * ------------------------------------------------------------------ */

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError  = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const text      = (s, isError) => ({ content: [{ type: 'text', text: s }], ...(isError ? { isError: true } : {}) });

function send(req, res, payload) {
  if (payload === null) return res.status(202).end();
  const accept = String((req.headers && req.headers.accept) || '');
  if (accept.includes('text/event-stream')) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    return res.end(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
  }
  return res.json(payload);
}

router.use(requireScope('inquiry'));

router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders && res.flushHeaders();
  const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 25000);
  req.on('close', () => clearInterval(keepAlive));
});

router.post('/', async (req, res) => {
  const msg = req.body || {};
  const id  = Object.prototype.hasOwnProperty.call(msg, 'id') ? msg.id : null;

  try {
    switch (msg.method) {
      case 'initialize':
        return send(req, res, rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities:    { tools: { listChanged: false } },
          serverInfo:      SERVER_INFO,
        }));
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return send(req, res, null);
      case 'ping':
        return send(req, res, rpcResult(id, {}));
      case 'tools/list':
        return send(req, res, rpcResult(id, {
          tools: TOOLS.map((t) => ({
            name:        t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        }));
      case 'tools/call': {
        const params = msg.params || {};
        const tool   = BY_NAME.get(params.name);
        if (!tool) return send(req, res, rpcError(id, -32602, `Unknown tool: ${params.name}`));
        const out = await invoke(tool, params.arguments || {}, req);
        return send(req, res, rpcResult(id, out));
      }
      default:
        return send(req, res, rpcError(id, -32601, `Method not supported: ${msg.method}`));
    }
  } catch (e) {
    return send(req, res, rpcError(id, -32603, `Internal error: ${e && e.message ? e.message : e}`));
  }
});

async function invoke(tool, args, req) {
  const token    = callerToken(req);
  const identity = await checkScope(token, tool.scope);
  if (!identity.allowed) {
    return text(JSON.stringify({
      error:          identity.error ? 'identity_unverified' : 'identity_scope_denied',
      detail:         identity.error
        ? `Could not verify caller identity (${identity.error})`
        : `Token identity lacks scope '${tool.scope}'`,
      policies:       identity.policies,
      granted_scopes: identity.scopes,
      required_scope: tool.scope,
    }), true);
  }

  const spec = tool.call(args);
  let upstream;
  try {
    upstream = await fetch(`${API_BASE()}${spec.path}`, {
      method: spec.method,
      headers: {
        Accept:        'application/json',
        Authorization: /^Bearer\s/i.test(token) ? token : `Bearer ${token.trim()}`,
        ...(spec.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(spec.body ? { body: JSON.stringify(spec.body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    return text(JSON.stringify({
      error:  'service_unreachable',
      detail: `${spec.method} ${spec.path} failed: ${e && e.message ? e.message : e}`,
    }), true);
  }

  const raw = await upstream.text();
  return text(raw, !upstream.ok);
}

module.exports = router;
module.exports.TOOLS = TOOLS;
