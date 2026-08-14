/**
 * vault-scope.js — agent-identity scope enforcement for the modernized AP API.
 *
 * The point of this module: the modern AP payments API does NOT decide what a
 * caller may do from a hard-coded role string in its own code. It asks Vault
 * "who is this token?", gets back the identity's *policies*, and maps those
 * policies to scopes. The assistant platform authenticates with a token minted
 * for the `ap-inquiry-agent` identity, which carries the read-only
 * `ap-inquiry-read` policy — so its inquiry tools work and its write tools are
 * refused with an auditable 403 that names the identity's policies.
 *
 * Three enforcement layers, in order:
 *
 *   1. Identity   — Vault vouches for the token, or the call is 401.
 *   2. Standing   — the governance control plane may SUSPEND an identity out of
 *                   band; a suspended identity is 403 regardless of its scopes.
 *   3. Scope      — the identity's policies must grant the route's scope.
 *
 * Every decision, allow or deny, is reported to the governance ingest endpoint
 * as a fire-and-forget event, so the control plane sees the runtime and not just
 * the configuration.
 *
 * Zero dependencies. Uses the global `fetch` (Node 18+). Nothing to install.
 *
 *   const { checkScope, requireScope } = require('./middleware/vault-scope');
 *
 *   app.get ('/api/v2/payments/:ref',         requireScope('inquiry'), handler);
 *   app.post('/api/v2/payments/:ref/release', requireScope('ops'),     handler);
 *
 * Environment:
 *   VAULT_ADDR                 default http://127.0.0.1:8200
 *   VAULT_TOKEN                the service's own Vault token, used to read the
 *                              identity-status key. Absent => standing checks
 *                              are skipped (scope enforcement is unaffected).
 *   VAULT_SCOPE_CACHE_MS       default 15000 (0 disables the lookup cache)
 *   VAULT_STATUS_CACHE_MS      default 5000  (0 disables the standing cache)
 *   VAULT_STATUS_PATH          default secret/data/meridian/ap-api/identity-status
 *   GOV_INGEST_URL             governance ingest base URL. Absent => no events.
 *   GOV_INGEST_TOKEN           bearer token for that endpoint. Optional.
 *   GOV_INGEST_DRY_RUN         "1" => print the event instead of posting it.
 *   GOV_PROJECT                default meridian-payment-ops
 *   GOV_SOURCE                 default api
 *
 * Every governance-event variable is optional and every failure to emit is
 * swallowed: observability never becomes a dependency of serving a request.
 */

'use strict';

const VAULT_ADDR = () =>
  (process.env.VAULT_ADDR || 'http://127.0.0.1:8200').replace(/\/+$/, '');

/**
 * The identity contract. A Vault policy is a *capability*, and this table is
 * the single place where a capability becomes an API scope. Adding a new
 * governed identity means adding a policy in setup-vault.sh and one line here
 * — never a change to a route handler.
 */
const POLICY_SCOPES = {
  'ap-inquiry-read': ['inquiry'],            // payment status / search / risk
  'ap-ops-write': ['inquiry', 'ops'],        // + release / hold payment
};

/**
 * Policy -> the governance identity that holds it. Vault tokens issued from a
 * fixed policy carry no display name worth auditing, so the identity the
 * control plane suspends and the dashboard shows is derived from the policy —
 * the same fact the scope table is derived from, read a second way.
 */
const POLICY_IDENTITIES = {
  'ap-inquiry-read': 'ap-inquiry-agent',
  'ap-ops-write': 'ap-ops-agent',
};

/** Vault attaches `default` to every token; it grants no API scope here. */
const IGNORED_POLICIES = new Set(['default']);

/** The standing value that means "this identity may not act right now". */
const SUSPENDED = 'suspended';

/** Lookup cache: token -> { expires, result }. Keeps per-call latency off the
 *  critical path without ever caching a *denial* longer than a blink. */
const CACHE_MS = () => {
  const v = Number(process.env.VAULT_SCOPE_CACHE_MS);
  return Number.isFinite(v) ? v : 15000;
};
const cache = new Map();

/** Standing cache. Deliberately shorter than the identity cache: a suspension
 *  is an incident response, and it has to bite within seconds. */
const STATUS_CACHE_MS = () => {
  const v = Number(process.env.VAULT_STATUS_CACHE_MS);
  return Number.isFinite(v) ? v : 5000;
};
let statusCache = null;   // { expires, map }

const STATUS_PATH = () =>
  (process.env.VAULT_STATUS_PATH || 'secret/data/meridian/ap-api/identity-status')
    .replace(/^\/+/, '');

/** Scopes granted by a set of Vault policies (deduplicated, sorted). */
function scopesForPolicies(policies) {
  const out = new Set();
  for (const p of policies || []) {
    if (IGNORED_POLICIES.has(p)) continue;
    for (const s of POLICY_SCOPES[p] || []) out.add(s);
  }
  return [...out].sort();
}

