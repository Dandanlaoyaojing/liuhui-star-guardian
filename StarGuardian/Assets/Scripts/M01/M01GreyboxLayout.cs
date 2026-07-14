// M01 灰盒关卡的布局装配(把记忆齿轮 config → 齿轮/盘/证据/参考图/碎片/目标片吸附区 的纯数据布局)——
// 引擎无关纯逻辑, 由 xUnit 钉死正确性. 从 assets/scripts/cocos/M01GreyboxLayout.ts 迁移, 规则不变.
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里.
//
// TS→C# 语义/命名映射:
//   - TS 里「模块函数 buildM01GreyboxLayout」与「返回类型 interface M01GreyboxLayout」同名冲突 →
//     C# 用 静态类 M01GreyboxLayout 承接函数与常量(同 M01IntroLayout/M01StandardPieceBlend 先例:
//     模块静态类以文件名命名), 数据结果类型改名 M01GreyboxLayoutData(唯一新增名; 见返回 ambiguities)。
//       buildM01GreyboxLayout                → M01GreyboxLayout.Build
//       resolveM01EvidenceFragmentSnapPosition → M01GreyboxLayout.ResolveEvidenceFragmentSnapPosition
//       M01_STANDARD_PIECE_DISPLAY_SIZE      → M01GreyboxLayout.StandardPieceDisplaySize (public static readonly)
//   - interface M01GreyboxPoint{x,y} / M01GreyboxSize{width,height} → readonly struct + IEquatable + ==/!=
//     (C#9 无 record struct)。Equals 对 double 字段用 .Equals() 不用 ==(NaN 自反, 兑现 record struct 语义)。
//   - interface M01GreyboxTokenNode / M01GreyboxPieceSnapZone → sealed class(可变): position/sourcePosition/
//     fragmentSnapPositions 在 shiftBoardContentToMatchBoard 里被就地重赋值 → { get; set; }; 其余 { get; init; }。
//     (含 IReadOnlyList 字段, 不做 record 结构相等, 故用 class 而非 record —— 测试也不比较节点相等。)
//   - interface M01GreyboxLayout(返回)/ M01GreyboxLayoutOptions / M01EvidenceNodeBuildOptions → 数据类/record。
//   - 可选字段 filters?/slots?/referencePattern?(TS 条件展开 …(cond ? {x} : {}))→ 可空属性, 缺省=null(缺席)。
//   - number → double(几何); Map(new Map(...))重复键 last-wins → Dictionary 索引器; Array.sort(a.layer-b.layer) →
//     OrderBy(稳定, 复刻 V8 稳定排序; 目标片 layer 0..5 互异, 稳定性此处仅防御)。
//   - text overrides(TS Partial<Record<key,string>>)→ IReadOnlyDictionary<string,string>?(同 M01GreyboxText.cs)。
//   - Math.hypot(a,b) → Math.Sqrt(a*a+b*b)(见 normalizeEvidenceSnapOffset)。=== 字符串 → ==(ordinal)。
//   - config.entities(顶层 unknown[], List<object?>?)真实 config 恒缺省=null → 回退 scene.entities(强类型 EntityDef);
//     顶层存在时元素为未定型 JObject, 用 Newtonsoft 承接以忠实 readPosition 的 isRecord/typeof number 判定。
//   - 导出但本文件未消费的常量 M01_TARGET_REFERENCE_DISPLAY_SIZE / _PIECE_SLOT_SIZE 一并保留(供渲染层消费)。
#nullable enable

using System;
using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using StarGuardian.Core;

namespace StarGuardian.M01
{
    /// <summary>平面点 {x,y} —— TS interface M01GreyboxPoint(number → double)。</summary>
    public readonly struct M01GreyboxPoint : IEquatable<M01GreyboxPoint>
    {
        public double X { get; }
        public double Y { get; }
        public M01GreyboxPoint(double x, double y) { X = x; Y = y; }

        // double 字段用 .Equals() 而非 ==(NaN 自反, 兑现 record struct 语义)。
        public bool Equals(M01GreyboxPoint other) => X.Equals(other.X) && Y.Equals(other.Y);
        public override bool Equals(object? obj) => obj is M01GreyboxPoint p && Equals(p);
        public override int GetHashCode() => HashCode.Combine(X, Y);
        public static bool operator ==(M01GreyboxPoint a, M01GreyboxPoint b) => a.Equals(b);
        public static bool operator !=(M01GreyboxPoint a, M01GreyboxPoint b) => !a.Equals(b);
        public override string ToString() => $"M01GreyboxPoint {{ X = {X}, Y = {Y} }}";
    }

    /// <summary>轴对齐尺寸 {width,height} —— TS interface M01GreyboxSize。</summary>
    public readonly struct M01GreyboxSize : IEquatable<M01GreyboxSize>
    {
        public double Width { get; }
        public double Height { get; }
        public M01GreyboxSize(double width, double height) { Width = width; Height = height; }

        public bool Equals(M01GreyboxSize other) => Width.Equals(other.Width) && Height.Equals(other.Height);
        public override bool Equals(object? obj) => obj is M01GreyboxSize s && Equals(s);
        public override int GetHashCode() => HashCode.Combine(Width, Height);
        public static bool operator ==(M01GreyboxSize a, M01GreyboxSize b) => a.Equals(b);
        public static bool operator !=(M01GreyboxSize a, M01GreyboxSize b) => !a.Equals(b);
        public override string ToString() => $"M01GreyboxSize {{ Width = {Width}, Height = {Height} }}";
    }

