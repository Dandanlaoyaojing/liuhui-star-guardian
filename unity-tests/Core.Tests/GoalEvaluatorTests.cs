// 从 tests/core/GoalEvaluator.test.ts 逐条迁移 —— 规则不变, 断言一一对应。
using System.Collections.Generic;
using StarGuardian.Core;
using Xunit;

namespace StarGuardian.Core.Tests
{
    public class GoalEvaluatorTests
    {
        private static AllSortedGoalParams Goal => new()
        {
            Dimensions = new[] { "color", "shape" },
            Colors = new[] { "red", "blue" },
            Shapes = new[] { "circle", "triangle" }
        };

        private static SortSlotState[] Slots => new SortSlotState[]
        {
            new() { Id = "slot_red_circle", Accepts = new Dictionary<string, string?> { ["color"] = "red", ["shape"] = "circle" } },
            new() { Id = "slot_red_triangle", Accepts = new Dictionary<string, string?> { ["color"] = "red", ["shape"] = "triangle" } },
            new() { Id = "slot_blue_circle", Accepts = new Dictionary<string, string?> { ["color"] = "blue", ["shape"] = "circle" } },
            new() { Id = "slot_blue_triangle", Accepts = new Dictionary<string, string?> { ["color"] = "blue", ["shape"] = "triangle" } }
        };

        [Fact(DisplayName = "succeeds when every fragment is placed in the slot matching color and shape")]
        public void Succeeds_WhenEveryFragmentMatchesColorAndShape()
        {
            var entities = new SortableEntityState[]
            {
                new()
                {
                    Id = "fragment_1",
                    Attributes = new Dictionary<string, string?> { ["color"] = "red", ["shape"] = "circle" },
                    PlacedInSlotId = "slot_red_circle"
                },
                new()
                {
                    Id = "fragment_2",
                    Attributes = new Dictionary<string, string?> { ["color"] = "blue", ["shape"] = "triangle" },
                    PlacedInSlotId = "slot_blue_triangle"
                }
            };

            var result = GoalEvaluator.EvaluateAllSorted(Goal, new SortState { Entities = entities, Slots = Slots });

            Assert.True(result.Success);
            Assert.Empty(result.Failures);
        }

        [Fact(DisplayName = "rejects a fragment placed in a slot with the wrong color or shape")]
        public void Rejects_FragmentInWrongColorOrShapeSlot()
        {
            var entities = new SortableEntityState[]
            {
                new()
                {
                    Id = "fragment_1",
                    Attributes = new Dictionary<string, string?> { ["color"] = "red", ["shape"] = "circle" },
                    PlacedInSlotId = "slot_blue_circle"
                }
            };

            var result = GoalEvaluator.EvaluateAllSorted(Goal, new SortState { Entities = entities, Slots = Slots });

            Assert.False(result.Success);
            Assert.Contains("fragment_1 is in slot_blue_circle, which does not match color=red", result.Failures);
        }

        [Fact(DisplayName = "rejects a fragment with a missing placement")]
        public void Rejects_FragmentWithMissingPlacement()
        {
            var entities = new SortableEntityState[]
            {
                new()
                {
                    Id = "fragment_1",
                    Attributes = new Dictionary<string, string?> { ["color"] = "red", ["shape"] = "circle" },
                    PlacedInSlotId = null
                }
            };

            var result = GoalEvaluator.EvaluateAllSorted(Goal, new SortState { Entities = entities, Slots = Slots });

            Assert.False(result.Success);
            Assert.Contains("fragment_1 is not placed", result.Failures);
        }

        [Fact(DisplayName = "rejects missing or unsupported color and shape dimensions")]
        public void Rejects_MissingOrUnsupportedDimensions()
        {
            var entities = new SortableEntityState[]
            {
                new()
                {
                    Id = "fragment_1",
                    Attributes = new Dictionary<string, string?> { ["color"] = "green" },
                    PlacedInSlotId = "slot_red_circle"
                }
            };

            var result = GoalEvaluator.EvaluateAllSorted(Goal, new SortState { Entities = entities, Slots = Slots });

            Assert.False(result.Success);
            Assert.Contains("fragment_1 has unsupported color=green", result.Failures);
            Assert.Contains("fragment_1 is missing shape", result.Failures);
        }
    }
}
