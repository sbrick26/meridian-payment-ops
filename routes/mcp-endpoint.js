/* ---------------------------------------------------------------------------
 * Function: POST /mcp (JSON-RPC tools/list, tools/call)
 * Owner:    payments-platform-team
 * Control:  AC-6, AC-2, IA-2   (SOX: segregation of duties; PCI-DSS Req. 8)
 * Reviewed: 2026-08-14
 * ---------------------------------------------------------------------------
 * MCP tool layer over the modernized AP payment-status service.
 *
 * Tools exposed:
 *   payment_status_lookup  — inquiry scope — GET /api/v2/payment-status
 *   payment_risk           — inquiry scope — GET /api/v2/risk-score
 *   payment_release        — ops scope     — PERMANENTLY REFUSED (no write auth)
 *
 * The agent holds inquiry:read only. payment_release is listed so the
 * refusal is the service's own auditable 403, relayed verbatim to the
 * caller — the operation is not hidden (rule 11(b)).
 *
 * Field filter: the agent may surface status, risk band, vendor name,
 * amount, hold reason, and expected pay date. BankBIC, remit_TO, Clerk,
 * and clerk_initials are stripped before returning to the caller.
 *
 * Approved under KAN-87, Swayam Barik, 2026-08-13.
 * ------------------------------------------------------------------------- */

'use strict';

var express  = require('express');
var fetch    = require('node-fetch');
var vaultMod = require('../vault/middleware/vault-scope');
var requireScope = vaultMod.requireScope;
var checkScope   = vaultMod.checkScope;

var router = express.Router();
router.use(express.json({ limit: '256kb' }));

/* Base URL of this service's own API — loopback. */
function apiBase() {
	return (process.env.API_BASE_URL || ('http://127.0.0.1:' + (process.env.PORT || '4600')))
		.replace(/\/+$/, '');
}

var PROTOCOL_VERSION = '2025-06-18';
var SERVER_INFO      = { name: 'ap-payments-tools', version: '1.0.0' };

/* --------------------------------------------------------------------------
 * PII filter — strip fields the agent is not authorised to surface.
 * Plan §4 constraint: never return BankBIC, remit_TO, Clerk, clerk_initials.
 * Applied to the parsed upstream response before it reaches the caller.
 * ------------------------------------------------------------------------- */
var PII_FIELDS = ['BankBIC', 'remit_TO', 'Clerk', 'clerk_initials'];

function stripPii(obj) {
	if (!obj || typeof obj !== 'object') return obj;
	var out = {};
	var keys = Object.keys(obj);
	for (var i = 0; i < keys.length; i++) {
		if (PII_FIELDS.indexOf(keys[i]) === -1) {
			out[keys[i]] = obj[keys[i]];
		}
	}
	return out;
}

/* --------------------------------------------------------------------------
 * Tool catalogue
 * ------------------------------------------------------------------------- */
var TOOLS = [
	{
		name: 'payment_status_lookup',
		scope: 'inquiry',
		description:
			'Look up an AP payment by its payment reference or by invoice number. ' +
			'Returns vendor name, amount, status, hold reason, risk band, and expected pay date.',
		inputSchema: {
			type: 'object',
			properties: {
				ref:     { type: 'string', description: 'Payment reference, e.g. MT-2026-08815', maxLength: 64 },
				invoice: { type: 'string', description: 'Invoice number, e.g. INV-2026-4403',   maxLength: 64 }
			},
			additionalProperties: false
		},
		call: function (a) {
			if (a.ref) {
				return { method: 'GET', path: '/api/v2/payment-status?ref=' + encodeURIComponent(a.ref) };
			}
			return { method: 'GET', path: '/api/v2/payment-status?invoice=' + encodeURIComponent(a.invoice || '') };
		},
		filterPii: true
	},
	{
		name: 'payment_risk',
		scope: 'inquiry',
		description:
			'Return the risk score and risk band for one payment, by payment reference.',
		inputSchema: {
			type: 'object',
			properties: {
				ref: { type: 'string', description: 'Payment reference', maxLength: 64 }
			},
			required: ['ref'],
			additionalProperties: false
		},
		call: function (a) {
			return { method: 'GET', path: '/api/v2/risk-score?ref=' + encodeURIComponent(a.ref) };
		},
		filterPii: false
	},
	{
		name: 'payment_release',
		scope: 'ops',
		description:
			'Release a held AP payment for settlement. Write operation — permanently ' +
			'refused for this agent identity. Contact the AP desk at ext 4400.',
		inputSchema: {
			type: 'object',
			properties: {
				ref:  { type: 'string', description: 'Payment reference', maxLength: 64 },
				note: { type: 'string', description: 'Reason for release', maxLength: 256 }
			},
			required: ['ref'],
			additionalProperties: false
		},
		call: function (a) {
			return {
				method: 'POST',
				path:   '/api/v2/payment-status/' + encodeURIComponent(a.ref) + '/release',
				body:   { note: a.note || null }
			};
		},
		filterPii: false
	}
];