    /// <summary>灰盒节点类别 —— TS 字符串联合 M01GreyboxNodeKind(保为 string 常量, 不建 enum)。</summary>
    public static class M01GreyboxNodeKind
    {
        public const string Gear = "gear";
        public const string Board = "board";
        public const string Filter = "filter";
        public const string Fragment = "fragment";
        public const string Evidence = "evidence";
        public const string ReferencePattern = "reference_pattern";
        public const string Slot = "slot";
        public const string Label = "label";
    }

    /// <summary>灰盒 token 节点 —— TS interface M01GreyboxTokenNode。position/sourcePosition/fragmentSnapPositions
    /// 在盘位移补偿(ShiftBoardContentToMatchBoard)里就地重赋值 → 可写; 其余构造后不变 → init。</summary>
    public sealed class M01GreyboxTokenNode
    {
        public string Id { get; init; } = "";
        public string ControllerId { get; init; } = "";
        public string Kind { get; init; } = "";
        public string Label { get; init; } = "";
        public M01GreyboxPoint Position { get; set; }

        /// <summary>TS 可选 sourcePosition?: 证据节点带原始盘坐标; 参考卡节点透传, 其余节点无(null)。</summary>
        public M01GreyboxPoint? SourcePosition { get; set; }

        public M01GreyboxSize Size { get; init; }
        public string ColorToken { get; init; } = "";
        public string ShapeToken { get; init; } = "";
        public IReadOnlyList<string> Tags { get; init; } = Array.Empty<string>();

        /// <summary>TS 可选 fragmentSnapPositions?: Record&lt;fragmentId, {x,y}&gt;(仅证据 work 节点有; 参考卡节点 null)。</summary>
        public IReadOnlyDictionary<string, M01GreyboxPoint>? FragmentSnapPositions { get; set; }

        /// <summary>TS 可选 magnetPolygon?: 弱磁吸命中轮廓(局部坐标); 条件不足时缺席(null)。</summary>
        public IReadOnlyList<M01GreyboxPoint>? MagnetPolygon { get; init; }
    }

    /// <summary>目标拼片吸附区 —— TS interface M01GreyboxPieceSnapZone。position 在盘位移补偿里就地重赋值 → 可写。</summary>
    public sealed class M01GreyboxPieceSnapZone
    {
        public string Id { get; init; } = "";
        public string? ExpectedFragmentId { get; init; }
        public string StandardPieceId { get; init; } = "";
        public string ShapeToken { get; init; } = "";
        public M01GreyboxPoint Position { get; set; }
        public M01GreyboxSize Size { get; init; }
        public double Rotation { get; init; }
        public int Layer { get; init; }
        public IReadOnlyList<string> Tags { get; init; } = Array.Empty<string>();
    }

    /// <summary>Build 的完整布局结果 —— TS interface M01GreyboxLayout(避免与静态类同名, 改称 ...Data)。
    /// filters/slots/referencePattern 缺席时为 null(对应 TS undefined/键不存在)。</summary>
    public sealed class M01GreyboxLayoutData
    {
        public M01GreyboxSize Canvas { get; init; }
        public string StatusText { get; init; } = "";
        public bool EvidenceSnapEnabled { get; init; }
        public M01GreyboxTokenNode Gear { get; init; } = new();
        public M01GreyboxTokenNode Board { get; init; } = new();
        public IReadOnlyList<M01GreyboxPieceSnapZone> TargetPieceSlots { get; init; } =
            Array.Empty<M01GreyboxPieceSnapZone>();
        public IReadOnlyList<M01GreyboxTokenNode>? Filters { get; init; }
        public IReadOnlyList<M01GreyboxTokenNode> Fragments { get; init; } = Array.Empty<M01GreyboxTokenNode>();
        public IReadOnlyList<M01GreyboxTokenNode> Evidence { get; init; } = Array.Empty<M01GreyboxTokenNode>();
        public M01GreyboxTokenNode? ReferencePattern { get; init; }
        public IReadOnlyList<M01GreyboxTokenNode> ReferenceEvidence { get; init; } =
            Array.Empty<M01GreyboxTokenNode>();
        public IReadOnlyList<M01GreyboxTokenNode>? Slots { get; init; }
    }

    /// <summary>Build 可选项 —— TS interface M01GreyboxLayoutOptions。text 为文案覆盖表(缺省=空)。</summary>
    public sealed record M01GreyboxLayoutOptions
    {
        public IReadOnlyDictionary<string, string>? Text { get; init; }
    }

    /// <summary>
    /// M01GreyboxLayout.ts 的模块函数 + 常量汇成静态类。方法名去掉冗余 M01Greybox 前缀(类名已含), 语义一一对应。
    /// </summary>
    public static class M01GreyboxLayout
    {
        // TS: const CANVAS(模块私有, 未导出)。
        private static readonly M01GreyboxSize CanvasSize = new(960, 640);

