// M01 灰盒关卡的落子结算(碎片/滤色片拖放 → 弱磁吸/目标片吸附/贴槽/自由落下/激活滤色片/归位)——
// 引擎无关纯逻辑, 由 xUnit 钉死正确性. 从 assets/scripts/cocos/M01GreyboxDrag.ts 迁移, 规则不变.
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里.
//
// TS→C# 语义/命名映射:
//   - 判别联合 M01GreyboxDropAction(weak_snap_fragment | snap_fragment_to_target_piece |
//     place_fragment_freely | stick_fragment_to_slot | activate_filter | place_fragment | return_to_origin)
//     → 单 sealed record M01GreyboxDropAction + Type 判别串, 各态只填自己的字段其余留 null(同 SnapZone.cs 的 DropResult)。
//     record 合成的值相等供测试 toEqual 比较; Type 串逐字保留(测试断言依赖)。
//   - interface M01GreyboxDropOptions{ rotation?: number } → sealed record + double? Rotation。
//   - number → double(几何/角度); === 字符串 → ==(ordinal); new Set(tags) → HashSet<string>;
//     Object.keys(map) → Dictionary.Keys(仅用 length/includes, 不依赖顺序)。
//   - Array.sort(comparator) 稳定 → LINQ OrderBy/OrderByDescending.ThenBy(稳定, 复刻 V8 稳定排序)。
//   - dropPosition 是 M01GreyboxPoint; SnapZone.ts 的 containsPoint/resolveDropResult 收 Interaction.Point2
//     → 用 ToPoint2 转换后调 SnapZoneLogic(复用已转写的 Interaction/SnapZone.cs, 不重定义)。
//   - options.rotation === undefined → double? 为 null; %/Math.min/Math.abs 直译; Math.round 无(本文件不用)。
//   - 复用已转写类型: M01GreyboxLayoutData / M01GreyboxTokenNode / M01GreyboxPieceSnapZone / M01GreyboxPoint
//     (M01GreyboxLayout.cs), Interaction.{SnapZone, SnapBounds, TagCriteria, SnapEntity, DropResult, Point2, SnapZoneLogic}。
#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.Interaction;

namespace StarGuardian.M01
{
    /// <summary>落子结果的判别串 —— TS M01GreyboxDropAction.type 字符串联合(逐字保留, 测试依赖)。</summary>
    public static class M01GreyboxDropActionType
    {
        public const string WeakSnapFragment = "weak_snap_fragment";
        public const string SnapFragmentToTargetPiece = "snap_fragment_to_target_piece";
        public const string PlaceFragmentFreely = "place_fragment_freely";
        public const string StickFragmentToSlot = "stick_fragment_to_slot";
        public const string ActivateFilter = "activate_filter";
        public const string PlaceFragment = "place_fragment";
        public const string ReturnToOrigin = "return_to_origin";
    }

    /// <summary>
    /// 一次落子的结算结果 —— TS 判别联合 M01GreyboxDropAction。各态只填自己的字段, 其余保持 null:
    ///   weak_snap_fragment            → Type + FragmentId + EvidenceId;
    ///   snap_fragment_to_target_piece → Type + FragmentId + PieceSlotId + Position + Rotation;
    ///   place_fragment_freely         → Type + FragmentId + Position?(可选);
    ///   stick_fragment_to_slot        → Type + FragmentId + Position;
    ///   activate_filter               → Type + FilterId;
    ///   place_fragment                → Type + FragmentId + SlotId;
    ///   return_to_origin              → Type + Reason("no_zone" | "wrong_token_kind")。
    /// </summary>
    public sealed record M01GreyboxDropAction
    {
        public string Type { get; init; } = "";
        public string? FragmentId { get; init; }
        public string? EvidenceId { get; init; }
        public string? PieceSlotId { get; init; }
        public string? SlotId { get; init; }
        public string? FilterId { get; init; }
        public M01GreyboxPoint? Position { get; init; }
        public double? Rotation { get; init; }
        public string? Reason { get; init; }
    }

    /// <summary>落子可选项 —— TS interface M01GreyboxDropOptions。rotation 缺省=null(对应 TS undefined)。</summary>
    public sealed record M01GreyboxDropOptions
    {
        public double? Rotation { get; init; }
    }

