// 拼片吸附判定(标签准则匹配 + 落点命中区域 + 吸附落位)纯逻辑 —— 引擎无关, 由 xUnit 钉死正确性.
// 从 assets/scripts/interaction/SnapZone.ts 迁移, 规则不变.
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里.
// TS→C# 语义映射:
//   - Point2 来自 DragHandler.ts(SnapZone.ts import 它)→ 复用 DragHandler.cs 里同命名空间的
//     readonly record struct Point2, 本文件不重复定义(避免 CS0101 重复类型);
//   - interface(SnapEntity/TagCriteria/SnapBounds/SnapZone/SnapMatchResult)→ sealed record;
//   - 可选字段 all?/any?/none?/snapPosition?/reason?/missingTags? → 可空(null 区分 TS 的 undefined);
//   - 字符串字面量联合 SnapRejectReason("missing_required_tags"|...)→ 常量字符串(逐字保留, 测试依赖);
//   - 判别联合 DropResult(accepted|rejected|missed)→ 单 record + Type 判别串, 各态只填自己的字段其余留 null;
//   - new Set(tags) → HashSet<string>; [].filter/.some → Linq Where/Any; ?? → C# ??;
//     数组结果物化为 List(ToList), 每次返回新对象不改入参.

using System;
using System.Collections.Generic;
using System.Linq;

namespace StarGuardian.Interaction
{
    /// <summary>可被吸附的实体(带标签)—— TS interface SnapEntity</summary>
    public sealed record SnapEntity
    {
        public string Id { get; init; } = "";
        public IReadOnlyList<string> Tags { get; init; } = Array.Empty<string>();
    }

    /// <summary>标签准则: all 全含 / any 至少一个 / none 一个都不含 —— TS interface TagCriteria</summary>
    public sealed record TagCriteria
    {
        public IReadOnlyList<string>? All { get; init; }
        public IReadOnlyList<string>? Any { get; init; }
        public IReadOnlyList<string>? None { get; init; }
    }

    /// <summary>以 (X,Y) 为中心的轴对齐矩形 —— TS interface SnapBounds(number → double, 精度不变)</summary>
    public sealed record SnapBounds
    {
        public double X { get; init; }
        public double Y { get; init; }
        public double Width { get; init; }
        public double Height { get; init; }
    }

    /// <summary>吸附槽 —— TS interface SnapZone</summary>
    public sealed record SnapZone
    {
        public string Id { get; init; } = "";
        public TagCriteria Criteria { get; init; } = new();
        public SnapBounds Bounds { get; init; } = new();

        /// <summary>未指定时落到 bounds 原点(对应 TS 的 snapPosition?: undefined)</summary>
        public Point2? SnapPosition { get; init; }
    }

    // SnapRejectReason = "missing_required_tags" | "missing_any_tag" | "forbidden_tags"
    // —— 文案逐字保留(测试断言依赖)。
    public static class SnapRejectReason
    {
        public const string MissingRequiredTags = "missing_required_tags";
        public const string MissingAnyTag = "missing_any_tag";
        public const string ForbiddenTags = "forbidden_tags";
    }

    /// <summary>标签匹配结果 —— TS interface SnapMatchResult(可读的拒绝原因 + 相关标签)</summary>
    public sealed record SnapMatchResult
    {
        public bool Accepted { get; init; }
        public string? Reason { get; init; }
        public IReadOnlyList<string>? MissingTags { get; init; }
        public IReadOnlyList<string>? AnyTags { get; init; }
        public IReadOnlyList<string>? ForbiddenTags { get; init; }
    }

    /// <summary>
    /// 落子结果三态 —— TS 判别联合 DropResult:
    ///   accepted → Type + EntityId + ZoneId + SnapPosition;
    ///   rejected → Type + EntityId + ZoneId + Reason + 相关标签;
    ///   missed   → Type + EntityId + Reason="no_zone"(无 ZoneId)。
    /// 各态只填自己的字段, 其余保持 null。
    /// </summary>
    public sealed record DropResult
    {
        public string Type { get; init; } = "";
        public string EntityId { get; init; } = "";
        public string? ZoneId { get; init; }
        public string? Reason { get; init; }
        public Point2? SnapPosition { get; init; }
        public IReadOnlyList<string>? MissingTags { get; init; }
        public IReadOnlyList<string>? AnyTags { get; init; }
        public IReadOnlyList<string>? ForbiddenTags { get; init; }
    }

