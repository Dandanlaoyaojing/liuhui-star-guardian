// 从 tests/cocos/M01GreyboxDrag.test.ts 逐条迁移 —— 规则不变, 断言一一对应不增不减, DisplayName 保留原描述。
// vitest 原 14 条(describe "resolveM01GreyboxDrop")→ 14 个 [Fact]。
//
// TS→C# 说明:
//   - resolveM01GreyboxDrop → M01GreyboxDrag.ResolveM01GreyboxDrop; buildM01GreyboxLayout → M01GreyboxLayout.Build。
//   - 返回类型 M01GreyboxDropAction 是 sealed record(值相等)→ expect(...).toEqual({...}) 直接 Assert.Equal(record)。
//     各态字段: place_fragment_freely{Type,FragmentId,Position}; snap_fragment_to_target_piece{Type,FragmentId,
//     PieceSlotId,Position,Rotation}; stick_fragment_to_slot{Type,FragmentId,Position}; weak_snap_fragment{Type,
//     FragmentId,EvidenceId}。未填字段 null, 与 vitest toEqual 忽略 undefined 语义一致。
//   - `{ ...config, targetPattern: {...} }` 浅拷贝: M01MemoryGearConfig 是 class(无 with)→ CloneConfig/
//     CloneTargetPattern 逐字段浅拷贝(同 M01GreyboxLayoutTests)。
//   - 顶层 const layout = buildM01GreyboxLayout(config)(计算一次, 多用例共享)→ static readonly Layout。
//   - expect(x).toEqual({x,y}) 落点 → new M01GreyboxPoint(x,y)。
//   - .not.toMatchObject({type}) → Assert.NotEqual(type, action.Type); .not.toMatchObject({type,pieceSlotId})
//     → Assert.False(action.Type == type && action.PieceSlotId == pieceSlotId)。
//   - Math.round(浏览器坐标量化)→ JsRound(= Math.Floor(x+0.5), 精确复刻 JS 半值向 +∞ 取整)。
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using StarGuardian.Core;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01GreyboxDragTests
    {
        /// <summary>沿目录向上找仓库根读同一份真 config —— 同 M01GreyboxLayoutTests 模式。</summary>
        private static readonly M01MemoryGearConfig Config = LoadConfig();

        /// <summary>TS: const layout = buildM01GreyboxLayout(config)(describe 作用域内一次计算, 多用例共享)。</summary>
        private static readonly M01GreyboxLayoutData Layout = M01GreyboxLayout.Build(Config);

        [Fact(DisplayName = "does not use evidence magnetism while the target pattern is still being composed")]
        public void DoesNotUseEvidenceMagnetismWhileTheTargetPatternIsStillBeingComposed()
        {
            var manualLayout = M01GreyboxLayout.Build(CloneConfig(
                Config,
                targetPattern: CloneTargetPattern(Config.TargetPattern!, locked: false)));
            var fragment = manualLayout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_triangle_red_1");
            var evidence = manualLayout.Evidence.FirstOrDefault(
                item => item.ControllerId == "current_manual_target_green_circle_hexagon_1");

            Assert.NotNull(fragment);
            Assert.NotNull(evidence);
            Assert.Equal(
                new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.PlaceFragmentFreely,
                    FragmentId = "fragment_triangle_red_1",
                    Position = evidence!.Position
                },
                M01GreyboxDrag.ResolveM01GreyboxDrop(manualLayout, fragment!, evidence!.Position));
        }

        [Fact(DisplayName = "prefers the expected exact target piece slot over overlapping evidence magnetism after the target pattern is locked")]
        public void PrefersTheExpectedExactTargetPieceSlotOverOverlappingEvidenceMagnetismAfterLocking()
        {
            var lockedLayout = M01GreyboxLayout.Build(CloneConfig(
                Config,
                targetPattern: CloneTargetPattern(Config.TargetPattern!, locked: true)));
            var fragment = lockedLayout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_hexagon_blue_1");
            var evidence = lockedLayout.Evidence.FirstOrDefault(
                item => item.ControllerId == "current_manual_target_green_circle_hexagon_1");

            Assert.NotNull(fragment);
            Assert.NotNull(evidence);
            Assert.Equal(
                new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.SnapFragmentToTargetPiece,
                    FragmentId = "fragment_hexagon_blue_1",
                    PieceSlotId = "target_piece_hexagon_blue_1",
                    Position = new M01GreyboxPoint(-153, 3.5),
                    Rotation = 0
                },
                M01GreyboxDrag.ResolveM01GreyboxDrop(lockedLayout, fragment!, evidence!.Position));
        }

        [Fact(DisplayName = "snaps by geometry instead of solution identity")]
        public void SnapsByGeometryInsteadOfSolutionIdentity()
        {
            var fragment = Layout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_hexagon_red_2");
            var evidence = Layout.Evidence.FirstOrDefault(
                item => item.ControllerId == "current_manual_target_green_circle_hexagon_1");

            Assert.NotNull(fragment);
            Assert.NotNull(evidence);
            Assert.Equal(
                new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.SnapFragmentToTargetPiece,
                    FragmentId = "fragment_hexagon_red_2",
                    PieceSlotId = "target_piece_hexagon_blue_1",
                    Position = new M01GreyboxPoint(-153, 3.5),
                    Rotation = 0
                },
                M01GreyboxDrag.ResolveM01GreyboxDrop(Layout, fragment!, evidence!.Position));
        }

        [Fact(DisplayName = "returns the locked target rotation with a target piece snap")]
        public void ReturnsTheLockedTargetRotationWithATargetPieceSnap()
        {
            var fragment = Layout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_triangle_blue_1");

            Assert.NotNull(fragment);
            Assert.Equal(
                new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.SnapFragmentToTargetPiece,
                    FragmentId = "fragment_triangle_blue_1",
                    PieceSlotId = "target_piece_triangle_blue_1",
                    Position = new M01GreyboxPoint(-102, -40.5),
                    Rotation = 90
                },
                M01GreyboxDrag.ResolveM01GreyboxDrop(Layout, fragment!, new M01GreyboxPoint(-102, -40.5)));
        }

        [Fact(DisplayName = "does not snap (stages) an expected fragment at a locked target slot when rotation is wrong; sticks to slot instead of falling")]
        public void DoesNotSnapExpectedFragmentAtLockedTargetSlotWhenRotationIsWrongSticksToSlot()
        {
            var fragment = Layout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_triangle_blue_1");
            var targetPosition = new M01GreyboxPoint(-102, -40.5);

            Assert.NotNull(fragment);
            // 角度不对 → 贴在槽位不掉(stick), 不落定验证; 玩家原地转对了再 snap。不再自由落下。
            Assert.Equal(
                new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.StickFragmentToSlot,
                    FragmentId = "fragment_triangle_blue_1",
                    Position = targetPosition
                },
                M01GreyboxDrag.ResolveM01GreyboxDrop(Layout, fragment!, targetPosition, new M01GreyboxDropOptions { Rotation = 0 }));
        }

        [Fact(DisplayName = "lets any circle fragment geometry-snap to a circle target slot")]
        public void LetsAnyCircleFragmentGeometrySnapToACircleTargetSlot()
        {
            var fragment = Layout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_circle_blue_1");
            var targetPosition = new M01GreyboxPoint(-158, -38.5);

            Assert.NotNull(fragment);
            Assert.Equal(
                new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.SnapFragmentToTargetPiece,
                    FragmentId = "fragment_circle_blue_1",
                    PieceSlotId = "target_piece_circle_yellow_1",
                    Position = targetPosition,
                    Rotation = 0
                },
                M01GreyboxDrag.ResolveM01GreyboxDrop(Layout, fragment!, targetPosition, new M01GreyboxDropOptions { Rotation = 0 }));
        }

        [Fact(DisplayName = "does not weak-snap an expected fragment to generated evidence when its rotation is wrong")]
        public void DoesNotWeakSnapAnExpectedFragmentToGeneratedEvidenceWhenItsRotationIsWrong()
        {
            var fragment = Layout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_triangle_blue_1");
            var evidence = Layout.Evidence.FirstOrDefault(
                item => item.ControllerId == "current_manual_target_green_triangle_triangle_1");

            Assert.NotNull(fragment);
            Assert.NotNull(evidence);
            // 证据中心被目标槽矩形盖住 → 命中目标槽路径。角度不对 → 贴在槽位(stick), 不是弱磁吸、不自由落下。
            var action = M01GreyboxDrag.ResolveM01GreyboxDrop(Layout, fragment!, evidence!.Position, new M01GreyboxDropOptions { Rotation = 0 });
            Assert.Equal("stick_fragment_to_slot", action.Type);
        }

        [Fact(DisplayName = "lets every circle fragment geometry-snap to circle-compatible evidence")]
        public void LetsEveryCircleFragmentGeometrySnapToCircleCompatibleEvidence()
        {
            var circleFragments = Layout.Fragments.Where(item => item.Tags.Contains("shape:circle")).ToList();
            var circleEvidence = Layout.Evidence.Where(item => item.Tags.Contains("shape:circle")).ToList();

            Assert.Equal(
                new[] { "fragment_circle_blue_1", "fragment_circle_yellow_1", "fragment_circle_red_2" },
                circleFragments.Select(item => item.ControllerId).ToArray());
            Assert.True(circleEvidence.Count > 0);

            foreach (var fragment in circleFragments)
            {
                foreach (var evidence in circleEvidence)
                {
                    var action = M01GreyboxDrag.ResolveM01GreyboxDrop(Layout, fragment, evidence.Position, new M01GreyboxDropOptions { Rotation = 0 });
                    Assert.NotEqual(M01GreyboxDropActionType.PlaceFragmentFreely, action.Type);
                }
            }
        }

        [Fact(DisplayName = "keeps narrow target slots hittable after browser coordinate quantization")]
        public void KeepsNarrowTargetSlotsHittableAfterBrowserCoordinateQuantization()
        {
            var lockedLayout = M01GreyboxLayout.Build(CloneConfig(
                Config,
                targetPattern: CloneTargetPattern(Config.TargetPattern!, locked: true)));
            var fragment = lockedLayout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_circle_red_2");
            var evidence = lockedLayout.Evidence.FirstOrDefault(
                item => item.ControllerId == "current_manual_target_orange_circle_triangle_1");

            Assert.NotNull(fragment);
            Assert.NotNull(evidence);
            Assert.Equal(
                new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.SnapFragmentToTargetPiece,
                    FragmentId = "fragment_circle_red_2",
                    PieceSlotId = "target_piece_circle_red_2",
                    Position = new M01GreyboxPoint(-122, 14.5),
                    Rotation = 0
                },
                M01GreyboxDrag.ResolveM01GreyboxDrop(
                    lockedLayout,
                    fragment!,
                    new M01GreyboxPoint(JsRound(evidence!.Position.X), JsRound(evidence!.Position.Y))));
        }

        [Fact(DisplayName = "does not snap fragments to old target piece slots while composing a new target")]
        public void DoesNotSnapFragmentsToOldTargetPieceSlotsWhileComposingANewTarget()
        {
            var manualLayout = M01GreyboxLayout.Build(CloneConfig(
                Config,
                targetPattern: CloneTargetPattern(Config.TargetPattern!, locked: false, pieces: new List<M01TargetPieceInstanceDef>())));
            var fragment = manualLayout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_circle_yellow_1");
            var oldTargetPosition = new M01GreyboxPoint(68.92, 20.49);

            Assert.NotNull(fragment);
            Assert.Empty(manualLayout.TargetPieceSlots);
            Assert.Equal(
                new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.PlaceFragmentFreely,
                    FragmentId = "fragment_circle_yellow_1",
                    Position = oldTargetPosition
                },
                M01GreyboxDrag.ResolveM01GreyboxDrop(manualLayout, fragment!, oldTargetPosition));
        }

        [Fact(DisplayName = "keeps evidence reconstruction drops from being stolen by overlapping target piece slots after locking")]
        public void KeepsEvidenceReconstructionDropsFromBeingStolenByOverlappingTargetPieceSlotsAfterLocking()
        {
            var lockedLayout = M01GreyboxLayout.Build(CloneConfig(
                Config,
                targetPattern: CloneTargetPattern(
                    Config.TargetPattern!,
                    locked: true,
                    pieces: new List<M01TargetPieceInstanceDef>
                    {
                        new M01TargetPieceInstanceDef
                        {
                            Id = "target_piece_hexagon_lower_left",
                            StandardPieceId = "standard_hexagon",
                            Position = new Vec2Def { X = -60.35, Y = -73.1 }
                        }
                    })));
            var fragment = Layout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_hexagon_red_2");
            var evidence = lockedLayout.Evidence.FirstOrDefault(
                item => item.ControllerId == "current_manual_target_green_circle_hexagon_1");

            Assert.NotNull(fragment);
            Assert.NotNull(evidence);
            Assert.Equal(
                new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.WeakSnapFragment,
                    FragmentId = "fragment_hexagon_red_2",
                    EvidenceId = "current_manual_target_green_circle_hexagon_1"
                },
                M01GreyboxDrag.ResolveM01GreyboxDrop(lockedLayout, fragment!, evidence!.Position));
        }

        [Fact(DisplayName = "does not snap a mismatched shape to a target piece slot")]
        public void DoesNotSnapAMismatchedShapeToATargetPieceSlot()
        {
            var fragment = Layout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_triangle_red_1");
            var oldTargetPosition = new M01GreyboxPoint(68.92, 20.49);

            Assert.NotNull(fragment);
            // .not.toMatchObject({ type: "snap_fragment_to_target_piece", pieceSlotId: "target_piece_circle_right" })
            var action = M01GreyboxDrag.ResolveM01GreyboxDrop(Layout, fragment!, oldTargetPosition);
            Assert.False(
                action.Type == M01GreyboxDropActionType.SnapFragmentToTargetPiece &&
                action.PieceSlotId == "target_piece_circle_right");
        }

        [Fact(DisplayName = "does not weak-snap a shape that cannot produce the generated overlap target")]
        public void DoesNotWeakSnapAShapeThatCannotProduceTheGeneratedOverlapTarget()
        {
            var fragment = Layout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_triangle_red_1");
            var evidence = Layout.Evidence.FirstOrDefault(
                item => item.ControllerId == "current_manual_target_green_circle_hexagon_1");

            Assert.NotNull(fragment);
            Assert.NotNull(evidence);
            Assert.Equal(
                new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.PlaceFragmentFreely,
                    FragmentId = "fragment_triangle_red_1",
                    Position = evidence!.Position
                },
                M01GreyboxDrag.ResolveM01GreyboxDrop(Layout, fragment!, evidence!.Position));
        }

        [Fact(DisplayName = "returns a fragment to free placement when no evidence shape is nearby")]
        public void ReturnsAFragmentToFreePlacementWhenNoEvidenceShapeIsNearby()
        {
            var fragment = Layout.Fragments.FirstOrDefault(item => item.ControllerId == "fragment_circle_blue_1");
            var position = new M01GreyboxPoint(420, -260);

            Assert.NotNull(fragment);
            Assert.Equal(
                new M01GreyboxDropAction
                {
                    Type = M01GreyboxDropActionType.PlaceFragmentFreely,
                    FragmentId = "fragment_circle_blue_1",
                    Position = position
                },
                M01GreyboxDrag.ResolveM01GreyboxDrop(Layout, fragment!, position));
        }

        // ---- 辅助 ----

        // JS Math.round(x) = Math.floor(x + 0.5)(半值向 +∞ 取整; 与 C# Math.Round 的 banker's rounding 不同)。
        private static double JsRound(double value) => Math.Floor(value + 0.5);

        // config 浅拷贝(TS `{ ...config, targetPattern }` / `{ ...targetPattern, locked, pieces }`)—— 同 M01GreyboxLayoutTests。
        private static M01MemoryGearConfig CloneConfig(
            M01MemoryGearConfig source,
            M01TargetPatternDef? targetPattern = null)
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
                Evidence = source.Evidence,
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
