// 从 tests/cocos/M01GreyboxSession.test.ts 迁移 —— 规则不变, 29 条 it 全部转写, 断言一一对应不增不减。
//
// vitest → xUnit 映射约定:
//   - toMatchObject({k:v}) → 逐字段 Assert.Equal / Assert.True/False(仅断言 TS 点名的键)。
//   - toMatchObject 里 selectedFragmentId: undefined / not.toHaveProperty("observedColor") → Assert.Null(...)
//     (C# 侧 View/Result 的可空字段 null ⟺ TS 属性缺席/undefined)。
//   - expect.arrayContaining([...]) → 逐个 Assert.Contains(order-independent)。
//   - 精确数组(toMatchObject 的数组值 / toEqual)→ Assert.Equal(expected, actual)(顺序敏感, 元素级)。
//   - toContain(substr) → Assert.Contains(substr, str)。 toHaveLength(n) → Assert.Equal(n, list.Count)。
//   - now: () => number 用可变捕获局部 double 复刻(nowValue += ... 反映进闭包)。
#nullable enable

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using StarGuardian.Core;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01GreyboxSessionTests
    {
        // 沿目录向上找仓库根读同一份真 config(同 M01TargetPatternGeneratorTests 模式)。
        private static readonly M01MemoryGearConfig RealConfig = LoadConfig();

        // TS: CORRECT_EVIDENCE_PAIRS —— 从当前手动目标派生出的正确证据对。
        private static readonly (string EvidenceId, string[] FragmentIds)[] CorrectEvidencePairs =
        {
            ("current_manual_target_green_circle_hexagon_1", new[] { "fragment_circle_yellow_1", "fragment_hexagon_blue_1" }),
            ("current_manual_target_orange_circle_hexagon_1", new[] { "fragment_circle_yellow_1", "fragment_hexagon_red_2" }),
            ("current_manual_target_orange_circle_triangle_1", new[] { "fragment_circle_red_2", "fragment_triangle_yellow_2" }),
            ("current_manual_target_purple_circle_hexagon_1", new[] { "fragment_circle_red_2", "fragment_hexagon_blue_1" }),
            ("current_manual_target_green_triangle_triangle_1", new[] { "fragment_triangle_blue_1", "fragment_triangle_yellow_2" }),
            ("current_manual_target_purple_triangle_hexagon_1", new[] { "fragment_triangle_blue_1", "fragment_hexagon_red_2" })
        };

        private static void SubmitCorrectCandidate(M01GreyboxSession session)
        {
            foreach (var (evidenceId, fragmentIds) in CorrectEvidencePairs)
            {
                session.SubmitEvidencePair(evidenceId, fragmentIds);
            }
        }

        private static void SubmitWrongColorCompleteCandidate(M01GreyboxSession session)
        {
            session.SubmitEvidencePair(
                "current_manual_target_green_circle_hexagon_1",
                new[] { "fragment_circle_red_2", "fragment_hexagon_blue_1" });
            for (var index = 1; index < CorrectEvidencePairs.Length; index += 1)
            {
                session.SubmitEvidencePair(CorrectEvidencePairs[index].EvidenceId, CorrectEvidencePairs[index].FragmentIds);
            }
        }

        private static void SubmitWrongFragmentSetCompleteCandidate(M01GreyboxSession session)
        {
            session.SubmitEvidencePair(
                "current_manual_target_green_circle_hexagon_1",
                new[] { "fragment_circle_blue_1", "fragment_hexagon_yellow_1" });
            for (var index = 1; index < CorrectEvidencePairs.Length; index += 1)
            {
                session.SubmitEvidencePair(CorrectEvidencePairs[index].EvidenceId, CorrectEvidencePairs[index].FragmentIds);
            }
        }

        [Fact(DisplayName = "lets the greybox activate a filter, select an eligible fragment, and place it in a slot")]
        public void ActivateSelectPlace()
        {
            var session = M01GreyboxSession.FromConfig(M01LegacySortConfig.Build());

            Assert.Contains("已启用", session.ActivateFilter("filter_red").Status);

            var select = session.SelectFragment("fragment_red_circle_1");
            Assert.True(select.Accepted);
            Assert.Equal("fragment_red_circle_1", select.SelectedFragmentId);

            var place = session.PlaceSelectedFragment("slot_red_circle");
            Assert.True(place.Accepted);
            Assert.Null(place.SelectedFragmentId);
            Assert.Equal(1, place.SortedCount);
        }

        [Fact(DisplayName = "allows runtime status copy to be replaced without changing gameplay logic")]
        public void StatusCopyReplaceable()
        {
            var session = M01GreyboxSession.FromConfig(M01LegacySortConfig.Build(), new M01GreyboxSessionOptions
            {
                Text = new Dictionary<string, string>
                {
                    ["filterActivated"] = "FILTER {color}",
                    ["fragmentSelected"] = "PICKED {color} {shape}"
                }
            });

            Assert.Equal("FILTER red", session.ActivateFilter("filter_red").Status);
            Assert.Equal("PICKED red circle", session.SelectFragment("fragment_red_circle_1").Status);
        }

        [Fact(DisplayName = "rejects selecting fragments that are hidden by the active filter")]
        public void RejectsHiddenFragments()
        {
            var session = M01GreyboxSession.FromConfig(M01LegacySortConfig.Build());

            session.ActivateFilter("filter_red");

            var select = session.SelectFragment("fragment_blue_circle_1");
            Assert.False(select.Accepted);
            Assert.Equal("inactive_filter", select.Reason);
        }

        [Fact(DisplayName = "advances greybox hints from filters to fragments to the selected fragment target slot")]
        public void AdvancesGreyboxHints()
        {
            var session = M01GreyboxSession.FromConfig(M01LegacySortConfig.Build());

            var hint1 = session.RequestHint();
            Assert.Equal(1, hint1.Level);
            Assert.Equal(new[] { "filter_red", "filter_blue", "filter_yellow" }, hint1.TargetIds);
            var filterView = session.GetFilterView("filter_red");
            Assert.True(filterView.Hinted);
            Assert.Equal("hinted", filterView.Presentation);

            session.ActivateFilter("filter_red");

            var hint2 = session.RequestHint();
            Assert.Equal(2, hint2.Level);
            Assert.Contains("fragment_red_circle_1", hint2.TargetIds);
            Assert.Contains("fragment_red_triangle_1", hint2.TargetIds);
            var fragmentView = session.GetFragmentView("fragment_red_circle_1");
            Assert.True(fragmentView.Hinted);
            Assert.Equal("hinted", fragmentView.Presentation);
            var dimmedView = session.GetFragmentView("fragment_blue_circle_1");
            Assert.False(dimmedView.Hinted);
            Assert.Equal("dimmed", dimmedView.Presentation);

            session.SelectFragment("fragment_red_circle_1");

            var hint3 = session.RequestHint();
            Assert.Equal(3, hint3.Level);
            Assert.Equal(new[] { "slot_red_circle" }, hint3.TargetIds);
            var slotView = session.GetSlotView("slot_red_circle");
            Assert.True(slotView.Hinted);
            Assert.Equal("hinted", slotView.Presentation);
        }

        [Fact(DisplayName = "allows hint copy to be replaced even when the config includes Chinese hint text")]
        public void HintCopyReplaceable()
        {
            var session = M01GreyboxSession.FromConfig(M01LegacySortConfig.Build(), new M01GreyboxSessionOptions
            {
                Text = new Dictionary<string, string>
                {
                    ["hintNoFilter"] = "HINT FILTER",
                    ["hintActiveFilter"] = "HINT FRAGMENTS",
                    ["hintSelectedFragment"] = "HINT SLOT"
                }
            });

            Assert.Equal("HINT FILTER", session.RequestHint().Text);

            session.ActivateFilter("filter_red");
            Assert.Equal("HINT FRAGMENTS", session.RequestHint().Text);

            session.SelectFragment("fragment_red_circle_1");
            Assert.Equal("HINT SLOT", session.RequestHint().Text);
        }

        [Fact(DisplayName = "exposes targeted error feedback when a selected fragment is placed in the wrong slot")]
        public void ExposesWrongSlotFeedback()
        {
            var session = M01GreyboxSession.FromConfig(M01LegacySortConfig.Build());

            session.ActivateFilter("filter_red");
            session.SelectFragment("fragment_red_circle_1");
            var result = session.PlaceSelectedFragment("slot_red_triangle");

            Assert.False(result.Accepted);
            Assert.Equal("wrong_slot", result.Reason);

            var feedback = session.GetLastFeedback();
            Assert.NotNull(feedback);
            Assert.Equal("error", feedback!.Kind);
            Assert.Equal(new[] { "fragment_red_circle_1", "slot_red_triangle" }, feedback.TargetIds);

            Assert.Equal("error", session.GetSlotView("slot_red_triangle").Presentation);
        }

        [Fact(DisplayName = "exposes visual state changes for filters, selected fragments, and placed fragments")]
        public void ExposesVisualStateChanges()
        {
            var session = M01GreyboxSession.FromConfig(M01LegacySortConfig.Build());

            session.ActivateFilter("filter_red");

            var filterView = session.GetFilterView("filter_red");
            Assert.True(filterView.Active);
            Assert.Equal("active", filterView.Presentation);

            var redView = session.GetFragmentView("fragment_red_circle_1");
            Assert.True(redView.Interactive);
            Assert.Equal("highlighted", redView.Presentation);

            var blueView = session.GetFragmentView("fragment_blue_circle_1");
            Assert.False(blueView.Interactive);
            Assert.Equal("dimmed", blueView.Presentation);

            session.SelectFragment("fragment_red_circle_1");

            var selectedView = session.GetFragmentView("fragment_red_circle_1");
            Assert.True(selectedView.Selected);
            Assert.Equal("selected", selectedView.Presentation);

            session.PlaceSelectedFragment("slot_red_circle");

            var placedView = session.GetFragmentView("fragment_red_circle_1");
            Assert.True(placedView.Placed);
            Assert.False(placedView.Interactive);
            Assert.Equal("placed", placedView.Presentation);
            Assert.Equal("slot_red_circle", placedView.SlotId);
        }

        [Fact(DisplayName = "unlocks the ToolCard once the last fragment is placed")]
        public void UnlocksToolCard()
        {
            var config = M01LegacySortConfig.Build();
            var session = M01GreyboxSession.FromConfig(config, new M01GreyboxSessionOptions { Now = () => 12345 });

            foreach (var color in config.Colors)
            {
                session.ActivateFilter($"filter_{color}");
                foreach (var fragment in config.Fragments.Where(item => item.Color == color))
                {
                    session.SelectFragment(fragment.Id);
                    session.PlaceSelectedFragment($"slot_{fragment.Color}_{fragment.Shape}");
                }
            }

            var completion = session.GetCompletionState();
            Assert.True(completion.Completed);
            Assert.Equal(18, completion.SortedCount);
            Assert.Equal(12345L, session.GetLastToolCard()!.UnlockedAt);

            var repairView = session.GetRepairView();
            Assert.True(repairView.Repaired);
            Assert.Equal("repaired", repairView.Presentation);
        }

        [Fact(DisplayName = "reports completion in Chinese for the runtime status label")]
        public void ReportsCompletionInChinese()
        {
            var config = M01LegacySortConfig.Build();
            var session = M01GreyboxSession.FromConfig(config);
            var lastStatus = "";

            foreach (var color in config.Colors)
            {
                session.ActivateFilter($"filter_{color}");
                foreach (var fragment in config.Fragments.Where(item => item.Color == color))
                {
                    session.SelectFragment(fragment.Id);
                    lastStatus = session.PlaceSelectedFragment($"slot_{fragment.Color}_{fragment.Shape}").Status;
                }
            }

            Assert.Equal("M01 已修复，认知工具卡已解锁。", lastStatus);
        }

        [Fact(DisplayName = "selects a flashlight and reveals a fragment color")]
        public void SelectsFlashlightAndReveals()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);

            var flashlight = session.SelectFlashlight("flashlight_red");
            Assert.True(flashlight.Accepted);
            Assert.Equal("red", flashlight.ActiveFlashlightColor);

            var reveal = session.RevealFragment("fragment_circle_blue_1");
            Assert.True(reveal.Accepted);
            Assert.Equal("fragment_circle_blue_1", reveal.FragmentId);
            Assert.Equal("purple", reveal.RevealedColor);
        }

        [Fact(DisplayName = "shows an observed blend color only before a fragment is moved to assembly")]
        public void ObservedColorOnlyBeforeMove()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);

            session.SelectFlashlight("flashlight_red");
            session.RevealFragment("fragment_circle_blue_1");

            var revealed = session.GetFragmentView("fragment_circle_blue_1");
            Assert.Equal("purple", revealed.ObservedColor);
            Assert.Equal("highlighted", revealed.Presentation);

            session.PickFragment("fragment_circle_blue_1");

            var picked = session.GetFragmentView("fragment_circle_blue_1");
            Assert.Equal("selected", picked.Presentation);
            Assert.Null(picked.ObservedColor);

            session.WeakSnapFragmentToEvidence(
                "fragment_circle_blue_1",
                "current_manual_target_green_circle_hexagon_1");

            var snapped = session.GetFragmentView("fragment_circle_blue_1");
            Assert.Equal("normal", snapped.Presentation);
            Assert.Null(snapped.ObservedColor);
        }

        [Fact(DisplayName = "reveals every candidate fragment for the selected fixed flashlight color")]
        public void RevealsEveryFragment()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);
            var fragmentIds = RealConfig.Fragments.Select(fragment => fragment.Id).ToList();

            session.SelectFlashlight("flashlight_red");
            var revealed = session.RevealFragments(fragmentIds);

            Assert.Equal(9, revealed.Count);

            var byId = revealed.ToDictionary(result => result.FragmentId, result => result.RevealedColor);
            Assert.Equal("purple", byId["fragment_circle_blue_1"]);
            Assert.Equal("orange", byId["fragment_circle_yellow_1"]);
            Assert.Equal("red", byId["fragment_circle_red_2"]);
            Assert.Equal("purple", byId["fragment_triangle_blue_1"]);
            Assert.Equal("red", byId["fragment_triangle_red_1"]);
            Assert.Equal("orange", byId["fragment_triangle_yellow_2"]);
            Assert.Equal("purple", byId["fragment_hexagon_blue_1"]);
            Assert.Equal("orange", byId["fragment_hexagon_yellow_1"]);
            Assert.Equal("red", byId["fragment_hexagon_red_2"]);

            foreach (var fragmentId in fragmentIds)
            {
                Assert.NotNull(session.GetFragmentView(fragmentId).ObservedColor);
            }
        }

        [Fact(DisplayName = "keeps fixed floodlight reveal colors visible while the flashlight remains selected")]
        public void KeepsFloodlightColorsVisible()
        {
            double nowValue = 1000;
            var session = M01GreyboxSession.FromConfig(RealConfig, new M01GreyboxSessionOptions { Now = () => nowValue });
            var fragmentIds = RealConfig.Fragments.Select(fragment => fragment.Id).ToList();

            session.SelectFlashlight("flashlight_yellow");
            session.RevealFragments(fragmentIds, new M01GreyboxRevealOptions { Persistent = true });

            nowValue += 10000;

            Assert.Equal("green", session.GetFragmentView("fragment_circle_blue_1").ObservedColor);
            Assert.Equal("yellow", session.GetFragmentView("fragment_circle_yellow_1").ObservedColor);
            Assert.Equal("orange", session.GetFragmentView("fragment_circle_red_2").ObservedColor);
            Assert.Equal("green", session.GetFragmentView("fragment_triangle_blue_1").ObservedColor);
            Assert.Equal("orange", session.GetFragmentView("fragment_triangle_red_1").ObservedColor);
            Assert.Equal("yellow", session.GetFragmentView("fragment_triangle_yellow_2").ObservedColor);
            Assert.Equal("green", session.GetFragmentView("fragment_hexagon_blue_1").ObservedColor);
            Assert.Equal("yellow", session.GetFragmentView("fragment_hexagon_yellow_1").ObservedColor);
            Assert.Equal("orange", session.GetFragmentView("fragment_hexagon_red_2").ObservedColor);
        }

        [Fact(DisplayName = "clears fixed floodlight observed colors when fragment movement starts")]
        public void ClearsObservedOnMovement()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);
            var fragmentIds = RealConfig.Fragments.Select(fragment => fragment.Id).ToList();

            session.SelectFlashlight("flashlight_red");
            session.RevealFragments(fragmentIds, new M01GreyboxRevealOptions { Persistent = true });

            var clearedFragmentIds = session.ClearObservedFragmentColors();

            Assert.Equal(fragmentIds, clearedFragmentIds);
            foreach (var fragmentId in fragmentIds)
            {
                Assert.Null(session.GetFragmentView(fragmentId).ObservedColor);
            }
        }

        [Fact(DisplayName = "turns the flashlight off via clearFlashlight and resets candidate reveal colors")]
        public void ClearFlashlightResets()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);
            var fragmentIds = RealConfig.Fragments.Select(fragment => fragment.Id).ToList();

            session.SelectFlashlight("flashlight_red");
            session.RevealFragments(fragmentIds, new M01GreyboxRevealOptions { Persistent = true });

            var cleared = session.ClearFlashlight();
            Assert.True(cleared.Accepted);
            Assert.Null(cleared.ActiveFlashlightId);
            Assert.Null(cleared.ActiveFlashlightColor);
            Assert.Equal(fragmentIds, cleared.ClearedFragmentIds);

            foreach (var fragmentId in fragmentIds)
            {
                var view = session.GetFragmentView(fragmentId);
                Assert.Null(view.ObservedColor);
                Assert.Equal("normal", view.Presentation);
            }

            // 灭态下无法显色: 必须重新选灯。
            Assert.False(session.RevealFragment("fragment_circle_blue_1").Accepted);

            // 显色/选色模型保持完好: 再开灯立即恢复工作。
            var reselect = session.SelectFlashlight("flashlight_yellow");
            Assert.True(reselect.Accepted);
            Assert.Equal("yellow", reselect.ActiveFlashlightColor);

            var reveal = session.RevealFragment("fragment_circle_blue_1");
            Assert.True(reveal.Accepted);
            Assert.Equal("green", reveal.RevealedColor);
        }

        [Fact(DisplayName = "expires observed flashlight colors after a short reveal window")]
        public void ExpiresObservedColors()
        {
            double nowValue = 1000;
            var session = M01GreyboxSession.FromConfig(RealConfig, new M01GreyboxSessionOptions { Now = () => nowValue });

            session.SelectFlashlight("flashlight_red");
            session.RevealFragment("fragment_circle_blue_1");

            var view1 = session.GetFragmentView("fragment_circle_blue_1");
            Assert.Equal("purple", view1.ObservedColor);
            Assert.Equal("highlighted", view1.Presentation);

            nowValue += 1999;

            var view2 = session.GetFragmentView("fragment_circle_blue_1");
            Assert.Equal("purple", view2.ObservedColor);
            Assert.Equal("highlighted", view2.Presentation);

            nowValue += 1;

            var view3 = session.GetFragmentView("fragment_circle_blue_1");
            Assert.Equal("normal", view3.Presentation);
            Assert.Null(view3.ObservedColor);
        }

        [Fact(DisplayName = "returns rejections instead of throwing when new actions are sent to a legacy config")]
        public void ReturnsRejectionsForLegacyConfig()
        {
            var session = M01GreyboxSession.FromConfig(M01LegacySortConfig.Build());

            Assert.False(session.SelectFlashlight("flashlight_red").Accepted);

            var weakSnap = session.WeakSnapFragmentToEvidence("fragment_red_circle_1", "evidence_missing");
            Assert.False(weakSnap.Accepted);
            Assert.Equal("evidence_missing", weakSnap.EvidenceId);
        }

        [Fact(DisplayName = "advances overlap-evidence hints from flashlights to fragments and evidence")]
        public void AdvancesOverlapEvidenceHints()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig, new M01GreyboxSessionOptions
            {
                Text = new Dictionary<string, string>
                {
                    ["hintNoFilter"] = "HINT FLASHLIGHT",
                    ["hintActiveFilter"] = "HINT OBSERVE",
                    ["hintSelectedFragment"] = "HINT EVIDENCE"
                }
            });

            var hint1 = session.RequestHint();
            Assert.Equal(1, hint1.Level);
            Assert.Equal("HINT FLASHLIGHT", hint1.Text);
            Assert.Equal(new[] { "flashlight_red", "flashlight_yellow", "flashlight_blue" }, hint1.TargetIds);

            session.SelectFlashlight("flashlight_red");

            var hint2 = session.RequestHint();
            Assert.Equal(2, hint2.Level);
            Assert.Equal("HINT OBSERVE", hint2.Text);
            Assert.Contains("fragment_circle_blue_1", hint2.TargetIds);
            Assert.Contains("fragment_circle_yellow_1", hint2.TargetIds);

            session.PickFragment("fragment_circle_blue_1");

            var hint3 = session.RequestHint();
            Assert.Equal(3, hint3.Level);
            Assert.Equal("HINT EVIDENCE", hint3.Text);
            Assert.Contains("current_manual_target_green_circle_hexagon_1", hint3.TargetIds);
        }

        [Fact(DisplayName = "weak-snaps a shape-compatible fragment near a generated overlap target without validating color")]
        public void WeakSnapsShapeCompatible()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);

            var result = session.WeakSnapFragmentToEvidence(
                "fragment_hexagon_red_2",
                "current_manual_target_green_circle_hexagon_1");
            Assert.True(result.Accepted);
            Assert.Equal(0, result.CompletedEvidenceCount);
            Assert.Equal("off", result.BottomLight);
        }

        [Fact(DisplayName = "does not weak-snap a shape that cannot produce the generated overlap target")]
        public void DoesNotWeakSnapWrongShape()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);

            var result = session.WeakSnapFragmentToEvidence(
                "fragment_triangle_red_1",
                "current_manual_target_green_circle_hexagon_1");
            Assert.False(result.Accepted);
            Assert.Equal("wrong_shape", result.Reason);
            Assert.Equal("off", result.BottomLight);
        }

        [Fact(DisplayName = "flashes bottom light when the submitted candidate is wrong")]
        public void FlashesBottomLightWhenWrong()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);
            SubmitWrongColorCompleteCandidate(session);

            var result = session.ValidateCandidateStructure();
            Assert.False(result.Accepted);
            Assert.Equal("wrong_blend_color", result.Reason);
            Assert.Equal("flash_then_off", result.BottomLight);
            Assert.Equal(3.0, result.ValidationLightSeconds);
            Assert.False(result.Completed);
        }

        [Fact(DisplayName = "treats a moved staged fragment as unstaged before validation")]
        public void MovedStagedFragmentUnstaged()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);
            SubmitCorrectCandidate(session);

            var pick = session.PickFragment("fragment_circle_yellow_1");
            Assert.True(pick.Accepted);
            Assert.Equal("fragment_circle_yellow_1", pick.HeldFragmentId);

            var placeHeld = session.PlaceHeldFragment(new M01GreyboxPoint(320, -180));
            Assert.True(placeHeld.Accepted);
            Assert.Equal("fragment_circle_yellow_1", placeHeld.FragmentId);
            Assert.Equal("free", placeHeld.Placement);

            var result = session.ValidateCandidateStructure();
            Assert.False(result.Accepted);
            Assert.Equal("incomplete_candidate", result.Reason);
            Assert.Equal("flash_then_off", result.BottomLight);
            Assert.Equal(3.0, result.ValidationLightSeconds);
            Assert.False(result.Completed);
        }

        [Fact(DisplayName = "reveals staged fragment base colors only during the failed bottom-light flash window")]
        public void RevealsStagedColorsDuringFlash()
        {
            double nowValue = 1000;
            var session = M01GreyboxSession.FromConfig(RealConfig, new M01GreyboxSessionOptions { Now = () => nowValue });
            SubmitWrongColorCompleteCandidate(session);

            var result = session.ValidateCandidateStructure();
            Assert.False(result.Accepted);
            Assert.Equal("flash_then_off", result.BottomLight);

            var redView = session.GetFragmentView("fragment_circle_red_2");
            Assert.Equal("red", redView.ValidationColor);
            Assert.Equal("highlighted", redView.Presentation);

            var blueView = session.GetFragmentView("fragment_hexagon_blue_1");
            Assert.Equal("blue", blueView.ValidationColor);
            Assert.Equal("highlighted", blueView.Presentation);

            var yellowView = session.GetFragmentView("fragment_hexagon_yellow_1");
            Assert.Equal("normal", yellowView.Presentation);
            Assert.Null(yellowView.ValidationColor);

            nowValue += 2000;

            var afterView = session.GetFragmentView("fragment_circle_blue_1");
            Assert.Equal("normal", afterView.Presentation);
            Assert.Null(afterView.ValidationColor);
        }

        [Fact(DisplayName = "clears failed-validation flash state as soon as the wrong evidence pair is corrected")]
        public void ClearsFlashOnCorrection()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);
            SubmitWrongColorCompleteCandidate(session);

            var firstValidate = session.ValidateCandidateStructure();
            Assert.False(firstValidate.Accepted);
            Assert.Equal("wrong_blend_color", firstValidate.Reason);
            Assert.Equal("flash_then_off", firstValidate.BottomLight);
            Assert.Equal(3.0, firstValidate.ValidationLightSeconds);
            Assert.False(firstValidate.Completed);

            var redView = session.GetFragmentView("fragment_circle_red_2");
            Assert.Equal("red", redView.ValidationColor);
            Assert.Equal("highlighted", redView.Presentation);
            var blueView = session.GetFragmentView("fragment_hexagon_blue_1");
            Assert.Equal("blue", blueView.ValidationColor);
            Assert.Equal("highlighted", blueView.Presentation);

            var submit = session.SubmitEvidencePair(
                "current_manual_target_green_circle_hexagon_1",
                new[] { "fragment_circle_yellow_1", "fragment_hexagon_blue_1" });
            Assert.True(submit.Accepted);
            Assert.True(submit.ReplacedPreviousPair);
            Assert.Equal("off", submit.BottomLight);
            Assert.False(submit.Completed);

            var completion = session.GetCompletionState();
            Assert.False(completion.Completed);
            Assert.Equal("off", completion.BottomLight);

            var clearedView = session.GetFragmentView("fragment_circle_red_2");
            Assert.Equal("normal", clearedView.Presentation);
            Assert.Null(clearedView.ValidationColor);

            var secondValidate = session.ValidateCandidateStructure();
            Assert.True(secondValidate.Accepted);
            Assert.Equal("steady_on", secondValidate.BottomLight);
            Assert.True(secondValidate.Completed);
            Assert.Null(secondValidate.ValidationLightSeconds);
        }

        [Fact(DisplayName = "keeps bottom light steady only after the whole candidate structure is correct")]
        public void KeepsBottomLightSteady()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig, new M01GreyboxSessionOptions { Now = () => 12345 });
            SubmitCorrectCandidate(session);

            var result = session.ValidateCandidateStructure();
            Assert.True(result.Accepted);
            Assert.Equal("steady_on", result.BottomLight);
            Assert.True(result.Completed);
            Assert.Equal(12345L, session.GetLastToolCard()!.UnlockedAt);
        }

        [Fact(DisplayName = "reports a wrong fragment set when a decoy produces the right blend color")]
        public void ReportsWrongFragmentSet()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);
            SubmitWrongFragmentSetCompleteCandidate(session);

            var result = session.ValidateCandidateStructure();
            Assert.False(result.Accepted);
            Assert.Equal("wrong_fragment_set", result.Reason);
            Assert.Equal("flash_then_off", result.BottomLight);
            Assert.Equal(3.0, result.ValidationLightSeconds);
            Assert.False(result.Completed);
        }

        [Fact(DisplayName = "can reset a failed overlap-evidence candidate after the validation flash")]
        public void CanResetFailedCandidate()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);
            SubmitWrongColorCompleteCandidate(session);

            var result = session.ValidateCandidateStructure();
            Assert.False(result.Accepted);
            Assert.Equal("flash_then_off", result.BottomLight);
            Assert.True(session.AreAllEvidenceStaged());

            var reset = session.ResetCandidateStructure();
            var expected = new[]
            {
                "fragment_circle_yellow_1",
                "fragment_circle_red_2",
                "fragment_hexagon_blue_1",
                "fragment_hexagon_red_2",
                "fragment_triangle_blue_1",
                "fragment_triangle_yellow_2"
            };
            Assert.Equal(
                expected.OrderBy(id => id, StringComparer.Ordinal).ToList(),
                reset.OrderBy(id => id, StringComparer.Ordinal).ToList());

            Assert.False(session.AreAllEvidenceStaged());

            var completion = session.GetCompletionState();
            Assert.False(completion.Completed);
            Assert.Equal("off", completion.BottomLight);
            Assert.Equal(0, completion.ReconstructedEvidenceCount);
        }

        [Fact(DisplayName = "supports click-pick and click-place so staged fragments can be corrected")]
        public void SupportsClickPickAndPlace()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);

            var pick = session.PickFragment("fragment_circle_blue_1");
            Assert.True(pick.Accepted);
            Assert.Equal("fragment_circle_blue_1", pick.HeldFragmentId);

            var placeHeld = session.PlaceHeldFragment(new M01GreyboxPoint(320, -180));
            Assert.True(placeHeld.Accepted);
            Assert.Equal("fragment_circle_blue_1", placeHeld.FragmentId);
            Assert.Equal("free", placeHeld.Placement);

            session.SubmitEvidencePair(
                "current_manual_target_green_circle_hexagon_1",
                new[] { "fragment_hexagon_yellow_1", "fragment_circle_blue_1" });

            var submit = session.SubmitEvidencePair(
                "current_manual_target_green_circle_hexagon_1",
                new[] { "fragment_circle_yellow_1", "fragment_hexagon_blue_1" });
            Assert.True(submit.Accepted);
            Assert.Equal("off", submit.BottomLight);
        }

        [Fact(DisplayName = "releases the held fragment after a weak snap placement")]
        public void ReleasesHeldAfterWeakSnap()
        {
            var session = M01GreyboxSession.FromConfig(RealConfig);

            session.SelectFlashlight("flashlight_red");
            session.PickFragment("fragment_circle_blue_1");
            var weakSnap = session.WeakSnapFragmentToEvidence(
                "fragment_circle_blue_1",
                "current_manual_target_green_circle_hexagon_1");
            Assert.True(weakSnap.Accepted);

            var hint = session.RequestHint();
            Assert.Equal(2, hint.Level);
            Assert.Contains("fragment_triangle_blue_1", hint.TargetIds);
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
