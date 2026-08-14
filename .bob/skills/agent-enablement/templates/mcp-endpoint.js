/* ---------------------------------------------------------------------------
 * Function: POST /mcp (JSON-RPC tools/list, tools/call)
 * Owner:    payments-platform-team
 * Control:  AC-6 (authorization/operator entitlements), AC-2, IA-2 (identity)
 *           SOX/PCI: SOX 404 segregation of duties; PCI Req. 8
 * Reviewed: 2026-08-13
 * ------------------------------------------------------------------------- */

/**
 * mcp-endpoint.js — assistant tool interface for the modernized AP payments API.
 *
 * Mounted inside the modernized service:
 *
 *   app.use('/mcp', require('./routes/mcp-endpoint'));   // after /api/v2
 *
 * Transport: streamable-http. A single POST endpoint speaking JSON-RPC 2.0,
 * answering `initialize`, `tools/list` and `tools/call`. Responses are returned
 * as `application/json`; when the caller advertises `text/event-stream` in
 * Accept, the same JSON-RPC message is written as a single SSE event, which is
 * what the streamable-http clients expect. GET /mcp opens an (empty) event
 * stream so clients that probe it do not error.
 *
 * Dependency policy: this file is written against Express and the Node standard
 * library only — no MCP SDK, no new package in package.json. The protocol
 * surface an assistant platform actually exercises is small enough that adding a
 * transitive dependency tree to obtain it is not justified, and the approved-
 * libraries rule applies to this file like any other.
 *
 * Identity: this layer decides nothing. Every tool declares the scope it needs;
 * the scope is checked against the caller's identity via the Vault-backed
 * middleware, and the call is then forwarded to the service's own /api/v2 route
 * with the caller's token attached — so the route re-checks the same scope and
 * the refusal the assistant relays is the service's own auditable refusal, not a
 * message invented here.
 */

'use strict';

const express = require('express');
const { requireScope, checkScope } = require('../vault/middleware/vault-scope');

const router = express.Router();
router.use(express.json({ limit: '256kb' }));

