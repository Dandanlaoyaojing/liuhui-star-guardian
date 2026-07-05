#!/usr/bin/env bash
# 冷启动 Cocos 预览, 绕过浏览器缓存旧码的老坑。
#
# 根因: Cocos 预览服务器对 SystemJS 的 import-map (/scripting/x/import-map.json)
# 只发弱 ETag、无 Cache-Control → 浏览器(尤其 Safari)编译后不重新拉, 一直跑旧 chunk。
# 服务器改不了。这里用**一次性 user-data-dir**: 空 profile = 空 HTTP 缓存, 每次必冷启动,
# 与 ETag/Cache-Control 行为无关, 保证拿到刚编译的代码。
#
# 用法:  scripts/preview-fresh.sh
# 预览编辑器里【当前打开的场景】—— 想预览哪关就先在 Cocos 里打开哪个 .scene。
# 注意: 必须用裸地址。?scene=<名字> 会让引擎去找 /scene/<名字>.json → 404 → 场景永远起不来
# (停在 Cocos loading 画面); 裸地址加载编辑器当前场景才能正常 boot。
set -euo pipefail

PORT=7456
URL="http://localhost:${PORT}/"

if ! curl -s -o /dev/null --max-time 3 "http://localhost:${PORT}"; then
  echo "预览服务器 (${PORT}) 没响应 —— 先在 Cocos Creator 里打开工程并让它跑起来, 再执行本脚本。" >&2
  exit 1
fi

PROFILE="$(mktemp -d "${TMPDIR:-/tmp}/cocos-preview-XXXXXX")"
echo "冷启动 Chrome (一次性 profile: ${PROFILE})"
echo "  → ${URL}"
# ponytail: 一次性 profile 每次新建, 关掉即弃; 小(空 profile), macOS 会清 /tmp。不做退出清理是因为窗口还开着。
open -na "Google Chrome" --args \
  --user-data-dir="${PROFILE}" \
  --no-first-run --no-default-browser-check \
  --new-window "${URL}"