        // TS: MIN_EVIDENCE_FRAGMENT_SNAP_DISTANCE = 34。
        private const double MinEvidenceFragmentSnapDistance = 34;

        // TS: export const M01_STANDARD_PIECE_DISPLAY_SIZE。
        public static readonly M01GreyboxSize StandardPieceDisplaySize = new(56, 56);

        /// <summary>
        /// Cocos M01GreyboxArt 的 HIDDEN_FRAGMENT_DISPLAY_SIZE_OVERRIDES：圆片使用 60×60
        /// 精灵画布容纳完整手绘轮廓；拼接/吸附几何仍保持标准 56×56。
        /// </summary>
        public static M01GreyboxSize ResolveFragmentArtDisplaySize(string shapeToken) =>
            shapeToken == "circle"
                ? new M01GreyboxSize(60, 60)
                : StandardPieceDisplaySize;

        // TS: export const M01_TARGET_REFERENCE_DISPLAY_SIZE(本文件未消费, 供渲染层)。
        public static readonly M01GreyboxSize TargetReferenceDisplaySize = new(196, 170.32);

        // TS: export const M01_TARGET_REFERENCE_PIECE_SLOT_SIZE = M01_STANDARD_PIECE_DISPLAY_SIZE(本文件未消费)。
        public static readonly M01GreyboxSize TargetReferencePieceSlotSize = StandardPieceDisplaySize;

        // TS: REFERENCE_PATTERN_CENTER。
        private static readonly M01GreyboxPoint ReferencePatternCenter = new(-360, 120);

        // TS: REFERENCE_PATTERN_SCALE。
        private const double ReferencePatternScale = 0.4;

        // TS: EVIDENCE_WORK_AREA_CENTER。
        private static readonly M01GreyboxPoint EvidenceWorkAreaCenter = new(-60, 0);

        // TS: EVIDENCE_WORK_AREA_SCALE。
        private const double EvidenceWorkAreaScale = 0.85;

        // TS: GEAR_BOARD_DESIGN_X —— 盘内容坐标的设计基准 x(board 历史 x)。
        private const double GearBoardDesignX = -60;

        /// <summary>证据节点装配可选项 —— TS interface M01EvidenceNodeBuildOptions(未导出)。</summary>
        private sealed record M01EvidenceNodeBuildOptions
        {
            public bool SynthesizeLegacyGeneratedOverlap { get; init; }
        }

        /// <summary>把 config 装配成完整灰盒布局 —— TS buildM01GreyboxLayout。</summary>
        public static M01GreyboxLayoutData Build(
            M01MemoryGearConfig config,
            M01GreyboxLayoutOptions? options = null)
        {
            options ??= new M01GreyboxLayoutOptions();
            var text = options.Text;

            var resolvedConfig = M01TargetPatternGenerator.ResolveConfigWithCurrentTargetEvidence(config);

            var filters = (resolvedConfig.Filters ?? new List<M01FilterDef>())
                .Select(filter => BuildFilterNode(filter, resolvedConfig, text))
                .ToList();
            var slots = (resolvedConfig.Slots ?? new List<M01SlotDef>())
                .Select(slot => BuildSlotNode(slot, text))
                .ToList();

            var evidenceSnapEnabled = ShouldEnableEvidenceSnap(resolvedConfig);
            var evidenceBuildOptions = new M01EvidenceNodeBuildOptions
            {
                SynthesizeLegacyGeneratedOverlap = evidenceSnapEnabled
            };
            var evidence = BuildEvidenceWorkNodes(resolvedConfig.Evidence, text, evidenceBuildOptions);
            var referenceEvidence = BuildReferenceEvidenceNodes(resolvedConfig.Evidence, text, evidenceBuildOptions);

            var layout = new M01GreyboxLayoutData
            {
                Canvas = CanvasSize,
                StatusText = M01GreyboxText.Format("initialInstruction", null, text),
                EvidenceSnapEnabled = evidenceSnapEnabled,
                Gear = BuildGearNode(resolvedConfig),
                Board = BuildBoardNode(),
                TargetPieceSlots = BuildTargetPieceSnapZones(resolvedConfig),
                Fragments = resolvedConfig.Fragments
                    .Select(fragment => BuildFragmentNode(fragment, text))
                    .ToList(),
                Evidence = evidence,
                // TS: …(referenceEvidence.length > 0 ? { referencePattern } : {})
                ReferencePattern = referenceEvidence.Count > 0 ? BuildReferencePatternNode(referenceEvidence) : null,
                ReferenceEvidence = referenceEvidence,
                // TS: …(filters.length > 0 ? { filters } : {}) / slots 同
                Filters = filters.Count > 0 ? filters : null,
                Slots = slots.Count > 0 ? slots : null
            };

            // 盘内容坐标以 board 历史位置(GEAR_BOARD_DESIGN_X)为绝对基准, 不挂 board 节点 → board 平移后不会自动跟。
            // 在数据源头统一把盘位移补到所有盘内容坐标(渲染与弱磁吸附判定共用同一份 evidence, 一次全跟)。
            ShiftBoardContentToMatchBoard(layout);
            return layout;
        }

