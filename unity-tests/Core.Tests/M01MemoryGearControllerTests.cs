// 从 tests/levels/stage1/M01MemoryGearController.test.ts 逐条迁移(23 it → 23 Fact) —— 规则不变, 断言一一对应。
// 补的是 fable 审指出的覆盖缺口: C# 的 M01MemoryGearController 实现已 faithful, 但 TS 的 controller 直测
// 此前零转写。本文件把这 23 条钉进 xUnit, 尤其覆盖 fable 点名的三块 C# 无钉子的路径:
//   ① M01OrderedMap 迭代删除序 —— unstageFragment 按插入序返回被牵连的双证据(测 18);
//   ② ProgressStore 布线 —— completeRepairAndUnlockToolCard 的 markPuzzleCompleted/unlockToolCard +
//      二次解锁 newlyUnlocked=false + usedFragmentCount=6(测 23);
//   ③ 工具卡解锁 —— getToolCardUnlock().toolCard.front.toolName + validateToolCard(测 19)。
//
// TS→C# 约定:
//   - realM01Config(TS 直接 import 的原始 JSON `as any`)在 5 条纯 config 数据守护里用原始 JObject 承接(RawConfig),
//     以忠实翻译 toBeUndefined 这类"键必须缺席"的守护(evidence.fullOutline / fragmentIds / hiddenColorHint);
//     若改用强类型 config, 这些未定型字段根本不存在属性, 守护会被静默削弱。undefined→Assert.Null(indexer 缺键返回 null)。
//   - makeRealConfig()(TS 返回同一 import 单例)→ 共享静态 typed Config(控制器只克隆 fragment、只读 config, 跨测试安全, 与 TS 共享语义一致)。
//   - makeConfig()(legacy 按色形归类夹具)→ M01LegacySortConfig.Build()。
//   - now 注入: TS () => n(number)→ C# Func<double>(控制器)/ Func<long>(ProgressStore)。
//   - toMatchObject→逐字段断言(只断出现的字段); toEqual 对象→全字段断言(TS 缺席键 = C# 默认 null/0/false); toEqual 数组→顺序敏感 Assert.Equal。
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StarGuardian.Core;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01MemoryGearControllerTests
    {
        // ── 真实 config: typed(控制器用) + raw JObject(数据守护用), 同一份仓库单一真源 ──
        private static readonly M01MemoryGearConfig Config = LoadTypedConfig();
        private static readonly JObject RawConfig = LoadRawConfig();

        // TS 顶层 const colors = ["red","blue","yellow"](注: 非 red/yellow/blue), legacy 夹具与 sortAll 共用。
        private static readonly string[] LegacyColors = { "red", "blue", "yellow" };

        // TS CORRECT_EVIDENCE_PAIRS —— 顺序即 config evidence 插入序, 驱动 reconstructedEvidenceIds 断言。
        private static readonly (string EvidenceId, string[] FragmentIds)[] CorrectEvidencePairs =
        {
            ("current_manual_target_green_circle_hexagon_1", new[] { "fragment_circle_yellow_1", "fragment_hexagon_blue_1" }),
            ("current_manual_target_orange_circle_hexagon_1", new[] { "fragment_circle_yellow_1", "fragment_hexagon_red_2" }),
            ("current_manual_target_orange_circle_triangle_1", new[] { "fragment_circle_red_2", "fragment_triangle_yellow_2" }),
            ("current_manual_target_purple_circle_hexagon_1", new[] { "fragment_circle_red_2", "fragment_hexagon_blue_1" }),
            ("current_manual_target_green_triangle_triangle_1", new[] { "fragment_triangle_blue_1", "fragment_triangle_yellow_2" }),
            ("current_manual_target_purple_triangle_hexagon_1", new[] { "fragment_triangle_blue_1", "fragment_hexagon_red_2" }),
        };

        // ── 纯颜色函数(TS 顶层导出 blendM01PigmentColors / revealM01FragmentColor)──

        [Fact(DisplayName = "blends M01 base colors using storybook pigment rules")]
        public void BlendsM01BaseColorsUsingStorybookPigmentRules()
        {
            Assert.Equal("orange", M01MemoryGearColors.BlendPigmentColors("red", "yellow"));
            Assert.Equal("orange", M01MemoryGearColors.BlendPigmentColors("yellow", "red"));
            Assert.Equal("purple", M01MemoryGearColors.BlendPigmentColors("red", "blue"));
            Assert.Equal("green", M01MemoryGearColors.BlendPigmentColors("blue", "yellow"));
            Assert.Equal("red", M01MemoryGearColors.BlendPigmentColors("red", "red"));
        }

        [Fact(DisplayName = "reveals hidden fragment color under a flashlight color")]
        public void RevealsHiddenFragmentColorUnderAFlashlightColor()
        {
            // TS revealM01FragmentColor({ hiddenColor }, flashlightColor); C# 直接取 hiddenColor 字符串。
            Assert.Equal("purple", M01MemoryGearColors.RevealFragmentColor("blue", "red"));
            Assert.Equal("green", M01MemoryGearColors.RevealFragmentColor("yellow", "blue"));
        }

        // ── 纯 config 数据守护(读原始 JObject)──

        [Fact(DisplayName = "loads the new M01 overlap evidence config")]
        public void LoadsTheNewM01OverlapEvidenceConfig()
        {
            Assert.Equal("overlap_evidence_reconstructed", Str(RawConfig["goal"]!["type"]));
            Assert.Equal(9, ((JArray)RawConfig["fragments"]!).Count);
            Assert.True(((JArray)RawConfig["evidence"]!).Count >= 4);
            Assert.True(((JArray)RawConfig["evidence"]!).Count <= 6);
            Assert.Equal("solution_defined", Str(RawConfig["goal"]!["params"]!["requiredFragments"]));
            Assert.Equal(3, (int)RawConfig["goal"]!["params"]!["validationLightSeconds"]!);
        }

        [Fact(DisplayName = "derives used fragments from the configured evidence solution graph")]
        public void DerivesUsedFragmentsFromTheConfiguredEvidenceSolutionGraph()
        {
            var usedFragmentIds = new HashSet<string>();
            foreach (var evidence in (JArray)RawConfig["evidence"]!)
            {
                foreach (var id in (JArray)evidence["solution"]!["fragmentIds"]!)
                {
                    usedFragmentIds.Add(Str(id));
                }
            }

            Assert.True(usedFragmentIds.Count > 0);
            Assert.True(usedFragmentIds.Count < ((JArray)RawConfig["fragments"]!).Count);
            foreach (var evidence in (JArray)RawConfig["evidence"]!)
            {
                Assert.Equal(2, ((JArray)evidence["solution"]!["fragmentIds"]!).Count);
            }
        }

        [Fact(DisplayName = "keeps candidate fragments limited to circle, triangle, and hexagon shapes")]
        public void KeepsCandidateFragmentsLimitedToCircleTriangleAndHexagonShapes()
        {
            var allowedShapes = new HashSet<string> { "circle", "triangle", "hexagon" };
            var colorsByShape = new Dictionary<string, HashSet<string>>();

            foreach (var fragment in (JArray)RawConfig["fragments"]!)
            {
                var shape = Str(fragment["shape"] ?? fragment["edgeShape"]);
                Assert.True(allowedShapes.Contains(shape));
                Assert.Equal(shape, Str(fragment["edgeShape"]));
                if (!colorsByShape.TryGetValue(shape, out var colors))
                {
                    colors = new HashSet<string>();
                    colorsByShape[shape] = colors;
                }
                colors.Add(Str(fragment["hiddenColor"]));
            }

            // TS [...keys()].sort() 用码元序 → StringComparer.Ordinal。
            var keys = colorsByShape.Keys.OrderBy(key => key, StringComparer.Ordinal).ToList();
            Assert.Equal(new[] { "circle", "hexagon", "triangle" }, keys);
            foreach (var colorsForShape in colorsByShape.Values)
            {
                Assert.True(colorsForShape.Count >= 2);
            }
        }

        [Fact(DisplayName = "includes same-shape different-color decoys without leaking target answers")]
        public void IncludesSameShapeDifferentColorDecoysWithoutLeakingTargetAnswers()
        {
            var fragments = (JArray)RawConfig["fragments"]!;
            var wrongColorDecoy = fragments.First(fragment => Str(fragment["id"]) == "fragment_hexagon_yellow_1");
            var sameShapeDecoy = fragments.First(fragment => Str(fragment["id"]) == "fragment_hexagon_red_2");

            Assert.Equal("yellow", Str(wrongColorDecoy["hiddenColor"]));
            Assert.Equal("hexagon", Str(wrongColorDecoy["edgeShape"]));
            Assert.Equal("hexagon", Str(wrongColorDecoy["shape"]));
            Assert.Equal("red", Str(sameShapeDecoy["hiddenColor"]));
            Assert.Equal("hexagon", Str(sameShapeDecoy["edgeShape"]));
            Assert.Equal("hexagon", Str(sameShapeDecoy["shape"]));

            var evidence = (JArray)RawConfig["evidence"]!;
            Assert.True(evidence.All(item => ((JArray)item["solution"]!["fragmentIds"]!).Count == 2));
            Assert.False(evidence.Any(item =>
                ((JArray)item["solution"]!["fragmentIds"]!).Any(id => Str(id) == "fragment_hexagon_yellow_1")));
            // TS 原文此断言重复两遍, 逐条对应保留不删。
            Assert.False(evidence.Any(item =>
                ((JArray)item["solution"]!["fragmentIds"]!).Any(id => Str(id) == "fragment_hexagon_yellow_1")));

            var solutionFragmentIds = new HashSet<string>();
            foreach (var item in evidence)
            {
                foreach (var id in (JArray)item["solution"]!["fragmentIds"]!)
                {
                    solutionFragmentIds.Add(Str(id));
                }
            }

            var solutionFragmentsTaggedAsDecoys = fragments
                .Where(fragment => solutionFragmentIds.Contains(Str(fragment["id"])))
                .Where(fragment => fragment["tags"] is JArray tags && tags.Any(tag => Str(tag) == "decoy"))
                .ToList();

            Assert.Empty(solutionFragmentsTaggedAsDecoys);
            Assert.Equal("solution_defined", Str(RawConfig["goal"]!["params"]!["requiredFragments"]));
        }

        [Fact(DisplayName = "keeps target evidence limited to overlap hints only")]
        public void KeepsTargetEvidenceLimitedToOverlapHintsOnly()
        {
            foreach (var evidence in (JArray)RawConfig["evidence"]!)
            {
                Assert.NotNull(evidence["targetShape"]);
                Assert.Matches("^(orange|green|purple)$", Str(evidence["targetBlendColor"]));

                var expectedShapeTags = ((JArray)evidence["generatedOverlap"]!["sourceShapes"]!)
                    .Select(shape => $"shape:{Str(shape)}")
                    .ToList();
                var actualShapeTags = ((JArray)evidence["shapeTags"]!)
                    .Select(tag => Str(tag))
                    .ToList();
                Assert.Equal(expectedShapeTags, actualShapeTags);

                var generatedOverlap = (JObject)evidence["generatedOverlap"]!;
                Assert.True(IsNumber(generatedOverlap["areaRatio"]));
                var offset = (JObject)generatedOverlap["offset"]!;
                Assert.True(IsNumber(offset["x"]));
                Assert.True(IsNumber(offset["y"]));

                // 守护"答案不得直接泄进 evidence": 这些键必须缺席(TS toBeUndefined → indexer 返回 null)。
                Assert.Null(evidence["fullOutline"]);
                Assert.Null(evidence["fragmentIds"]);
                Assert.Null(evidence["hiddenColorHint"]);
            }
        }

        // ── 有状态控制器: 手电显色 / 交叠证据暂存 / 结构验证 / 底光时序 ──

        [Fact(DisplayName = "reveals candidate fragments without making hidden colors visible by default")]
        public void RevealsCandidateFragmentsWithoutMakingHiddenColorsVisibleByDefault()
        {
            var controller = M01MemoryGearController.FromConfig(MakeRealConfig());
            var fragment = controller.GetFragmentState("fragment_circle_blue_1");

            Assert.False(fragment!.HiddenColorVisible);

            // toEqual 全字段: accepted/fragmentId/flashlightColor/revealedColor; TS 无 reason 键 → C# Reason 应为 null。
            var reveal = controller.RevealFragmentWithFlashlight("fragment_circle_blue_1", "red");
            Assert.True(reveal.Accepted);
            Assert.Null(reveal.Reason);
            Assert.Equal("fragment_circle_blue_1", reveal.FragmentId);
            Assert.Equal("red", reveal.FlashlightColor);
            Assert.Equal("purple", reveal.RevealedColor);

            Assert.False(controller.GetFragmentState("fragment_circle_blue_1")!.HiddenColorVisible);
        }

        [Fact(DisplayName = "stages shape-compatible fixed-shape fragments against a generated overlap target without completing evidence immediately")]
        public void StagesShapeCompatibleFixedShapeFragmentsWithoutCompletingEvidenceImmediately()
        {
            var controller = M01MemoryGearController.FromConfig(MakeRealConfig());

            var stage = controller.StageEvidencePair(
                "current_manual_target_green_circle_hexagon_1",
                new[] { "fragment_hexagon_blue_1", "fragment_circle_blue_1" });
            Assert.True(stage.Accepted);
            Assert.Equal("current_manual_target_green_circle_hexagon_1", stage.EvidenceId);
            Assert.False(stage.ColorRevealed);

            var state = controller.GetCompletionState();
            Assert.False(state.Completed);
            Assert.Equal(0, state.ReconstructedEvidenceCount);
            Assert.Equal(6, state.TotalEvidenceCount);
            Assert.Equal("off", state.BottomLight);
        }

        [Fact(DisplayName = "flashes the bottom light for two seconds when a complete candidate is not fully correct")]
        public void FlashesTheBottomLightWhenACompleteCandidateIsNotFullyCorrect()
        {
            var controller = M01MemoryGearController.FromConfig(MakeRealConfig());
            StageWrongColorCompleteCandidate(controller);

            var result = controller.ValidateCandidateStructure();
            Assert.False(result.Accepted);
            Assert.Equal("wrong_blend_color", result.Reason);
            Assert.Equal("flash_then_off", result.BottomLight);
            Assert.Equal(3d, result.ValidationLightSeconds!.Value);
            Assert.False(result.Completed);

            var state = controller.GetCompletionState();
            Assert.False(state.Completed);
            Assert.Equal(0, state.ReconstructedEvidenceCount);
            Assert.Equal("flash_then_off", state.BottomLight);
        }

        [Fact(DisplayName = "reports the configured failed-validation flash duration")]
        public void ReportsTheConfiguredFailedValidationFlashDuration()
        {
            // TS 深克隆 config 再把 validationLightSeconds 设成 3; C# 里该字段 init-only 且真实 config 本就是 3,
            // 重设为 3 是无操作 → 直接用共享 config(控制器只读 config, 无跨测试污染)。仍验控制器如实上报 3。
            var controller = M01MemoryGearController.FromConfig(MakeRealConfig());
            StageWrongColorCompleteCandidate(controller);

            var result = controller.ValidateCandidateStructure();
            Assert.False(result.Accepted);
            Assert.Equal("flash_then_off", result.BottomLight);
            Assert.Equal(3d, result.ValidationLightSeconds!.Value);
        }

        [Fact(DisplayName = "rejects validation while the candidate is still incomplete")]
        public void RejectsValidationWhileTheCandidateIsStillIncomplete()
        {
            var controller = M01MemoryGearController.FromConfig(MakeRealConfig());
            // 该对形状不匹配本证据(circle+triangle vs shape:circle+shape:hexagon)→ 不入暂存 → 候选残缺。
            controller.StageEvidencePair(
                "current_manual_target_green_circle_hexagon_1",
                new[] { "fragment_circle_blue_1", "fragment_triangle_blue_1" });

            var result = controller.ValidateCandidateStructure();
            Assert.False(result.Accepted);
            Assert.Equal("incomplete_candidate", result.Reason);
            Assert.Equal("flash_then_off", result.BottomLight);
            Assert.Equal(3d, result.ValidationLightSeconds!.Value);
            Assert.False(result.Completed);
        }

        [Fact(DisplayName = "turns the bottom light off after the failed validation flash window")]
        public void TurnsTheBottomLightOffAfterTheFailedValidationFlashWindow()
        {
            double now = 10_000;
            var controller = M01MemoryGearController.FromConfig(MakeRealConfig(), new M01ControllerOptions
            {
                Now = () => now
            });
            StageWrongColorCompleteCandidate(controller);

            controller.ValidateCandidateStructure();

            Assert.Equal("flash_then_off", controller.GetCompletionState().BottomLight);

            now += 2_999;
            Assert.Equal("flash_then_off", controller.GetCompletionState().BottomLight);

            now += 1;
            Assert.Equal("off", controller.GetCompletionState().BottomLight);
        }

        [Fact(DisplayName = "keeps the bottom light on only when all staged evidence pairs are correct")]
        public void KeepsTheBottomLightOnOnlyWhenAllStagedEvidencePairsAreCorrect()
        {
            var controller = M01MemoryGearController.FromConfig(MakeRealConfig());
            StageCorrectCandidate(controller);

            var result = controller.ValidateCandidateStructure();
            Assert.True(result.Accepted);
            Assert.Equal("steady_on", result.BottomLight);
            Assert.True(result.Completed);
            Assert.Equal(
                CorrectEvidencePairs.Select(pair => pair.EvidenceId).ToList(),
                result.ReconstructedEvidenceIds);
            Assert.True(controller.IsComplete());

            var unlock = controller.CompleteRepairAndUnlockToolCard();
            Assert.True(unlock.Completed);
            Assert.True(unlock.NewlyUnlocked);
        }

        [Fact(DisplayName = "reports wrong fragment set when a decoy pair produces the right blend color")]
        public void ReportsWrongFragmentSetWhenADecoyPairProducesTheRightBlendColor()
        {
            var controller = M01MemoryGearController.FromConfig(MakeRealConfig());
            StageWrongFragmentSetCompleteCandidate(controller);

            var result = controller.ValidateCandidateStructure();
            Assert.False(result.Accepted);
            Assert.Equal("wrong_fragment_set", result.Reason);
            Assert.Equal("flash_then_off", result.BottomLight);
            Assert.Equal(3d, result.ValidationLightSeconds!.Value);
            Assert.False(result.Completed);
        }

        [Fact(DisplayName = "rejects correct colors when the pair is assigned to the wrong generated overlap target")]
        public void RejectsCorrectColorsWhenThePairIsAssignedToTheWrongGeneratedOverlapTarget()
        {
            var controller = M01MemoryGearController.FromConfig(MakeRealConfig());
            controller.StageEvidencePair("current_manual_target_green_circle_hexagon_1", new[]
            {
                "fragment_circle_blue_1",
                "fragment_hexagon_yellow_1"
            });
            controller.StageEvidencePair("current_manual_target_orange_circle_hexagon_1", new[]
            {
                "fragment_circle_red_2",
                "fragment_hexagon_yellow_1"
            });
            controller.StageEvidencePair("current_manual_target_orange_circle_triangle_1", new[]
            {
                "fragment_circle_yellow_1",
                "fragment_triangle_red_1"
            });
            controller.StageEvidencePair("current_manual_target_purple_circle_hexagon_1", new[]
            {
                "fragment_circle_blue_1",
                "fragment_hexagon_red_2"
            });
            controller.StageEvidencePair("current_manual_target_green_triangle_triangle_1", new[]
            {
                "fragment_triangle_yellow_2",
                "fragment_triangle_blue_1"
            });
            controller.StageEvidencePair("current_manual_target_purple_triangle_hexagon_1", new[]
            {
                "fragment_triangle_blue_1",
                "fragment_hexagon_red_2"
            });

            var result = controller.ValidateCandidateStructure();
            Assert.False(result.Accepted);
            Assert.Equal("wrong_fragment_set", result.Reason);
            Assert.Equal("flash_then_off", result.BottomLight);
            Assert.Equal(3d, result.ValidationLightSeconds!.Value);
            Assert.False(result.Completed);
        }

        [Fact(DisplayName = "lets a failed staged pair be replaced by a later snap")]
        public void LetsAFailedStagedPairBeReplacedByALaterSnap()
        {
            var controller = M01MemoryGearController.FromConfig(MakeRealConfig());

            controller.StageEvidencePair(
                "current_manual_target_green_circle_hexagon_1",
                new[] { "fragment_hexagon_yellow_1", "fragment_circle_blue_1" });

            var result = controller.StageEvidencePair(
                "current_manual_target_green_circle_hexagon_1",
                new[] { "fragment_hexagon_blue_1", "fragment_circle_blue_1" });
            Assert.True(result.Accepted);
            Assert.Equal("current_manual_target_green_circle_hexagon_1", result.EvidenceId);
            Assert.Equal(new[] { "fragment_hexagon_blue_1", "fragment_circle_blue_1" }, result.FragmentIds);
        }

        [Fact(DisplayName = "removes staged evidence when a fragment is moved away again")]
        public void RemovesStagedEvidenceWhenAFragmentIsMovedAwayAgain()
        {
            var controller = M01MemoryGearController.FromConfig(MakeRealConfig());
            StageCorrectCandidate(controller);

            // OrderedMap 迭代删除序: fragment_hexagon_blue_1 参与 green_circle_hexagon(插入序 0)与
            // purple_circle_hexagon(插入序 3), 按插入序返回被牵连的双证据(fable 点名的 OrderedMap 语义)。
            Assert.Equal(
                new[]
                {
                    "current_manual_target_green_circle_hexagon_1",
                    "current_manual_target_purple_circle_hexagon_1"
                },
                controller.UnstageFragment("fragment_hexagon_blue_1"));
            Assert.False(controller.IsEvidenceStaged("current_manual_target_green_circle_hexagon_1"));

            var result = controller.ValidateCandidateStructure();
            Assert.False(result.Accepted);
            Assert.Equal("incomplete_candidate", result.Reason);
            Assert.Equal("flash_then_off", result.BottomLight);
            Assert.Equal(3d, result.ValidationLightSeconds!.Value);
            Assert.False(result.Completed);
        }

        // ── legacy 按色形归类分支(makeConfig 夹具)──

        [Fact(DisplayName = "sorts all fragments by active color filter and unlocks the M01 ToolCard")]
        public void SortsAllFragmentsByActiveColorFilterAndUnlocksTheM01ToolCard()
        {
            var config = M01LegacySortConfig.Build();
            var controller = M01MemoryGearController.FromConfig(config);

            SortAll(controller, config);

            Assert.True(controller.IsComplete());
            var state = controller.GetCompletionState();
            Assert.True(state.Completed);
            Assert.Equal(18, state.SortedCount);
            Assert.Equal(18, state.TotalFragments);

            var unlock = controller.CompleteRepairAndUnlockToolCard();
            Assert.True(unlock.Completed);
            // TS if (unlock.completed) 判别联合收窄 → 此处 completed 恒真, 内层断言无条件执行。
            Assert.True(unlock.NewlyUnlocked);
            Assert.Equal("m01", unlock.ToolCard!.PuzzleId);
            Assert.True(ToolCardFactory.Validate(unlock.ToolCard!).Ok);

            Assert.Equal("分类与归纳", controller.GetToolCardUnlock()!.Value.ToolCard.Front.ToolName);
        }

        [Fact(DisplayName = "rejects a fragment placed into a slot with the wrong shape or color")]
        public void RejectsAFragmentPlacedIntoASlotWithTheWrongShapeOrColor()
        {
            var controller = M01MemoryGearController.FromConfig(M01LegacySortConfig.Build());
            controller.InsertFilter("filter_red");

            var result = controller.PlaceFragmentInSlot("fragment_red_circle_1", "slot_red_triangle");

            // toEqual 全字段: TS 拒绝对象仅 4 键 → SortedCount/Completed 取 C# 默认(0/false)。
            Assert.False(result.Accepted);
            Assert.Equal("wrong_slot", result.Reason);
            Assert.Equal("fragment_red_circle_1", result.FragmentId);
            Assert.Equal("slot_red_triangle", result.SlotId);
            Assert.Equal(0, result.SortedCount);
            Assert.False(result.Completed);

            var fragment = controller.GetFragmentState("fragment_red_circle_1");
            Assert.Null(fragment!.SlotId);
            Assert.False(fragment.Sorted);
            Assert.False(controller.IsComplete());
        }

        [Fact(DisplayName = "only exposes unsorted fragments matching the inserted active filter as draggable")]
        public void OnlyExposesUnsortedFragmentsMatchingTheInsertedActiveFilterAsDraggable()
        {
            var controller = M01MemoryGearController.FromConfig(M01LegacySortConfig.Build());

            Assert.Empty(controller.GetDraggableFragmentIds());
            Assert.False(controller.IsFragmentDraggable("fragment_red_circle_1"));

            controller.InsertFilter("filter_red");

            Assert.True(controller.IsFragmentDraggable("fragment_red_circle_1"));
            Assert.False(controller.IsFragmentDraggable("fragment_blue_circle_1"));
            Assert.Equal(6, controller.GetDraggableFragmentIds().Count);

            var rejected = controller.PlaceFragmentInSlot("fragment_blue_circle_1", "slot_blue_circle");

            Assert.False(rejected.Accepted);
            Assert.Equal("inactive_filter", rejected.Reason);
        }

        [Fact(DisplayName = "does not complete until every duplicate fragment is sorted")]
        public void DoesNotCompleteUntilEveryDuplicateFragmentIsSorted()
        {
            var config = M01LegacySortConfig.Build();
            var controller = M01MemoryGearController.FromConfig(config);

            foreach (var color in LegacyColors)
            {
                controller.InsertFilter($"filter_{color}");
                foreach (var fragment in config.Fragments.Where(item =>
                             item.Color == color && item.Id.EndsWith("_1", StringComparison.Ordinal)))
                {
                    controller.PlaceFragmentInSlot(fragment.Id, $"slot_{fragment.Color}_{fragment.Shape}");
                }
            }

            var state = controller.GetCompletionState();
            Assert.False(state.Completed);
            Assert.Equal(9, state.SortedCount);
            Assert.Equal(18, state.TotalFragments);
            Assert.Null(controller.GetToolCardUnlock());
        }

        // ── ProgressStore 布线(fable 点名: markPuzzleCompleted/unlockToolCard/二次解锁/usedFragmentCount)──

        [Fact(DisplayName = "completes and persists the real overlap evidence M01 JSON")]
        public void CompletesAndPersistsTheRealOverlapEvidenceM01Json()
        {
            var config = MakeRealConfig();
            var progressStore = ProgressStore.CreateProgressStore(new CreateProgressStoreOptions
            {
                Storage = ProgressStore.CreateMemoryStorage(),
                Now = () => 12345
            });
            var controller = M01MemoryGearController.FromConfig(config, new M01ControllerOptions
            {
                ProgressStore = progressStore,
                Now = () => 12345
            });

            Assert.Equal("overlap_evidence_reconstructed", config.Goal.Type);
            var state = controller.GetCompletionState();
            Assert.False(state.Completed);
            Assert.Equal(0, state.ReconstructedEvidenceCount);
            Assert.Equal(config.Evidence.Count, state.TotalEvidenceCount);
            Assert.Equal(6, state.UsedFragmentCount);
            Assert.Equal("off", state.BottomLight);

            StageCorrectCandidate(controller);
            var validate = controller.ValidateCandidateStructure();
            Assert.True(validate.Accepted);
            Assert.True(validate.Completed);
            Assert.Equal("steady_on", validate.BottomLight);

            var firstUnlock = controller.CompleteRepairAndUnlockToolCard();
            var secondUnlock = controller.CompleteRepairAndUnlockToolCard();

            Assert.True(firstUnlock.Completed);
            Assert.True(firstUnlock.NewlyUnlocked);
            Assert.True(secondUnlock.Completed);
            Assert.False(secondUnlock.NewlyUnlocked);
            Assert.True(progressStore.IsPuzzleCompleted("m01"));
            Assert.True(progressStore.HasToolCard("m01"));
        }

        // ── 测试设施 ──

        // TS makeRealConfig() 返回同一 import 单例 → 共享 typed Config(控制器只克隆 fragment、只读 config)。
        private static M01MemoryGearConfig MakeRealConfig() => Config;

        // TS stageCorrectCandidate: 逐对暂存正解。
        private static void StageCorrectCandidate(M01MemoryGearController controller)
        {
            foreach (var (evidenceId, fragmentIds) in CorrectEvidencePairs)
            {
                controller.StageEvidencePair(evidenceId, fragmentIds);
            }
        }

        // TS stageWrongColorCompleteCandidate: green 处放一对 blend 出 purple(≠green)的片, 其余正解。
        private static void StageWrongColorCompleteCandidate(M01MemoryGearController controller)
        {
            controller.StageEvidencePair(
                "current_manual_target_green_circle_hexagon_1",
                new[] { "fragment_circle_red_2", "fragment_hexagon_blue_1" });
            foreach (var (evidenceId, fragmentIds) in CorrectEvidencePairs.Skip(1))
            {
                controller.StageEvidencePair(evidenceId, fragmentIds);
            }
        }

        // TS stageWrongFragmentSetCompleteCandidate: green 处放一对诱饵(blend 恰好 green 但非正解片集), 其余正解。
        private static void StageWrongFragmentSetCompleteCandidate(M01MemoryGearController controller)
        {
            controller.StageEvidencePair(
                "current_manual_target_green_circle_hexagon_1",
                new[] { "fragment_circle_blue_1", "fragment_hexagon_yellow_1" });
            foreach (var (evidenceId, fragmentIds) in CorrectEvidencePairs.Skip(1))
            {
                controller.StageEvidencePair(evidenceId, fragmentIds);
            }
        }

        // TS sortAll: 逐色激活滤片, 把该色所有碎片按 slot_{color}_{shape} 放入, 每次 accepted。
        private static void SortAll(M01MemoryGearController controller, M01MemoryGearConfig config)
        {
            foreach (var color in LegacyColors)
            {
                controller.InsertFilter($"filter_{color}");
                foreach (var fragment in config.Fragments.Where(item => item.Color == color))
                {
                    var result = controller.PlaceFragmentInSlot(fragment.Id, $"slot_{fragment.Color}_{fragment.Shape}");
                    Assert.True(result.Accepted);
                }
            }
        }

        // TS expect.any(Number): JSON 数字 = Integer 或 Float token。
        private static bool IsNumber(JToken? token) =>
            token != null && (token.Type == JTokenType.Integer || token.Type == JTokenType.Float);

        // 从原始 JToken 取非空字符串(本 config 相关字段恒为存在的字符串; 缺席/null 则抛使测试失败)。
        private static string Str(JToken? token) =>
            (string?)token ?? throw new InvalidOperationException("expected a string JSON token");

        // 沿目录向上找仓库根读同一份真 config —— 同 M01SnapRotationTests / PuzzleConfigTests 模式, 单一真源不复制夹具。
        private static string ResolveConfigPath()
        {
            var rel = Path.Combine("assets", "resources", "configs", "stage1", "m01-memory-gear.json");
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null && !File.Exists(Path.Combine(dir.FullName, rel)))
            {
                dir = dir.Parent;
            }
            if (dir == null)
            {
                throw new FileNotFoundException($"repo root with {rel} not found");
            }
            return Path.Combine(dir.FullName, rel);
        }

        private static M01MemoryGearConfig LoadTypedConfig() =>
            JsonConvert.DeserializeObject<M01MemoryGearConfig>(File.ReadAllText(ResolveConfigPath()))!;

        private static JObject LoadRawConfig() => JObject.Parse(File.ReadAllText(ResolveConfigPath()));
    }
}
