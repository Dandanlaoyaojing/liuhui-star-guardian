#!/bin/bash
# Official Luma Dream Machine (Photon) image generation via curl.
#
# Why curl + this endpoint:
#   - agents.lumalabs.ai (the old scripts/luma-gen.py path) sits behind Meta anti-bot
#     that drops every non-browser TLS fingerprint -> SSL_EOF. The OFFICIAL endpoint
#     api.lumalabs.ai (108.160.161.83, Luma's own IP) has NO such filter -> reachable.
#   - curl is a signed binary, so it avoids the macOS library-validation block that
#     stops Python (_socket/unicodedata) from loading inside Claude Code's Bash.
#   - api.lumalabs.ai is a US endpoint -> must go through the local proxy from CN.
#
# Usage:
#   scripts/luma-photon-gen.sh "<prompt>" <out.png> [aspect=1:1] [model=photon-1]
#
# Needs LUMA_DREAM_API_KEY in ~/.claude/.env (create at
# https://lumalabs.ai/dream-machine/api/keys -- the LUMA_AGENTS_API_KEY does NOT work here).
set -euo pipefail

PROMPT="${1:?prompt required}"
OUT="${2:?output path required}"
ASPECT="${3:-1:1}"
MODEL="${4:-photon-1}"
PROXY="${LUMA_PROXY:-http://127.0.0.1:17890}"
API="https://api.lumalabs.ai/dream-machine/v1"

KEY=$(grep '^LUMA_DREAM_API_KEY=' "$HOME/.claude/.env" 2>/dev/null | cut -d= -f2- | tr -d '\042\047' | xargs || true)
if [ -z "${KEY:-}" ]; then
  echo "ERROR: LUMA_DREAM_API_KEY not set in ~/.claude/.env" >&2
  echo "  Create a key at https://lumalabs.ai/dream-machine/api/keys and add:" >&2
  echo "  LUMA_DREAM_API_KEY=luma-..." >&2
  exit 2
fi

cmurl() { curl -sS -m "${1}" -x "$PROXY" -H "Authorization: Bearer $KEY" "${@:2}"; }

# Build request body safely (no jq dependency; prompt embedded via python json — pure, no network).
BODY=$(PROMPT="$PROMPT" MODEL="$MODEL" ASPECT="$ASPECT" python3 -c 'import json,os; print(json.dumps({"prompt":os.environ["PROMPT"],"model":os.environ["MODEL"],"aspect_ratio":os.environ["ASPECT"]}))')

echo "Submitting (model=$MODEL aspect=$ASPECT)..." >&2
RESP=$(cmurl 30 -H "Content-Type: application/json" -X POST "$API/generations/image" -d "$BODY")
ID=$(printf '%s' "$RESP" | grep -o '"id"[: ]*"[^"]*"' | head -1 | sed 's/.*"id"[: ]*"//; s/"$//')
if [ -z "${ID:-}" ]; then echo "submit failed: $RESP" >&2; exit 1; fi
echo "id: $ID" >&2

for i in $(seq 1 80); do
  sleep 3
  ST=$(cmurl 20 "$API/generations/$ID")
  STATE=$(printf '%s' "$ST" | grep -o '"state"[: ]*"[^"]*"' | head -1 | sed 's/.*"state"[: ]*"//; s/"$//')
  echo "  poll $i: ${STATE:-?}" >&2
  case "$STATE" in
    completed)
      URL=$(printf '%s' "$ST" | grep -oE 'https://[^"]*(cdn-luma|storage)[^"]*' | head -1)
      if [ -z "${URL:-}" ]; then echo "completed but no image url: $ST" >&2; exit 1; fi
      curl -sS -m 90 -x "$PROXY" -o "$OUT" "$URL"
      echo "saved: $OUT" >&2
      echo "$OUT"
      exit 0 ;;
    failed) echo "generation failed: $ST" >&2; exit 1 ;;
  esac
done
echo "timed out after ~4min" >&2; exit 1