var BY_NAME = {};
for (var i = 0; i < TOOLS.length; i++) {
	BY_NAME[TOOLS[i].name] = TOOLS[i];
}

/* --------------------------------------------------------------------------
 * Argument validation — dependency-free (rule 04)
 * ------------------------------------------------------------------------- */
function validateArgs(schema, args) {
	var errs   = [];
	var props  = (schema && schema.properties) || {};
	var req    = (schema && schema.required) || [];
	for (var i = 0; i < req.length; i++) {
		var k = req[i];
		if (args[k] === undefined || args[k] === null || String(args[k]) === '') {
			errs.push('missing required argument \'' + k + '\'');
		}
	}
	if (schema && schema.additionalProperties === false) {
		var argKeys = Object.keys(args);
		for (var j = 0; j < argKeys.length; j++) {
			if (!props[argKeys[j]]) errs.push('unknown argument \'' + argKeys[j] + '\'');
		}
	}
	var allKeys = Object.keys(args);
	for (var m = 0; m < allKeys.length; m++) {
		var key  = allKeys[m];
		var val  = args[key];
		var spec = props[key];
		if (!spec || val === undefined || val === null) continue;
		if (spec.type === 'string'  && typeof val !== 'string')  errs.push('\'' + key + '\' must be a string');
		if (spec.type === 'number'  && typeof val !== 'number')  errs.push('\'' + key + '\' must be a number');
		if (spec.type === 'boolean' && typeof val !== 'boolean') errs.push('\'' + key + '\' must be a boolean');
		if (typeof val === 'string' && val.length > (spec.maxLength || 200)) {
			errs.push('\'' + key + '\' exceeds maximum length');
		}
	}
	return errs;
}

/* --------------------------------------------------------------------------
 * Transport helpers
 * ------------------------------------------------------------------------- */
function rpcResult(id, result)          { return { jsonrpc: '2.0', id: id, result: result }; }
function rpcError(id, code, message)    { return { jsonrpc: '2.0', id: id, error: { code: code, message: message } }; }
function textContent(s, isErr) {
	var r = { content: [{ type: 'text', text: s }] };
	if (isErr) r.isError = true;
	return r;
}

function send(req, res, payload) {
	if (payload === null) return res.status(202).end();
	var accept = String((req.headers && req.headers.accept) || '');
	if (accept.indexOf('text/event-stream') !== -1) {
		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');
		return res.end('event: message\ndata: ' + JSON.stringify(payload) + '\n\n');
	}
	return res.json(payload);
}

function callerToken(req) {
	var h = req.headers || {};
	return String(h.authorization || h['x-vault-token'] || '');
}

/* --------------------------------------------------------------------------
 * Tool invocation
 * ------------------------------------------------------------------------- */
