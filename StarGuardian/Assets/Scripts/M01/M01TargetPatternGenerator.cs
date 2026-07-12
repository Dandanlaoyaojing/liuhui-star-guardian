// M01「记忆齿轮」目标图案 → 交叠证据的纯几何派生逻辑 —— 引擎无关, 由 xUnit 钉死正确性。
// 从 assets/scripts/cocos/M01TargetPatternGenerator.ts 迁移, 规则不变。
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里。
//
// 职责: 把「手动摆好的标准拼片(targetPattern.pieces / 显式 placements)」两两求原色重叠、混色, 生成一批
//   M01OverlapEvidenceDef(供下游 Layout/Persistence 消费)。派生用的几何/裁剪/混色由已转写的
//   M01StandardPieceBlend 承担, 本文件只做「摆片→证据 DTO」这一层编排。
//
// TS→C# 语义映射:
//   - 导出自由函数 derive.../resolve... → 静态类 M01TargetPatternGenerator 的 PascalCase 方法(去冗余 M01 前缀,
//     同 M01StandardPieceBlend 先例)。TS 名 → C# 名:
//       deriveM01TargetEvidenceFromTargetPattern → DeriveTargetEvidenceFromTargetPattern
//       resolveM01TargetEvidenceFromConfig       → ResolveTargetEvidenceFromConfig
//       resolveM01ConfigWithCurrentTargetEvidence→ ResolveConfigWithCurrentTargetEvidence(下游依赖)
//       deriveM01TargetEvidenceFromPlacements     → DeriveTargetEvidenceFromPlacements
//     导出常量 M01_CURRENT_MANUAL_TARGET_EVIDENCE_ID_PREFIX → CurrentManualTargetEvidenceIdPrefix。
//   - 导出 interface M01ManualTargetPiecePlacement(下游依赖) / M01TargetPatternGeneratorOptions → sealed record(init)。
//     position 复用 M01StandardPieceBlend.cs 里的 M01StandardPieceBlendPoint(readonly struct), 不重定义。
//   - number → double(几何坐标/面积/角度); Map → Dictionary(索引器赋值 = TS Map last-wins 语义);
//     .some / .filter / .map / .flatMap → LINQ/foreach; a ?? b(TS 对 null/undefined)→ C# ?? / TryGetValue。
//   - Math.round(x) 对半数向 +∞ 取整(= Math.Floor(x + 0.5)), 与 MidpointRounding.AwayFromZero 在【负半数】处不同;
//     本文件坐标(position/offset/outline 相对量)常为负 → 用 Math.Floor(x + 0.5) 精确复刻 JS, 不用 AwayFromZero
//     (见 RoundPointCoordinate/RoundRatio 注)。Math.ceil → Math.Ceiling; Math.min/max → Math.Min/Max; Math.abs → Math.Abs。
//   - 内联 {x,y}(证据 position / offset / outline 元素)→ Core.Vec2Def(与 M01OverlapEvidenceDef 字段类型一致, 勿重定义)。
//   - `{ ...config, evidence }`(浅拷贝并覆盖一个字段): M01MemoryGearConfig 是 class(继承非 record 的 PuzzleConfig,
//     C# record 不能继承普通类)→ 无 `with`, 只能手写对象初始化逐字段浅拷贝。见 ResolveConfigWithCurrentTargetEvidence
//     的注: 若 config 新增字段, 此处必须同步补(否则派生 config 静默丢字段 —— TS→C# 转写「绿但错」高发点)。
//   - 引用相等: TS `evidence === config.evidence` → C# ReferenceEquals(未派生时返回 config.Evidence 本引用, 保 return config 短路)。
#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.Core;

namespace StarGuardian.M01
{
    /// <summary>一片手动摆放的目标拼片 —— TS interface M01ManualTargetPiecePlacement(下游 Layout/Persistence 依赖)。
    /// position 复用 M01StandardPieceBlendPoint; rotation 缺省(TS undefined)按 0° 处理。</summary>
    public sealed record M01ManualTargetPiecePlacement
    {
        public string FragmentId { get; init; } = "";
        public M01StandardPieceBlendPoint Position { get; init; }
        public double? Rotation { get; init; }
    }

