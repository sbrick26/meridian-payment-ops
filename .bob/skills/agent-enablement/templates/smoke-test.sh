#!/bin/sh
# smoke-test.sh — post-deploy check for the AP payment assistant.
#
# Two assertions, both against the LIVE deployed agent:
#
#   1. READ  — ask for the status of a known invoice. The answer must name that
#              invoice's vendor. The vendor name is not hard-coded: it is read
#              from the service's own /api/v2 response, so the test survives a
#              reseed.
#   2. WRITE — ask for that payment to be released. The answer must carry the
#              identity refusal. An answer that reports success is a failure of
#              this test and a stop-work condition: the assistant has been given
#              access it must not hold.
#
# Environment (no secret is ever written into this file):
#   WXO_INSTANCE_URL   base URL of the Orchestrate service instance
#   WXO_API_KEY        bearer token for the Orchestrate API
#   WXO_AGENT_ID       agent id from `orchestrate agents list`
#   WXO_CHAT_URL       optional; full chat-completions URL, overriding the
#                      default composed from WXO_INSTANCE_URL and WXO_AGENT_ID.
#                      Confirm the path for the target instance before relying
#                      on the default.
#   SERVICE_URL        modernized service base URL   (default http://localhost:4600)
#   INQUIRY_TOKEN      identity token with the inquiry scope
#   INVOICE_NO         invoice to ask about          (default INV-2026-4471)
#
# Exit status: 0 when both lines PASS, 1 otherwise.

set -u

SERVICE_URL="${SERVICE_URL:-http://localhost:4600}"
INVOICE_NO="${INVOICE_NO:-INV-2026-4471}"
CHAT_URL="${WXO_CHAT_URL:-${WXO_INSTANCE_URL:-}/v1/orchestrate/${WXO_AGENT_ID:-}/chat/completions}"

fail=0

need() {
  eval "v=\${$1:-}"
  if [ -z "$v" ]; then
    echo "FAIL setup - environment variable $1 is not set"
    exit 1
  fi
}

need WXO_API_KEY
need INQUIRY_TOKEN
if [ -z "${WXO_CHAT_URL:-}" ]; then
  need WXO_INSTANCE_URL
  need WXO_AGENT_ID
fi

# --- expected vendor, taken from the service itself --------------------------

payment_json=$(curl -s -H "Authorization: Bearer ${INQUIRY_TOKEN}" \
  "${SERVICE_URL}/api/v2/payments?invoice=${INVOICE_NO}")

vendor=$(printf '%s' "$payment_json" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if isinstance(d, dict) and "items" in d:
    d = (d.get("items") or [None])[0]
if isinstance(d, list):
    d = d[0] if d else None
if isinstance(d, dict):
    v = d.get("vendor") or {}
    print(v.get("name", "") if isinstance(v, dict) else v)
' 2>/dev/null)

if [ -z "$vendor" ]; then
  echo "FAIL setup - could not read the vendor for ${INVOICE_NO} from ${SERVICE_URL}"
  exit 1
fi
echo "info  invoice ${INVOICE_NO} - expected vendor: ${vendor}"

# --- ask the deployed agent --------------------------------------------------

ask() {
  body=$(python3 -c '
import json, sys
print(json.dumps({
    "messages": [{"role": "user", "content": sys.argv[1]}],
    "stream": False,
}))' "$1")

  curl -s -X POST "$CHAT_URL" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${WXO_API_KEY}" \
    -d "$body" | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except Exception:
    print(raw)
    sys.exit(0)
try:
    print(d["choices"][0]["message"]["content"])
except Exception:
    print(json.dumps(d))
'
}

contains() {
  printf '%s' "$1" | tr 'A-Z' 'a-z' | grep -q -- "$(printf '%s' "$2" | tr 'A-Z' 'a-z')"
}

# --- 1. read path ------------------------------------------------------------

read_answer=$(ask "What is the status of invoice ${INVOICE_NO}?")
echo "----- read answer -----"
echo "$read_answer"

if contains "$read_answer" "$vendor"; then
  echo "PASS read  - answer names the vendor '${vendor}'"
else
  echo "FAIL read  - answer does not name the vendor '${vendor}'"
  fail=1
fi

# --- 2. write path -----------------------------------------------------------

write_answer=$(ask "Please release the payment for invoice ${INVOICE_NO} now.")
echo "----- release answer -----"
echo "$write_answer"

denied=0
for phrase in "identity_scope_denied" "lacks scope" "not permitted" "read-only" "read only" "cannot release" "unable to release"; do
  if contains "$write_answer" "$phrase"; then
    denied=1
    break
  fi
done

claimed=0
for phrase in "has been released" "successfully released" "i have released" "released the payment"; do
  if contains "$write_answer" "$phrase"; then
    claimed=1
    break
  fi
done

if [ "$claimed" -eq 1 ]; then
  echo "FAIL write - the assistant reported a release. Stop work: check the scope"
  echo "             mounted on the release route and the identity behind the"
  echo "             tool connection before proceeding."
  fail=1
elif [ "$denied" -eq 1 ]; then
  echo "PASS write - answer relays the identity refusal"
else
  echo "FAIL write - answer carries neither a refusal nor a success claim"
  fail=1
fi

# --- result ------------------------------------------------------------------

if [ "$fail" -eq 0 ]; then
  echo "RESULT PASS - read path answers, write path refused by identity"
else
  echo "RESULT FAIL"
fi
exit "$fail"
