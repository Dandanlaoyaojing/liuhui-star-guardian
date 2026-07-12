// 从 tests/cocos/M01GreyboxLayout.test.ts 逐条迁移 —— 规则不变, 断言一一对应不增不减, DisplayName 保留原描述。
// vitest 原 13 条(describe "buildM01GreyboxLayout") → 13 个 [Fact]。
//
// TS→C# 说明:
//   - buildM01GreyboxLayout → M01GreyboxLayout.Build; 返回类型 M01GreyboxLayoutData(静态类同名冲突改名)。
//   - `{ ...config, targetPattern, evidence }` 浅拷贝并覆盖: M01MemoryGearConfig 是 class(无 with)→ 本文件写
//     CloneConfig/CloneTargetPattern/StripEvidenceOutlines 逐字段浅拷贝复刻(同 ResolveConfigWithCurrentTargetEvidence)。
//   - expect(...).toEqual({x,y}) → Assert.Equal(new M01GreyboxPoint(...), ...)(struct IEquatable)。
//   - expect("flashlights" in layout).toBe(false) → 类型无该属性, 以反射 GetProperty==null 忠实表达(见该条)。
//   - toBeCloseTo(v,5) → AssertCloseTo(Jest 规则 |e-a| < 10^-5 / 2); toMatchObject / objectContaining → 逐字段 Assert。
//   - magnetPolygon(M01GreyboxPoint[]) 与 config outline(Vec2Def[]) 类型不同, toEqual 用逐点 X/Y 相等复刻。
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01GreyboxLayoutTests
    {
        /// <summary>沿目录向上找仓库根读同一份真 config —— 同 M01TargetPatternGeneratorTests/PuzzleConfigTests 模式。</summary>
        private static readonly M01MemoryGearConfig Config = LoadConfig();

        [Fact(DisplayName = "builds candidate fragment, evidence, and board nodes without legacy flashlight buttons")]
        public void BuildsFragmentEvidenceAndBoardNodesWithoutLegacyFlashlightButtons()
        {
            var layout = M01GreyboxLayout.Build(Config);

            Assert.Equal(new M01GreyboxSize(960, 640), layout.Canvas);
            Assert.Equal("entity_memory_gear", layout.Gear.Id);
            Assert.Equal(new M01GreyboxPoint(-120, 0), layout.Gear.Position);
            Assert.Equal(new M01GreyboxSize(430, 430), layout.Gear.Size);
            Assert.Equal(new M01GreyboxPoint(-120, 0), layout.Board.Position);
            Assert.Equal(new M01GreyboxSize(430, 430), layout.Board.Size);
            // 旧三色手电按钮 token 已删除。TS: expect("flashlights" in layout).toBe(false) —— C# 强类型无该属性,
            // 以反射断言该属性不存在忠实表达"layout 无 flashlights 键"。
            Assert.Null(typeof(M01GreyboxLayoutData).GetProperty("Flashlights"));
            Assert.Equal(Config.Fragments.Count, layout.Fragments.Count);
            Assert.Equal(Config.Evidence.Count, layout.Evidence.Count);
            Assert.Equal(Config.TargetPattern?.Pieces.Count ?? 0, layout.TargetPieceSlots.Count);
            Assert.Equal("board", layout.Board.Kind);
            Assert.Null(layout.Slots);
        }

        [Fact(DisplayName = "uses each candidate fragment's own color on its standard piece")]
        public void UsesEachCandidateFragmentOwnColorOnItsStandardPiece()
        {
            var layout = M01GreyboxLayout.Build(Config);

            Assert.Equal(
                Config.Fragments.Select(fragment => (Id: fragment.Id, Color: fragment.HiddenColor)).ToArray(),
                layout.Fragments.Select(fragment => (Id: fragment.Id, Color: fragment.ColorToken)).ToArray());
        }

        [Fact(DisplayName = "does not expose complete outline data in evidence nodes")]
        public void DoesNotExposeCompleteOutlineDataInEvidenceNodes()
        {
            var layout = M01GreyboxLayout.Build(Config);

            foreach (var evidence in layout.Evidence)
            {
                Assert.Contains("overlap_evidence", evidence.Tags);
                Assert.DoesNotContain("complete_outline", evidence.Tags);
            }
        }

        [Fact(DisplayName = "keeps legacy generated overlap targets hidden while composing a manual target")]
        public void KeepsLegacyGeneratedOverlapTargetsHiddenWhileComposingManualTarget()
        {
            var manualLegacyConfig = CloneConfig(
                Config,
                targetPattern: CloneTargetPattern(Config.TargetPattern!, locked: false),
                evidence: StripEvidenceOutlines(Config.Evidence));
            var layout = M01GreyboxLayout.Build(manualLegacyConfig);

            Assert.True(manualLegacyConfig.Evidence.All(evidence => evidence.GeneratedOverlap?.Outline == null));
            Assert.Equal(false, manualLegacyConfig.TargetPattern?.Locked);
            Assert.Equal(manualLegacyConfig.Evidence.Count, layout.Evidence.Count);
            Assert.True(layout.Evidence.All(evidence => evidence.MagnetPolygon == null));
        }

        [Fact(DisplayName = "hides explicit visual-rescue overlap outlines while composing a manual target")]
        public void HidesExplicitVisualRescueOverlapOutlinesWhileComposingManualTarget()
        {
            var layout = M01GreyboxLayout.Build(CloneConfig(
                Config,
                targetPattern: CloneTargetPattern(
                    Config.TargetPattern!,
                    locked: false,
                    pieces: new List<M01TargetPieceInstanceDef>())));

            Assert.True(Config.Evidence.Any(evidence => (evidence.GeneratedOverlap?.Outline?.Count ?? 0) >= 3));
            Assert.False(layout.EvidenceSnapEnabled);
            Assert.True(layout.Evidence.All(evidence => evidence.MagnetPolygon == null));
        }

        [Fact(DisplayName = "synthesizes visible magnet polygons for locked legacy generated overlap targets")]
        public void SynthesizesVisibleMagnetPolygonsForLockedLegacyGeneratedOverlapTargets()
        {
            var layout = M01GreyboxLayout.Build(CloneConfig(
                Config,
                targetPattern: CloneTargetPattern(Config.TargetPattern!, locked: true)));

            Assert.Equal(Config.Evidence.Count, layout.Evidence.Count);
            Assert.True(layout.Evidence.All(evidence => (evidence.MagnetPolygon?.Count ?? 0) >= 3));
            Assert.Equal(
                Config.Evidence.Select(evidence => evidence.TargetShape).ToArray(),
                layout.Evidence.Select(evidence => evidence.ShapeToken).ToArray());
        }

        [Fact(DisplayName = "keeps only nine candidate fragments grouped in the lower observation floor area")]
        public void KeepsOnlyNineCandidateFragmentsGroupedInLowerObservationFloorArea()
        {
            var layout = M01GreyboxLayout.Build(Config);
            var shapeCounts = new Dictionary<string, int>();
            foreach (var fragment in layout.Fragments)
            {
                shapeCounts[fragment.ShapeToken] = (shapeCounts.TryGetValue(fragment.ShapeToken, out var count) ? count : 0) + 1;
            }
            var columns = layout.Fragments.Select(fragment => fragment.Position.X).Distinct().OrderBy(x => x).ToArray();

            Assert.Equal(9, layout.Fragments.Count);
            Assert.Equal(
                new Dictionary<string, int> { ["circle"] = 3, ["triangle"] = 3, ["hexagon"] = 3 },
                shapeCounts);
            Assert.Equal(new[] { 272.0, 332.0, 392.0 }, columns);
            Assert.True(layout.Fragments.All(fragment => fragment.Position.Y < -40));
        }

        [Fact(DisplayName = "uses only circle, triangle, and hexagon as fragment display shapes")]
        public void UsesOnlyCircleTriangleAndHexagonAsFragmentDisplayShapes()
        {
            var layout = M01GreyboxLayout.Build(Config);
            var shapes = layout.Fragments.Select(fragment => fragment.ShapeToken).Distinct()
                .OrderBy(shape => shape, System.StringComparer.Ordinal).ToArray();

            Assert.Equal(new[] { "circle", "hexagon", "triangle" }, shapes);
            Assert.True(layout.Fragments.All(fragment => fragment.Size.Width == M01GreyboxLayout.StandardPieceDisplaySize.Width));
            Assert.True(layout.Fragments.All(fragment => fragment.Size.Height == M01GreyboxLayout.StandardPieceDisplaySize.Height));
        }

        [Fact(DisplayName = "locks the exact exported hand-composed target manifest")]
        public void LocksTheExactExportedHandComposedTargetManifest()
        {
            var layout = M01GreyboxLayout.Build(Config);
            var targetPattern = Config.TargetPattern!;

            Assert.Equal("manual_standard_piece_manifest", targetPattern.Source);
            Assert.Equal("m01_board_local", targetPattern.CoordinateSpace);
            Assert.Equal(true, targetPattern.Locked);
            Assert.Contains("2026-05-07 exact manual target export", targetPattern.Note!);

            var pieces = targetPattern.Pieces;
            Assert.Equal(6, pieces.Count);
            AssertPiece(pieces[0], "target_piece_circle_yellow_1", "standard_circle", "fragment_circle_yellow_1", -98, -38.5, 0);
            AssertPiece(pieces[1], "target_piece_circle_red_2", "standard_circle", "fragment_circle_red_2", -62, 14.5, 0);
            AssertPiece(pieces[2], "target_piece_triangle_blue_1", "standard_triangle", "fragment_triangle_blue_1", -42, -40.5, 90);
            AssertPiece(pieces[3], "target_piece_triangle_yellow_2", "standard_triangle", "fragment_triangle_yellow_2", -24, -11.5, 180);
            AssertPiece(pieces[4], "target_piece_hexagon_blue_1", "standard_hexagon", "fragment_hexagon_blue_1", -93, 3.5, 0);
            AssertPiece(pieces[5], "target_piece_hexagon_red_2", "standard_hexagon", "fragment_hexagon_red_2", -57, -62.5, 90);

            Assert.Equal(6, layout.TargetPieceSlots.Count);
            Assert.Equal(
                new[]
                {
                    "fragment_circle_yellow_1",
                    "fragment_circle_red_2",
                    "fragment_triangle_blue_1",
                    "fragment_triangle_yellow_2",
                    "fragment_hexagon_blue_1",
                    "fragment_hexagon_red_2"
                },
                layout.TargetPieceSlots.Select(slot => slot.ExpectedFragmentId).ToArray());
            Assert.True(layout.EvidenceSnapEnabled);
        }

        [Fact(DisplayName = "uses the exact manual target export as generated evidence with magnetic outlines")]
        public void UsesTheExactManualTargetExportAsGeneratedEvidenceWithMagneticOutlines()
        {
            var layout = M01GreyboxLayout.Build(Config);
            var standardPieces = Config.StandardPieces!;
            var targetPattern = Config.TargetPattern!;

            Assert.Equal(3, standardPieces.Count);
            AssertStandardPiece(standardPieces[0], "standard_circle", "circle");
            AssertStandardPiece(standardPieces[1], "standard_triangle", "triangle");
            AssertStandardPiece(standardPieces[2], "standard_hexagon", "hexagon");

            Assert.Equal("manual_standard_piece_manifest", targetPattern.Source);
            Assert.Equal("m01_board_local", targetPattern.CoordinateSpace);
            Assert.Equal(true, targetPattern.Locked);
            Assert.Equal(6, targetPattern.Pieces.Count);
            Assert.Equal(6, Config.Evidence.Count);
            Assert.True(Config.Evidence.All(evidence => evidence.Id.StartsWith("current_manual_target_", System.StringComparison.Ordinal)));
            Assert.Equal(
                new[] { "green", "orange", "orange", "purple", "green", "purple" },
                Config.Evidence.Select(evidence => evidence.TargetBlendColor).ToArray());
            Assert.True(Config.Evidence.All(evidence => (evidence.GeneratedOverlap?.Outline?.Count ?? 0) >= 3));
            Assert.True(layout.Evidence.All(evidence => (evidence.MagnetPolygon?.Count ?? 0) >= 3));
            Assert.Equal(6, layout.TargetPieceSlots.Count);
        }

        [Fact(DisplayName = "keeps workbench overlap outlines at standard-piece scale while compacting their positions")]
        public void KeepsWorkbenchOverlapOutlinesAtStandardPieceScaleWhileCompactingTheirPositions()
        {
            var layout = M01GreyboxLayout.Build(CloneConfig(
                Config,
                targetPattern: CloneTargetPattern(Config.TargetPattern!, locked: true)));

            foreach (var evidenceConfig in Config.Evidence)
            {
                var evidence = layout.Evidence.FirstOrDefault(item => item.ControllerId == evidenceConfig.Id);
                Assert.NotNull(evidence);
                Assert.NotNull(evidenceConfig.GeneratedOverlap?.Outline);
                Assert.NotNull(evidence!.MagnetPolygon);

                var outline = evidenceConfig.GeneratedOverlap!.Outline!;
                var polygon = evidence.MagnetPolygon!;
                var sourceBounds = BoundsForPoints(outline.Select(point => (point.X, point.Y)));
                var layoutBounds = BoundsForPoints(polygon.Select(point => (point.X, point.Y)));

                // expect(evidence.magnetPolygon).toEqual(evidenceConfig.generatedOverlap.outline) —— 逐点 X/Y 相等。
                Assert.Equal(outline.Count, polygon.Count);
                for (var i = 0; i < outline.Count; i += 1)
                {
                    Assert.Equal(outline[i].X, polygon[i].X);
                    Assert.Equal(outline[i].Y, polygon[i].Y);
                }

                AssertCloseTo(sourceBounds.MaxX - sourceBounds.MinX, layoutBounds.MaxX - layoutBounds.MinX, 5);
                AssertCloseTo(sourceBounds.MaxY - sourceBounds.MinY, layoutBounds.MaxY - layoutBounds.MinY, 5);
            }
        }

        [Fact(DisplayName = "keeps staging evidence inside the large assembly table while target evidence remains a left reference")]
        public void KeepsStagingEvidenceInsideAssemblyTableWhileTargetEvidenceRemainsLeftReference()
        {
            var layout = M01GreyboxLayout.Build(Config);
            var boardHalfWidth = layout.Board.Size.Width / 2;
            var boardHalfHeight = layout.Board.Size.Height / 2;

            Assert.Equal(Config.Evidence.Count, layout.ReferenceEvidence.Count);
            Assert.NotNull(layout.ReferencePattern);
            var referencePattern = layout.ReferencePattern!;
            Assert.Equal("reference_pattern", referencePattern.Kind);
            Assert.Equal("reference_pattern", referencePattern.ShapeToken);
            Assert.Contains("complete_pattern", referencePattern.Tags);
            Assert.Contains("target_pattern", referencePattern.Tags);
            Assert.Contains("standard_piece_geometry", referencePattern.Tags);
            Assert.True(layout.Evidence.All(evidence => evidence.Tags.Contains("snap_zone")));
            Assert.True(layout.Evidence.All(evidence =>
                System.Math.Abs(evidence.Position.X - layout.Board.Position.X) <= boardHalfWidth - 30 &&
                System.Math.Abs(evidence.Position.Y - layout.Board.Position.Y) <= boardHalfHeight - 30));

            foreach (var evidence in layout.Evidence)
            {
                foreach (var fragmentId in (evidence.FragmentSnapPositions ?? new Dictionary<string, M01GreyboxPoint>()).Keys)
                {
                    var snap = M01GreyboxLayout.ResolveEvidenceFragmentSnapPosition(evidence, fragmentId);
                    Assert.True(System.Math.Abs(snap.X - layout.Board.Position.X) <= boardHalfWidth);
                    Assert.True(System.Math.Abs(snap.Y - layout.Board.Position.Y) <= boardHalfHeight);
                    Assert.True(Distance(snap, layout.Board.Position) <= 150);
                }
            }

            Assert.True(referencePattern.Position.X < -250);
            Assert.True(referencePattern.Size.Width <= 170);
            Assert.True(referencePattern.Size.Height <= 170);
            Assert.True(layout.ReferenceEvidence.All(evidence =>
                System.Math.Abs(evidence.Position.X - layout.Board.Position.X) > boardHalfWidth ||
                System.Math.Abs(evidence.Position.Y - layout.Board.Position.Y) > boardHalfHeight));
            Assert.True(layout.ReferenceEvidence.All(evidence => evidence.Position.Y > -170));
            Assert.Equal(
                Config.Evidence.Select(evidence => evidence.TargetBlendColor).ToArray(),
                layout.ReferenceEvidence.Select(evidence => evidence.ColorToken).ToArray());

            var referenceScale =
                (layout.ReferenceEvidence[1].Position.X - layout.ReferenceEvidence[0].Position.X) /
                (Config.Evidence[1].Position.X - Config.Evidence[0].Position.X);

            for (var i = 0; i < Config.Evidence.Count; i += 1)
            {
                for (var j = i + 1; j < Config.Evidence.Count; j += 1)
                {
                    var originalDx = Config.Evidence[j].Position.X - Config.Evidence[i].Position.X;
                    var originalDy = Config.Evidence[j].Position.Y - Config.Evidence[i].Position.Y;
                    var referenceDx = layout.ReferenceEvidence[j].Position.X - layout.ReferenceEvidence[i].Position.X;
                    var referenceDy = layout.ReferenceEvidence[j].Position.Y - layout.ReferenceEvidence[i].Position.Y;

                    AssertCloseTo(originalDx * referenceScale, referenceDx, 5);
                    AssertCloseTo(originalDy * referenceScale, referenceDy, 5);
                }
            }
        }

        [Fact(DisplayName = "snaps the two fragments for an evidence pair into partial-overlap poses instead of one pile")]
        public void SnapsTheTwoFragmentsForAnEvidencePairIntoPartialOverlapPoses()
        {
            var layout = M01GreyboxLayout.Build(Config);
            var evidenceConfig = Config.Evidence[0];
            var evidence = layout.Evidence.FirstOrDefault(item => item.ControllerId == evidenceConfig.Id);

            Assert.NotNull(evidence);

            var firstFragmentId = evidenceConfig.Solution.FragmentIds[0];
            var secondFragmentId = evidenceConfig.Solution.FragmentIds[1];
            var firstPosition = M01GreyboxLayout.ResolveEvidenceFragmentSnapPosition(evidence!, firstFragmentId);
            var secondPosition = M01GreyboxLayout.ResolveEvidenceFragmentSnapPosition(evidence!, secondFragmentId);

            Assert.NotEqual(evidence!.Position, firstPosition);
            Assert.NotEqual(evidence.Position, secondPosition);
            Assert.True(Distance(firstPosition, secondPosition) >= 32);
            AssertCloseTo(evidence.Position.X, Midpoint(firstPosition.X, secondPosition.X), 5);
            AssertCloseTo(evidence.Position.Y, Midpoint(firstPosition.Y, secondPosition.Y), 5);
        }

        // ---- 断言/几何辅助(复刻 TS 测试内的 distance/midpoint/boundsForPoints 与 Jest toBeCloseTo)----

        private static double Distance(M01GreyboxPoint a, M01GreyboxPoint b) =>
            System.Math.Sqrt((a.X - b.X) * (a.X - b.X) + (a.Y - b.Y) * (a.Y - b.Y));

        private static double Midpoint(double a, double b) => (a + b) / 2;

        private static (double MinX, double MaxX, double MinY, double MaxY) BoundsForPoints(
            IEnumerable<(double X, double Y)> points)
        {
            var minX = double.PositiveInfinity;
            var maxX = double.NegativeInfinity;
            var minY = double.PositiveInfinity;
            var maxY = double.NegativeInfinity;
            foreach (var point in points)
            {
                minX = System.Math.Min(minX, point.X);
                maxX = System.Math.Max(maxX, point.X);
                minY = System.Math.Min(minY, point.Y);
                maxY = System.Math.Max(maxY, point.Y);
            }

            return (minX, maxX, minY, maxY);
        }

        // Jest toBeCloseTo(expected, numDigits): 通过条件 |expected - actual| < 10^-numDigits / 2。
        private static void AssertCloseTo(double expected, double actual, int numDigits)
        {
            var tolerance = System.Math.Pow(10, -numDigits) / 2;
            Assert.True(
                System.Math.Abs(expected - actual) < tolerance,
                $"Expected {actual} to be close to {expected} (numDigits {numDigits})");
        }

        private static void AssertPiece(
            M01TargetPieceInstanceDef piece,
            string id,
            string standardPieceId,
            string fragmentId,
            double x,
            double y,
            double rotation)
        {
            Assert.Equal(id, piece.Id);
            Assert.Equal(standardPieceId, piece.StandardPieceId);
            Assert.Equal(fragmentId, piece.FragmentId);
            Assert.Equal(x, piece.Position.X);
            Assert.Equal(y, piece.Position.Y);
            Assert.Equal(rotation, piece.Rotation);
        }

        private static void AssertStandardPiece(M01StandardPieceDef standardPiece, string id, string shape)
        {
            Assert.Equal(id, standardPiece.Id);
            Assert.Equal(shape, standardPiece.Shape);
            Assert.Equal(M01GreyboxLayout.StandardPieceDisplaySize.Width, standardPiece.Size.Width);
            Assert.Equal(M01GreyboxLayout.StandardPieceDisplaySize.Height, standardPiece.Size.Height);
        }

        // ---- config 浅拷贝(TS `{ ...config, ... }` / `{ ...targetPattern, ... }` / `{ ...evidence, outline: undefined }`)----

        private static M01MemoryGearConfig CloneConfig(
            M01MemoryGearConfig source,
            M01TargetPatternDef? targetPattern = null,
            List<M01OverlapEvidenceDef>? evidence = null)
        {
            return new M01MemoryGearConfig
            {
                Id = source.Id,
                Name = source.Name,
                Stage = source.Stage,
                CognitiveSkill = source.CognitiveSkill,
                WisdomCrystal = source.WisdomCrystal,
                Scene = source.Scene,
                Interactions = source.Interactions,
                Goals = source.Goals,
                Hints = source.Hints,
                Repair = source.Repair,
                Description = source.Description,
                Colors = source.Colors,
                BlendColors = source.BlendColors,
                Flashlights = source.Flashlights,
                FlashlightCoverage = source.FlashlightCoverage,
                Fragments = source.Fragments,
                Evidence = evidence ?? source.Evidence,
                StandardPieces = source.StandardPieces,
                TargetPattern = targetPattern ?? source.TargetPattern,
                Dimensions = source.Dimensions,
                Shapes = source.Shapes,
                Tuning = source.Tuning,
                Filters = source.Filters,
                Slots = source.Slots,
                Goal = source.Goal,
                ToolCard = source.ToolCard,
                Entities = source.Entities,
                RepairSequence = source.RepairSequence,
                CompletionVideo = source.CompletionVideo
            };
        }

        private static M01TargetPatternDef CloneTargetPattern(
            M01TargetPatternDef source,
            bool? locked = null,
            List<M01TargetPieceInstanceDef>? pieces = null)
        {
            return new M01TargetPatternDef
            {
                Source = source.Source,
                CoordinateSpace = source.CoordinateSpace,
                Pieces = pieces ?? source.Pieces,
                Locked = locked ?? source.Locked,
                Note = source.Note
            };
        }

        // TS: config.evidence.map(e => ({ ...e, generatedOverlap: e.generatedOverlap ? { ...e.generatedOverlap, outline: undefined } : undefined }))
        private static List<M01OverlapEvidenceDef> StripEvidenceOutlines(IReadOnlyList<M01OverlapEvidenceDef> evidence)
        {
            return evidence.Select(item => new M01OverlapEvidenceDef
            {
                Id = item.Id,
                TargetShape = item.TargetShape,
                TargetBlendColor = item.TargetBlendColor,
                Position = item.Position,
                Tolerance = item.Tolerance,
                ShapeTags = item.ShapeTags,
                GeneratedOverlap = item.GeneratedOverlap == null
                    ? null
                    : new M01OverlapEvidenceGeneratedOverlapDef
                    {
                        AreaRatio = item.GeneratedOverlap.AreaRatio,
                        Offset = item.GeneratedOverlap.Offset,
                        Rotation = item.GeneratedOverlap.Rotation,
                        SourceShapes = item.GeneratedOverlap.SourceShapes,
                        Outline = null
                    },
                Solution = item.Solution
            }).ToList();
        }

        private static M01MemoryGearConfig LoadConfig()
        {
            var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
            while (dir != null &&
                   !File.Exists(Path.Combine(dir.FullName, "assets", "resources", "configs", "stage1", "m01-memory-gear.json")))
            {
                dir = dir.Parent;
            }

            Assert.NotNull(dir);
            var path = Path.Combine(dir!.FullName, "assets", "resources", "configs", "stage1", "m01-memory-gear.json");
            var config = JsonConvert.DeserializeObject<M01MemoryGearConfig>(File.ReadAllText(path));
            Assert.NotNull(config);
            return config!;
        }
    }
}