    /// <summary>派生可选项 —— TS interface M01TargetPatternGeneratorOptions(两者皆可选)。</summary>
    public sealed record M01TargetPatternGeneratorOptions
    {
        public string? IdPrefix { get; init; }
        public double? MinOverlapArea { get; init; }
    }

    /// <summary>
    /// M01TargetPatternGenerator.ts 的四个导出自由函数 + 私有几何工具汇成静态类。语义一一对应。
    /// </summary>
    public static class M01TargetPatternGenerator
    {
        // TS: DEFAULT_STANDARD_PIECE_SIZE = { width: 56, height: 56 }
        private static readonly M01StandardPieceBlendSize DefaultStandardPieceSize = new(56, 56);

        // TS: DEFAULT_MIN_OVERLAP_AREA = 30
        private const double DefaultMinOverlapArea = 30;

        // TS: export const M01_CURRENT_MANUAL_TARGET_EVIDENCE_ID_PREFIX = "current_manual_target"
        public const string CurrentManualTargetEvidenceIdPrefix = "current_manual_target";

        /// <summary>从 config.targetPattern.pieces 派生「当前手动目标」交叠证据 —— TS deriveM01TargetEvidenceFromTargetPattern。</summary>
        public static IReadOnlyList<M01OverlapEvidenceDef> DeriveTargetEvidenceFromTargetPattern(
            M01MemoryGearConfig config,
            M01TargetPatternGeneratorOptions? options = null)
        {
            options ??= new M01TargetPatternGeneratorOptions();

            var placements = new List<M01ManualTargetPiecePlacement>();
            foreach (var piece in config.TargetPattern?.Pieces ?? new List<M01TargetPieceInstanceDef>())
            {
                // TS: if (!piece.fragmentId) return undefined → 被 filter 剔除(空串/缺省皆剔)。
                if (string.IsNullOrEmpty(piece.FragmentId))
                {
                    continue;
                }

                placements.Add(new M01ManualTargetPiecePlacement
                {
                    FragmentId = piece.FragmentId!,
                    Position = new M01StandardPieceBlendPoint(piece.Position.X, piece.Position.Y),
                    Rotation = piece.Rotation ?? 0.0
                });
            }

            // TS: { idPrefix: PREFIX, ...options } —— options 覆盖 idPrefix(缺省→ PREFIX), 并带上 minOverlapArea。
            return DeriveTargetEvidenceFromPlacements(config, placements, new M01TargetPatternGeneratorOptions
            {
                IdPrefix = options.IdPrefix ?? CurrentManualTargetEvidenceIdPrefix,
                MinOverlapArea = options.MinOverlapArea
            });
        }

        /// <summary>锁定的 targetPattern 有真片时用它派生, 否则回退到 config.evidence —— TS resolveM01TargetEvidenceFromConfig。</summary>
        public static IReadOnlyList<M01OverlapEvidenceDef> ResolveTargetEvidenceFromConfig(
            M01MemoryGearConfig config)
        {
            var targetPattern = config.TargetPattern;
            if (targetPattern is { Locked: true } &&
                (targetPattern.Pieces ?? new List<M01TargetPieceInstanceDef>())
                    .Any(piece => !string.IsNullOrEmpty(piece.FragmentId)))
            {
                return DeriveTargetEvidenceFromTargetPattern(config);
            }

            // TS: config.evidence ?? [] —— 返回 config.Evidence 本引用(保 ResolveConfigWithCurrentTargetEvidence 的引用相等短路)。
            return config.Evidence ?? new List<M01OverlapEvidenceDef>();
        }

