#!/usr/bin/env bash
# 即梦生成角色动作短视频的命令模板(防漂移版)。
# 前置: dreamina 已登录, PATH 含 ~/.local/bin
# 用法: 改下面的 FIRST_FRAME / PROMPT / MODE 后执行
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

FIRST_FRAME="${1:-temp/first-frame-white.png}"   # 白底定妆图
OUT="${2:-temp/action.mp4}"
MODE="${3:-frames2video}"                          # frames2video(待机/原地,最稳) 或 image2video(位移动作)

# ── prompt:只写动作 + 固定机位 + 纯侧面,绝不写美术细节(颜色/画风会带偏漂移)──
PROMPT="严格保持参考图中角色的外形、颜色、比例完全不变,全程一致不漂移。\
全程保持纯侧面视角,头部不转动,始终只露出一只眼睛,脸朝向不变。\
固定机位、镜头完全不动,不推拉缩放平移,角色保持同样大小、留在画面同一位置。纯白背景。\
动作:<在这里只描述动作,例如:原地轻柔呼吸、耳朵极轻微动一下>。动作幅度很小、缓慢安静。"

echo "提交即梦视频 ($MODE)…"
if [ "$MODE" = "frames2video" ]; then
  # 首尾帧双锁同一张图 → 强制首尾一致,根治"越走越大"(适合待机/呼吸/原地循环)
  RES=$(dreamina frames2video --first="$FIRST_FRAME" --last="$FIRST_FRAME" \
    --prompt="$PROMPT" --model_version=seedance2.0_vip --duration=5 --video_resolution=1080p --poll=60 2>&1)
else
  # 单首帧(适合走路等需要净位移的;靠 prompt 强约束大小不变)
  RES=$(dreamina image2video --image="$FIRST_FRAME" \
    --prompt="$PROMPT" --model_version=seedance2.0_vip --duration=5 --video_resolution=1080p --poll=60 2>&1)
fi

SID=$(echo "$RES" | grep -oE '"submit_id"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*"([^"]*)"$/\1/')
echo "submit_id=$SID"

# 轮询下载。注意:video_url 后缀不是 .mp4(带 mime_type 参数),按字段名解析
for i in $(seq 1 60); do
  Q=$(dreamina query_result --submit_id="$SID" 2>&1)
  URL=$(echo "$Q" | grep -oE '"video_url"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*:[[:space:]]*"//; s/"$//')
  if [ -n "$URL" ]; then curl -fsSL "$URL" -o "$OUT" && echo "SAVED $OUT"; break; fi
  echo "[$i] $(echo "$Q"|grep -oE '"gen_status"[^,]*'|head -1)"; sleep 15
done
