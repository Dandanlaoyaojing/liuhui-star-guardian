// M01 分类归纳目标评估器 —— 引擎无关纯逻辑, 由 xUnit 钉死正确性。
// all_sorted: 每个(可按 tag 筛选的)实体, 其每个维度都必须 (1) 有合法取值(在 colors/shapes 白名单内),
//   (2) 已放入某槽, (3) 所在槽在每个维度上都接受该实体的取值; expectedEntityIds 缺席也算失败。
// 失败文案逐字保留 TS 原文(单测依赖)。从 assets/scripts/core/GoalEvaluator.ts 迁移, 规则不变。

using System;
using System.Collections.Generic;
using System.Linq;

namespace StarGuardian.Core
{
    public sealed class AllSortedGoalParams
    {
        public IReadOnlyList<string> Dimensions { get; init; } = Array.Empty<string>();
        public IReadOnlyList<string>? Colors { get; init; }
        public IReadOnlyList<string>? Shapes { get; init; }
        public IReadOnlyList<string>? ExpectedEntityIds { get; init; }
        public string? EntityTag { get; init; }
    }

    public sealed class SortableEntityState
    {
        public string Id { get; init; } = "";

        // TS Record<string, string | undefined>: 键缺失与显式 undefined 同义 → C# 用 Dictionary<string, string?>,
        // "缺键"与"值为 null"都当作 undefined 处理(取值统一走 TryGetValue, 未命中回退 null)。
        public IReadOnlyDictionary<string, string?> Attributes { get; init; } = new Dictionary<string, string?>();

        // TS string | null | undefined: 未放置。空串 / null 皆视为"未放置"(对齐 JS `!placedInSlotId` 的 falsy 语义)。
        public string? PlacedInSlotId { get; init; }

        public IReadOnlyList<string>? Tags { get; init; }
    }

    public sealed class SortSlotState
    {
        public string Id { get; init; } = "";
        public IReadOnlyDictionary<string, string?> Accepts { get; init; } = new Dictionary<string, string?>();
        public IReadOnlyList<string>? Tags { get; init; }
    }

    public sealed class SortState
    {
        public IReadOnlyList<SortableEntityState> Entities { get; init; } = Array.Empty<SortableEntityState>();
        public IReadOnlyList<SortSlotState> Slots { get; init; } = Array.Empty<SortSlotState>();
    }

    public sealed class GoalEvaluationResult
    {
        public bool Success { get; }
        public IReadOnlyList<string> Failures { get; }

        public GoalEvaluationResult(bool success, IReadOnlyList<string> failures)
        {
            Success = success;
            Failures = failures;
        }
    }

    public static class GoalEvaluator
    {
        public static GoalEvaluationResult EvaluateGoal(GoalDef goal, SortState state)
        {
            if (goal.Type != GoalType.AllSorted)
            {
                return new GoalEvaluationResult(false, new[] { $"Unsupported goal type: {goal.Type}" });
            }

            return EvaluateAllSorted(goal.Params, state);
        }

        public static GoalEvaluationResult EvaluateAllSorted(AllSortedGoalParams goalParams, SortState state)
        {
            var failures = new List<string>();

            if (goalParams.Dimensions == null || goalParams.Dimensions.Count == 0)
            {
                return new GoalEvaluationResult(false, new[] { "all_sorted requires at least one dimension" });
            }

            var entities = SelectEntities(goalParams, state.Entities);

            // TS `new Map(slots.map(...))`: 重复 slot.id 后者覆盖前者 → 用索引器赋值实现同一 last-wins
            //(ToDictionary 遇重复键会抛, 语义不符)。
            var slotsById = new Dictionary<string, SortSlotState>();
            foreach (var slot in state.Slots)
            {
                slotsById[slot.Id] = slot;
            }

            if (entities.Count == 0)
            {
                failures.Add("all_sorted has no entities to evaluate");
            }

            CollectExpectedEntityFailures(goalParams, entities, failures);

            foreach (var entity in entities)
            {
                failures.AddRange(CollectDimensionFailures(goalParams, entity));

                if (string.IsNullOrEmpty(entity.PlacedInSlotId))
                {
                    failures.Add($"{entity.Id} is not placed");
                    continue;
                }

                if (!slotsById.TryGetValue(entity.PlacedInSlotId, out var slot))
                {
                    failures.Add($"{entity.Id} is placed in unknown slot {entity.PlacedInSlotId}");
                    continue;
                }

                foreach (var dimension in goalParams.Dimensions)
                {
                    var actualValue = entity.Attributes.TryGetValue(dimension, out var av) ? av : null;
                    var acceptedValue = slot.Accepts.TryGetValue(dimension, out var sv) ? sv : null;
                    if (actualValue != null && acceptedValue != actualValue)
                    {
                        failures.Add(
                            $"{entity.Id} is in {slot.Id}, which does not match {dimension}={actualValue}");
                    }
                }
            }

            return new GoalEvaluationResult(failures.Count == 0, failures);
        }

        private static List<SortableEntityState> SelectEntities(
            AllSortedGoalParams goalParams,
            IReadOnlyList<SortableEntityState> entities)
        {
            if (goalParams.EntityTag == null)
            {
                return entities.ToList();
            }

            var entityTag = goalParams.EntityTag;
            return entities.Where(entity => entity.Tags?.Contains(entityTag) == true).ToList();
        }

        private static void CollectExpectedEntityFailures(
            AllSortedGoalParams goalParams,
            IReadOnlyList<SortableEntityState> entities,
            List<string> failures)
        {
            if (goalParams.ExpectedEntityIds == null)
            {
                return;
            }

            var entityIds = new HashSet<string>(entities.Select(entity => entity.Id));
            foreach (var expectedId in goalParams.ExpectedEntityIds)
            {
                if (!entityIds.Contains(expectedId))
                {
                    failures.Add($"missing expected entity {expectedId}");
                }
            }
        }

        private static List<string> CollectDimensionFailures(
            AllSortedGoalParams goalParams,
            SortableEntityState entity)
        {
            var failures = new List<string>();

            foreach (var dimension in goalParams.Dimensions)
            {
                var value = entity.Attributes.TryGetValue(dimension, out var v) ? v : null;

                // TS `value === undefined || value.length === 0`: 缺失 / 空串都算缺该维度(空白串不算, 故用 IsNullOrEmpty 而非 IsNullOrWhiteSpace)。
                if (string.IsNullOrEmpty(value))
                {
                    failures.Add($"{entity.Id} is missing {dimension}");
                    continue;
                }

                var allowedValues = GetAllowedValues(goalParams, dimension);
                if (allowedValues != null && !allowedValues.Contains(value))
                {
                    failures.Add($"{entity.Id} has unsupported {dimension}={value}");
                }
            }

            return failures;
        }

        private static IReadOnlyList<string>? GetAllowedValues(AllSortedGoalParams goalParams, string dimension)
        {
            if (dimension == "color")
            {
                return goalParams.Colors;
            }
            if (dimension == "shape")
            {
                return goalParams.Shapes;
            }

            return null;
        }
    }
}
