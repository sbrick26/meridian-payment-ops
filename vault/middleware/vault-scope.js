/* ---------------------------------------------------------------------------
 * Function: vault-scope
 * Owner:    payments-platform-team
 * Control:  AC-6   (SOX 404 segregation of duties; PCI Req. 8; rule 11)
 * Reviewed: 2026-08-13
 * --------------------------------------------------------------------------- */

/**
 * vault-scope.js — scope enforcement for the AP payments MCP tool layer.
 *
 * Exports a single function: checkScope(toolName, token).
 *
 * Design note (rule 11b):
 *   Write scope (ops) is PERMANENTLY REFUSED in this module. This is not a
 *   runtime check against a policy store — it is hardcoded. The write scope
 *   requires written approval from the service owner and the control owner,
 *   naming the assistant, the operations, and the limits, recorded in the plan
 *   document. That approval has not been obtained for this epic (KAN-51/KAN-52).
 *   Absent that record, the scope is not granted and cannot be granted by any
 *   runtime value, flag, or argument.
 *
 *   The tool definitions remain in the catalogue so the refusal is auditable
 *   (rule 11b: "hiding the operation is not an equivalent measure"). Every
 *   attempted write call produces the canonical refusal message and is logged
 *   by the caller.
 */

'use strict';

/** Tools that the inquiry identity is permitted to call. */
var INQUIRY_TOOLS = {
  payment_status_lookup: true,
  payments_search: true,
  payment_risk: true
};

/** Tools requiring the ops scope — permanently refused per rule 11(b). */
var OPS_TOOLS = {
  payment_release: true,
  payment_hold: true
};

/**
 * checkScope(toolName, token)
 *
 * Returns:
 *   { allowed: true }
 *     — inquiry tool and a token is present.
 *
 *   { allowed: false, reason: "identity_scope_denied", message: "...",
 *     identity: "ap-inquiry-agent" }
 *     — ops tool (payment_release or payment_hold): always refused regardless
 *       of the token value. This is the permanent control, not a runtime check.
 *
 *   { allowed: false, reason: "unauthorized", message: "Bearer token required" }
 *     — no token was presented.
 *
 * @param {string} toolName  - the tool being called
 * @param {string|null} token - the raw Bearer token extracted from the
 *                              Authorization header, or null/empty string
 * @returns {{ allowed: boolean, reason?: string, message?: string, identity?: string }}
 */
function checkScope(toolName, token) {
  /* --- no token at all: refuse before checking the tool --- */
  if (!token || !token.trim()) {
    return {
      allowed: false,
      reason: 'unauthorized',
      message: 'Bearer token required'
    };
  }

  /* --- ops scope: permanently refused (rule 11b) --- */
  if (OPS_TOOLS[toolName]) {
    return {
      allowed: false,
      reason: 'identity_scope_denied',
      message: 'Token identity lacks scope ops, policies:[ap-payments-read-only]',
      identity: 'ap-inquiry-agent'
    };
  }

  /* --- inquiry scope: any valid Bearer token is sufficient --- */
  if (INQUIRY_TOOLS[toolName]) {
    return { allowed: true };
  }

  /* --- unknown tool: refuse conservatively --- */
  return {
    allowed: false,
    reason: 'identity_scope_denied',
    message: 'Unknown tool: ' + toolName
  };
}

module.exports = { checkScope: checkScope };
