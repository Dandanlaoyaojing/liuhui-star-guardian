// 从 tests/interaction/FilterSystem.test.ts 逐条迁移 —— 规格不变, 断言一一对应.
using System.Collections.Generic;
using StarGuardian.Interaction;
using Xunit;

namespace StarGuardian.Interaction.Tests
{
    public class FilterSystemTests
    {
        private static IReadOnlyList<FilterableFragment> Fragments => new List<FilterableFragment>
        {
            new()
            {
                Id = "fragment-red-circle-1",
                Tags = new[] { "fragment", "color:red", "shape:circle" }
            },
            new()
            {
                Id = "fragment-blue-circle-1",
                Tags = new[] { "fragment", "color:blue", "shape:circle" }
            },
            new()
            {
                Id = "fragment-yellow-hexagon-1",
                Tags = new[] { "fragment", "color:yellow", "shape:hexagon" },
                Placed = true
            }
        };

        [Fact(DisplayName = "creates and changes active filter state immutably")]
        public void CreatesAndChangesActiveFilterStateImmutably()
        {
            var empty = FilterSystem.CreateFilterState(new[] { "color:red", "color:blue", "color:yellow" });
            var red = FilterSystem.SetActiveFilter(empty, "color:red");
            var cleared = FilterSystem.ClearActiveFilter(red);

            Assert.Null(empty.ActiveTag);

            Assert.Equal(new[] { "color:red", "color:blue", "color:yellow" }, red.AvailableTags);
            Assert.Equal("color:red", red.ActiveTag);

            Assert.Equal(new[] { "color:red", "color:blue", "color:yellow" }, cleared.AvailableTags);
            Assert.Null(cleared.ActiveTag);
        }

        [Fact(DisplayName = "highlights matching fragments and dims nonmatching fragments for M01 tags")]
        public void HighlightsMatchingAndDimsNonmatchingForM01Tags()
        {
            var state = FilterSystem.SetActiveFilter(
                FilterSystem.CreateFilterState(new[] { "color:red", "color:blue", "color:yellow" }),
                "color:red");

            Assert.Equal(
                new FragmentFilterState
                {
                    FragmentId = "fragment-red-circle-1",
                    Visible = true,
                    Eligible = true,
                    Draggable = true,
                    Highlighted = true,
                    Dimmed = false,
                    Disabled = false,
                    Presentation = "highlighted"
                },
                FilterSystem.EvaluateFragmentFilterState(Fragments[0], state));

            Assert.Equal(
                new FragmentFilterState
                {
                    FragmentId = "fragment-blue-circle-1",
                    Visible = true,
                    Eligible = false,
                    Draggable = false,
                    Highlighted = false,
                    Dimmed = true,
                    Disabled = true,
                    Presentation = "dimmed"
                },
                FilterSystem.EvaluateFragmentFilterState(Fragments[1], state));
        }

        [Fact(DisplayName = "keeps placed fragments disabled even when their tags match")]
        public void KeepsPlacedFragmentsDisabledEvenWhenTagsMatch()
        {
            var state = FilterSystem.SetActiveFilter(
                FilterSystem.CreateFilterState(new[] { "color:red", "color:blue", "color:yellow" }),
                "color:yellow");

            Assert.Equal(
                new FragmentFilterState
                {
                    FragmentId = "fragment-yellow-hexagon-1",
                    Visible = true,
                    Eligible = false,
                    Draggable = false,
                    Highlighted = false,
                    Dimmed = false,
                    Disabled = true,
                    Presentation = "disabled"
                },
                FilterSystem.EvaluateFragmentFilterState(Fragments[2], state));
        }

        [Fact(DisplayName = "returns a stable view map for all fragments")]
        public void ReturnsStableViewMapForAllFragments()
        {
            var state = FilterSystem.SetActiveFilter(
                FilterSystem.CreateFilterState(new[] { "color:red", "color:blue", "color:yellow" }),
                "color:blue");

            var map = FilterSystem.EvaluateFragments(Fragments, state);

            // 外层 toEqual 要求恰好这三个键, 无多余
            Assert.Equal(3, map.Count);

            // 每个条目对应 TS 的 expect.objectContaining({ presentation, eligible })
            Assert.Equal("dimmed", map["fragment-red-circle-1"].Presentation);
            Assert.False(map["fragment-red-circle-1"].Eligible);

            Assert.Equal("highlighted", map["fragment-blue-circle-1"].Presentation);
            Assert.True(map["fragment-blue-circle-1"].Eligible);

            Assert.Equal("disabled", map["fragment-yellow-hexagon-1"].Presentation);
            Assert.False(map["fragment-yellow-hexagon-1"].Eligible);
        }
    }
}