        // 盘内容坐标设计基准 = board 历史 x(-60)。board 实际 x 与之的差 = 盘整体位移, 统一补到盘内容。
        private static void ShiftBoardContentToMatchBoard(M01GreyboxLayoutData layout)
        {
            var shiftX = layout.Board.Position.X - GearBoardDesignX;
            if (shiftX == 0.0)
            {
                return;
            }

            // 只平移【盘上】内容: work-area evidence(中心 EVIDENCE_WORK_AREA_CENTER=-60=GEAR_BOARD_DESIGN_X)+ 吸附点。
            // referenceEvidence / referencePattern 是左侧独立参考卡(中心 -360, 不依赖盘位置), 不能跟盘平移。
            foreach (var evidenceNode in layout.Evidence)
            {
                evidenceNode.Position = new M01GreyboxPoint(evidenceNode.Position.X + shiftX, evidenceNode.Position.Y);
                if (evidenceNode.SourcePosition.HasValue)
                {
                    var source = evidenceNode.SourcePosition.Value;
                    evidenceNode.SourcePosition = new M01GreyboxPoint(source.X + shiftX, source.Y);
                }
                if (evidenceNode.FragmentSnapPositions != null)
                {
                    var moved = new Dictionary<string, M01GreyboxPoint>();
                    foreach (var entry in evidenceNode.FragmentSnapPositions)
                    {
                        moved[entry.Key] = new M01GreyboxPoint(entry.Value.X + shiftX, entry.Value.Y);
                    }
                    evidenceNode.FragmentSnapPositions = moved;
                }
            }

            foreach (var slot in layout.TargetPieceSlots)
            {
                slot.Position = new M01GreyboxPoint(slot.Position.X + shiftX, slot.Position.Y);
            }
        }

        // TS: config.targetPattern?.locked !== false —— 仅当 locked 显式为 false 才禁用(null/未锁皆启用)。
        // C# 可空 bool? != false: null != false → true; true != false → true; false != false → false. 逐一对应。
        private static bool ShouldEnableEvidenceSnap(M01MemoryGearConfig config) =>
            config.TargetPattern?.Locked != false;

        private static M01GreyboxTokenNode BuildReferencePatternNode(
            IReadOnlyList<M01GreyboxTokenNode> referenceEvidence)
        {
            var minX = double.PositiveInfinity;
            var maxX = double.NegativeInfinity;
            var minY = double.PositiveInfinity;
            var maxY = double.NegativeInfinity;
            foreach (var evidence in referenceEvidence)
            {
                minX = Math.Min(minX, evidence.Position.X - evidence.Size.Width / 2.0);
                maxX = Math.Max(maxX, evidence.Position.X + evidence.Size.Width / 2.0);
                minY = Math.Min(minY, evidence.Position.Y - evidence.Size.Height / 2.0);
                maxY = Math.Max(maxY, evidence.Position.Y + evidence.Size.Height / 2.0);
            }

            return new M01GreyboxTokenNode
            {
                Id = "m01_reference_complete_pattern",
                ControllerId = "m01_reference_complete_pattern",
                Kind = M01GreyboxNodeKind.ReferencePattern,
                Label = "目标完整图案",
                Position = new M01GreyboxPoint((minX + maxX) / 2.0, (minY + maxY) / 2.0),
                Size = new M01GreyboxSize(maxX - minX + 34, maxY - minY + 34),
                ColorToken = "neutral",
                ShapeToken = "reference_pattern",
                Tags = new List<string>
                {
                    "reference_evidence", "complete_pattern", "target_pattern", "standard_piece_geometry"
                }
            };
        }

        private static M01GreyboxTokenNode BuildGearNode(M01MemoryGearConfig config)
        {
            var position = ReadPosition(FindEntityPosition(config, "entity_memory_gear"), new M01GreyboxPoint(0, 0));

            return new M01GreyboxTokenNode
            {
                Id = "entity_memory_gear",
                ControllerId = "entity_memory_gear",
                Kind = M01GreyboxNodeKind.Gear,
                Label = config.Name,
                Position = position,
                Size = new M01GreyboxSize(430, 430),
                ColorToken = "neutral",
                ShapeToken = "gear",
                Tags = new List<string> { "gear", "repair_target" }
            };
        }

        private static M01GreyboxTokenNode BuildBoardNode()
        {
            return new M01GreyboxTokenNode
            {
                Id = "m01_overlap_board",
                ControllerId = "m01_overlap_board",
                Kind = M01GreyboxNodeKind.Board,
                Label = "拼接盘",
                // 与大螺母 entity_memory_gear 同 x(平台整体); 2026-06 左移 -60→-120 平衡布局。
                Position = new M01GreyboxPoint(-120, 0),
                Size = new M01GreyboxSize(430, 430),
                ColorToken = "neutral",
                ShapeToken = "board",
                Tags = new List<string> { "board", "assembly_board", "bottom_light" }
            };
        }