/** The governance identity a set of policies belongs to, or null. */
function identityForPolicies(policies) {
  for (const p of policies || []) {
    if (POLICY_IDENTITIES[p]) return POLICY_IDENTITIES[p];
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Layer 2: standing (the governance control plane)                    *
 * ------------------------------------------------------------------ */

/**
 * Read the identity-status key: `{ "<identity>": "active" | "suspended" }`.
 *
 * Read with the *service's* own token, not the caller's: the caller must not be
 * able to influence whether its own suspension is visible.
 *
 * Fails open, on purpose and with a narrow blast radius. If the key is missing
 * or Vault is briefly unreachable this returns an empty map, which suspends
 * nobody — scope enforcement (layer 3) is untouched and still fails closed. The
 * alternative, refusing every request when the status key cannot be read, turns
 * one unavailable key into a total outage of a read-only inquiry API.
 *
 * @returns {Promise<Object<string,string>>} identity -> standing
 */
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
      // KV v2 nests the payload one level deeper than KV v1; accept either.
      const data = (body && body.data) || {};
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

/** Drop the cached identity standing (tests, or after a suspend/restore). */
function clearStatusCache() { statusCache = null; }

/* ------------------------------------------------------------------ *
 * Layer 3: identity and scope                                         *
 * ------------------------------------------------------------------ */

/**
 * Resolve a Vault token to its identity: policies, scopes and governance name.
 * Cached; never throws. Standing is deliberately NOT part of this result, so a
 * suspension is never masked by a warm identity cache.
 */
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
    // lookup-self is the token asking Vault about itself: the API server never
    // needs privileged Vault credentials of its own to identify a caller.
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

  const data = (body && body.data) || {};
  const policies = Array.isArray(data.policies) ? data.policies : [];
  const result = {
    policies,
    scopes: scopesForPolicies(policies),
    identity: identityForPolicies(policies) || data.display_name || data.entity_id || null,
    error: null,
  };

  if (ttl > 0) cache.set(key, { expires: Date.now() + ttl, result });
  return result;
}

/**
 * Resolve a Vault token to its identity, then answer one question:
 * may this identity do a thing requiring `requiredScope`, right now?
 *
 * @param {string} bearerToken   a Vault token (the raw token, no "Bearer ")
 * @param {string} requiredScope e.g. 'inquiry' or 'ops'
 * @returns {Promise<{allowed:boolean, suspended:boolean, policies:string[],
 *                    scopes:string[], identity:(string|null),
 *                    error:(string|null)}>}
 *
 * Never throws: an unreachable Vault, a garbage token and an expired token all
 * come back as { allowed:false, error:'<reason>' } so the caller can render a
 * clean refusal instead of a stack trace. Fail-closed by construction.
 */
async function checkScope(bearerToken, requiredScope) {
  const deny = (error, extra = {}) => ({
    allowed: false, suspended: false, policies: [], scopes: [],
    identity: null, error, ...extra,
  });

  const token = String(bearerToken || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return deny('missing_token');
  if (!requiredScope) return deny('missing_required_scope');

  const id = await resolveIdentity(token);
  if (id.error) return deny(id.error);

  // Standing before scope: a suspended identity is refused even for a call its
  // policies would otherwise permit, and the refusal says so.
  const standing = await identityStatus();
  if (id.identity && standing[id.identity] === SUSPENDED) {
    return {
      allowed: false,
      suspended: true,
      policies: id.policies,
      scopes: id.scopes,
      identity: id.identity,
      error: null,
    };
  }

  return {
    allowed: id.scopes.includes(requiredScope),
    suspended: false,
    policies: id.policies,
    scopes: id.scopes,
    identity: id.identity,
    error: null,
  };
}

/* ------------------------------------------------------------------ *
 * Governance events                                                   *
 * ------------------------------------------------------------------ */

/**
 * Report one identity decision to the governance control plane.
 *
 * Fire-and-forget by contract: this returns a promise for tests, but callers on
 * the request path do not await it and every failure mode — no configuration, a
 * dead endpoint, a 500, a timeout — resolves quietly. An API that stops serving
 * because its audit sink is down has traded one outage for two.
 *
 * @param {object} event
 * @param {string} event.event_type  identity_allowed | identity_denied | ...
 * @param {string} event.severity    critical | high | medium | info
 * @param {string} event.actor       the governance identity that acted
 * @param {string} event.tool        tool name, or the route that was called
 * @param {string} event.detail      one human sentence
 * @param {string} [event.scope]     the scope the call required
 * @returns {Promise<boolean>} true if handed off, false if skipped or failed
 */
async function emitGovernanceEvent(event) {
  const base = String(process.env.GOV_INGEST_URL || '').replace(/\/+$/, '');
  const dryRun = String(process.env.GOV_INGEST_DRY_RUN || '') === '1';
  if (!base && !dryRun) return false;

  const record = {
    ts: new Date().toISOString(),
    source: process.env.GOV_SOURCE || 'api',
    actor: event.actor || 'unknown',
    event_type: event.event_type,
    rule: event.rule || 'scope-enforcement',
    severity: event.severity,
    detail: event.detail || null,
    tool: event.tool || null,
    project: process.env.GOV_PROJECT || 'meridian-payment-ops',
    scope: event.scope || null,
    // `identity` mirrors `actor` for the control plane's identity view, which
    // filters on the identity column rather than the free-form actor column.
    identity: event.actor || null,
  };

  if (dryRun) {
    // eslint-disable-next-line no-console
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
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Never let an emission failure surface on the request path. */
function emitQuietly(event) {
  try {
    const p = emitGovernanceEvent(event);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ *
 * Express middleware                                                  *
 * ------------------------------------------------------------------ */

/** The route being called, for the event's `tool` field. */
function routeName(req) {
  const path = String((req && req.originalUrl) || (req && req.url) || '').split('?')[0];
  return `${(req && req.method) || 'GET'} ${path || '/'}`;
}

/**
 * Express middleware factory. Read tools mount `requireScope('inquiry')`,
 * write tools mount `requireScope('ops')`.
 *
 * On success it attaches `req.vaultIdentity = { identity, policies, scopes }`
 * so handlers and the audit log can record *who* acted.
 *
 * Refusals:
 *   401 identity_unverified    no token, or Vault could not vouch for it
 *   403 identity_suspended     a real identity the control plane has suspended
 *   403 identity_scope_denied  a real identity that simply lacks the scope
 *
 * @param {string} scope
 * @param {{tool?:string, emit?:boolean}} [opts]
 *   `tool` names the event's subject when the route is not the useful name
 *   (an MCP tool, say). `emit:false` silences only the ALLOW event, for a gate
 *   layered in front of another check that will emit it — one call, one event.
 *   Refusals always emit regardless: a refusal ends the request here, the
 *   layered check never runs, and a silenced refusal is an unrecorded denial —
 *   which is how a suspended identity's blocked calls went missing from the
 *   governance feed.
 */
function requireScope(scope, opts = {}) {
  const emit = opts.emit !== false;

  return function vaultScopeMiddleware(req, res, next) {
    const token =
      (req.headers && (req.headers.authorization || req.headers['x-vault-token'])) || '';
    const tool = opts.tool || routeName(req);

    checkScope(token, scope).then((result) => {
      if (result.allowed) {
        req.vaultIdentity = {
          identity: result.identity,
          policies: result.policies,
          scopes: result.scopes,
        };
        if (emit) {
          emitQuietly({
            event_type: 'identity_allowed',
            severity: 'info',
            actor: result.identity,
            tool,
            scope,
            detail: `${tool} permitted — identity ${result.identity} holds scope '${scope}'`,
          });
        }
        return next();
      }

      // No verifiable identity at all -> 401, not 403. Nothing to attribute the
      // event to either, so it is reported against the unverified token.
      if (result.error) {
        {
          emitQuietly({
            event_type: 'identity_denied',
            severity: 'critical',
            actor: 'unverified',
            tool,
            scope,
            detail: `${tool} refused — caller identity could not be verified (${result.error})`,
          });
        }
        return res.status(401).json({
          error: 'identity_unverified',
          detail: `Could not verify caller identity with Vault (${result.error})`,
          required_scope: scope,
        });
      }

      // Suspended out of band by the governance control plane. This outranks
      // scope: the identity is not being told it lacks a capability, it is
      // being told it may not act at all.
      if (result.suspended) {
        {
          emitQuietly({
            event_type: 'identity_denied',
            severity: 'critical',
            actor: result.identity,
            tool,
            scope,
            detail: `${tool} refused — identity ${result.identity} is suspended in the governance control plane`,
          });
        }
        return res.status(403).json({
          error: 'identity_suspended',
          detail: `Identity ${result.identity} is suspended in the governance control plane`,
          identity: result.identity,
          policies: result.policies,
          required_scope: scope,
        });
      }

      // A known identity that is not allowed to do this. Name the policies so
      // the refusal is auditable and self-explanatory.
      {
        emitQuietly({
          event_type: 'identity_denied',
          severity: 'critical',
          actor: result.identity,
          tool,
          scope,
          detail: `${tool} refused — identity ${result.identity} lacks scope '${scope}' (holds ${result.scopes.join(', ') || 'none'})`,
        });
      }
      return res.status(403).json({
        error: 'identity_scope_denied',
        detail: `Token identity lacks scope '${scope}'`,
        identity: result.identity,
        policies: result.policies,
        granted_scopes: result.scopes,
        required_scope: scope,
      });
    }).catch((e) => {
      // Belt and braces: checkScope is non-throwing, but never 500 on identity.
      res.status(401).json({
        error: 'identity_unverified',
        detail: `Identity check failed unexpectedly: ${e && e.message ? e.message : e}`,
        required_scope: scope,
      });
    });
  };
}

/** Drop cached lookups (tests, or after re-running setup-vault.sh). */
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
