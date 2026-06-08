#!/bin/bash
# Ideogram image generation via curl.
#   - api.ideogram.ai is reachable through the local proxy (401 without key, not SSL_EOF):
#     no Meta anti-bot, no GFW drop on this host. US endpoint -> needs the proxy from CN.
#   - curl avoids the macOS library-validation block that stops Python networking in Claude's Bash.
#   - Ideogram V3 generate is SYNCHRONOUS: the POST returns the image url directly (no polling).
#
# Usage:
#   scripts/ideogram-gen.sh "<prompt>" <out.png> [aspect=1x1] [style=GENERAL] [speed=QUALITY]
#   IDEOGRAM_VERSION=ideogram-v4 scripts/ideogram-gen.sh ...   # if/when a v4 endpoint exists
#
# Needs IDEOGRAM_API_KEY in ~/.claude/.env.  Auth header: "Api-Key: <key>".
set -euo pipefail

PROMPT="${1:?prompt required}"
OUT="${2:?output path required}"
ASPECT="${3:-1x1}"          # 1x1, 16x9, 9x16, 4x3, 3x4, ...
STYLE="${4:-GENERAL}"        # AUTO, GENERAL, REALISTIC, DESIGN, FICTION
SPEED="${5:-QUALITY}"        # TURBO, DEFAULT, QUALITY
VERSION="${IDEOGRAM_VERSION:-ideogram-v3}"
PROXY="${IDEOGRAM_PROXY:-http://127.0.0.1:17890}"

KEY=$(grep '^IDEOGRAM_API_KEY=' "$HOME/.claude/.env" 2>/dev/null | cut -d= -f2- | tr -d '\042\047' | xargs || true)
if [ -z "${KEY:-}" ]; then
  echo "ERROR: IDEOGRAM_API_KEY not set in ~/.claude/.env" >&2
  exit 2
fi

BODY=$(PROMPT="$PROMPT" A="$ASPECT" S="$STYLE" SP="$SPEED" python3 -c \
  'import json,os; print(json.dumps({"prompt":os.environ["PROMPT"],"aspect_ratio":os.environ["A"],"style_type":os.environ["S"],"rendering_speed":os.environ["SP"],"num_images":1}))')

echo "Generating ($VERSION  $ASPECT  $STYLE/$SPEED)..." >&2
RESP=$(curl -sS -m 120 -x "$PROXY" -H "Api-Key: $KEY" -H "Content-Type: application/json" \
  -X POST "https://api.ideogram.ai/v1/$VERSION/generate" -d "$BODY")

URL=$(printf '%s' "$RESP" | python3 -c 'import json,sys
try:
    d=json.load(sys.stdin); print(d["data"][0]["url"])
except Exception:
    sys.exit(1)' 2>/dev/null) || { echo "unexpected response: $RESP" >&2; exit 1; }

curl -sS -m 120 -x "$PROXY" -o "$OUT" "$URL"
echo "saved: $OUT" >&2
echo "$OUT"