        private static IReadOnlyList<M01GreyboxPieceSnapZone> BuildTargetPieceSnapZones(M01MemoryGearConfig config)
        {
            if (config.TargetPattern == null || config.StandardPieces == null)
            {
                return new List<M01GreyboxPieceSnapZone>();
            }

            // TS: new Map(config.standardPieces.map(p => [p.id, p])) —— 重复键 last-wins → 索引器赋值。
            var standardPiecesById = new Dictionary<string, M01StandardPieceDef>();
            foreach (var standardPiece in config.StandardPieces)
            {
                standardPiecesById[standardPiece.Id] = standardPiece;
            }

            var zones = new List<M01GreyboxPieceSnapZone>();
            foreach (var piece in config.TargetPattern.Pieces)
            {
                // TS: standardPiecesById.get(...); if (!sp) return undefined → filter 剔除。
                if (!standardPiecesById.TryGetValue(piece.StandardPieceId, out var standardPiece))
                {
                    continue;
                }

                zones.Add(TargetPieceSnapZoneFromManifest(piece, standardPiece));
            }

            // TS: .sort((a,b) => a.layer - b.layer)。OrderBy 稳定, 复刻 V8 稳定排序。
            return zones.OrderBy(zone => zone.Layer).ToList();
        }

        private static M01GreyboxPieceSnapZone TargetPieceSnapZoneFromManifest(
            M01TargetPieceInstanceDef piece,
            M01StandardPieceDef standardPiece)
        {
            return new M01GreyboxPieceSnapZone
            {
                Id = piece.Id,
                ExpectedFragmentId = piece.FragmentId,
                StandardPieceId = piece.StandardPieceId,
                ShapeToken = standardPiece.Shape,
                Position = new M01GreyboxPoint(piece.Position.X, piece.Position.Y),
                Size = new M01GreyboxSize(standardPiece.Size.Width, standardPiece.Size.Height),
                Rotation = piece.Rotation ?? 0.0,
                Layer = piece.Layer ?? 0,
                Tags = new List<string>
                {
                    "target_piece",
                    "manual_standard_piece_manifest",
                    $"standard-piece:{piece.StandardPieceId}",
                    $"shape:{standardPiece.Shape}"
                }
            };
        }

        private static M01GreyboxTokenNode BuildFilterNode(
            M01FilterDef filter,
            M01MemoryGearConfig config,
            IReadOnlyDictionary<string, string>? text = null)
        {
            var fallbackY = filter.Color == "red" ? 160.0 : filter.Color == "blue" ? 80.0 : 0.0;
            var entityPosition = FindEntityPosition(config, filter.EntityId ?? $"entity_{filter.Id}");
            var color = M01GreyboxText.FormatColorLabel(filter.Color, text);

            // TS: text.filterLabel !== undefined ? Format(...) : (filter.label ?? Format(...))
            var label = text != null && text.ContainsKey("filterLabel")
                ? M01GreyboxText.Format("filterLabel", new Dictionary<string, object> { ["color"] = color }, text)
                : filter.Label ?? M01GreyboxText.Format("filterLabel", new Dictionary<string, object> { ["color"] = color }, text);

            return new M01GreyboxTokenNode
            {
                Id = filter.Id,
                ControllerId = filter.Id,
                Kind = M01GreyboxNodeKind.Filter,
                Label = label,
                Position = ReadPosition(entityPosition, new M01GreyboxPoint(-420, fallbackY)),
                Size = new M01GreyboxSize(76, 44),
                ColorToken = filter.Color,
                ShapeToken = "filter",
                Tags = new List<string> { "filter", filter.Color }
            };
        }

        private static M01GreyboxTokenNode BuildFragmentNode(
            M01CandidateFragmentDef fragment,
            IReadOnlyDictionary<string, string>? text = null)
        {
            // TS: fragment.hiddenColor ?? fragment.color ?? "hidden"。HiddenColor 在 C# 类型里非空(默认 ""),
            // ?? 链后两级仅对 null 触发, 而它不可能为 null → 直接取 HiddenColor 与 TS 等价(真实 config 恒有值)。
            var colorToken = fragment.HiddenColor;
            var shapeToken = fragment.Shape ?? fragment.EdgeShape;
            var color = M01GreyboxText.FormatColorLabel(colorToken, text);
            var shape = M01GreyboxText.FormatShapeLabel(shapeToken, text);

            var tags = new List<string> { "candidate_fragment" };
            if (fragment.Tags != null)
            {
                tags.AddRange(fragment.Tags);
            }

            return new M01GreyboxTokenNode
            {
                Id = fragment.Id,
                ControllerId = fragment.Id,
                Kind = M01GreyboxNodeKind.Fragment,
                Label = M01GreyboxText.Format(
                    "tokenLabel",
                    new Dictionary<string, object> { ["color"] = color, ["shape"] = shape },
                    text),
                Position = ReadPosition(fragment.Position, new M01GreyboxPoint(0, 0)),
                Size = StandardPieceDisplaySize,
                ColorToken = colorToken,
                ShapeToken = shapeToken,
                Tags = tags
            };
        }

        private static M01GreyboxTokenNode BuildEvidenceNode(
            M01OverlapEvidenceDef evidence,
            IReadOnlyDictionary<string, string>? text,
            M01EvidenceNodeBuildOptions options)
        {
            return BuildEvidenceNodeAt(
                evidence,
                ReadPosition(evidence.Position, new M01GreyboxPoint(0, 0)),
                text,
                1.0,
                options);
        }

