// Pure playback timing shared by xUnit and the Unity Lemmy renderer.
#nullable enable

using System;

namespace StarGuardian.M01.Rendering
{
    public static class M01LemmyPlayback
    {
        public static int[] PlayableFrameIndices(string actionId, int loadedFrameCount)
        {
            var spec = Find(actionId);
            var skip = spec.SkipLeadFrames > 0 && loadedFrameCount > spec.SkipLeadFrames + 1
                ? spec.SkipLeadFrames
                : 0;
            var result = new int[Math.Max(0, loadedFrameCount - skip)];
            for (var index = 0; index < result.Length; index += 1)
            {
                result[index] = index + skip;
            }
            return result;
        }

        /// <summary>Exact port of LemmyActorContract.buildPacedFrameDurations plus uniform fallback.</summary>
        public static double[] FrameDurationsMs(string actionId, int loadedFrameCount)
        {
            var spec = Find(actionId);
            var frames = PlayableFrameIndices(actionId, loadedFrameCount);
            var result = new double[frames.Length];
            var headMs = 1000d / spec.Fps;
            var tailMs = 1000d / (spec.TailFps ?? spec.Fps);

            for (var index = 0; index < frames.Length; index += 1)
            {
                var sourceFrame = frames[index];
                var duration = spec.PeakFrame.HasValue && sourceFrame > spec.PeakFrame.Value
                    ? tailMs
                    : headMs;
                if (spec.PeakFrame.HasValue && sourceFrame == spec.PeakFrame.Value)
                {
                    duration += spec.PeakHoldMs;
                }
                result[index] = duration;
            }

            return result;
        }

        /// <summary>-1 means no event. Cocos clamps out-of-range events to the last loaded frame.</summary>
        public static int EventFrame(string actionId, int loadedFrameCount)
        {
            var spec = Find(actionId);
            if (!spec.EventFrame.HasValue || loadedFrameCount <= 0)
            {
                return -1;
            }
            return Math.Min(spec.EventFrame.Value, loadedFrameCount - 1);
        }

        public static M01LemmyActionContract Find(string actionId)
        {
            foreach (var action in M01RenderContract.LemmyActions)
            {
                if (string.Equals(action.Id, actionId, StringComparison.Ordinal))
                {
                    return action;
                }
            }
            throw new ArgumentException($"Unknown Lemmy action: {actionId}", nameof(actionId));
        }
    }
}