        /// <summary>把 config 的 evidence 替换成当前派生结果(若确有变化)—— TS resolveM01ConfigWithCurrentTargetEvidence。</summary>
        public static M01MemoryGearConfig ResolveConfigWithCurrentTargetEvidence(M01MemoryGearConfig config)
        {
            var evidence = ResolveTargetEvidenceFromConfig(config);

            // TS: if (evidence === config.evidence) return config —— 未派生(回退到本引用)则原样返回, 不新建 config。
            if (ReferenceEquals(evidence, config.Evidence))
            {
                return config;
            }

            // TS: return { ...config, evidence } —— 浅拷贝全部字段, 仅覆盖 Evidence。
            // ⚠ 手写浅拷贝: M01MemoryGearConfig 新增字段时【必须】在此同步补一行, 否则派生 config 静默丢该字段。
            return new M01MemoryGearConfig
            {
                // 基类 PuzzleConfig 字段
                Id = config.Id,
                Name = config.Name,
                Stage = config.Stage,
                CognitiveSkill = config.CognitiveSkill,
                WisdomCrystal = config.WisdomCrystal,
                Scene = config.Scene,
                Interactions = config.Interactions,
                Goals = config.Goals,
                Hints = config.Hints,
                Repair = config.Repair,
                // M01MemoryGearConfig 专属字段
                Description = config.Description,
                Colors = config.Colors,
                BlendColors = config.BlendColors,
                Flashlights = config.Flashlights,
                FlashlightCoverage = config.FlashlightCoverage,
                Fragments = config.Fragments,
                // 覆盖点(TS 的 evidence): 到此分支 evidence 必是派生出的新 List → 直接沿用同一引用(TS 是按引用赋值);
                // 极端非 List 情况才复制兜底。
                Evidence = evidence as List<M01OverlapEvidenceDef> ?? new List<M01OverlapEvidenceDef>(evidence),
                StandardPieces = config.StandardPieces,
                TargetPattern = config.TargetPattern,
                Dimensions = config.Dimensions,
                Shapes = config.Shapes,
                Tuning = config.Tuning,
                Filters = config.Filters,
                Slots = config.Slots,
                Goal = config.Goal,
                ToolCard = config.ToolCard,
                Entities = config.Entities,
                RepairSequence = config.RepairSequence,
                CompletionVideo = config.CompletionVideo
            };
        }