        private static M01GreyboxTokenNode BuildEvidenceNodeAt(
            M01OverlapEvidenceDef evidence,
            M01GreyboxPoint position,
            IReadOnlyDictionary<string, string>? text,
            double sizeScale,
            M01EvidenceNodeBuildOptions options)
        {
            var color = M01GreyboxText.FormatColorLabel(evidence.TargetBlendColor, text);
            var shape = M01GreyboxText.FormatShapeLabel(evidence.TargetShape, text);
            var size = Math.Max(evidence.Tolerance * 2.0 * sizeScale, 52.0);
            var sourceShapeTags = (evidence.GeneratedOverlap?.SourceShapes ?? new List<string>())
                .Select(sourceShape => $"source-shape:{sourceShape}")
                .ToList();
            var magnetPolygon = BuildGeneratedOverlapMagnetPolygon(evidence, sizeScale, options);

            var tags = new List<string> { "overlap_evidence", "snap_zone" };
            tags.AddRange(sourceShapeTags);
            tags.AddRange(evidence.ShapeTags);

            return new M01GreyboxTokenNode
            {
                Id = evidence.Id,
                ControllerId = evidence.Id,
                Kind = M01GreyboxNodeKind.Evidence,
                Label = M01GreyboxText.Format(
                    "tokenLabel",
                    new Dictionary<string, object> { ["color"] = color, ["shape"] = shape },
                    text),
                Position = position,
                SourcePosition = ReadPosition(evidence.Position, new M01GreyboxPoint(0, 0)),
                Size = new M01GreyboxSize(size, size),
                ColorToken = evidence.TargetBlendColor,
                ShapeToken = evidence.TargetShape,
                Tags = tags,
                FragmentSnapPositions = BuildEvidenceFragmentSnapPositions(evidence, position),
                // TS: …(magnetPolygon && magnetPolygon.length >= 3 ? { magnetPolygon } : {})
                MagnetPolygon = (magnetPolygon != null && magnetPolygon.Count >= 3) ? magnetPolygon : null
            };
        }

        private static IReadOnlyList<M01GreyboxPoint>? BuildGeneratedOverlapMagnetPolygon(
            M01OverlapEvidenceDef evidence,
            double sizeScale,
            M01EvidenceNodeBuildOptions options)
        {
            if (!options.SynthesizeLegacyGeneratedOverlap)
            {
                return null;
            }

            var outline = evidence.GeneratedOverlap?.Outline;
            if (outline != null)
            {
                var explicitOutline = outline
                    .Select(point => new M01GreyboxPoint(point.X * sizeScale, point.Y * sizeScale))
                    .ToList();
                if (explicitOutline.Count >= 3)
                {
                    return explicitOutline;
                }
            }

            return SynthesizeGeneratedOverlapMagnetPolygon(evidence, sizeScale);
        }

        private static IReadOnlyList<M01GreyboxPoint>? SynthesizeGeneratedOverlapMagnetPolygon(
            M01OverlapEvidenceDef evidence,
            double sizeScale)
        {
            if (evidence.TargetShape != "generated_overlap")
            {
                return null;
            }

            var sourceShapes = evidence.GeneratedOverlap?.SourceShapes;
            var fragmentIds = evidence.Solution.FragmentIds;
            var firstFragmentId = fragmentIds.Count > 0 ? fragmentIds[0] : null;
            var secondFragmentId = fragmentIds.Count > 1 ? fragmentIds[1] : null;
            var pigmentPair = PigmentPairForTargetBlendColor(evidence.TargetBlendColor);
            if (sourceShapes == null || sourceShapes.Count < 2 ||
                string.IsNullOrEmpty(firstFragmentId) || string.IsNullOrEmpty(secondFragmentId) ||
                pigmentPair == null)
            {
                return null;
            }

            var offset = NormalizeEvidenceSnapOffset(evidence.GeneratedOverlap?.Offset);
            var rotation = evidence.GeneratedOverlap?.Rotation ?? 0.0;
            var placements = new List<M01StandardPieceBlendPlacement>
            {
                new M01StandardPieceBlendPlacement
                {
                    Id = firstFragmentId!,
                    ShapeToken = sourceShapes[0],
                    ColorToken = pigmentPair.Value.First,
                    Position = new M01StandardPieceBlendPoint(-offset.X / 2.0, -offset.Y / 2.0),
                    Size = new M01StandardPieceBlendSize(StandardPieceDisplaySize.Width, StandardPieceDisplaySize.Height),
                    Rotation = rotation
                },
                new M01StandardPieceBlendPlacement
                {
                    Id = secondFragmentId!,
                    ShapeToken = sourceShapes[1],
                    ColorToken = pigmentPair.Value.Second,
                    Position = new M01StandardPieceBlendPoint(offset.X / 2.0, offset.Y / 2.0),
                    Size = new M01StandardPieceBlendSize(StandardPieceDisplaySize.Width, StandardPieceDisplaySize.Height),
                    Rotation = rotation
                }
            };
            var overlay = M01StandardPieceBlend.ResolveOverlays(placements)
                .FirstOrDefault(candidate => candidate.ColorToken == evidence.TargetBlendColor);
            if (overlay == null || overlay.Points.Count < 3)
            {
                return null;
            }

            var bounds = BoundsForGeneratedOverlapPoints(overlay.Points);
            var centerX = (bounds.MinX + bounds.MaxX) / 2.0;
            var centerY = (bounds.MinY + bounds.MaxY) / 2.0;

            return overlay.Points
                .Select(point => new M01GreyboxPoint((point.X - centerX) * sizeScale, (point.Y - centerY) * sizeScale))
                .ToList();
        }

