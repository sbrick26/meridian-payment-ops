#!/bin/sh
# Export a Figma frame to PNG without the Desktop Bridge plugin.
#
#   ./scripts/figma-export.sh <file-key> <node-id> <output.png> [scale]
#
# The Figma token is read from .env by this script, never handed to the caller:
# the agent that runs it gets a file, not a credential. Uses the REST API, so it
# keeps working when Figma is closed or the plugin is not attached.
set -e

FILE_KEY="$1"; NODE_ID="$2"; OUT="$3"; SCALE="${4:-2}"
[ -n "$FILE_KEY" ] && [ -n "$NODE_ID" ] && [ -n "$OUT" ] || {
  echo "usage: figma-export.sh <file-key> <node-id> <output.png> [scale]" >&2; exit 2; }

DIR="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN="$(grep -m1 '^FIGMA_ACCESS_TOKEN=' "$DIR/.env" 2>/dev/null | cut -d= -f2-)"
[ -n "$TOKEN" ] || { echo "FIGMA_ACCESS_TOKEN not configured in .env" >&2; exit 1; }

URL=$(curl -s -H "X-Figma-Token: $TOKEN" \
  "https://api.figma.com/v1/images/$FILE_KEY?ids=$NODE_ID&format=png&scale=$SCALE" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); v=list(d.get('images',{}).values()); print(v[0] if v and v[0] else '')")

[ -n "$URL" ] || { echo "Figma returned no image for node $NODE_ID" >&2; exit 1; }
mkdir -p "$(dirname "$OUT")"
curl -s -o "$OUT" "$URL"
echo "exported $NODE_ID -> $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
