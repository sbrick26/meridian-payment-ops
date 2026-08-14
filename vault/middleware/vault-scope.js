/* ---------------------------------------------------------------------------
 * Function: Vault agent-identity scope enforcement (requireScope middleware)
 * Owner:    payments-platform-team
 * Control:  AC-6 (least privilege), AC-2, IA-2 (agent identity via Vault)
 *           SOX/PCI: SOX 404 segregation of duties; PCI Req. 7, Req. 8
 * Reviewed: 2026-08-13
 * ------------------------------------------------------------------------- */

/**
 * vault-scope.js — agent-identity scope enforcement for the modernized AP API.
 *
 * Production-proven middleware copied verbatim from
 * .bob/skills/agent-enablement/templates/vault-scope.js (KAN-78, 2026-08-13).
 * No logic changes. Env reads are optional with safe fallbacks.
 *
 * The point of this module: the modern AP payments API does NOT decide what a
 * caller may do from a hard-coded role string in its own code. It asks Vault
 * "who is this token?", gets back the identity's *policies*, and maps those
 * policies to scopes. The assistant platform authenticates with a token minted
 * for the `ap-inquiry-agent` identity, which carries the read-only
 * `ap-inquiry-read` policy — so its inquiry tools work and its write tools are
 * refused with an auditable 403 that names the identity's policies.
 *
 * Environment (all optional, safe defaults):
 *   VAULT_ADDR                 default http://127.0.0.1:8200
 *   VAULT_TOKEN                service's own Vault token for standing checks
 *   VAULT_SCOPE_CACHE_MS       default 15000
 *   VAULT_STATUS_CACHE_MS      default 5000
 *   VAULT_STATUS_PATH          default secret/data/meridian/ap-api/identity-status
 *   GOV_INGEST_URL             governance ingest base URL (optional)
 *   GOV_INGEST_TOKEN           bearer token for governance endpoint (optional)
 *   GOV_INGEST_DRY_RUN         "1" => print event instead of posting
 *   GOV_PROJECT                default meridian-payment-ops
 *   GOV_SOURCE                 default api
 */

'use strict';

const VAULT_ADDR = () =>
  (process.env.VAULT_ADDR || 'http://127.0.0.1:8200').replace(/\/+$/, '');

const POLICY_SCOPES = {
  'ap-inquiry-read': ['inquiry'],
  'ap-ops-write':    ['inquiry', 'ops'],
};

const POLICY_IDENTITIES = {
  'ap-inquiry-read': 'ap-inquiry-agent',
  'ap-ops-write':    'ap-ops-agent',
};

const IGNORED_POLICIES = new Set(['default']);
const SUSPENDED = 'suspended';

const CACHE_MS = () => {
  const v = Number(process.env.VAULT_SCOPE_CACHE_MS);
  return Number.isFinite(v) ? v : 15000;
};
const cache = new Map();

const STATUS_CACHE_MS = () => {
  const v = Number(process.env.VAULT_STATUS_CACHE_MS);
  return Number.isFinite(v) ? v : 5000;
};
let statusCache = null;

const STATUS_PATH = () =>
  (process.env.VAULT_STATUS_PATH || 'secret/data/meridian/ap-api/identity-status')
    .replace(/^\/+/, '');

function scopesForPolicies(policies) {
  const out = new Set();
  for (const p of policies || []) {
    if (IGNORED_POLICIES.has(p)) continue;
    for (const s of POLICY_SCOPES[p] || []) out.add(s);
  }
  return [...out].sort();
}

function identityForPolicies(policies) {
  for (const p of policies || []) {
    if (POLICY_IDENTITIES[p]) return POLICY_IDENTITIES[p];
  }
  return null;
}