        private static (double MinX, double MaxX, double MinY, double MaxY) BoundsForGeneratedOverlapPoints(
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

        // TS: pigmentPairForTargetBlendColor —— 混色 → 其两颜料原色对; 非混色返回 undefined。
        private static (string First, string Second)? PigmentPairForTargetBlendColor(string colorToken)
        {
            if (colorToken == "orange")
            {
                return ("red", "yellow");
            }
            if (colorToken == "green")
            {
                return ("yellow", "blue");
            }
            if (colorToken == "purple")
            {
                return ("red", "blue");
            }

            return null;
        }

        private static IReadOnlyList<M01GreyboxTokenNode> BuildEvidenceWorkNodes(
            IReadOnlyList<M01OverlapEvidenceDef> evidenceItems,
            IReadOnlyDictionary<string, string>? text,
            M01EvidenceNodeBuildOptions options)
        {
            if (evidenceItems.Count == 0)
            {
                return new List<M01GreyboxTokenNode>();
            }

            var sourcePositions = evidenceItems
                .Select(evidence => ReadPosition(evidence.Position, new M01GreyboxPoint(0, 0)))
                .ToList();
            var sourceCenter = CenterOfPoints(sourcePositions);

            var result = new List<M01GreyboxTokenNode>(evidenceItems.Count);
            for (var index = 0; index < evidenceItems.Count; index += 1)
            {
                var source = sourcePositions[index];
                result.Add(BuildEvidenceNodeAt(
                    evidenceItems[index],
                    new M01GreyboxPoint(
                        EvidenceWorkAreaCenter.X + (source.X - sourceCenter.X) * EvidenceWorkAreaScale,
                        EvidenceWorkAreaCenter.Y + (source.Y - sourceCenter.Y) * EvidenceWorkAreaScale),
                    text,
                    1.0,
                    options));
            }

            return result;
        }

        private static IReadOnlyList<M01GreyboxTokenNode> BuildReferenceEvidenceNodes(
            IReadOnlyList<M01OverlapEvidenceDef> evidenceItems,
            IReadOnlyDictionary<string, string>? text,
            M01EvidenceNodeBuildOptions options)
        {
            if (evidenceItems.Count == 0)
            {
                return new List<M01GreyboxTokenNode>();
            }

            var evidenceNodes = evidenceItems.Select(evidence => BuildEvidenceNode(evidence, text, options)).ToList();
            var sourceCenter = CenterOfPoints(evidenceNodes.Select(evidence => evidence.Position).ToList());

            // TS: { ...token, position, size, tags, magnetPolygon, fragmentSnapPositions: undefined }
            // 逐字段浅拷贝并覆盖(sourcePosition 透传自 token)。
            return evidenceNodes.Select(token => new M01GreyboxTokenNode
            {
                Id = token.Id,
                ControllerId = token.ControllerId,
                Kind = token.Kind,
                Label = token.Label,
                Position = new M01GreyboxPoint(
                    ReferencePatternCenter.X + (token.Position.X - sourceCenter.X) * ReferencePatternScale,
                    ReferencePatternCenter.Y + (token.Position.Y - sourceCenter.Y) * ReferencePatternScale),
                SourcePosition = token.SourcePosition,
                Size = new M01GreyboxSize(
                    token.Size.Width * ReferencePatternScale,
                    token.Size.Height * ReferencePatternScale),
                ColorToken = token.ColorToken,
                ShapeToken = token.ShapeToken,
                Tags = token.Tags
                    .Where(tag => tag != "snap_zone")
                    .Concat(new[] { "reference_evidence", "complete_pattern" })
                    .ToList(),
                MagnetPolygon = token.MagnetPolygon?
                    .Select(point => new M01GreyboxPoint(point.X * ReferencePatternScale, point.Y * ReferencePatternScale))
                    .ToList(),
                FragmentSnapPositions = null
            }).ToList();
        }

        private static M01GreyboxPoint CenterOfPoints(IReadOnlyList<M01GreyboxPoint> points)
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

            return new M01GreyboxPoint((minX + maxX) / 2.0, (minY + maxY) / 2.0);
        }

        /// <summary>取某碎片在证据上的吸附位(缺失回落证据中心)—— TS resolveM01EvidenceFragmentSnapPosition。</summary>
        public static M01GreyboxPoint ResolveEvidenceFragmentSnapPosition(
            M01GreyboxTokenNode evidence,
            string fragmentId)
        {
            if (evidence.FragmentSnapPositions != null &&
                evidence.FragmentSnapPositions.TryGetValue(fragmentId, out var point))
            {
                return point;
            }

            return evidence.Position;
        }

