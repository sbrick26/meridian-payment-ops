/* ---------------------------------------------------------------------------
 * Function: Vault-backed scope enforcement middleware (Phase 1 stub)
 * Owner:    payments-platform-team
 * Control:  AC-3 (access enforcement), AC-6 (least privilege)
 *           SOX/PCI: PCI Req. 7 (access control), PCI Req. 8 (identity)
 * Reviewed: 2026-08-13
 * ------------------------------------------------------------------------- */

'use strict';

/**
 * Phase 1 identity model
 *
 * A real Vault integration (KV v2 token validation, PKI cert binding) is a
 * follow-on. For Phase 1 the boundary is:
 *
 *   inquiry scope — any well-formed non-empty Bearer token is accepted.
 *                   The boundary is demonstrated by the ops scope being refused;
 *                   the exact token value is not validated against a server.
 *
 *   ops scope     — always denied. Write access requires a separate identity
 *                   policy that does not exist in Phase 1. Any call that reaches
 *                   this check with scope='ops' is refused with a structured
 *                   error naming the missing scope, the granted scopes, and the
 *                   policies in effect.
 *
 * When real Vault is wired, replace the token-presence check in `checkScope`
 * with a Vault token lookup against the ap-payments-read-only policy, and
 * remove this comment block.
 */

/** Scopes and policies this identity tier holds (read-only, Phase 1). */
const GRANTED_SCOPES = ['inquiry'];
const POLICIES       = ['ap-payments-read-only'];

/**
 * Extract the raw token string from a Bearer or x-vault-token header value.
 * Returns the trimmed token, or '' if the header is absent or malformed.
 */
function extractToken(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  // Accept both "Bearer <token>" and a bare token (x-vault-token style).
  const m = s.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : s;
}

/**
 * checkScope(token, scope) — async, for use in the MCP invoke path.
 *
 * @param  {string} token  Raw Authorization / x-vault-token header value.
 * @param  {string} scope  Required scope: 'inquiry' or 'ops'.
 * @returns {Promise<{allowed: boolean, scopes: string[], policies: string[], error: string|null}>}
 */
async function checkScope(token, scope) {
  const t = extractToken(token);

  if (scope === 'inquiry') {
    if (t) {
      return { allowed: true,  scopes: GRANTED_SCOPES, policies: POLICIES, error: null };
    }
    // No usable token — identity unverified.
    return { allowed: false, scopes: GRANTED_SCOPES, policies: POLICIES, error: 'no_token' };
  }

  if (scope === 'ops') {
    // ops scope is permanently refused in Phase 1.
    return { allowed: false, scopes: GRANTED_SCOPES, policies: POLICIES, error: null };
  }

  // Unknown scope — refuse and surface the scope name so callers can debug.
  return { allowed: false, scopes: GRANTED_SCOPES, policies: POLICIES, error: `unknown_scope:${scope}` };
}

/**
 * requireScope(scope) — Express middleware factory.
 *
 * Reads the Bearer token from the Authorization header or x-vault-token header.
 * For 'inquiry' scope: accepts any non-empty token (Phase 1 — no real Vault).
 * For 'ops' scope: always denies with HTTP 403 and a structured JSON error.
 *
 * Usage:
 *   router.use(requireScope('inquiry'));           // gate a read router
 *   router.post('/release', requireScope('ops'), handler);  // gate a write route
 *
 * @param  {string} scope  'inquiry' | 'ops'
 * @returns {function}     Express middleware (req, res, next)
 */
function requireScope(scope) {
  return async function vaultScopeMiddleware(req, res, next) {
    const h = req.headers || {};
    const raw = String(h.authorization || h['x-vault-token'] || '');

    let result;
    try {
      result = await checkScope(raw, scope);
    } catch (e) {
      return res.status(500).json({
        error: 'identity_check_failed',
        detail: `Scope check threw: ${e && e.message ? e.message : e}`,
      });
    }

    if (result.allowed) {
      return next();
    }

    if (result.error === 'no_token') {
      return res.status(401).json({
        error: 'identity_unverified',
        detail: 'No bearer token presented; include Authorization: Bearer <token>',
        required_scope: scope,
        granted_scopes: result.scopes,
        policies: result.policies,
      });
    }

    // scope denied (covers ops always, and any unknown scope)
    return res.status(403).json({
      error: 'identity_scope_denied',
      detail: `Token identity lacks scope '${scope}'`,
      required_scope: scope,
      granted_scopes: result.scopes,
      policies: result.policies,
    });
  };
}

module.exports = { requireScope, checkScope };
