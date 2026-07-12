// 从 tests/cocos/M01CutsceneTiming.test.ts 逐条迁移 —— 规格不变, 断言一一对应.
using StarGuardian.Core;
using Xunit;

namespace StarGuardian.Core.Tests
{
    public class M01CutsceneTimingTests
    {
        private const double Fps = 24;
        private const int N = 344;

        [Fact(DisplayName = "starts on frame 0 at t=0")]
        public void StartsOnFrameZeroAtTimeZero()
        {
            Assert.Equal(0, M01CutsceneTiming.CutsceneFrameIndex(0, Fps, N));
        }

        [Fact(DisplayName = "advances by elapsed×fps (frame-rate independent)")]
        public void AdvancesByElapsedTimesFps()
        {
            Assert.Equal(24, M01CutsceneTiming.CutsceneFrameIndex(1000, Fps, N)); // 1s × 24fps
            Assert.Equal(12, M01CutsceneTiming.CutsceneFrameIndex(500, Fps, N));
            // 同一经过时长, 与调用频率无关 —— 只看累计 ms。
            Assert.Equal(1, M01CutsceneTiming.CutsceneFrameIndex(41.67, Fps, N)); // ~1/24 s → 第 1 帧
            Assert.Equal(0, M01CutsceneTiming.CutsceneFrameIndex(41, Fps, N)); // 略早于第 1 帧边界
        }

        [Fact(DisplayName = "clamps to last frame past the end (holds, never overruns the array)")]
        public void ClampsToLastFramePastTheEnd()
        {
            Assert.Equal(N - 1, M01CutsceneTiming.CutsceneFrameIndex(999999, Fps, N));
            Assert.Equal(N - 1, M01CutsceneTiming.CutsceneFrameIndex((N / Fps) * 1000, Fps, N));
        }

        [Fact(DisplayName = "clamps negative/zero-count to a safe index")]
        public void ClampsNegativeAndZeroCountToSafeIndex()
        {
            Assert.Equal(0, M01CutsceneTiming.CutsceneFrameIndex(-100, Fps, N));
            Assert.Equal(0, M01CutsceneTiming.CutsceneFrameIndex(1000, Fps, 0));
        }
    }
}
