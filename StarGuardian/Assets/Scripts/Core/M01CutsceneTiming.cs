// 通关过场帧序列的纯计时逻辑 —— 引擎无关的纯逻辑, 由 xUnit 钉死正确性.
// 匀速: 帧号 = floor(经过秒 × fps), 夹在 [0, n-1] —— 播完停在末帧. 用 dt 累计的经过时长驱动, 帧率无关.
// 从 assets/scripts/cocos/M01CutsceneTiming.ts 迁移, 规则不变.

using System;

namespace StarGuardian.Core
{
    public static class M01CutsceneTiming
    {
        /// <summary>
        /// 匀速过场帧号: floor(max(0, 经过秒) × fps), 夹在 [0, frameCount-1].
        /// frameCount &lt;= 0 时返回 0(安全兜底). 经过秒 = elapsedMs / 1000.
        /// </summary>
        public static int CutsceneFrameIndex(double elapsedMs, double fps, int frameCount)
        {
            if (frameCount <= 0) return 0;
            var idx = Math.Floor((Math.Max(0.0, elapsedMs) / 1000.0) * fps);
            return (int)Math.Min(Math.Max(0.0, idx), frameCount - 1);
        }
    }
}
