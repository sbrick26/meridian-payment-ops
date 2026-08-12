#!/bin/sh
# Read Figma structure or node properties without the Desktop Bridge plugin.
#
#   ./scripts/figma-read.sh pages   <file-key>
#   ./scripts/figma-read.sh node    <file-key> <node-id>     # full node JSON
#   ./scripts/figma-read.sh findpage <file-key> <name-prefix> # page + child frames
#
# Same contract as figma-export.sh: the token is read here, never exposed to the
# caller. REST only, so it works with Figma closed.
set -e
MODE="$1"; FILE_KEY="$2"
[ -n "$MODE" ] && [ -n "$FILE_KEY" ] || { echo "usage: figma-read.sh pages|node|findpage <file-key> [arg]" >&2; exit 2; }

DIR="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN="$(grep -m1 '^FIGMA_ACCESS_TOKEN=' "$DIR/.env" 2>/dev/null | cut -d= -f2-)"
[ -n "$TOKEN" ] || { echo "FIGMA_ACCESS_TOKEN not configured in .env" >&2; exit 1; }
get() { curl -s -H "X-Figma-Token: $TOKEN" "$1"; }

case "$MODE" in
  pages)
    get "https://api.figma.com/v1/files/$FILE_KEY?depth=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if 'err' in d: print('error:', d['err']); raise SystemExit(1)
print('file:', d.get('name'))
for p in d['document']['children']: print(p['id'], '|', p['name'])"
    ;;
  node)
    NODE="$3"; [ -n "$NODE" ] || { echo "node id required" >&2; exit 2; }
    get "https://api.figma.com/v1/files/$FILE_KEY/nodes?ids=$NODE"
    ;;
  findpage)
    PREFIX="$3"; [ -n "$PREFIX" ] || { echo "name prefix required" >&2; exit 2; }
    get "https://api.figma.com/v1/files/$FILE_KEY?depth=2" | PREFIX="$PREFIX" python3 -c "
import json,os,sys
d=json.load(sys.stdin); pre=os.environ['PREFIX']
for p in d['document']['children']:
    if p['name'].startswith(pre):
        print('page', p['id'], '|', p['name'])
        for c in p.get('children',[]): print('  frame', c['id'], '|', c['name'])"
    ;;
  *) echo "unknown mode: $MODE" >&2; exit 2 ;;
esac