        /// <summary>把显式摆放的标准拼片两两求原色重叠、混色, 生成交叠证据 —— TS deriveM01TargetEvidenceFromPlacements。</summary>
        public static IReadOnlyList<M01OverlapEvidenceDef> DeriveTargetEvidenceFromPlacements(
            M01MemoryGearConfig config,
            IReadOnlyList<M01ManualTargetPiecePlacement> placements,
            M01TargetPatternGeneratorOptions? options = null)
        {
            options ??= new M01TargetPatternGeneratorOptions();

            // TS: new Map(config.fragments.map(f => [f.id, f])) —— Map 重复键 last-wins → 索引器赋值。
            var fragmentsById = new Dictionary<string, M01CandidateFragmentDef>();
            foreach (var fragment in config.Fragments)
            {
                fragmentsById[fragment.Id] = fragment;
            }

            // TS: new Map((config.standardPieces ?? []).map(p => [p.shape, p.size]))
            var standardSizeByShape = new Dictionary<string, M01StandardPieceBlendSize>();
            foreach (var piece in config.StandardPieces ?? new List<M01StandardPieceDef>())
            {
                standardSizeByShape[piece.Shape] = new M01StandardPieceBlendSize(piece.Size.Width, piece.Size.Height);
            }

            var blendPlacements = new List<M01StandardPieceBlendPlacement>();
            foreach (var placement in placements)
            {
                // TS: fragmentsById.get(...); if (!fragment) return undefined → filter 剔除。
                if (!fragmentsById.TryGetValue(placement.FragmentId, out var fragment))
                {
                    continue;
                }

                // TS: fragment.shape ?? fragment.edgeShape(?? 只对 null/undefined 触发, 不对空串)。
                var shapeToken = fragment.Shape ?? fragment.EdgeShape;
                blendPlacements.Add(new M01StandardPieceBlendPlacement
                {
                    Id = placement.FragmentId,
                    ShapeToken = shapeToken,
                    ColorToken = fragment.HiddenColor,
                    Position = placement.Position,
                    // TS: standardSizeByShape.get(shapeToken) ?? DEFAULT_STANDARD_PIECE_SIZE
                    Size = standardSizeByShape.TryGetValue(shapeToken, out var size) ? size : DefaultStandardPieceSize,
                    Rotation = placement.Rotation ?? 0.0
                });
            }

            var minOverlapArea = options.MinOverlapArea ?? DefaultMinOverlapArea;

            // TS: new Map(config.fragments.map(f => [f.id, f.shape ?? f.edgeShape]))
            var fragmentShapeById = new Dictionary<string, string>();
            foreach (var fragment in config.Fragments)
            {
                fragmentShapeById[fragment.Id] = fragment.Shape ?? fragment.EdgeShape;
            }

            // TS: new Map(blendPlacements.map(p => [p.id, p]))
            var placementById = new Dictionary<string, M01StandardPieceBlendPlacement>();
            foreach (var placement in blendPlacements)
            {
                placementById[placement.Id] = placement;
            }

            var overlayCountsBySignature = new Dictionary<string, int>();
            var result = new List<M01OverlapEvidenceDef>();

            // TS: resolveM01StandardPieceBlendOverlays(blendPlacements).filter(...).flatMap(...) —— 顺序敏感(签名计数按迭代序递增)。
            foreach (var overlay in M01StandardPieceBlend.ResolveOverlays(blendPlacements))
            {
                // .filter(overlay => polygonArea(overlay.points) >= minOverlapArea)
                if (PolygonArea(overlay.Points) < minOverlapArea)
                {
                    continue;
                }

                // flatMap: if (!isM01TargetBlendColor(...)) return [] —— 只保混色(orange/green/purple)。
                if (!IsTargetBlendColor(overlay.ColorToken))
                {
                    continue;
                }

                var firstId = overlay.SourceIds[0];
                var secondId = overlay.SourceIds[1];
                placementById.TryGetValue(firstId, out var firstPlacement);
                placementById.TryGetValue(secondId, out var secondPlacement);

                // TS: [fragmentShapeById.get(firstId) ?? "circle", fragmentShapeById.get(secondId) ?? "circle"]
                var firstShape = fragmentShapeById.TryGetValue(firstId, out var fShape) ? fShape : "circle";
                var secondShape = fragmentShapeById.TryGetValue(secondId, out var sShape) ? sShape : "circle";
                var sourceShapes = new List<string> { firstShape, secondShape };

                var bounds = BoundsForPoints(overlay.Points);
                var position = new Vec2Def
                {
                    X = RoundPointCoordinate((bounds.MinX + bounds.MaxX) / 2.0),
                    Y = RoundPointCoordinate((bounds.MinY + bounds.MaxY) / 2.0)
                };

                var signature = $"{overlay.ColorToken}_{string.Join("_", sourceShapes)}";
                var nextCount = (overlayCountsBySignature.TryGetValue(signature, out var existingCount) ? existingCount : 0) + 1;
                overlayCountsBySignature[signature] = nextCount;

                var overlapArea = PolygonArea(overlay.Points);
                // TS: firstPlacement! / secondPlacement!(非空断言; 源自 blendPlacements 必命中 placementById)。
                var minSourceArea = Math.Min(
                    PolygonArea(M01StandardPieceBlend.BuildPolygon(firstPlacement!)),
                    PolygonArea(M01StandardPieceBlend.BuildPolygon(secondPlacement!)));

                var outline = new List<Vec2Def>(overlay.Points.Count);
                foreach (var point in overlay.Points)
                {
                    outline.Add(new Vec2Def
                    {
                        X = RoundPointCoordinate(point.X - position.X),
                        Y = RoundPointCoordinate(point.Y - position.Y)
                    });
                }

                result.Add(new M01OverlapEvidenceDef
                {
                    Id = $"{options.IdPrefix ?? "target_overlap"}_{signature}_{nextCount}",
                    TargetShape = "generated_overlap",
                    TargetBlendColor = overlay.ColorToken,
                    Position = position,
                    // TS: Math.max(18, Math.ceil(Math.max(width, height) / 2))
                    Tolerance = Math.Max(18.0, Math.Ceiling(Math.Max(bounds.MaxX - bounds.MinX, bounds.MaxY - bounds.MinY) / 2.0)),
                    ShapeTags = sourceShapes.Select(shape => $"shape:{shape}").ToList(),
                    GeneratedOverlap = new M01OverlapEvidenceGeneratedOverlapDef
                    {
                        AreaRatio = RoundRatio(overlapArea / minSourceArea),
                        Offset = new Vec2Def
                        {
                            // TS: (secondPlacement?.position.x ?? 0) - (firstPlacement?.position.x ?? 0)
                            X = RoundPointCoordinate((secondPlacement?.Position.X ?? 0.0) - (firstPlacement?.Position.X ?? 0.0)),
                            Y = RoundPointCoordinate((secondPlacement?.Position.Y ?? 0.0) - (firstPlacement?.Position.Y ?? 0.0))
                        },
                        // TS: ((firstPlacement?.rotation ?? 0) + (secondPlacement?.rotation ?? 0)) / 2
                        Rotation = RoundPointCoordinate(((firstPlacement?.Rotation ?? 0.0) + (secondPlacement?.Rotation ?? 0.0)) / 2.0),
                        SourceShapes = sourceShapes,
                        Outline = outline
                    },
                    Solution = new M01OverlapEvidenceSolutionDef
                    {
                        FragmentIds = new List<string> { firstId, secondId }
                    }
                });
            }

            return result;
        }