        private static IReadOnlyDictionary<string, M01GreyboxPoint> BuildEvidenceFragmentSnapPositions(
            M01OverlapEvidenceDef evidence,
            M01GreyboxPoint evidencePosition)
        {
            // TS: const [first, second] = evidence.solution.fragmentIds(契约恰好两 id)。
            var fragmentIds = evidence.Solution.FragmentIds;
            var firstFragmentId = fragmentIds[0];
            var secondFragmentId = fragmentIds[1];
            var offset = NormalizeEvidenceSnapOffset(evidence.GeneratedOverlap?.Offset);

            // TS 对象字面量 { [first]: ..., [second]: ... }: 若 first===second 则 last-wins → 索引器赋值。
            var result = new Dictionary<string, M01GreyboxPoint>();
            result[firstFragmentId] = new M01GreyboxPoint(
                evidencePosition.X - offset.X / 2.0,
                evidencePosition.Y - offset.Y / 2.0);
            result[secondFragmentId] = new M01GreyboxPoint(
                evidencePosition.X + offset.X / 2.0,
                evidencePosition.Y + offset.Y / 2.0);
            return result;
        }

        private static M01GreyboxPoint NormalizeEvidenceSnapOffset(Vec2Def? offset)
        {
            // TS: const rawOffset = offset ?? { x: MIN, y: 0 } —— 整体替换(非逐字段)。
            var rawOffset = offset != null
                ? new M01GreyboxPoint(offset.X, offset.Y)
                : new M01GreyboxPoint(MinEvidenceFragmentSnapDistance, 0.0);
            var length = Math.Sqrt(rawOffset.X * rawOffset.X + rawOffset.Y * rawOffset.Y);

            if (length == 0.0)
            {
                return new M01GreyboxPoint(MinEvidenceFragmentSnapDistance, 0.0);
            }

            var scale = Math.Max(1.0, MinEvidenceFragmentSnapDistance / length);
            return new M01GreyboxPoint(rawOffset.X * scale, rawOffset.Y * scale);
        }

        private static M01GreyboxTokenNode BuildSlotNode(
            M01SlotDef slot,
            IReadOnlyDictionary<string, string>? text = null)
        {
            var color = M01GreyboxText.FormatColorLabel(slot.Accepts.Color, text);
            var shape = M01GreyboxText.FormatShapeLabel(slot.Accepts.Shape, text);

            var tags = new List<string>();
            if (slot.Tags != null)
            {
                tags.AddRange(slot.Tags);
            }

            return new M01GreyboxTokenNode
            {
                Id = slot.Id,
                ControllerId = slot.Id,
                Kind = M01GreyboxNodeKind.Slot,
                Label = M01GreyboxText.Format(
                    "tokenLabel",
                    new Dictionary<string, object> { ["color"] = color, ["shape"] = shape },
                    text),
                Position = ReadPosition(slot.Position, new M01GreyboxPoint(0, 0)),
                Size = new M01GreyboxSize(52, 52),
                ColorToken = slot.Accepts.Color,
                ShapeToken = slot.Accepts.Shape,
                Tags = tags
            };
        }

        // TS: readPosition —— 值须是含数值 x/y 的对象(isRecord && typeof number), 否则回退 fallback。
        // 承接 Vec2Def(强类型, X/Y 恒为 double=number)与顶层 entities 的未定型 JObject 两种来源。
        private static M01GreyboxPoint ReadPosition(object? value, M01GreyboxPoint fallback)
        {
            if (value is Vec2Def vec)
            {
                return new M01GreyboxPoint(vec.X, vec.Y);
            }
            if (value is JObject obj &&
                TryReadNumber(obj["x"], out var x) &&
                TryReadNumber(obj["y"], out var y))
            {
                return new M01GreyboxPoint(x, y);
            }

            return fallback;
        }

        // TS typeof v === "number": 仅 JSON 数值(Integer/Float); 数值字符串等一律不算。
        private static bool TryReadNumber(JToken? token, out double number)
        {
            if (token is JValue { Type: JTokenType.Integer or JTokenType.Float } value && value.Value != null)
            {
                number = Convert.ToDouble(value.Value);
                return true;
            }

            number = 0.0;
            return false;
        }

        // TS: findEntityPosition —— config.entities ?? config.scene.entities 里按 id 找, 返回其 position(unknown)。
        private static object? FindEntityPosition(M01MemoryGearConfig config, string entityId)
        {
            // config.Entities(顶层, List<object?>?): 真实 config 恒缺省=null → 回退 scene.entities。
            // 顶层存在时元素为未定型 JObject(或已投影的 EntityDef), 两者都承接以忠实 TS。
            if (config.Entities != null)
            {
                foreach (var candidate in config.Entities)
                {
                    if (candidate is EntityDef typed && typed.Id == entityId)
                    {
                        return typed.Position;
                    }
                    if (candidate is JObject obj && (string?)obj["id"] == entityId)
                    {
                        return obj["position"];
                    }
                }

                return null;
            }

            foreach (var candidate in config.Scene.Entities)
            {
                if (candidate.Id == entityId)
                {
                    return candidate.Position;
                }
            }

            return null;
        }
    }
}