    /// <summary>
    /// SnapZone.ts 的三个导出自由函数(canSnapToZone / resolveDropResult / containsPoint)汇成静态类。
    /// 命名为 SnapZoneLogic 而非 SnapZone —— 后者已是导出的吸附槽 record 类型, 不能同名。
    /// </summary>
    public static class SnapZoneLogic
    {
        /// <summary>判断实体标签是否满足吸附槽准则, 不满足给出可读原因 —— TS canSnapToZone</summary>
        public static SnapMatchResult CanSnapToZone(SnapEntity entity, SnapZone zone)
        {
            var tags = new HashSet<string>(entity.Tags);

            var missingTags = (zone.Criteria.All ?? Array.Empty<string>())
                .Where(tag => !tags.Contains(tag))
                .ToList();
            if (missingTags.Count > 0)
            {
                return new SnapMatchResult
                {
                    Accepted = false,
                    Reason = SnapRejectReason.MissingRequiredTags,
                    MissingTags = missingTags
                };
            }

            var anyTags = zone.Criteria.Any ?? Array.Empty<string>();
            if (anyTags.Count > 0 && !anyTags.Any(tag => tags.Contains(tag)))
            {
                return new SnapMatchResult
                {
                    Accepted = false,
                    Reason = SnapRejectReason.MissingAnyTag,
                    AnyTags = anyTags.ToList()
                };
            }

            var forbiddenTags = (zone.Criteria.None ?? Array.Empty<string>())
                .Where(tag => tags.Contains(tag))
                .ToList();
            if (forbiddenTags.Count > 0)
            {
                return new SnapMatchResult
                {
                    Accepted = false,
                    Reason = SnapRejectReason.ForbiddenTags,
                    ForbiddenTags = forbiddenTags
                };
            }

            return new SnapMatchResult { Accepted = true };
        }

        /// <summary>把一次落子解析为 accepted/rejected/missed 三态 —— TS resolveDropResult</summary>
        public static DropResult ResolveDropResult(
            SnapEntity entity,
            IReadOnlyList<SnapZone> zones,
            Point2 dropPosition)
        {
            var targetZone = zones.FirstOrDefault(zone => ContainsPoint(zone.Bounds, dropPosition));
            if (targetZone is null)
            {
                return new DropResult
                {
                    Type = "missed",
                    EntityId = entity.Id,
                    Reason = "no_zone"
                };
            }

            var match = CanSnapToZone(entity, targetZone);
            if (!match.Accepted)
            {
                var reason = match.Reason ?? SnapRejectReason.MissingRequiredTags;

                return new DropResult
                {
                    Type = "rejected",
                    EntityId = entity.Id,
                    ZoneId = targetZone.Id,
                    Reason = reason,
                    MissingTags = match.MissingTags,
                    AnyTags = match.AnyTags,
                    ForbiddenTags = match.ForbiddenTags
                };
            }

            return new DropResult
            {
                Type = "accepted",
                EntityId = entity.Id,
                ZoneId = targetZone.Id,
                SnapPosition = targetZone.SnapPosition
                    ?? new Point2(targetZone.Bounds.X, targetZone.Bounds.Y)
            };
        }

        /// <summary>点是否落在以 (X,Y) 为中心、宽高各半的矩形内(闭区间)—— TS containsPoint</summary>
        public static bool ContainsPoint(SnapBounds bounds, Point2 point)
        {
            var halfWidth = bounds.Width / 2;
            var halfHeight = bounds.Height / 2;

            return point.X >= bounds.X - halfWidth &&
                   point.X <= bounds.X + halfWidth &&
                   point.Y >= bounds.Y - halfHeight &&
                   point.Y <= bounds.Y + halfHeight;
        }
    }
}