        // TS: isM01TargetBlendColor —— 只有混色(排除三原色)是有效目标色。
        private static bool IsTargetBlendColor(string colorToken) =>
            colorToken == "orange" || colorToken == "green" || colorToken == "purple";

        // TS: boundsForPoints —— reduce 求 AABB(种子 ±Infinity)。points 恒 >= 3 点故边界良定义。
        private static (double MinX, double MaxX, double MinY, double MaxY) BoundsForPoints(
            IReadOnlyList<M01StandardPieceBlendPoint> points)
        {
            var minX = double.PositiveInfinity;
            var maxX = double.NegativeInfinity;
            var minY = double.PositiveInfinity;
            var maxY = double.NegativeInfinity;
            foreach (var point in points)
            {
                minX = Math.Min(minX, point.X);
                maxX = Math.Max(maxX, point.X);
                minY = Math.Min(minY, point.Y);
                maxY = Math.Max(maxY, point.Y);
            }

            return (minX, maxX, minY, maxY);
        }

        // TS: polygonArea —— 鞋带公式 abs(Σ / 2)(与 M01StandardPieceBlend 的私有同名工具同式, 该处 private 故本文件重写)。
        private static double PolygonArea(IReadOnlyList<M01StandardPieceBlendPoint> points)
        {
            var sum = 0.0;
            for (var index = 0; index < points.Count; index += 1)
            {
                var point = points[index];
                var next = points[(index + 1) % points.Count];
                sum += point.X * next.Y - next.X * point.Y;
            }

            return Math.Abs(sum / 2.0);
        }

        // TS: roundPointCoordinate = Math.round(v * 100) / 100。
        // Math.round 半数向 +∞(= Math.Floor(x + 0.5)); 坐标常为负, 故用 Floor(x+0.5) 精确复刻(非 AwayFromZero)。
        private static double RoundPointCoordinate(double value) => Math.Floor(value * 100.0 + 0.5) / 100.0;

        // TS: roundRatio = Math.round(v * 1000) / 1000(v = 面积比, 恒正; 同用 Floor(x+0.5) 与坐标一致)。
        private static double RoundRatio(double value) => Math.Floor(value * 1000.0 + 0.5) / 1000.0;
    }
}
