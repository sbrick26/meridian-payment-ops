#!/bin/bash
# =============================================================================
# Payment Operations Console - workspace setup
#
# What it does:
#   1. Resolves to the repo root regardless of where you run it from.
#   2. Checks Node.js (>=18) and npm.
#   3. Bootstraps .env from .env.example if missing (then exits so you can edit).
#   4. Installs npm dependencies if node_modules is missing.
#   5. Generates .bob/mcp.json from .bob/mcp.json.example using values in .env
#      (servers whose required env is missing are auto-disabled).
#   6. Seeds the local SQLite database if it does not exist yet.
#
# Usage:
#   ./setup.sh          full setup
#   ./setup.sh --mcp    quick mode: regenerate .bob/mcp.json only
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "${BLUE}$1${NC}"; }
ok()   { echo -e "  ${GREEN}✓ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "  ${RED}✗ $1${NC}"; }

DB_FILE="payops.db"

# Generates .bob/mcp.json from .bob/mcp.json.example using values from .env.
# Auto-disables any server whose required env is missing/empty.
generate_mcp_json() {
    if [ ! -f ".env" ]; then
        fail ".env not found. Run ./setup.sh (no flags) to bootstrap it."
        exit 1
    fi
    if [ ! -f ".bob/mcp.json.example" ]; then
        fail ".bob/mcp.json.example not found."
        exit 1
    fi
    node - <<'JS_EOF'
const fs = require('fs');

// Parse .env (handles unquoted, single-, and double-quoted values; comments; blank lines).
const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach((line) => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const eq = t.indexOf('=');
  if (eq === -1) return;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[k] = v;
});

const template = JSON.parse(fs.readFileSync('.bob/mcp.json.example', 'utf8'));
const missing = new Set();

const sub = (n) => {
  if (typeof n === 'string') {
    return n.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, k) => {
      if (env[k] === undefined || env[k] === '') { missing.add(k); return ''; }
      return env[k];
    });
  }
  if (Array.isArray(n)) return n.map(sub);
  if (n && typeof n === 'object') {
    const o = {};
    for (const k of Object.keys(n)) o[k] = sub(n[k]);
    return o;
  }
  return n;
};

const config = sub(template);

// Auto-disable any server whose required env is missing.
const REQUIRED = {
  jira: ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
  confluence: ['CONFLUENCE_URL', 'CONFLUENCE_USERNAME', 'CONFLUENCE_API_TOKEN'],
  'figma-console': ['FIGMA_ACCESS_TOKEN'],
};
const disabled = [];
for (const [name, req] of Object.entries(REQUIRED)) {
  if (!config.mcpServers || !config.mcpServers[name]) continue;
  const m = req.filter((k) => !env[k]);
  if (m.length) {
    config.mcpServers[name].disabled = true;
    disabled.push({ name, missing: m });
  }
}

fs.writeFileSync('.bob/mcp.json', JSON.stringify(config, null, 2) + '\n');
console.log('  \x1b[0;32m✓\x1b[0m Wrote .bob/mcp.json');

if (missing.size) {
  console.warn('  \x1b[1;33m⚠\x1b[0m Missing/empty env vars: ' + [...missing].sort().join(', '));
}
if (disabled.length) {
  console.warn('  \x1b[1;33m⚠\x1b[0m Auto-disabled MCP servers (missing required env):');
  disabled.forEach(({ name, missing }) =>
    console.warn('     - ' + name + ' (needs: ' + missing.join(', ') + ')')
  );
}
JS_EOF
}

# --- Quick mode: regenerate mcp.json only ----------------------------------
if [ "$1" = "--mcp" ] || [ "$1" = "--mcp-only" ]; then
    step "Regenerating .bob/mcp.json from .env..."
    generate_mcp_json
    echo ""
    echo -e "${GREEN}Done.${NC} Restart the IDE to pick up the new server list."
    exit 0
fi

echo -e "${BLUE}Payment Operations Console - setup${NC}"
echo -e "${BLUE}   Repo: $SCRIPT_DIR${NC}"
echo ""

# --- 1. Tooling check ------------------------------------------------------
step "[1/4] Checking required tools..."
if ! command -v node >/dev/null 2>&1; then
    fail "Node.js not installed. Install Node 18+ (e.g. 'brew install node') and re-run."
    exit 1
fi
NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    fail "Node.js 18+ required. Found: $(node -v). Upgrade and re-run."
    exit 1
fi
ok "Node.js $(node -v)"
if ! command -v npm >/dev/null 2>&1; then
    fail "npm not found alongside Node. Reinstall Node."
    exit 1
fi
ok "npm $(npm -v)"

# better-sqlite3 is a native module: without a prebuilt binary for this arch it
# compiles from source, which needs the Xcode command line tools on macOS.
if [ "$(uname)" = "Darwin" ]; then
    if xcode-select -p >/dev/null 2>&1; then
        ok "Xcode CLI tools present"
    else
        warn "Xcode CLI tools missing - run 'xcode-select --install' if npm install fails"
    fi
fi

if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then
        ok "gh CLI authenticated"
    else
        warn "gh CLI installed but not authenticated - run 'gh auth login'"
    fi
else
    warn "gh CLI not found - pull request operations will not work (brew install gh)"
fi
echo ""

# --- 2. .env bootstrap -----------------------------------------------------
step "[2/4] Checking .env..."
if [ ! -f ".env" ]; then
    if [ ! -f ".env.example" ]; then
        fail ".env.example missing - cannot bootstrap .env. Aborting."
        exit 1
    fi
    cp .env.example .env
    warn "Created .env from .env.example."
    echo ""
    echo -e "${YELLOW}   Next: edit .env with your real credentials, then re-run this script.${NC}"
    echo ""
    echo -e "${BLUE}   Values used by the MCP servers:${NC}"
    echo "     - jira:          JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN"
    echo "     - confluence:    CONFLUENCE_URL, CONFLUENCE_USERNAME, CONFLUENCE_API_TOKEN"
    echo "     - figma-console: FIGMA_ACCESS_TOKEN"
    echo "   Any server whose values are blank is written out disabled."
    exit 0
fi
ok ".env exists"
echo ""

# --- 3. Dependencies -------------------------------------------------------
step "[3/4] Checking dependencies..."
if [ -d "node_modules" ]; then
    ok "node_modules present (delete it and re-run for a clean install)"
else
    echo "  Running 'npm install'..."
    npm install --silent
    ok "Dependencies installed"
fi
if node -e "require('better-sqlite3')" >/dev/null 2>&1; then
    ok "better-sqlite3 native module loads"
else
    fail "better-sqlite3 failed to load - the native binary did not build."
    [ "$(uname)" = "Darwin" ] && warn "On macOS: xcode-select --install, then re-run."
    exit 1
fi
echo ""

# --- 4. MCP config + database ----------------------------------------------
step "[4/4] Generating .bob/mcp.json and seeding the database..."
generate_mcp_json
if [ -f "$DB_FILE" ]; then
    ok "$DB_FILE already exists - leaving it alone"
else
    npm run --silent seed
    ok "Seeded $DB_FILE"
fi
echo ""

echo -e "${GREEN}Setup complete.${NC}"
echo "  Start the console:  npm start   (http://localhost:4600)"
echo "  Regenerate MCP:     ./setup.sh --mcp"
echo "  Engineering rules:  .bob/rules/  (read 00-engineering-constitution.md first)"
