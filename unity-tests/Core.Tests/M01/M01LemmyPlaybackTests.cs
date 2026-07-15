using System;
using System.Linq;
using System.Reflection;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01LemmyPlaybackTests
    {
        [Fact]
        public void DefinesLemmyPlaybackParityLogic()
        {
            var type = PlaybackType();

            Assert.NotNull(type);
        }

        [Fact]
        public void SlicesOnlyConfiguredLeadFrames()
        {
            Assert.Equal(Enumerable.Range(4, 25), IntArray("PlayableFrameIndices", "startle", 29));
            Assert.Equal(Enumerable.Range(0, 24), IntArray("PlayableFrameIndices", "idle", 24));
        }

        [Fact]
        public void BuildsStartleSnapHoldAndSlowRecoveryDurations()
        {
            var durations = DoubleArray("FrameDurationsMs", "startle", 29);

            Assert.Equal(25, durations.Length);
            Assert.Equal(1000d / 60d, durations[0], 10); // source frame 4
            Assert.Equal(1000d / 60d + 420d, durations[2], 10); // source peak frame 6
            Assert.Equal(1000d / 13d, durations[3], 10); // source frame 7 recovery
        }

        [Fact]
        public void BuildsStartleBackPeakHoldAndTailDurations()
        {
            var durations = DoubleArray("FrameDurationsMs", "startleback", 14);

            Assert.Equal(14, durations.Length);
            Assert.Equal(10d, durations[0], 10);
            Assert.Equal(430d, durations[2], 10);
            Assert.Equal(62.5d, durations[3], 10);
        }

        [Fact]
        public void UsesUniformFpsForUnpacedActions()
        {
            var durations = DoubleArray("FrameDurationsMs", "headbutt", 124);

            Assert.Equal(124, durations.Length);
            Assert.All(durations, duration => Assert.Equal(1000d / 48d, duration, 10));
        }

        [Fact]
        public void PlaysTheDedicatedFoldedCrouchAtItsAuthoredRate()
        {
            Assert.Equal(Enumerable.Range(0, 28), IntArray("PlayableFrameIndices", "crouchback", 28));
            var durations = DoubleArray("FrameDurationsMs", "crouchback", 28);
            Assert.Equal(28, durations.Length);
            Assert.All(durations, duration => Assert.Equal(1000d / 35d, duration, 10));
        }

        [Theory]
        [InlineData("reach", 36, 23)]
        [InlineData("reach", 20, 19)]
        [InlineData("headbutt", 124, 66)]
        [InlineData("idle", 24, -1)]
        public void PreservesAndClampsCocosGameplayEventFrames(string action, int loadedCount, int expected)
        {
            Assert.Equal(expected, Convert.ToInt32(Invoke("EventFrame", action, loadedCount)));
        }

        private static Type PlaybackType() =>
            Type.GetType("StarGuardian.M01.Rendering.M01LemmyPlayback, Core.Tests")
            ?? throw new Xunit.Sdk.XunitException("M01LemmyPlayback is missing");

        private static object Invoke(string method, params object[] args)
        {
            var info = PlaybackType().GetMethod(method, BindingFlags.Public | BindingFlags.Static)
                ?? throw new Xunit.Sdk.XunitException($"M01LemmyPlayback.{method} is missing");
            return info.Invoke(null, args)
                   ?? throw new Xunit.Sdk.XunitException($"M01LemmyPlayback.{method} returned null");
        }

        private static int[] IntArray(string method, params object[] args) => (int[])Invoke(method, args);
        private static double[] DoubleArray(string method, params object[] args) => (double[])Invoke(method, args);
    }
}
