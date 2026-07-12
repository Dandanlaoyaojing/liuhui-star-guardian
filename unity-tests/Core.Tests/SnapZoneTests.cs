// 从 tests/interaction/SnapZone.test.ts 逐条迁移 —— 规则不变, 断言一一对应。
using StarGuardian.Interaction;
using Xunit;

namespace StarGuardian.Interaction.Tests
{
    public class SnapZoneTests
    {
        private static SnapEntity RedCircleFragment => new()
        {
            Id = "fragment-red-circle-1",
            Tags = new[] { "fragment", "color:red", "shape:circle" }
        };

        private static SnapZone RedCircleSlot => new()
        {
            Id = "slot-red-circle",
            Criteria = new TagCriteria
            {
                All = new[] { "color:red", "shape:circle" },
                None = new[] { "locked" }
            },
            Bounds = new SnapBounds { X = 100, Y = 100, Width = 40, Height = 40 },
            SnapPosition = new Point2(100, 100)
        };

        [Fact(DisplayName = "accepts entities whose tags satisfy the zone criteria")]
        public void AcceptsEntitiesWhoseTagsSatisfyTheZoneCriteria()
        {
            // toEqual({ accepted: true }) —— accepted 为真且其余字段皆缺省(null)
            var result = SnapZoneLogic.CanSnapToZone(RedCircleFragment, RedCircleSlot);

            Assert.True(result.Accepted);
            Assert.Null(result.Reason);
            Assert.Null(result.MissingTags);
            Assert.Null(result.AnyTags);
            Assert.Null(result.ForbiddenTags);
        }

        [Fact(DisplayName = "rejects entities with a readable criteria mismatch")]
        public void RejectsEntitiesWithAReadableCriteriaMismatch()
        {
            var blueCircleFragment = new SnapEntity
            {
                Id = "fragment-blue-circle-1",
                Tags = new[] { "fragment", "color:blue", "shape:circle" }
            };

            // toEqual({ accepted: false, reason: "missing_required_tags", missingTags: ["color:red"] })
            var result = SnapZoneLogic.CanSnapToZone(blueCircleFragment, RedCircleSlot);

            Assert.False(result.Accepted);
            Assert.Equal("missing_required_tags", result.Reason);
            Assert.Equal(new[] { "color:red" }, result.MissingTags);
            Assert.Null(result.AnyTags);
            Assert.Null(result.ForbiddenTags);
        }

        [Fact(DisplayName = "resolves accepted, rejected, and missed drop results")]
        public void ResolvesAcceptedRejectedAndMissedDropResults()
        {
            var accepted = SnapZoneLogic.ResolveDropResult(
                RedCircleFragment,
                new[] { RedCircleSlot },
                new Point2(112, 92));

            // toEqual({ type: "accepted", entityId, zoneId, snapPosition: {100,100} })
            Assert.Equal("accepted", accepted.Type);
            Assert.Equal("fragment-red-circle-1", accepted.EntityId);
            Assert.Equal("slot-red-circle", accepted.ZoneId);
            Assert.Equal(new Point2(100, 100), accepted.SnapPosition!.Value);
            Assert.Null(accepted.Reason);
            Assert.Null(accepted.MissingTags);
            Assert.Null(accepted.AnyTags);
            Assert.Null(accepted.ForbiddenTags);

            var rejected = SnapZoneLogic.ResolveDropResult(
                new SnapEntity
                {
                    Id = "fragment-red-triangle-1",
                    Tags = new[] { "fragment", "color:red", "shape:triangle" }
                },
                new[] { RedCircleSlot },
                new Point2(112, 92));

            // toEqual({ type: "rejected", entityId, zoneId, reason, missingTags: ["shape:circle"] })
            Assert.Equal("rejected", rejected.Type);
            Assert.Equal("fragment-red-triangle-1", rejected.EntityId);
            Assert.Equal("slot-red-circle", rejected.ZoneId);
            Assert.Equal("missing_required_tags", rejected.Reason);
            Assert.Equal(new[] { "shape:circle" }, rejected.MissingTags);
            Assert.Null(rejected.SnapPosition);
            Assert.Null(rejected.AnyTags);
            Assert.Null(rejected.ForbiddenTags);

            var missed = SnapZoneLogic.ResolveDropResult(
                RedCircleFragment,
                new[] { RedCircleSlot },
                new Point2(10, 10));

            // toEqual({ type: "missed", entityId, reason: "no_zone" }) —— 无 zoneId
            Assert.Equal("missed", missed.Type);
            Assert.Equal("fragment-red-circle-1", missed.EntityId);
            Assert.Equal("no_zone", missed.Reason);
            Assert.Null(missed.ZoneId);
        }
    }
}
