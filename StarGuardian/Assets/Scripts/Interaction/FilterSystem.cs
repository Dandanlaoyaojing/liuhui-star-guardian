// 碎片筛选(高亮/暗化/禁用/可拖)纯逻辑 —— 引擎无关, 由 xUnit 钉死正确性.
// 从 assets/scripts/interaction/FilterSystem.ts 迁移, 规则不变.
// TS→C# 语义映射:
//   - 字符串字面量联合 FragmentPresentation ("normal"|"highlighted"|"dimmed"|"disabled")
//     → 常量字符串(逐字保留), FragmentFilterState.Presentation 为 string;
//   - 可选字段 activeTag? / placed? → 可空 string? / bool?(用 null 区分 TS 的 undefined);
//   - !state.activeTag(TS 真值判断, undefined 与 "" 皆为假) → string.IsNullOrEmpty;
//   - [...availableTags] 展开拷贝 → ToList(); Record<string, T> → Dictionary;
//   - 不可变返回照抄(每次返回新对象, 不改入参).

using System;
using System.Collections.Generic;
using System.Linq;

namespace StarGuardian.Interaction
{
    /// <summary>当前筛选状态 —— TS interface FilterState</summary>
    public sealed record FilterState
    {
        public IReadOnlyList<string> AvailableTags { get; init; } = Array.Empty<string>();

        /// <summary>未选中筛选时为 null(对应 TS 的 activeTag?: undefined)</summary>
        public string? ActiveTag { get; init; }
    }

    /// <summary>可被筛选的碎片 —— TS interface FilterableFragment</summary>
    public sealed record FilterableFragment
    {
        public string Id { get; init; } = "";
        public IReadOnlyList<string> Tags { get; init; } = Array.Empty<string>();

        /// <summary>已放置(对应 TS 的 placed?: undefined → null)</summary>
        public bool? Placed { get; init; }
    }

    /// <summary>展示态 —— TS 字符串联合 "normal" | "highlighted" | "dimmed" | "disabled"(逐字)</summary>
    public static class FragmentPresentation
    {
        public const string Normal = "normal";
        public const string Highlighted = "highlighted";
        public const string Dimmed = "dimmed";
        public const string Disabled = "disabled";
    }

    /// <summary>
    /// 单个碎片的筛选结果视图 —— TS interface FragmentFilterState.
    /// 用 record(值相等): 单测以整体等值断言(对应 vitest toEqual), 所有字段均为 string/bool.
    /// </summary>
    public sealed record FragmentFilterState
    {
        public string FragmentId { get; init; } = "";
        public bool Visible { get; init; }
        public bool Eligible { get; init; }
        public bool Draggable { get; init; }
        public bool Highlighted { get; init; }
        public bool Dimmed { get; init; }
        public bool Disabled { get; init; }
        public string Presentation { get; init; } = FragmentPresentation.Normal;
    }

    public static class FilterSystem
    {
        /// <summary>TS createFilterState —— 拷贝可用标签, 不共享入参引用</summary>
        public static FilterState CreateFilterState(IReadOnlyList<string> availableTags)
        {
            return new FilterState
            {
                AvailableTags = availableTags.ToList()
            };
        }

        /// <summary>TS setActiveFilter —— 选中一个已知标签(未知标签抛错, 文案逐字保留)</summary>
        public static FilterState SetActiveFilter(FilterState state, string activeTag)
        {
            if (!state.AvailableTags.Contains(activeTag))
            {
                throw new ArgumentException($"Unknown filter tag: {activeTag}");
            }

            return new FilterState
            {
                AvailableTags = state.AvailableTags,
                ActiveTag = activeTag
            };
        }

        /// <summary>TS clearActiveFilter —— 清空选中(返回不带 activeTag 的新状态)</summary>
        public static FilterState ClearActiveFilter(FilterState state)
        {
            return new FilterState
            {
                AvailableTags = state.AvailableTags
            };
        }

        /// <summary>TS evaluateFragmentFilterState —— 求单个碎片在当前筛选下的展示态</summary>
        public static FragmentFilterState EvaluateFragmentFilterState(
            FilterableFragment fragment,
            FilterState state)
        {
            // TS: if (fragment.placed) —— 已放置碎片一律禁用(即便标签匹配)
            if (fragment.Placed == true)
            {
                return new FragmentFilterState
                {
                    FragmentId = fragment.Id,
                    Visible = true,
                    Eligible = false,
                    Draggable = false,
                    Highlighted = false,
                    Dimmed = false,
                    Disabled = true,
                    Presentation = FragmentPresentation.Disabled
                };
            }

            // TS: if (!state.activeTag) —— 未选筛选(undefined 或 "" 皆视为无筛选)
            if (string.IsNullOrEmpty(state.ActiveTag))
            {
                return new FragmentFilterState
                {
                    FragmentId = fragment.Id,
                    Visible = true,
                    Eligible = false,
                    Draggable = false,
                    Highlighted = false,
                    Dimmed = false,
                    Disabled = true,
                    Presentation = FragmentPresentation.Normal
                };
            }

            var matchesActiveFilter = fragment.Tags.Contains(state.ActiveTag);

            return new FragmentFilterState
            {
                FragmentId = fragment.Id,
                Visible = true,
                Eligible = matchesActiveFilter,
                Draggable = matchesActiveFilter,
                Highlighted = matchesActiveFilter,
                Dimmed = !matchesActiveFilter,
                Disabled = !matchesActiveFilter,
                Presentation = matchesActiveFilter
                    ? FragmentPresentation.Highlighted
                    : FragmentPresentation.Dimmed
            };
        }

        /// <summary>
        /// TS evaluateFragments —— 求全部碎片的视图 map.
        /// 返回 Dictionary&lt;string, FragmentFilterState&gt;(对应 TS 的 FragmentFilterMap = Record&lt;string, FragmentFilterState&gt;).
        /// </summary>
        public static Dictionary<string, FragmentFilterState> EvaluateFragments(
            IReadOnlyList<FilterableFragment> fragments,
            FilterState state)
        {
            var views = new Dictionary<string, FragmentFilterState>();
            foreach (var fragment in fragments)
            {
                views[fragment.Id] = EvaluateFragmentFilterState(fragment, state);
            }
            return views;
        }
    }
}