    /// <summary>M01GreyboxDrag.ts 的导出函数 + 私有辅助汇成静态类。方法名去掉冗余前缀, 语义一一对应。</summary>
    public static class M01GreyboxDrag
    {
        // TS: EVIDENCE_MAGNET_CONTOUR_TOLERANCE = 2。
        private const double EvidenceMagnetContourTolerance = 2;

        // TS: TARGET_PIECE_SNAP_ROTATION_TOLERANCE = 1。
        private const double TargetPieceSnapRotationTolerance = 1;

        // TS: TARGET_PIECE_DROP_ZONE_MARGIN = 20 —— 目标槽判定框比拼片本体每边多放宽的总量(px)。
        private const double TargetPieceDropZoneMargin = 20;

        /// <summary>把一次落子解析为具体动作 —— TS resolveM01GreyboxDrop。</summary>
        public static M01GreyboxDropAction ResolveM01GreyboxDrop(
            M01GreyboxLayoutData layout,
            M01GreyboxTokenNode token,
            M01GreyboxPoint dropPosition,
            M01GreyboxDropOptions? options = null)
        {
            options ??= new M01GreyboxDropOptions();

            if (token.Kind == "filter")
            {
                var result = SnapZoneLogic.ResolveDropResult(
                    ToSnapEntity(token),
                    new List<SnapZone> { BuildFilterDropZone(layout) },
                    ToPoint2(dropPosition));

                return result.Type == "accepted"
                    ? new M01GreyboxDropAction
                    {
                        Type = M01GreyboxDropActionType.ActivateFilter,
                        FilterId = token.ControllerId
                    }
                    : new M01GreyboxDropAction
                    {
                        Type = M01GreyboxDropActionType.ReturnToOrigin,
                        Reason = result.Type == "missed" ? "no_zone" : "wrong_token_kind"
                    };
            }

            if (token.Kind == "fragment")
            {
                if (layout.Evidence.Count > 0)
                {
                    return ResolveEvidenceFragmentDrop(layout, token, dropPosition, options);
                }

                var result = ResolveFragmentDrop(layout, token, dropPosition);

                return result.Type == "accepted"
                    ? new M01GreyboxDropAction
                    {
                        Type = M01GreyboxDropActionType.PlaceFragment,
                        FragmentId = token.ControllerId,
                        SlotId = result.ZoneId
                    }
                    : new M01GreyboxDropAction
                    {
                        Type = M01GreyboxDropActionType.ReturnToOrigin,
                        Reason = result.Type == "missed" ? "no_zone" : "wrong_token_kind"
                    };
            }

            return new M01GreyboxDropAction
            {
                Type = M01GreyboxDropActionType.ReturnToOrigin,
                Reason = "wrong_token_kind"
            };
        }

        private static M01GreyboxDropAction ResolveEvidenceFragmentDrop(
            M01GreyboxLayoutData layout,
            M01GreyboxTokenNode token,
            M01GreyboxPoint dropPosition,
            M01GreyboxDropOptions options)
        {
            if (!layout.EvidenceSnapEnabled)
            {
                var pieceSlotHitWhileComposing = ResolveTargetPieceSlotDrop(layout, token, dropPosition, options);
                if (pieceSlotHitWhileComposing != null)
                {
                    return pieceSlotHitWhileComposing; // snap_fragment_to_target_piece 或 stick_fragment_to_slot(角度没对贴槽不掉)
                }
                return new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.PlaceFragmentFreely,
                    FragmentId = token.ControllerId,
                    Position = dropPosition
                };
            }

            var pieceSlotHit = ResolveTargetPieceSlotDrop(layout, token, dropPosition, options);
            if (pieceSlotHit != null)
            {
                return pieceSlotHit; // snap_fragment_to_target_piece 或 stick_fragment_to_slot
            }

            var hitEvidence = layout.Evidence
                .Select(evidence => new { Evidence = evidence, Zone = BuildEvidenceDropZone(evidence) })
                .Where(pair =>
                    SnapZoneLogic.ContainsPoint(pair.Zone.Bounds, ToPoint2(dropPosition)) &&
                    ContainsEvidenceMagnetContour(pair.Evidence, dropPosition))
                .ToList();

            var tokenTags = new HashSet<string>(token.Tags);
            var shapeCompatibleHits = hitEvidence
                .Where(pair =>
                    EvidenceTagMatchScore(pair.Evidence, tokenTags) > 0 &&
                    IsEvidenceTrialFitRotationCompatible(layout, pair.Evidence, token, options))
                .ToList();

