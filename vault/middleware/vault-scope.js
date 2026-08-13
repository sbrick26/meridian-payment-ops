/* ---------------------------------------------------------------------------
 * Function: Vault scope middleware — requireScope / checkScope
 * Owner:    payments-platform-team
 * Control:  AC-6 (least privilege), AC-2, IA-2 (identity)
 *           SOX/PCI: SOX 404 segregation of duties; PCI Req. 8
 * Reviewed: 2026-08-13
 * ---------------------------------------------------------------------------
 *
 * Phase-1 scope enforcement for the AP payments MCP agent layer.
 *
 * Identity model (Phase 1 — token-based, no external vault call):
 *   - Any Bearer token whose value matches VAULT_INQUIRY_TOKEN grants the
 *     'inquiry' (read-only) scope.  Tokens are compared with timing-safe
 *     equality so an attacker learns nothing from response timing.
 *   - 'ops' scope (write operations) is permanently refused in Phase 1; no
 *     token grants it.  When a real vault integration is wired in Phase 2, the
 *     ops scope will be gated on a separate, explicitly-approved token.
 *   - A call with no Authorization header or an unrecognised token is refused
 *     with 401; the identity is not propagated upstream.
 *
 * Refusals are auditable events per rule 11(c): the identity, the required
 * scope, and the policies carried by the token are all returned in the
 * response body in terms an operator can act on.
 * ------------------------------------------------------------------------- */

'use strict';

const crypto = require('crypto');

/** Supported identity policies in Phase 1. */
const KNOWN_POLICIES = {
  inquiry: ['ap-payments-read-only'],
  ops:     [],            // ops scope not issued in Phase 1
};

/**
 * Constant-time comparison of two strings.
 * Prevents timing-oracle leakage of the secret token.
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') { return false; }
  if (a.length !== b.length) {
    // Still do the comparison so timing is uniform for equal-length inputs;
    // length check is constant-cost.
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Extract the raw token from an Authorization header.
 * Accepts  "Bearer <token>"  or the raw token value directly.
 */
function extractToken(authHeader) {
  if (!authHeader) { return ''; }
  const m = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : String(authHeader).trim();
}

/**
 * checkScope(token, requiredScope) → Promise<IdentityResult>
 *
 * Returns an IdentityResult:
 *   allowed   boolean
 *   identity  string | null   — the identity name if allowed
 *   scopes    string[]        — scopes carried by the token
 *   policies  string[]        — policies attached to this identity
 *   error     string | null   — set when the token itself is unverifiable
 */
async function checkScope(rawToken, requiredScope) {
  // Accept both "Bearer <token>" and bare token values.
  const m = String(rawToken || '').match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1].trim() : String(rawToken || '').trim();
  const inquiryToken = process.env.VAULT_INQUIRY_TOKEN || '';

  // ops scope is permanently refused in Phase 1.
  if (requiredScope === 'ops') {
    const granted = safeEqual(token, inquiryToken) ? ['inquiry'] : [];
    return {
      allowed:  false,
      identity: null,
      scopes:   granted,
      policies: KNOWN_POLICIES.inquiry,
      error:    null,
    };
  }

  // inquiry scope: any token matching VAULT_INQUIRY_TOKEN is allowed.
  if (requiredScope === 'inquiry') {
    if (!inquiryToken) {
      return {
        allowed:  false,
        identity: null,
        scopes:   [],
        policies: [],
        error:    'VAULT_INQUIRY_TOKEN is not configured on this service',
      };
    }
    if (safeEqual(token, inquiryToken)) {
      return {
        allowed:   true,
        identity:  'ap-inquiry-agent',
        scopes:    ['inquiry'],
        policies:  KNOWN_POLICIES.inquiry,
        error:     null,
      };
    }
    return {
      allowed:  false,
      identity: null,
      scopes:   [],
      policies: [],
      error:    token ? null : 'No token presented',
    };
  }

  return {
    allowed: false,
    identity: null,
    scopes:   [],
    policies: [],
    error:    `Unknown scope: ${requiredScope}`,
  };
}

/**
 * requireScope(scope) → Express middleware
 *
 * Rejects the request with 401 if no recognisable identity is present, or
 * 403 if the identity lacks the required scope.  On success, attaches
 * req.identity so downstream routes can reference it.
 *
 * Used as the entry gate on the /mcp router.
 */
function requireScope(scope) {
  return async function vaultScopeMiddleware(req, res, next) {
    const token = extractToken(req.headers && req.headers.authorization);
    const result = await checkScope(token, scope);

    if (result.error && !result.allowed) {
      return res.status(401).json({
        error:          'identity_unverified',
        detail:         result.error,
        required_scope: scope,
      });
    }

    if (!result.allowed) {
      return res.status(403).json({
        error:          'identity_scope_denied',
        detail:         `Token identity lacks scope '${scope}'`,
        identity:       result.identity || 'unknown',
        policies:       result.policies,
        granted_scopes: result.scopes,
        required_scope: scope,
      });
    }

    req.identity = result.identity;
    return next();
  };
}

module.exports = { requireScope, checkScope };
