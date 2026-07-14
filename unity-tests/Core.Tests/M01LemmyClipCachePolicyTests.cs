using StarGuardian.M01.Rendering;
using Xunit;

namespace StarGuardian.Tests
{
    public sealed class M01LemmyClipCachePolicyTests
    {
        [Fact(DisplayName = "clip cache evicts the least-recently-used inactive action above capacity")]
        public void EvictsLeastRecentlyUsedInactiveClip()
        {
            var policy = new M01LemmyClipCachePolicy(3);
            policy.RecordLoaded("idle", null);
            policy.RecordLoaded("walk", "idle");
            policy.RecordLoaded("reach", "walk");

            var evicted = policy.RecordLoaded("headbutt", "reach");

            Assert.Equal(new[] { "idle" }, evicted);
            Assert.Equal(new[] { "walk", "reach", "headbutt" }, policy.CachedActions);
        }

        [Fact(DisplayName = "clip cache never evicts the action currently rendered or the action being loaded")]
        public void ProtectsActiveAndLoadingClips()
        {
            var policy = new M01LemmyClipCachePolicy(1);
            policy.RecordLoaded("idle", null);

            var evicted = policy.RecordLoaded("headbutt", "idle");

            Assert.Empty(evicted);
            Assert.Equal(new[] { "idle", "headbutt" }, policy.CachedActions);
        }

        [Fact(DisplayName = "touching a cached action updates recency without duplicating it")]
        public void TouchUpdatesRecency()
        {
            var policy = new M01LemmyClipCachePolicy(3);
            policy.RecordLoaded("idle", null);
            policy.RecordLoaded("walk", "idle");
            policy.RecordLoaded("reach", "walk");
            policy.Touch("idle");

            var evicted = policy.RecordLoaded("headbutt", "reach");

            Assert.Equal(new[] { "walk" }, evicted);
            Assert.Equal(new[] { "reach", "idle", "headbutt" }, policy.CachedActions);
        }
    }
}
