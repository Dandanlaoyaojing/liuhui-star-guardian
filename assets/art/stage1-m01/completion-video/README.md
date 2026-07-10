# M01 通关动画（星屑修复 → 齿轮平台开门）

`m01-completion-door-open.mp4`（12.2s, 1440×1440@60fps, 带 aac 音轨）是 M01 结尾通关动画的定稿成片，2026-07-10 由下面三个源视频用 ffmpeg 合成。

## 成片结构

- 0–4.1s：星屑点亮齿轮、汇聚成旋涡（画面来自 swirl 源，音频来自 audio-donor 源）
- 4.1–4.8s：0.7s 交叉溶解，旋涡消散、闭合的门浮现（过渡动画）
- 4.8–6.1s：闭门停顿，修复音效拖尾淡出，趋近全静
- 6.1s：门开始滑开，开门原声此刻进入（源音轨前 2s 被静音 + 0.3s 淡入）
- 至 12.2s：门完全滑开、星光洒出

## 源视频

- `source-repair-swirl-approved.mp4` — 前半段画面源（9.1s，无音轨；4.78s 处硬切出现的门自带缝光，不可直接用其门帧，故过渡改用交叉溶解）
- `source-door-open-starlight.mp4` — 后半段画面+声音源（8.1s，门在自身 2.0s 处开始滑开）
- `source-repair-audio-donor.mp4` — 前半段音效捐赠源（画面为早期废案，只取音轨）

## 重新合成命令

```sh
ffmpeg -y -i source-repair-swirl-approved.mp4 -i source-door-open-starlight.mp4 -i source-repair-audio-donor.mp4 \
  -filter_complex "[0:v]trim=0:4.775,setpts=PTS-STARTPTS[v0];[1:v]setpts=PTS-STARTPTS[v1];\
[v0][v1]xfade=transition=fade:duration=0.7:offset=4.075[v];\
[2:a]atrim=0:6.3,asetpts=PTS-STARTPTS,afade=t=out:st=4.9:d=1.3[a0];\
[1:a]afade=t=in:st=2:d=0.3,adelay=4075|4075[a1];\
[a0][a1]amix=inputs=2:duration=longest:normalize=0[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 18 -pix_fmt yuv420p -r 60 \
  -c:a aac -b:a 192k -movflags +faststart m01-completion-door-open.mp4
```

调参入口：溶解时长 `duration=0.7`（offset 需同步改为 4.775−duration）；修复音效拖尾 `afade=t=out:st=4.9:d=1.3`；开门声进入点 `afade=t=in:st=2`。

尚未接入运行时——M01 通关目前走 ToolCard 流程（`M01GreyboxBootstrap.renderCompletionToolCardIfAvailable`），本视频的播放接入是后续工作。
