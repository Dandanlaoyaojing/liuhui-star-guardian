/**
 * 通关过场帧序列的纯计时逻辑(不 import cc, 可单测)。匀速: 帧号 = floor(经过秒 × fps),
 * 夹在 [0, n-1] —— 播完停在末帧。用 dt 累计的经过时长驱动, 帧率无关。
 */
export function cutsceneFrameIndex(elapsedMs: number, fps: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  const idx = Math.floor((Math.max(0, elapsedMs) / 1000) * fps);
  return Math.min(Math.max(0, idx), frameCount - 1);
}