            if (shapeCompatibleHits.Count > 0)
            {
                var bestHit = shapeCompatibleHits
                    .OrderByDescending(pair => EvidenceTagMatchScore(pair.Evidence, tokenTags))
                    .ThenBy(pair => DistanceSquared(pair.Evidence.Position, dropPosition))
                    .First();

                return new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.WeakSnapFragment,
                    FragmentId = token.ControllerId,
                    EvidenceId = bestHit.Evidence.ControllerId
                };
            }

            return new M01GreyboxDropAction
            {
                Type = M01GreyboxDropActionType.PlaceFragmentFreely,
                FragmentId = token.ControllerId,
                Position = dropPosition
            };
        }

        private static M01GreyboxDropAction? ResolveTargetPieceSlotDrop(
            M01GreyboxLayoutData layout,
            M01GreyboxTokenNode token,
            M01GreyboxPoint dropPosition,
            M01GreyboxDropOptions options)
        {
            var tokenTags = new HashSet<string>(token.Tags);
            var compatibleSlots = layout.TargetPieceSlots
                .Where(slot => tokenTags.Contains($"shape:{slot.ShapeToken}"))
                .Where(slot => SnapZoneLogic.ContainsPoint(BuildTargetPieceDropZone(slot).Bounds, ToPoint2(dropPosition)))
                .ToList();

            if (compatibleSlots.Count == 0)
            {
                return null;
            }

            // 槽矩形可能互相重叠: 先取"玩家瞄准的"最近槽, 再对它判旋转(先筛旋转会静默吸到较远的角度兼容槽)。
            var nearestSlot = compatibleSlots
                .OrderBy(slot => DistanceSquared(slot.Position, dropPosition))
                .First();

            if (!IsTargetPieceRotationCompatible(options.Rotation, nearestSlot.Rotation, nearestSlot.ShapeToken))
            {
                // 落点命中槽但角度没对 → 贴在槽位不掉(保持玩家朝向), 原地转对了再落定。不再自由落下(片会悄悄掉走)。
                return new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.StickFragmentToSlot,
                    FragmentId = token.ControllerId,
                    Position = nearestSlot.Position
                };
            }

            return new M01GreyboxDropAction
            {
                Type = M01GreyboxDropActionType.SnapFragmentToTargetPiece,
                FragmentId = token.ControllerId,
                PieceSlotId = nearestSlot.Id,
                Position = nearestSlot.Position,
                Rotation = nearestSlot.Rotation
            };
        }

        private static DropResult ResolveFragmentDrop(
            M01GreyboxLayoutData layout,
            M01GreyboxTokenNode token,
            M01GreyboxPoint dropPosition)
        {
            var hitSlots = (layout.Slots ?? new List<M01GreyboxTokenNode>())
                .Select(slot => new { Slot = slot, Zone = BuildSlotDropZone(slot) })
                .Where(pair => SnapZoneLogic.ContainsPoint(pair.Zone.Bounds, ToPoint2(dropPosition)))
                .ToList();

            if (hitSlots.Count == 0)
            {
                return SnapZoneLogic.ResolveDropResult(ToSnapEntity(token), new List<SnapZone>(), ToPoint2(dropPosition));
            }

            var tokenTags = new HashSet<string>(token.Tags);
            var bestHit = hitSlots
                .OrderByDescending(pair => SlotTagMatchScore(pair.Slot, tokenTags))
                .ThenBy(pair => DistanceSquared(pair.Slot.Position, dropPosition))
                .First();

            return SnapZoneLogic.ResolveDropResult(
                ToSnapEntity(token),
                new List<SnapZone> { bestHit.Zone },
                ToPoint2(dropPosition));
        }

        private static SnapZone BuildTargetPieceDropZone(M01GreyboxPieceSnapZone slot)
        {
            return new SnapZone
            {
                Id = slot.Id,
                Criteria = new TagCriteria { All = new List<string> { "fragment", $"shape:{slot.ShapeToken}" } },
                Bounds = new SnapBounds
                {
                    // 判定框比拼片本体略放宽(每边 +TARGET_PIECE_DROP_ZONE_MARGIN/2): 落点稍偏也能吸/贴住。
                    X = slot.Position.X,
                    Y = slot.Position.Y,
                    Width = slot.Size.Width + TargetPieceDropZoneMargin,
                    Height = slot.Size.Height + TargetPieceDropZoneMargin
                },
                SnapPosition = ToPoint2(slot.Position)
            };
        }

        private static SnapZone BuildFilterDropZone(M01GreyboxLayoutData layout)
        {
            return new SnapZone
            {
                Id = layout.Gear.ControllerId,
                Criteria = new TagCriteria { All = new List<string> { "filter" } },
                Bounds = new SnapBounds
                {
                    X = layout.Gear.Position.X,
                    Y = layout.Gear.Position.Y,
                    Width = layout.Gear.Size.Width,
                    Height = layout.Gear.Size.Height
                },
                SnapPosition = ToPoint2(layout.Gear.Position)
            };
        }

        private static SnapZone BuildEvidenceDropZone(M01GreyboxTokenNode evidence)
        {
            return new SnapZone
            {
                Id = evidence.ControllerId,
                Criteria = new TagCriteria { All = new List<string> { "fragment" } },
                Bounds = new SnapBounds
                {
                    X = evidence.Position.X,
                    Y = evidence.Position.Y,
                    Width = evidence.Size.Width,
                    Height = evidence.Size.Height
                },
                SnapPosition = ToPoint2(evidence.Position)
            };
        }

        private static SnapZone BuildSlotDropZone(M01GreyboxTokenNode slot)
        {
            return new SnapZone
            {
                Id = slot.ControllerId,
                Criteria = new TagCriteria { All = new List<string> { "fragment" } },
                Bounds = new SnapBounds
                {
                    X = slot.Position.X,
                    Y = slot.Position.Y,
                    Width = slot.Size.Width,
                    Height = slot.Size.Height
                },
                SnapPosition = ToPoint2(slot.Position)
            };
        }

        private static SnapEntity ToSnapEntity(M01GreyboxTokenNode token)
        {
            var tags = new List<string> { token.Kind };
            tags.AddRange(token.Tags);

            return new SnapEntity
            {
                Id = token.ControllerId,
                Tags = tags
            };
        }

        private static int SlotTagMatchScore(M01GreyboxTokenNode slot, HashSet<string> tokenTags)
        {
            return slot.Tags.Count(tag => tokenTags.Contains(tag));
        }

        private static int EvidenceTagMatchScore(M01GreyboxTokenNode evidence, HashSet<string> tokenTags)
        {
            return evidence.Tags.Count(tag => tag != "overlap_evidence" && tokenTags.Contains(tag));
        }

        // 形状的旋转对称周期(度): 圆=0(任意角都重合); 三角形=120(3轴); 方形=90(4轴); 六边形=60(6轴); 未知=360(无对称)。
        private static double ShapeRotationSymmetryDegrees(string? shape)
        {
            switch (shape)
            {
                case "circle":
                    return 0;
                case "triangle":
                    return 120;
                case "square":
                    return 90;
                case "hexagon":
                    return 60;
                default:
                    return 360;
            }
        }

        private static bool IsTargetPieceRotationCompatible(
            double? rotation,
            double targetRotation,
            string? shape)
        {
            if (rotation == null)
            {
                return true;
            }
            var period = ShapeRotationSymmetryDegrees(shape);
            if (period == 0)
            {
                return true; // 圆: 任意朝向都重合
            }
            var raw = RotationDistanceDegrees(rotation.Value, targetRotation) % period;
            var reduced = Math.Min(raw, period - raw); // 到最近对称重合朝向的角距
            return reduced <= TargetPieceSnapRotationTolerance;
        }

        // 弱磁吸的旋转门槛: 按"该片是不是【当前这个证据】的真解生成片"分流(不是"任何地方的真解片")。
        //  - 是本证据生成片 → 按它自己的生成朝向判;
        //  - 不是本证据生成片(诱饵/别的证据的真解片) → 一律按本证据同形状生成片的朝向判。
        private static bool IsEvidenceTrialFitRotationCompatible(
            M01GreyboxLayoutData layout,
            M01GreyboxTokenNode evidence,
            M01GreyboxTokenNode token,
            M01GreyboxDropOptions options)
        {
            var generatorIds = (evidence.FragmentSnapPositions != null
                ? evidence.FragmentSnapPositions.Keys
                : Enumerable.Empty<string>()).ToList();
            if (generatorIds.Count == 0)
            {
                return true; // legacy 证据不带生成片信息 → 不加旋转门槛
            }

            if (generatorIds.Contains(token.ControllerId))
            {
                var ownSlot = layout.TargetPieceSlots.FirstOrDefault(
                    slot => slot.ExpectedFragmentId == token.ControllerId);
                if (ownSlot != null)
                {
                    return IsTargetPieceRotationCompatible(options.Rotation, ownSlot.Rotation, ownSlot.ShapeToken);
                }
            }

            var tokenTags = new HashSet<string>(token.Tags);
            var sameShapeGeneratorSlots = layout.TargetPieceSlots.Where(slot =>
                slot.ExpectedFragmentId != null &&
                generatorIds.Contains(slot.ExpectedFragmentId) &&
                tokenTags.Contains($"shape:{slot.ShapeToken}")).ToList();
            if (sameShapeGeneratorSlots.Count == 0)
            {
                return true; // 生成片没有同形状目标槽可查(数据缺口) → 兜底放行, 形状匹配已由 tag 分数把关
            }

            return sameShapeGeneratorSlots.Any(slot =>
                IsTargetPieceRotationCompatible(options.Rotation, slot.Rotation, slot.ShapeToken));
        }

        private static double NormalizeRotation(double rotation)
        {
            return ((rotation % 360) + 360) % 360;
        }

        private static double RotationDistanceDegrees(double left, double right)
        {
            var delta = Math.Abs(NormalizeRotation(left) - NormalizeRotation(right));
            return Math.Min(delta, 360 - delta);
        }

        private static bool ContainsEvidenceMagnetContour(
            M01GreyboxTokenNode evidence,
            M01GreyboxPoint dropPosition)
        {
            if (evidence.MagnetPolygon == null || evidence.MagnetPolygon.Count < 3)
            {
                return true;
            }

            var localPoint = new M01GreyboxPoint(
                dropPosition.X - evidence.Position.X,
                dropPosition.Y - evidence.Position.Y);

            return ContainsLocalPolygonPoint(evidence.MagnetPolygon, localPoint) ||
                DistanceToPolygonSquared(evidence.MagnetPolygon, localPoint) <=
                    EvidenceMagnetContourTolerance * EvidenceMagnetContourTolerance;
        }

        private static bool ContainsLocalPolygonPoint(
            IReadOnlyList<M01GreyboxPoint> polygon,
            M01GreyboxPoint point)
        {
            var inside = false;
            for (int index = 0, previousIndex = polygon.Count - 1; index < polygon.Count; previousIndex = index, index += 1)
            {
                var current = polygon[index];
                var previous = polygon[previousIndex];
                var intersects =
                    (current.Y > point.Y) != (previous.Y > point.Y) &&
                    point.X < ((previous.X - current.X) * (point.Y - current.Y)) / (previous.Y - current.Y) + current.X;

                if (intersects)
                {
                    inside = !inside;
                }
            }

            return inside;
        }

        private static double DistanceToPolygonSquared(
            IReadOnlyList<M01GreyboxPoint> polygon,
            M01GreyboxPoint point)
        {
            var closest = double.PositiveInfinity;
            for (int index = 0, previousIndex = polygon.Count - 1; index < polygon.Count; previousIndex = index, index += 1)
            {
                closest = Math.Min(
                    closest,
                    DistanceToSegmentSquared(point, polygon[previousIndex], polygon[index]));
            }

            return closest;
        }

        private static double DistanceToSegmentSquared(
            M01GreyboxPoint point,
            M01GreyboxPoint start,
            M01GreyboxPoint end)
        {
            var dx = end.X - start.X;
            var dy = end.Y - start.Y;
            var lengthSquared = dx * dx + dy * dy;
            if (lengthSquared == 0)
            {
                return DistanceSquared(point, start);
            }

            var t = Math.Max(
                0,
                Math.Min(1, ((point.X - start.X) * dx + (point.Y - start.Y) * dy) / lengthSquared));
            return DistanceSquared(point, new M01GreyboxPoint(
                start.X + t * dx,
                start.Y + t * dy));
        }

        private static double DistanceSquared(M01GreyboxPoint a, M01GreyboxPoint b)
        {
            var dx = a.X - b.X;
            var dy = a.Y - b.Y;

            return dx * dx + dy * dy;
        }

        // dropPosition 是 M01GreyboxPoint; SnapZone.cs 的判定/结算收 Interaction.Point2 → 值透传转换。
        private static Point2 ToPoint2(M01GreyboxPoint point) => new Point2(point.X, point.Y);
    }
}