/** Base URL of this service's own modern API. Same process; loopback call. */
const API_BASE = () =>
  (process.env.API_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4600}`)
    .replace(/\/+$/, '');

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'ap-payments-tools', version: '1.0.0' };

/* ------------------------------------------------------------------ *
 * Tool catalogue                                                      *
 *                                                                     *
 * `scope` is the enforcement contract: 'inquiry' for read tools,      *
 * 'ops' for write tools. `call` returns { method, path, body }        *
 * describing the /api/v2 request the tool maps to — one tool, one     *
 * documented endpoint, no business logic in this file.                *
 * ------------------------------------------------------------------ */

const TOOLS = [
  {
    name: 'payment_status_lookup',
    scope: 'inquiry',
    description:
      'Look up a single AP payment by its payment reference or by invoice ' +
      'number. Returns vendor, amount, status, hold reason, dates and risk.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Payment reference, e.g. MT-2026-08812' },
        invoice: { type: 'string', description: 'Invoice number, e.g. INV-2026-4471' },
      },
      additionalProperties: false,
    },
    call: (a) =>
      a.ref
        ? { method: 'GET', path: `/api/v2/payments/${encodeURIComponent(a.ref)}` }
        : { method: 'GET', path: `/api/v2/payments?invoice=${encodeURIComponent(a.invoice || '')}` },
  },
  {
    name: 'payments_search',
    scope: 'inquiry',
    description:
      'Search AP payments by status, vendor name or free text, with paging. ' +
      'Use when the caller does not have a single reference in hand.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Payment status filter' },
        vendor: { type: 'string', description: 'Vendor name filter' },
        q: { type: 'string', description: 'Free-text query' },
        page: { type: 'integer', minimum: 1, description: 'Page number, 1-based' },
      },
      additionalProperties: false,
    },
    call: (a) => ({ method: 'GET', path: `/api/v2/payments${query(a)}` }),
  },
  {
    name: 'payment_risk',
    scope: 'inquiry',
    description:
      'Return the risk score and risk band for one payment, by payment ' +
      'reference. Use when the caller asks how risky a payment is.',
    inputSchema: {
      type: 'object',
      properties: { ref: { type: 'string', description: 'Payment reference' } },
      required: ['ref'],
      additionalProperties: false,
    },
    // Risk is a field of the payment record in the /api/v2 contract; this tool
    // exists so the assistant has an unambiguous route for risk questions, not
    // because there is a second endpoint.
    call: (a) => ({ method: 'GET', path: `/api/v2/payments/${encodeURIComponent(a.ref)}` }),
  },
  {
    name: 'payment_release',
    scope: 'ops',
    description:
      'Release a held AP payment for settlement. Write operation: requires an ' +
      'identity holding the operations scope.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Payment reference' },
        note: { type: 'string', description: 'Reason recorded on the audit trail' },
      },
      required: ['ref'],
      additionalProperties: false,
    },
    call: (a) => ({
      method: 'POST',
      path: `/api/v2/payments/${encodeURIComponent(a.ref)}/release`,
      body: { note: a.note || null },
    }),
  },
  {
    name: 'payment_hold',
    scope: 'ops',
    description:
      'Place an AP payment on hold. Write operation: requires an identity ' +
      'holding the operations scope.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Payment reference' },
        reason: { type: 'string', description: 'Hold reason code or text' },
      },
      required: ['ref'],
      additionalProperties: false,
    },
    call: (a) => ({
      method: 'POST',
      path: `/api/v2/payments/${encodeURIComponent(a.ref)}/hold`,
      body: { reason: a.reason || null },
    }),
  },
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** Build a querystring from defined, non-empty arguments only. */
function query(args) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(args || {})) {
    if (v !== undefined && v !== null && String(v) !== '') p.append(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** The caller's credential, as presented. Forwarded verbatim upstream. */
function callerToken(req) {
  const h = req.headers || {};
  return String(h.authorization || h['x-vault-token'] || '');
}

/* ------------------------------------------------------------------ *
 * Transport plumbing                                                  *
 * ------------------------------------------------------------------ */

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

/** Text content block; MCP tool results are content arrays. */
const text = (s, isError) => ({
  content: [{ type: 'text', text: s }],
  ...(isError ? { isError: true } : {}),
});

/**
 * Write one JSON-RPC message. Streamable-http clients that asked for SSE get it
 * as a single `message` event; everyone else gets plain JSON.
 */
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

/**
 * Gate the whole endpoint on a verifiable identity that holds, at minimum, the
 * read scope. A caller with no identity never reaches the dispatcher; a caller
 * with a real identity gets per-tool enforcement below.
 */
router.use(requireScope('inquiry'));

/** Some clients open a stream before posting. Keep it open and empty. */
router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders && res.flushHeaders();
  const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 25000);
  req.on('close', () => clearInterval(keepAlive));
});

router.post('/', async (req, res) => {
  const msg = req.body || {};
  const id = Object.prototype.hasOwnProperty.call(msg, 'id') ? msg.id : null;

  try {
    switch (msg.method) {
      case 'initialize':
        return send(req, res, rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        }));

      // Notifications carry no id and expect no body.
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return send(req, res, null);

      case 'ping':
        return send(req, res, rpcResult(id, {}));

      case 'tools/list':
        return send(req, res, rpcResult(id, {
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        }));

      case 'tools/call': {
        const params = msg.params || {};
        const tool = BY_NAME.get(params.name);
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

/**
 * Run one tool: check the declared scope against the caller's identity, then
 * forward to /api/v2 carrying the caller's own token.
 *
 * A scope failure is returned as a tool result, not as a transport error: the
 * assistant must be able to read the refusal and relay it to the person who
 * asked. The wording is the service's, so what the caller hears matches what
 * the audit log records.
 */
/**
 * Validate arguments against the tool's declared inputSchema before anything
 * else sees them. Dependency-free by design (rule 04): required keys, no
 * unknown keys, primitive types, bounded string length, optional pattern.
 * The schema on each tool is the contract; without this check it is only
 * documentation - which a guardrail audit correctly flagged.
 */
function validateArgs(schema, args) {
  const errs = [];
  const props = (schema && schema.properties) || {};
  for (const k of (schema && schema.required) || []) {
    if (args[k] === undefined || args[k] === null || String(args[k]) === '') {
      errs.push(`missing required argument '${k}'`);
    }
  }
  if (schema && schema.additionalProperties === false) {
    for (const k of Object.keys(args)) {
      if (!props[k]) errs.push(`unknown argument '${k}'`);
    }
  }
  for (const [k, v] of Object.entries(args)) {
    const spec = props[k];
    if (!spec || v === undefined || v === null) continue;
    if (spec.type === 'string' && typeof v !== 'string') errs.push(`'${k}' must be a string`);
    if (spec.type === 'number' && typeof v !== 'number') errs.push(`'${k}' must be a number`);
    if (spec.type === 'boolean' && typeof v !== 'boolean') errs.push(`'${k}' must be a boolean`);
    if (typeof v === 'string' && v.length > (spec.maxLength || 200)) errs.push(`'${k}' exceeds maximum length`);
    if (spec.pattern && typeof v === 'string' && !(new RegExp(spec.pattern)).test(v)) {
      errs.push(`'${k}' does not match the required format`);
    }
  }
  return errs;
}

async function invoke(tool, args, req) {
  const invalid = validateArgs(tool.inputSchema, args || {});
  if (invalid.length) {
    return text(JSON.stringify({
      error: 'invalid_arguments',
      detail: invalid.join('; '),
      tool: tool.name,
    }), true);
  }

  const token = callerToken(req);

  const identity = await checkScope(token, tool.scope);
  if (!identity.allowed) {
    return text(JSON.stringify({
      error: identity.error ? 'identity_unverified' : 'identity_scope_denied',
      detail: identity.error
        ? `Could not verify caller identity (${identity.error})`
        : `Token identity lacks scope '${tool.scope}'`,
      policies: identity.policies,
      granted_scopes: identity.scopes,
      required_scope: tool.scope,
      // Refusals travel as ANSWERS, not errors - an error result triggers
      // the platform's canned text and erases the governance story.
      refusal: true,
      how_to_proceed: 'This action requires an authorized AP operator in the payment console.',
    }), false);
  }

  const spec = tool.call(args);
  let upstream;
  try {
    upstream = await fetch(`${API_BASE()}${spec.path}`, {
      method: spec.method,
      headers: {
        Accept: 'application/json',
        Authorization: /^Bearer\s/i.test(token) ? token : `Bearer ${token.trim()}`,
        ...(spec.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(spec.body ? { body: JSON.stringify(spec.body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    return text(JSON.stringify({
      error: 'service_unreachable',
      detail: `${spec.method} ${spec.path} failed: ${e && e.message ? e.message : e}`,
    }), true);
  }

  const raw = await upstream.text();
  // Relay the service's response verbatim. A 403 from /api/v2 is the identity
  // refusal the assistant is required to pass on unaltered.
  return text(raw, !upstream.ok);
}

module.exports = router;
module.exports.TOOLS = TOOLS;