async function identityStatus() {
  const ttl = STATUS_CACHE_MS();
  if (ttl > 0 && statusCache && statusCache.expires > Date.now()) return statusCache.map;

  const token = String(
    process.env.VAULT_TOKEN || process.env.VAULT_STATUS_TOKEN || '',
  ).trim();
  if (!token) return {};

  let map = {};
  try {
    const res = await fetch(`${VAULT_ADDR()}/v1/${STATUS_PATH()}`, {
      method: 'GET',
      headers: { 'X-Vault-Token': token },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const body = await res.json();
      const data  = (body && body.data) || {};
      const inner = data.data && typeof data.data === 'object' ? data.data : data;
      for (const [k, v] of Object.entries(inner)) {
        if (typeof v === 'string') map[k] = v;
      }
    }
  } catch {
    map = {};
  }

  if (ttl > 0) statusCache = { expires: Date.now() + ttl, map };
  return map;
}

function clearStatusCache() { statusCache = null; }

async function resolveIdentity(token) {
  const fail = (error) => ({ policies: [], scopes: [], identity: null, error });

  const ttl = CACHE_MS();
  const key = `${token} ${VAULT_ADDR()}`;
  if (ttl > 0) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.result;
    cache.delete(key);
  }

  let res;
  try {
    res = await fetch(`${VAULT_ADDR()}/v1/auth/token/lookup-self`, {
      method: 'GET',
      headers: { 'X-Vault-Token': token },
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    return fail(`vault_unreachable: ${e && e.message ? e.message : e}`);
  }

  if (res.status === 403) return fail('invalid_or_expired_token');
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
    return fail(`vault_lookup_failed_${res.status}${detail ? `: ${detail}` : ''}`);
  }

  let body;
  try { body = await res.json(); } catch { return fail('vault_bad_response'); }

  const data     = (body && body.data) || {};
  const policies = Array.isArray(data.policies) ? data.policies : [];
  const result   = {
    policies,
    scopes:   scopesForPolicies(policies),
    identity: identityForPolicies(policies) || data.display_name || data.entity_id || null,
    error:    null,
  };

  if (ttl > 0) cache.set(key, { expires: Date.now() + ttl, result });
  return result;
}

async function checkScope(bearerToken, requiredScope) {
  const deny = (error, extra = {}) => ({
    allowed: false, suspended: false, policies: [], scopes: [],
    identity: null, error, ...extra,
  });

  const token = String(bearerToken || '').replace(/^Bearer\s+/i, '').trim();
  if (!token)         return deny('missing_token');
  if (!requiredScope) return deny('missing_required_scope');

  const id = await resolveIdentity(token);
  if (id.error) return deny(id.error);

  const standing = await identityStatus();
  if (id.identity && standing[id.identity] === SUSPENDED) {
    return {
      allowed:   false,
      suspended: true,
      policies:  id.policies,
      scopes:    id.scopes,
      identity:  id.identity,
      error:     null,
    };
  }

  return {
    allowed:   id.scopes.includes(requiredScope),
    suspended: false,
    policies:  id.policies,
    scopes:    id.scopes,
    identity:  id.identity,
    error:     null,
  };
}

async function emitGovernanceEvent(event) {
  const base   = String(process.env.GOV_INGEST_URL || '').replace(/\/+$/, '');
  const dryRun = String(process.env.GOV_INGEST_DRY_RUN || '') === '1';
  if (!base && !dryRun) return false;

  const record = {
    ts:         new Date().toISOString(),
    source:     process.env.GOV_SOURCE  || 'api',
    actor:      event.actor             || 'unknown',
    event_type: event.event_type,
    rule:       event.rule              || 'scope-enforcement',
    severity:   event.severity,
    detail:     event.detail            || null,
    tool:       event.tool              || null,
    project:    process.env.GOV_PROJECT || 'meridian-payment-ops',
    scope:      event.scope             || null,
    identity:   event.actor             || null,
  };

  if (dryRun) {
    console.log(`[governance-event] ${JSON.stringify(record)}`);
    return true;
  }

  try {
    const res = await fetch(`${base}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.GOV_INGEST_TOKEN
          ? { Authorization: `Bearer ${process.env.GOV_INGEST_TOKEN}` }
          : {}),
      },
      body:   JSON.stringify(record),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function emitQuietly(event) {
  try {
    const p = emitGovernanceEvent(event);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch { /* ignore */ }
}

function routeName(req) {
  const path = String((req && req.originalUrl) || (req && req.url) || '').split('?')[0];
  return `${(req && req.method) || 'GET'} ${path || '/'}`;
}

function requireScope(scope, opts = {}) {
  const emit = opts.emit !== false;

  return function vaultScopeMiddleware(req, res, next) {
    const token = (req.headers && (req.headers.authorization || req.headers['x-vault-token'])) || '';
    const tool  = opts.tool || routeName(req);

    checkScope(token, scope).then((result) => {
      if (result.allowed) {
        req.vaultIdentity = {
          identity: result.identity,
          policies: result.policies,
          scopes:   result.scopes,
        };
        if (emit) {
          emitQuietly({
            event_type: 'identity_allowed',
            severity:   'info',
            actor:      result.identity,
            tool,
            scope,
            detail:     `${tool} permitted — identity ${result.identity} holds scope '${scope}'`,
          });
        }
        return next();
      }

      if (result.error) {
        emitQuietly({
          event_type: 'identity_denied',
          severity:   'critical',
          actor:      'unverified',
          tool,
          scope,
          detail:     `${tool} refused — caller identity could not be verified (${result.error})`,
        });
        return res.status(401).json({
          error:          'identity_unverified',
          detail:         `Could not verify caller identity with Vault (${result.error})`,
          required_scope: scope,
        });
      }

      if (result.suspended) {
        emitQuietly({
          event_type: 'identity_denied',
          severity:   'critical',
          actor:      result.identity,
          tool,
          scope,
          detail:     `${tool} refused — identity ${result.identity} is suspended in the governance control plane`,
        });
        return res.status(403).json({
          error:          'identity_suspended',
          detail:         `Identity ${result.identity} is suspended in the governance control plane`,
          identity:       result.identity,
          policies:       result.policies,
          required_scope: scope,
        });
      }

      emitQuietly({
        event_type: 'identity_denied',
        severity:   'critical',
        actor:      result.identity,
        tool,
        scope,
        detail:     `${tool} refused — identity ${result.identity} lacks scope '${scope}' (holds ${result.scopes.join(', ') || 'none'})`,
      });
      return res.status(403).json({
        error:          'identity_scope_denied',
        detail:         `Token identity lacks scope '${scope}'`,
        identity:       result.identity,
        policies:       result.policies,
        granted_scopes: result.scopes,
        required_scope: scope,
      });
    }).catch((e) => {
      res.status(401).json({
        error:          'identity_unverified',
        detail:         `Identity check failed unexpectedly: ${e && e.message ? e.message : e}`,
        required_scope: scope,
      });
    });
  };
}

function clearScopeCache() { cache.clear(); statusCache = null; }

module.exports = {
  checkScope,
  requireScope,
  clearScopeCache,
  clearStatusCache,
  identityStatus,
  emitGovernanceEvent,
  scopesForPolicies,
  identityForPolicies,
  POLICY_SCOPES,
  POLICY_IDENTITIES,
};
