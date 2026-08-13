/* ---------------------------------------------------------------------------
 * Function: mcp-endpoint
 * Owner:    payments-platform-team
 * Control:  AC-3, AC-6   (SOX: segregation of duties; PCI Req. 7, 8)
 * Reviewed: 2026-08-13
 * --------------------------------------------------------------------------- */

/**
 * mcp-endpoint.js — streamable-HTTP MCP endpoint for the AP payments console.
 *
 * Mounted by the parent at /mcp:
 *
 *   app.use('/mcp', require('./routes/mcp-endpoint'));
 *
 * Transport: streamable-HTTP, JSON-RPC 2.0 over a single POST.
 * When the caller's Accept header includes text/event-stream the response is
 * wrapped as a single SSE message event — the format streamable-HTTP clients
 * expect. A GET /mcp keeps the stream open with keep-alive comments.
 *
 * Database access: req.app.locals.db (better-sqlite3). All queries are
 * parameterized. The endpoint does not open a second connection.
 *
 * Scope enforcement: vault/middleware/vault-scope.checkScope is called before
 * every tool execution. Tools 1-3 require the inquiry scope (any valid Bearer
 * token). Tools 4-5 (payment_release, payment_hold) require the ops scope,
 * which is permanently refused per rule 11(b) — write scope has not been
 * approved for this epic.
 *
 * Dependency policy: Express and the Node standard library only. No MCP SDK.
 */

'use strict';

var express = require('express');
var vaultScope = require('../vault/middleware/vault-scope');

var router = express.Router();

/* express.json() is NOT globally mounted on the parent app (only urlencoded
 * is). Mount it here so POST bodies are parsed before the route handler runs. */
router.use(express.json({ limit: '256kb' }));

/* -------------------------------------------------------------------------- *
 * Tool catalogue                                                              *
 *                                                                             *
 * scope:    'inquiry' for read tools, 'ops' for write tools.                 *
 * handler:  function(args, db) — executed only after scope check passes.     *
 * -------------------------------------------------------------------------- */

var TOOLS = [
  {
    name: 'payment_status_lookup',
    scope: 'inquiry',
    description:
      'Look up a single AP payment by its payment reference or by invoice ' +
      'number. Returns vendor, amount, status, hold reason, dates and risk.',
    inputSchema: {
      type: 'object',
      properties: {
        ref:     { type: 'string', description: 'Payment reference, e.g. MT-2026-08812' },
        invoice: { type: 'string', description: 'Invoice number, e.g. INV-2026-4471' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'payments_search',
    scope: 'inquiry',
    description:
      'Search AP payments by status, vendor name or free text, with paging. ' +
      'Returns up to 20 results. Use when the caller does not have a single reference.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Payment status filter, e.g. HOLD' },
        q:      { type: 'string', description: 'Free-text query (ref, vendor, invoice)' },
        page:   { type: 'integer', minimum: 1, description: 'Page number, 1-based' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'payment_risk',
    scope: 'inquiry',
    description:
      'Return the risk score and risk band for one payment by payment reference.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Payment reference' }
      },
      required: ['ref'],
      additionalProperties: false
    }
  },
  {
    name: 'payment_release',
    scope: 'ops',
    description:
      'Release a held AP payment for settlement. Write operation: requires an ' +
      'identity holding the operations scope. Currently refused — write scope ' +
      'not approved for this deployment (rule 11b).',
    inputSchema: {
      type: 'object',
      properties: {
        ref:  { type: 'string', description: 'Payment reference' },
        note: { type: 'string', description: 'Reason recorded on the audit trail' }
      },
      required: ['ref'],
      additionalProperties: false
    }
  },
  {
    name: 'payment_hold',
    scope: 'ops',
    description:
      'Place an AP payment on hold. Write operation: requires an identity ' +
      'holding the operations scope. Currently refused — write scope not ' +
      'approved for this deployment (rule 11b).',
    inputSchema: {
      type: 'object',
      properties: {
        ref:    { type: 'string', description: 'Payment reference' },
        reason: { type: 'string', description: 'Hold reason code or text' }
      },
      required: ['ref'],
      additionalProperties: false
    }
  }
];

