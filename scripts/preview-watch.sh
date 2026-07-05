#!/usr/bin/env bash
# 常驻预览窗口, 开发时用。以后改 .ts 只需在这个窗口 Cmd+R 就能拿到新码, 不用退浏览器/不用冷启动。
#
# 根因(见 preview-fresh.sh 与记忆): Cocos 预览服务器给可变索引 import-map.json 只发弱 ETag、
# 无 Cache-Control → 浏览器启发式缓存旧 import-map → 照旧哈希加载旧 chunk = 旧码。chunk 本身
# 是内容哈希 + max-age=0(安全), 唯独 import-map 这层漏。DevTools 勾 "Disable cache" 会强制每次
# 重验 import-map, 根治此坑。
#
# 用法:  scripts/preview-watch.sh
#   首次: 弹出的 DevTools → Network 面板 → 勾 ☑ Disable cache。勾一次即可 —— 本脚本用【持久】
#   profile, 该勾选跨重启记住。之后改 .ts, 在此窗口 Cmd+R 就是新码。
# 注意: 必须裸地址。?scene=<名> 会 404 卡 loading。裸地址加载编辑器【当前打开的场景】。
set -euo pipefail

PORT=7456
URL="http://localhost:${PORT}/"
PROFILE="${HOME}/.cocos-preview-profile" # ponytail: 持久 profile, 记住 Disable-cache 勾选

if ! curl -s -o /dev/null --max-time 3 "http://localhost:${PORT}"; then
  echo "预览服务器 (${PORT}) 没响应 —— 先在 Cocos Creator 里让工程/预览跑起来, 再执行本脚本。" >&2
  exit 1
fi

echo "常驻预览窗口 (持久 profile: ${PROFILE})"
echo "  → ${URL}"
echo "  首次记得: DevTools → Network → 勾 ☑ Disable cache (勾一次, 永久生效)"
open -na "Google Chrome" --args \
  --user-data-dir="${PROFILE}" \
  --auto-open-devtools-for-tabs \
  --no-first-run --no-default-browser-check \
  --new-window "${URL}"