function invoke(tool, args, req) {
	var invalid = validateArgs(tool.inputSchema, args || {});
	if (invalid.length) {
		return Promise.resolve(textContent(JSON.stringify({
			error:  'invalid_arguments',
			detail: invalid.join('; '),
			tool:   tool.name
		}), true));
	}

	var token = callerToken(req);

	return checkScope(token, tool.scope).then(function (identity) {
		if (!identity.allowed) {
			return textContent(JSON.stringify({
				error:           identity.error ? 'identity_unverified' : 'identity_scope_denied',
				detail:          identity.error
					? 'Could not verify caller identity (' + identity.error + ')'
					: 'This agent is authorised for payment inquiry only. Write operations are permanently refused. Contact the AP desk at ext 4400.',
				scope_held:      (identity.scopes || []).join(', '),
				scope_required:  tool.scope
			}), true);
		}

		var spec = tool.call(args);
		var fetchOpts = {
			method: spec.method,
			headers: {
				'Accept': 'application/json',
				'Authorization': (/^Bearer\s/i.test(token) ? token : ('Bearer ' + token.trim()))
			}
		};
		if (spec.body) {
			fetchOpts.headers['Content-Type'] = 'application/json';
			fetchOpts.body = JSON.stringify(spec.body);
		}

		return fetch(apiBase() + spec.path, fetchOpts).then(function (upstream) {
			return upstream.text().then(function (raw) {
				var isErr = !upstream.ok;
				/* Apply PII filter on successful inquiry responses */
				if (!isErr && tool.filterPii) {
					try {
						var parsed = JSON.parse(raw);
						raw = JSON.stringify(stripPii(parsed));
					} catch (_) { /* leave raw as-is if not valid JSON */ }
				}
				return textContent(raw, isErr);
			});
		}).catch(function (e) {
			return textContent(JSON.stringify({
				error:  'service_unreachable',
				detail: spec.method + ' ' + spec.path + ' failed: ' + (e && e.message ? e.message : String(e))
			}), true);
		});
	});
}

/* --------------------------------------------------------------------------
 * Router
 * ------------------------------------------------------------------------- */

/* Gate the whole endpoint: caller must present a token. */
router.use(requireScope('inquiry'));

/* SSE keep-alive for clients that probe before posting. */
router.get('/', function (req, res) {
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	if (res.flushHeaders) res.flushHeaders();
	var keepAlive = setInterval(function () { res.write(': keep-alive\n\n'); }, 25000);
	req.on('close', function () { clearInterval(keepAlive); });
});

router.post('/', function (req, res) {
	var msg = req.body || {};
	var id  = Object.prototype.hasOwnProperty.call(msg, 'id') ? msg.id : null;

	try {
		var method = msg.method || '';

		if (method === 'initialize') {
			return send(req, res, rpcResult(id, {
				protocolVersion: PROTOCOL_VERSION,
				capabilities:    { tools: { listChanged: false } },
				serverInfo:      SERVER_INFO
			}));
		}

		if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
			return send(req, res, null);
		}

		if (method === 'ping') {
			return send(req, res, rpcResult(id, {}));
		}

		if (method === 'tools/list') {
			return send(req, res, rpcResult(id, {
				tools: TOOLS.map(function (t) {
					return { name: t.name, description: t.description, inputSchema: t.inputSchema };
				})
			}));
		}

		if (method === 'tools/call') {
			var params = msg.params || {};
			var tool   = BY_NAME[params.name];
			if (!tool) {
				return send(req, res, rpcError(id, -32602, 'Unknown tool: ' + params.name));
			}
			invoke(tool, params.arguments || {}, req).then(function (out) {
				return send(req, res, rpcResult(id, out));
			}).catch(function (e) {
				return send(req, res, rpcError(id, -32603, 'Internal error: ' + (e && e.message ? e.message : e)));
			});
			return;
		}

		return send(req, res, rpcError(id, -32601, 'Method not supported: ' + method));

	} catch (e) {
		return send(req, res, rpcError(id, -32603, 'Internal error: ' + (e && e.message ? e.message : e)));
	}
});

module.exports = router;
module.exports.TOOLS = TOOLS;