/* Index by name for O(1) dispatch. */
var BY_NAME = {};
for (var i = 0; i < TOOLS.length; i++) {
  BY_NAME[TOOLS[i].name] = TOOLS[i];
}

/* -------------------------------------------------------------------------- *
 * Transport helpers                                                           *
 * -------------------------------------------------------------------------- */

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id: id, result: result };
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id, error: { code: code, message: message } };
}

function toolText(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

function toolError(message) {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }], isError: true };
}

/**
 * Send a JSON-RPC response. When the caller's Accept includes text/event-stream,
 * wrap as a single SSE message event so streamable-HTTP clients are satisfied.
 */
function send(req, res, payload) {
  if (payload === null) { return res.status(202).end(); }
  var accept = String((req.headers && req.headers.accept) || '');
  if (accept.indexOf('text/event-stream') !== -1) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    return res.end('event: message\ndata: ' + JSON.stringify(payload) + '\n\n');
  }
  return res.json(payload);
}

/** Extract the raw Bearer token from the Authorization header, or return ''. */
function extractToken(req) {
  var auth = String((req.headers && req.headers.authorization) || '');
  if (!auth) { return ''; }
  var m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

/* -------------------------------------------------------------------------- *
 * Tool handlers                                                               *
 *                                                                             *
 * Each handler receives (args, db) and returns a plain object that is         *
 * serialised into the tool result content block. Parameterized queries only.  *
 * -------------------------------------------------------------------------- */

var APPROVAL_LIMIT_CENTS = 5000000;

/**
 * payment_status_lookup — mirrors the /api/payment-status query logic,
 * using parameterized statements against req.app.locals.db.
 */
function handlePaymentStatusLookup(args, db) {
  if (!args.ref && !args.invoice) {
    return { ERR: 'MISSING_REF', msg: 'ref or invoice parameter is required' };
  }

  var row;
  if (args.ref) {
    row = db.prepare(
      'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
      'k.initials AS clerk_initials FROM exceptions e, vendors v ' +
      'LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
      'WHERE e.vendor_id = v.id AND e.payment_ref = ?'
    ).get(args.ref);
  } else {
    row = db.prepare(
      'SELECT e.*, v.name AS vendor, v.country AS country, v.vendor_no AS vendor_no, ' +
      'k.initials AS clerk_initials FROM exceptions e, vendors v ' +
      'LEFT JOIN ap_clerks k ON k.id = e.clerk_id ' +
      'WHERE e.vendor_id = v.id AND e.invoice_no = ?'
    ).get(args.invoice);
  }

  if (!row) {
    return {
      ERR: 'NOT_FOUND',
      PaymentRef: args.ref || '',
      InvoiceNo: args.invoice || ''
    };
  }

  return {
    PaymentRef: row.payment_ref,
    InvoiceNo: row.invoice_no,
    PO_NUM: row.po_no,
    sts: row.status,
    sts_desc: statusDescription(row.status),
    amt_cents: String(row.amount_cents),
    ccy: row.currency,
    Type: row.ptype,
    vendorName: row.vendor,
    vend_ctry: row.country,
    VendorNo: row.vendor_no,
    remit_TO: row.remit_to,
    BankBIC: row.bank_bic,
    rsn: row.reason_code,
    rsnText: row.reason_text,
    age_days: String(row.age_days),
    CreatedDate: row.created_date,
    invoice_dt: row.invoice_date,
    due_dt: row.due_date,
    expected_pay_dt: row.expected_pay_date,
    PaymentRun: row.payment_run_id,
    risk: row.risk_flag,
    Clerk: row.clerk_initials || '',
    resolved_dt: row.resolved_date || '',
    Resolution: row.resolution || '',
    over_approval_limit: (row.amount_cents >= APPROVAL_LIMIT_CENTS ? 'Y' : 'N'),
    retcode: '0000'
  };
}

/**
 * payments_search — queries the exceptions table joined to vendors.
 * Read-only, parameterized, max 20 results.
 */
function handlePaymentsSearch(args, db) {
  var page = parseInt(args.page, 10);
  if (!page || page < 1) { page = 1; }
  var pageSize = 20;
  var offset = (page - 1) * pageSize;

  /* Build the WHERE clause using only parameterized placeholders. */
  var clauses = ['e.vendor_id = v.id'];
  var params = [];

  if (args.status && args.status !== '') {
    clauses.push('e.status = ?');
    params.push(args.status);
  } else {
    clauses.push("e.status <> 'RESOLVED'");
  }

  if (args.q && args.q !== '') {
    clauses.push(
      '(e.payment_ref LIKE ? OR v.name LIKE ? OR e.invoice_no LIKE ? OR e.po_no LIKE ?)'
    );
    var like = '%' + args.q + '%';
    params.push(like, like, like, like);
  }

  params.push(pageSize, offset);

  var sql =
    'SELECT e.payment_ref, v.name AS vendor, e.status, e.risk_flag, ' +
    'e.age_days, e.amount_cents, e.currency ' +
    'FROM exceptions e, vendors v ' +
    'WHERE ' + clauses.join(' AND ') +
    ' ORDER BY e.age_days DESC, e.id ASC ' +
    'LIMIT ? OFFSET ?';

  var rows = db.prepare(sql).all(params);
  return rows;
}

/**
 * payment_risk — mirrors the /api/risk-score query and scoring logic.
 */
function handlePaymentRisk(args, db) {
  if (!args.ref) {
    return { ERR: 'MISSING_REF' };
  }

  var row = db.prepare(
    'SELECT e.*, v.country AS country, v.new_vendor AS new_vendor ' +
    'FROM exceptions e, vendors v ' +
    'WHERE e.vendor_id = v.id AND e.payment_ref = ?'
  ).get(args.ref);

  if (!row) {
    return { ERR: 'NOT_FOUND', REF: args.ref };
  }

  var scored = scoreRow(row);
  return {
    REF: row.payment_ref,
    INV: row.invoice_no,
    SCORE: String(scored.score),
    BAND: scored.band,
    amt_cents: String(row.amount_cents),
    ccy: row.currency,
    TYPE: row.ptype,
    ctry: row.country,
    age: String(row.age_days),
    dup_suspect: (row.reason_code === 'H21' ? 'Y' : 'N'),
    bank_chg_days: String(row.bank_chg_days),
    over_limit: (row.amount_cents >= APPROVAL_LIMIT_CENTS ? 'Y' : 'N'),
    round_amt: (isRoundDollar(row.amount_cents) ? 'Y' : 'N'),
    new_vend: row.new_vendor,
    model: 'APRSK01',
    retcode: '0000'
  };
}

/* -------------------------------------------------------------------------- *
 * Risk scoring — ported from COBOL routine APRSK01 (mirrors server.js).      *
 * Kept here so the MCP tool does not call back over HTTP to the legacy route. *
 * -------------------------------------------------------------------------- */

function scoreRow(row) {
  var score = 0;
  var amt = row.amount_cents;

  if (amt >= 25000000)      { score += 45; }
  else if (amt >= 10000000) { score += 35; }
  else if (amt >= 5000000)  { score += 28; }
  else if (amt >= 1000000)  { score += 18; }
  else if (amt >= 250000)   { score += 10; }
  else                       { score += 4;  }

  if (row.ptype === 'WIRE') {
    score += (amt >= 5000000 ? 14 : 9);
  } else if (row.ptype === 'SEPA') {
    score += 6;
  } else {
    score += (row.channel === 'EDI' ? 5 : 3);
  }

  if      (row.country === 'US') { score += 2;  }
  else if (row.country === 'GB') { score += 3;  }
  else if (row.country === 'DE') { score += 3;  }
  else if (row.country === 'SG') { score += 7;  }
  else if (row.country === 'MX') { score += 11; }
  else                            { score += 8;  }

  if      (row.age_days >= 14) { score += 16; }
  else if (row.age_days >= 7)  { score += 11; }
  else if (row.age_days >= 4)  { score += 6;  }
  else if (row.age_days >= 2)  { score += 2;  }

  if (isRoundDollar(amt)) {
    score += (amt >= 1000000 ? 9 : 4);
  }

  if (row.bank_chg_days >= 0) {
    if      (row.bank_chg_days <= 30) { score += 14; }
    else if (row.bank_chg_days <= 90) { score += 7;  }
    else                               { score += 2;  }
  }

  if (row.new_vendor === 'Y') { score += 6; }

  if      (row.reason_code === 'H21') { score += 12; }
  else if (row.reason_code === 'H07') { score += 9;  }
  else if (row.reason_code === 'H41') { score += 7;  }
  else if (row.reason_code === 'H09') { score += 5;  }

  if      (row.risk_flag === 'HIGH') { score += 10; }
  else if (row.risk_flag === 'MED')  { score += 4;  }

  if (score > 100) { score = 100; }
  if (score < 0)   { score = 0;   }

  return { score: score, band: bandFor(score) };
}

function bandFor(score) {
  if (score >= 70) { return 'HIGH';   }
  if (score >= 40) { return 'MEDIUM'; }
  return 'LOW';
}

function isRoundDollar(cents) {
  if (cents % 100 !== 0) { return false; }
  var dollars = cents / 100;
  return (dollars % 1000 === 0 || dollars % 500 === 0);
}

function statusDescription(status) {
  if (status === 'PENDING')   { return 'Awaiting first review'; }
  if (status === 'REVIEW')    { return 'Under review by an AP clerk'; }
  if (status === 'HOLD')      { return 'Held - awaiting vendor or goods receipt'; }
  if (status === 'ESCALATED') { return 'Escalated to AP controls'; }
  if (status === 'RESOLVED')  { return 'Closed - released or returned'; }
  return 'Unknown';
}

/* -------------------------------------------------------------------------- *
 * Dispatcher                                                                  *
 * -------------------------------------------------------------------------- */

function dispatchTool(toolName, args, db) {
  switch (toolName) {
    case 'payment_status_lookup': return handlePaymentStatusLookup(args, db);
    case 'payments_search':       return handlePaymentsSearch(args, db);
    case 'payment_risk':          return handlePaymentRisk(args, db);
    default:
      /* payment_release and payment_hold are never reached: scope check
         refuses them in the route handler before dispatch is called. */
      throw new Error('Unroutable tool: ' + toolName);
  }
}

/* -------------------------------------------------------------------------- *
 * Routes                                                                      *
 * -------------------------------------------------------------------------- */

/**
 * GET /mcp — keep-alive stream for clients that open a GET before posting.
 */
router.get('/', function (req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) { res.flushHeaders(); }
  var keepAlive = setInterval(function () { res.write(': keep-alive\n\n'); }, 25000);
  req.on('close', function () { clearInterval(keepAlive); });
});

