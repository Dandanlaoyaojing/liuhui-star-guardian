#!/usr/bin/env python3
"""
Luma Uni-1 image generation via the Agents API.

The official ~/.claude/tools/luma/luma-gen (Node) hits ECONNRESET at the TLS
handshake because Luma's `agents.lumalabs.ai` endpoint runs behind Meta's
anti-bot infra (face:b00c:* IPv6 prefix) and rejects Node's default TLS
fingerprint. Python's urllib uses a different TLS implementation that passes
the fingerprint check.

Usage:
  scripts/luma-gen.py "<prompt>" [--aspect 1:1] [--ref path.png] [--ref-weight 0.9]
                                  [--out path.png]

API key is read from ~/.claude/.env (LUMA_AGENTS_API_KEY=...).
"""
import argparse
import base64
import json
import os
import os.path
import sys
import time
import urllib.error
import urllib.request


API_BASE = "https://agents.lumalabs.ai/v1"
ENV_FILE = os.path.expanduser("~/.claude/.env")


def load_key() -> str:
    if not os.path.exists(ENV_FILE):
        sys.exit(f"Missing env file: {ENV_FILE}")
    for line in open(ENV_FILE).read().splitlines():
        if line.startswith("LUMA_AGENTS_API_KEY="):
            key = line.split("=", 1)[1].strip()
            key = key.strip("'\"")
            if not key:
                sys.exit("LUMA_AGENTS_API_KEY is empty")
            return key
    sys.exit("LUMA_AGENTS_API_KEY not set in ~/.claude/.env")


def api(method: str, path: str, body: dict | None, key: str) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        API_BASE + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", "replace")[:500]
        sys.exit(f"Luma API {e.code}: {body_text}")


def file_to_image_obj(p: str) -> dict:
    if p.startswith("http"):
        return {"url": p}
    ext = os.path.splitext(p)[1].lstrip(".").lower() or "png"
    mime = "jpeg" if ext == "jpg" else ext
    with open(p, "rb") as f:
        return {"data": base64.b64encode(f.read()).decode("ascii"), "media_type": f"image/{mime}"}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("prompt", help="Generation prompt")
    p.add_argument("--aspect", default="1:1", help="Aspect ratio (1:1, 16:9, 3:1 …)")
    p.add_argument("--ref", action="append", default=[], help="Reference image path (repeatable)")
    p.add_argument("--ref-weight", type=float, default=None, help="Reference weight 0..1")
    p.add_argument("--out", default=None, help="Output PNG path")
    p.add_argument("--modify", default=None, help="Source image for image_edit mode")
    args = p.parse_args()

    key = load_key()

    payload: dict = {"prompt": args.prompt, "aspect_ratio": args.aspect}
    if args.modify:
        payload["type"] = "image_edit"
        payload["source"] = file_to_image_obj(args.modify)
    else:
        payload["type"] = "image"
    if args.ref:
        payload["image_ref"] = [
            {**file_to_image_obj(r), **({"weight": args.ref_weight} if args.ref_weight is not None else {})}
            for r in args.ref
        ]

    print("Submitting generation...", file=sys.stderr)
    submit = api("POST", "/generations", payload, key)
    gen_id = submit.get("id") or submit.get("generation_id")
    if not gen_id:
        sys.exit(f"No id in submit response: {json.dumps(submit)[:200]}")
    print(f"id: {gen_id}", file=sys.stderr)

    print("Waiting 15s before first poll...", file=sys.stderr)
    time.sleep(15)

    deadline = time.time() + 300
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        status = api("GET", f"/generations/{gen_id}", None, key)
        state = status.get("state") or status.get("status")
        print(f"  poll {attempt}: state={state}", file=sys.stderr)
        if state in ("completed", "succeeded"):
            urls = []
            out = status.get("output")
            if isinstance(out, list):
                for o in out:
                    if isinstance(o, str):
                        urls.append(o)
                    elif isinstance(o, dict):
                        u = o.get("url") or o.get("image_url")
                        if u:
                            urls.append(u)
            if not urls:
                sys.exit(f"No image URL in completed response: {json.dumps(status)[:300]}")
            ts = time.strftime("%Y-%m-%d-%H-%M-%S")
            base_out = args.out or f"./luma-{ts}.png"
            saved = []
            for i, url in enumerate(urls):
                out_path = base_out if len(urls) == 1 else (
                    f"{os.path.splitext(base_out)[0]}-{i}{os.path.splitext(base_out)[1] or '.png'}"
                )
                os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)
                with urllib.request.urlopen(url, timeout=60) as r:
                    open(out_path, "wb").write(r.read())
                saved.append(out_path)
                print(f"Saved: {out_path}", file=sys.stderr)
            for s in saved:
                print(s)
            return
        if state in ("failed", "error"):
            sys.exit(f"Generation failed: {json.dumps(status)[:300]}")
        time.sleep(2)
    sys.exit("Timed out after 5 minutes.")


if __name__ == "__main__":
    main()