/**
 * POST /mcp — JSON-RPC 2.0 dispatcher.
 */
router.post('/', function (req, res) {
  var msg = req.body || {};
  var id = Object.prototype.hasOwnProperty.call(msg, 'id') ? msg.id : null;

  try {
    switch (msg.method) {

      /* ------------------------------------------------------------------ */
      case 'tools/list':
        return send(req, res, rpcResult(id, {
          tools: TOOLS.map(function (t) {
            return { name: t.name, description: t.description, inputSchema: t.inputSchema };
          })
        }));

      /* ------------------------------------------------------------------ */
      case 'tools/call': {
        var params = msg.params || {};
        var toolName = params.name;
        var args = params.arguments || {};

        /* Require Authorization header for every tools/call request. */
        var token = extractToken(req);
        if (!token) {
          return res.status(401).json({
            error: 'unauthorized',
            message: 'Bearer token required'
          });
        }

        /* Look up the tool. */
        var tool = BY_NAME[toolName];
        if (!tool) {
          return send(req, res, rpcError(id, -32602, 'Unknown tool: ' + toolName));
        }

        /* Scope check via vault middleware. */
        var check = vaultScope.checkScope(toolName, token);
        if (!check.allowed) {
          /* Return the refusal as a tool result so the assistant can relay it
             verbatim — not as a transport error (rule 11c). */
          return send(req, res, rpcResult(id, toolError(check.message || check.reason)));
        }

        /* Execute the tool against the shared database connection. */
        var db = req.app.locals.db;
        var data = dispatchTool(toolName, args, db);
        return send(req, res, rpcResult(id, toolText(data)));
      }

      /* ------------------------------------------------------------------ */
      default:
        return send(req, res,
          rpcError(id, -32601, 'Method not supported: ' + msg.method));
    }
  } catch (e) {
    return send(req, res,
      rpcError(id, -32603, 'Internal error: ' + (e && e.message ? e.message : String(e))));
  }
});

module.exports = router;
