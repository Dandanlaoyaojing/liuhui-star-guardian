// M01 灰盒关卡的谜题状态机顶层 —— 引擎无关纯逻辑, 由 xUnit 钉死正确性.
// 从 assets/scripts/cocos/M01GreyboxSession.ts 迁移, 规则不变。
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里。
//
// 职责: 包裹 M01MemoryGearController 的状态机, 对外暴露「激活滤色片 / 选片 / 归类 / 手电显色 / 拾放 /
//   弱磁吸证据 / 暂存证据对 / 结构验证 / 提示 / 视图投影」。控制器承担核心谜题状态, 本类维护会话态
//   (选中/持握碎片、当前手电、观察显色缓存、最近提示/反馈、工具卡)并做文案格式化与视图投影。
//
// TS→C# 语义映射:
//   - export const M01_OBSERVED_REVEAL_MS = 2_000 → public const double ObservedRevealMs = 2000。
//   - interface M01GreyboxSessionOptions / RevealOptions → sealed class(init)。now: () => number → Func<double>?;
//     text: Partial<Record<key,string>> → IReadOnlyDictionary<string,string>?(缺省视为空, 同 M01GreyboxText)。
//   - 各 View/Result/Hint/Feedback interface + 可辨识联合 → sealed class(可空字段覆盖联合各分支; TS 缺席属性 ⟺ C# null,
//     故测试的 not.toHaveProperty("observedColor") ⟺ Assert.Null(view.ObservedColor))。
//   - presentation 字符串联合 → 纯 string 字面量(不建 enum)。
//   - Map<string,{color,expiresAt?}> observedFragmentColors → M01OrderedMap(保插入序: clearObservedFragmentColors
//     返回 [...keys()] 被测试按序 toEqual 消费)。now() 毫秒时间戳比较用 double。
//   - options 传给控制器: TS 直接把会话 options(含 now)传给 controller.fromConfig; C# 显式构造 M01ControllerOptions{Now}
//     (控制器只读 now/progressStore, 会话无 progressStore)。
//   - a?.b?.includes(x) === true → a != null && a.b.Contains(x)。x ?? y(对 null/undefined)→ ??。
#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.Core;

namespace StarGuardian.M01
{
    /// <summary>会话可选项 —— TS interface M01GreyboxSessionOptions。</summary>
    public sealed class M01GreyboxSessionOptions
    {
        public Func<double>? Now { get; init; }
        public IReadOnlyDictionary<string, string>? Text { get; init; }
    }

    /// <summary>手电显色可选项 —— TS interface M01GreyboxRevealOptions。</summary>
    public sealed class M01GreyboxRevealOptions
    {
        public bool? Persistent { get; init; }
    }

    /// <summary>滤色片视图 —— TS interface M01GreyboxFilterView。presentation 取 normal/active/hinted。</summary>
    public sealed class M01GreyboxFilterView
    {
        public string FilterId { get; init; } = "";
        public bool Active { get; init; }
        public bool Hinted { get; init; }
        public string Presentation { get; init; } = "";
    }

    /// <summary>碎片视图 —— TS interface M01GreyboxFragmentView。slotId/observedColor/validationColor 缺席时为 null。</summary>
    public sealed class M01GreyboxFragmentView
    {
        public string FragmentId { get; init; } = "";
        public bool Selected { get; init; }
        public bool Placed { get; init; }
        public bool Hinted { get; init; }
        public bool Interactive { get; init; }
        public string? SlotId { get; init; }
        public string? ObservedColor { get; init; }
        public string? ValidationColor { get; init; }
        public string Presentation { get; init; } = "";
    }

    /// <summary>槽位视图 —— TS interface M01GreyboxSlotView。presentation 取 normal/hinted/error。</summary>
    public sealed class M01GreyboxSlotView
    {
        public string SlotId { get; init; } = "";
        public bool Hinted { get; init; }
        public bool Error { get; init; }
        public string Presentation { get; init; } = "";
    }

    /// <summary>修复视图 —— TS interface M01GreyboxRepairView。presentation 取 normal/repaired。</summary>
    public sealed class M01GreyboxRepairView
    {
        public bool Repaired { get; init; }
        public string Presentation { get; init; } = "";
    }

    /// <summary>提示 —— TS interface M01GreyboxHint。level 取 1|2|3(int 承接)。</summary>
    public sealed class M01GreyboxHint
    {
        public int Level { get; init; }
        public string Text { get; init; } = "";
        public IReadOnlyList<string> TargetIds { get; init; } = Array.Empty<string>();
    }

    /// <summary>反馈 —— TS interface M01GreyboxFeedback。kind 取 success|error。</summary>
    public sealed class M01GreyboxFeedback
    {
        public string Kind { get; init; } = "";
        public string Message { get; init; } = "";
        public IReadOnlyList<string> TargetIds { get; init; } = Array.Empty<string>();
    }

    /// <summary>激活滤色片结果 —— TS activateFilter 返回 { accepted, status }。</summary>
    public sealed class M01GreyboxActivateFilterResult
    {
        public bool Accepted { get; init; }
        public string Status { get; init; } = "";
    }

    /// <summary>选片结果 —— TS 联合 M01GreyboxSelectResult。</summary>
    public sealed class M01GreyboxSelectResult
    {
        public bool Accepted { get; init; }
        public string? Reason { get; init; }
        public string? SelectedFragmentId { get; init; }
        public string Status { get; init; } = "";
    }

    /// <summary>归类放置结果 —— TS 联合 M01GreyboxPlaceResult。</summary>
    public sealed class M01GreyboxPlaceResult
    {
        public bool Accepted { get; init; }
        public string? Reason { get; init; }
        public string? SelectedFragmentId { get; init; }
        public int SortedCount { get; init; }
        public bool Completed { get; init; }
        public string Status { get; init; } = "";
    }

    /// <summary>选灯结果 —— TS selectFlashlight 返回 { accepted, activeFlashlightId?, activeFlashlightColor?, status }。</summary>
    public sealed class M01GreyboxFlashlightResult
    {
        public bool Accepted { get; init; }
        public string? ActiveFlashlightId { get; init; }
        public string? ActiveFlashlightColor { get; init; }
        public string Status { get; init; } = "";
    }

    /// <summary>灭灯结果 —— TS clearFlashlight 返回 { accepted, activeFlashlightId, activeFlashlightColor, clearedFragmentIds, status }。</summary>
    public sealed class M01GreyboxClearFlashlightResult
    {
        public bool Accepted { get; init; }
        public string? ActiveFlashlightId { get; init; }
        public string? ActiveFlashlightColor { get; init; }
        public IReadOnlyList<string> ClearedFragmentIds { get; init; } = Array.Empty<string>();
        public string Status { get; init; } = "";
    }

    /// <summary>手电显色结果 —— TS interface M01GreyboxRevealResult。revealedColor/persistent 缺席时为 null。</summary>
    public sealed class M01GreyboxRevealResult
    {
        public bool Accepted { get; init; }
        public string FragmentId { get; init; } = "";
        public string? RevealedColor { get; init; }
        public bool? Persistent { get; init; }
        public string Status { get; init; } = "";
    }

    /// <summary>拾片结果 —— TS pickFragment 返回 { accepted, heldFragmentId?, status }。</summary>
    public sealed class M01GreyboxPickResult
    {
        public bool Accepted { get; init; }
        public string? HeldFragmentId { get; init; }
        public string Status { get; init; } = "";
    }

    /// <summary>放置持握片结果 —— TS placeHeldFragment 返回 { accepted, fragmentId?, placement?, evidenceId?, status }。</summary>
    public sealed class M01GreyboxPlaceHeldResult
    {
        public bool Accepted { get; init; }
        public string? FragmentId { get; init; }
        public string? Placement { get; init; }
        public string? EvidenceId { get; init; }
        public string Status { get; init; } = "";
    }

    /// <summary>弱磁吸证据结果 —— TS weakSnapFragmentToEvidence 返回。</summary>
    public sealed class M01GreyboxWeakSnapResult
    {
        public bool Accepted { get; init; }
        public string? Reason { get; init; }
        public string FragmentId { get; init; } = "";
        public string EvidenceId { get; init; } = "";
        public int CompletedEvidenceCount { get; init; }
        public string BottomLight { get; init; } = "";
        public string Status { get; init; } = "";
    }

    /// <summary>暂存证据对结果 —— TS submitEvidencePair 返回(bottomLight 恒 "off", completed 恒 false)。</summary>
    public sealed class M01GreyboxSubmitEvidenceResult
    {
        public bool Accepted { get; init; }
        public bool ReplacedPreviousPair { get; init; }
        public string? Reason { get; init; }
        public int CompletedEvidenceCount { get; init; }
        public string BottomLight { get; init; } = "";
        public bool Completed { get; init; }
        public string Status { get; init; } = "";
    }

    /// <summary>结构验证结果 —— TS validateCandidateStructure 返回。validationLightSeconds 成功时 null。</summary>
    public sealed class M01GreyboxValidateResult
    {
        public bool Accepted { get; init; }
        public string? Reason { get; init; }
        public int CompletedEvidenceCount { get; init; }
        public string BottomLight { get; init; } = "";
        public double? ValidationLightSeconds { get; init; }
        public bool Completed { get; init; }
        public string Status { get; init; } = "";
    }

    /// <summary>
    /// M01 灰盒谜题会话 —— TS class M01GreyboxSession。私有可变会话态 + 委托 M01MemoryGearController, 语义一一对应。
    /// </summary>
    public sealed class M01GreyboxSession
    {
        // TS: export const M01_OBSERVED_REVEAL_MS = 2_000
        public const double ObservedRevealMs = 2000;

        private readonly M01MemoryGearController controller;
        private readonly M01MemoryGearConfig config;
        private readonly IReadOnlyDictionary<string, string>? text;
        private readonly Func<double> now;
        private string? selectedFragmentId;
        private string? heldFragmentId;
        private string? activeFlashlightId;
        private string? activeFlashlightColor;
        private ToolCard? lastToolCard;
        private M01GreyboxHint? lastHint;
        private M01GreyboxFeedback? lastFeedback;

        // TS: Map<string, { color; expiresAt? }> —— 保插入序(clearObservedFragmentColors 返回按序 keys)。
        private readonly M01OrderedMap<ObservedFragmentColor> observedFragmentColors = new();

        private sealed class ObservedFragmentColor
        {
            public string Color { get; init; } = "";
            public double? ExpiresAt { get; init; }
        }

        private M01GreyboxSession(M01MemoryGearConfig config, M01GreyboxSessionOptions? options = null)
        {
            options ??= new M01GreyboxSessionOptions();
            this.config = M01TargetPatternGenerator.ResolveConfigWithCurrentTargetEvidence(config);
            this.controller = M01MemoryGearController.FromConfig(this.config, new M01ControllerOptions { Now = options.Now });
            this.text = options.Text;
            this.now = options.Now ?? DefaultNow;
        }

        public static M01GreyboxSession FromConfig(M01MemoryGearConfig config, M01GreyboxSessionOptions? options = null) =>
            new M01GreyboxSession(config, options);

        public M01GreyboxActivateFilterResult ActivateFilter(string filterIdOrColor)
        {
            var result = controller.InsertFilter(filterIdOrColor);
            selectedFragmentId = null;

            if (!result.Accepted)
            {
                return new M01GreyboxActivateFilterResult
                {
                    Accepted = false,
                    Status = Format("unknownFilter", new Dictionary<string, object> { ["filterId"] = result.FilterId })
                };
            }

            lastHint = null;
            lastFeedback = null;

            return new M01GreyboxActivateFilterResult
            {
                Accepted = true,
                Status = Format("filterActivated", new Dictionary<string, object> { ["color"] = result.Color! })
            };
        }

        public M01GreyboxSelectResult SelectFragment(string fragmentId)
        {
            var fragment = controller.GetFragmentState(fragmentId);
            if (fragment == null)
            {
                selectedFragmentId = null;
                return new M01GreyboxSelectResult
                {
                    Accepted = false,
                    Reason = "invalid_fragment",
                    Status = Format("unknownFragment", new Dictionary<string, object> { ["fragmentId"] = fragmentId })
                };
            }

            if (!controller.IsFragmentDraggable(fragmentId))
            {
                selectedFragmentId = null;
                lastFeedback = new M01GreyboxFeedback
                {
                    Kind = "error",
                    Message = Format("wrongPlacementFeedback"),
                    TargetIds = new List<string> { fragmentId }
                };
                return new M01GreyboxSelectResult
                {
                    Accepted = false,
                    Reason = "inactive_filter",
                    Status = Format("inactiveFragment", new Dictionary<string, object> { ["fragmentId"] = fragmentId })
                };
            }

            selectedFragmentId = fragmentId;
            lastFeedback = null;
            return new M01GreyboxSelectResult
            {
                Accepted = true,
                SelectedFragmentId = fragmentId,
                Status = Format("fragmentSelected", new Dictionary<string, object>
                {
                    ["color"] = fragment.Color ?? fragment.HiddenColor,
                    ["shape"] = fragment.Shape ?? fragment.EdgeShape
                })
            };
        }

        public M01GreyboxPlaceResult PlaceSelectedFragment(string slotId)
        {
            var selected = selectedFragmentId;
            var before = controller.GetCompletionState();

            if (selected == null)
            {
                lastFeedback = new M01GreyboxFeedback
                {
                    Kind = "error",
                    Message = Format("noSelectionFeedback"),
                    TargetIds = new List<string>()
                };
                return new M01GreyboxPlaceResult
                {
                    Accepted = false,
                    Reason = "no_selection",
                    SortedCount = before.SortedCount,
                    Completed = false,
                    Status = Format("selectFragmentFirst")
                };
            }

            var result = controller.PlaceFragmentInSlot(selected, slotId);
            if (!result.Accepted)
            {
                lastFeedback = new M01GreyboxFeedback
                {
                    Kind = "error",
                    Message = Format("wrongPlacementFeedback"),
                    TargetIds = new List<string> { selected, slotId }
                };
                return new M01GreyboxPlaceResult
                {
                    Accepted = false,
                    Reason = result.Reason,
                    SelectedFragmentId = selected,
                    SortedCount = before.SortedCount,
                    Completed = false,
                    Status = Format("placeRejected", new Dictionary<string, object>
                    {
                        ["fragmentId"] = selected,
                        ["reason"] = result.Reason!
                    })
                };
            }

            selectedFragmentId = null;

            if (result.Completed)
            {
                var completion = controller.CompleteRepairAndUnlockToolCard();
                if (completion.Completed)
                {
                    lastToolCard = completion.ToolCard;
                }
            }

            lastHint = null;
            lastFeedback = new M01GreyboxFeedback
            {
                Kind = "success",
                Message = Format("correctPlacementFeedback"),
                TargetIds = new List<string> { result.SlotId }
            };

            return new M01GreyboxPlaceResult
            {
                Accepted = true,
                SelectedFragmentId = null,
                SortedCount = result.SortedCount,
                Completed = result.Completed,
                Status = result.Completed
                    ? Format("repairCompleted")
                    : Format("sortedCount", new Dictionary<string, object> { ["sortedCount"] = result.SortedCount })
            };
        }

        public M01GreyboxFlashlightResult SelectFlashlight(string flashlightId)
        {
            var flashlight = (config.Flashlights ?? new List<M01FlashlightDef>())
                .FirstOrDefault(candidate => candidate.Id == flashlightId);
            if (flashlight == null)
            {
                return new M01GreyboxFlashlightResult
                {
                    Accepted = false,
                    Status = Format("unknownFilter", new Dictionary<string, object> { ["filterId"] = flashlightId })
                };
            }

            activeFlashlightId = flashlight.Id;
            activeFlashlightColor = flashlight.Color;
            observedFragmentColors.Clear();
            lastHint = null;
            lastFeedback = null;

            return new M01GreyboxFlashlightResult
            {
                Accepted = true,
                ActiveFlashlightId = flashlight.Id,
                ActiveFlashlightColor = flashlight.Color,
                Status = Format("flashlightSelected", new Dictionary<string, object> { ["color"] = flashlight.Color })
            };
        }

        public M01GreyboxClearFlashlightResult ClearFlashlight()
        {
            activeFlashlightId = null;
            activeFlashlightColor = null;
            var clearedFragmentIds = ClearObservedFragmentColors();
            lastHint = null;
            lastFeedback = null;

            return new M01GreyboxClearFlashlightResult
            {
                Accepted = true,
                ActiveFlashlightId = null,
                ActiveFlashlightColor = null,
                ClearedFragmentIds = clearedFragmentIds,
                Status = Format("flashlightCleared")
            };
        }

        public M01GreyboxRevealResult RevealFragment(string fragmentId, M01GreyboxRevealOptions? options = null)
        {
            options ??= new M01GreyboxRevealOptions();

            if (activeFlashlightColor == null)
            {
                return new M01GreyboxRevealResult
                {
                    Accepted = false,
                    FragmentId = fragmentId,
                    Status = Format("selectFragmentFirst")
                };
            }

            var result = controller.RevealFragmentWithFlashlight(fragmentId, activeFlashlightColor);
            if (!result.Accepted)
            {
                return new M01GreyboxRevealResult
                {
                    Accepted = false,
                    FragmentId = fragmentId,
                    Status = Format("unknownFragment", new Dictionary<string, object> { ["fragmentId"] = fragmentId })
                };
            }

            observedFragmentColors.Set(
                fragmentId,
                options.Persistent == true
                    ? new ObservedFragmentColor { Color = result.RevealedColor! }
                    : new ObservedFragmentColor { Color = result.RevealedColor!, ExpiresAt = now() + ObservedRevealMs });

            return new M01GreyboxRevealResult
            {
                Accepted = true,
                FragmentId = fragmentId,
                RevealedColor = result.RevealedColor,
                Persistent = options.Persistent,
                Status = Format("fragmentRevealed", new Dictionary<string, object>
                {
                    ["fragmentId"] = fragmentId,
                    ["color"] = result.RevealedColor!
                })
            };
        }

        public List<M01GreyboxRevealResult> RevealFragments(
            IReadOnlyList<string> fragmentIds,
            M01GreyboxRevealOptions? options = null) =>
            fragmentIds.Select(fragmentId => RevealFragment(fragmentId, options)).ToList();

        public List<string> ClearObservedFragmentColors()
        {
            var fragmentIds = observedFragmentColors.Keys();
            observedFragmentColors.Clear();
            return fragmentIds;
        }

        public M01GreyboxPickResult PickFragment(string fragmentId)
        {
            var fragment = controller.GetFragmentState(fragmentId);
            if (fragment == null)
            {
                heldFragmentId = null;
                return new M01GreyboxPickResult
                {
                    Accepted = false,
                    Status = Format("unknownFragment", new Dictionary<string, object> { ["fragmentId"] = fragmentId })
                };
            }

            controller.UnstageFragment(fragmentId);
            heldFragmentId = fragmentId;
            selectedFragmentId = fragmentId;
            observedFragmentColors.Remove(fragmentId);
            lastFeedback = null;

            return new M01GreyboxPickResult
            {
                Accepted = true,
                HeldFragmentId = fragmentId,
                Status = Format("fragmentPickedUp", new Dictionary<string, object> { ["fragmentId"] = fragmentId })
            };
        }

        public M01GreyboxPlaceHeldResult PlaceHeldFragment(M01GreyboxPoint position)
        {
            var fragmentId = heldFragmentId;
            if (fragmentId == null)
            {
                return new M01GreyboxPlaceHeldResult
                {
                    Accepted = false,
                    Status = Format("selectFragmentFirst")
                };
            }

            heldFragmentId = null;
            selectedFragmentId = null;
            observedFragmentColors.Remove(fragmentId);

            return new M01GreyboxPlaceHeldResult
            {
                Accepted = true,
                FragmentId = fragmentId,
                Placement = "free",
                Status = Format("fragmentPlacedFreely", new Dictionary<string, object>
                {
                    ["fragmentId"] = fragmentId,
                    ["x"] = position.X,
                    ["y"] = position.Y
                })
            };
        }

        public M01GreyboxWeakSnapResult WeakSnapFragmentToEvidence(string fragmentId, string evidenceId)
        {
            var fragment = controller.GetFragmentState(fragmentId);
            var evidence = (config.Evidence ?? new List<M01OverlapEvidenceDef>())
                .FirstOrDefault(candidate => candidate.Id == evidenceId);
            if (fragment == null || evidence == null || !FragmentMatchesEvidenceShape(fragment, evidenceId))
            {
                var reason = fragment == null
                    ? "invalid_fragment"
                    : evidence == null
                        ? "invalid_evidence"
                        : "wrong_shape";
                return new M01GreyboxWeakSnapResult
                {
                    Accepted = false,
                    Reason = reason,
                    FragmentId = fragmentId,
                    EvidenceId = evidenceId,
                    CompletedEvidenceCount = controller.GetCompletionState().ReconstructedEvidenceCount,
                    BottomLight = controller.GetCompletionState().BottomLight,
                    Status = Format("evidenceRejected", new Dictionary<string, object> { ["evidenceId"] = evidenceId })
                };
            }

            heldFragmentId = null;
            selectedFragmentId = null;
            observedFragmentColors.Remove(fragmentId);
            var completionState = controller.GetCompletionState();

            return new M01GreyboxWeakSnapResult
            {
                Accepted = true,
                FragmentId = fragmentId,
                EvidenceId = evidenceId,
                CompletedEvidenceCount = completionState.ReconstructedEvidenceCount,
                BottomLight = completionState.BottomLight,
                Status = Format("weakSnapHint", new Dictionary<string, object>
                {
                    ["fragmentId"] = fragmentId,
                    ["evidenceId"] = evidenceId
                })
            };
        }

        public M01GreyboxSubmitEvidenceResult SubmitEvidencePair(string evidenceId, IReadOnlyList<string> fragmentIds)
        {
            var replacedPreviousPair = controller.IsEvidenceStaged(evidenceId);
            var result = controller.StageEvidencePair(evidenceId, fragmentIds);
            var completionState = controller.GetCompletionState();

            if (!result.Accepted)
            {
                return new M01GreyboxSubmitEvidenceResult
                {
                    Accepted = false,
                    ReplacedPreviousPair = replacedPreviousPair,
                    Reason = result.Reason,
                    CompletedEvidenceCount = completionState.ReconstructedEvidenceCount,
                    BottomLight = "off",
                    Completed = false,
                    Status = Format("evidenceRejected", new Dictionary<string, object> { ["evidenceId"] = evidenceId })
                };
            }

            return new M01GreyboxSubmitEvidenceResult
            {
                Accepted = true,
                ReplacedPreviousPair = replacedPreviousPair,
                CompletedEvidenceCount = completionState.ReconstructedEvidenceCount,
                BottomLight = "off",
                Completed = false,
                Status = Format("evidenceCompleted", new Dictionary<string, object> { ["evidenceId"] = evidenceId })
            };
        }

        public List<string> UnstageFragment(string fragmentId) => controller.UnstageFragment(fragmentId);

        public bool IsEvidenceStaged(string evidenceId) => controller.IsEvidenceStaged(evidenceId);

        public bool AreAllEvidenceStaged()
        {
            var evidence = config.Evidence ?? new List<M01OverlapEvidenceDef>();
            return evidence.Count > 0 && evidence.All(candidate => controller.IsEvidenceStaged(candidate.Id));
        }

        public List<string> ResetCandidateStructure()
        {
            heldFragmentId = null;
            selectedFragmentId = null;
            lastFeedback = null;
            return controller.ResetCandidateStructure();
        }

        public M01GreyboxValidateResult ValidateCandidateStructure()
        {
            var result = controller.ValidateCandidateStructure();
            if (!result.Accepted)
            {
                return new M01GreyboxValidateResult
                {
                    Accepted = false,
                    Reason = result.Reason,
                    CompletedEvidenceCount = controller.GetCompletionState().ReconstructedEvidenceCount,
                    BottomLight = result.BottomLight,
                    ValidationLightSeconds = result.ValidationLightSeconds,
                    Completed = result.Completed,
                    Status = Format("validationLightFlash")
                };
            }

            var completion = controller.CompleteRepairAndUnlockToolCard();
            if (completion.Completed)
            {
                lastToolCard = completion.ToolCard;
            }

            return new M01GreyboxValidateResult
            {
                Accepted = true,
                CompletedEvidenceCount = controller.GetCompletionState().ReconstructedEvidenceCount,
                BottomLight = result.BottomLight,
                ValidationLightSeconds = result.ValidationLightSeconds,
                Completed = result.Completed,
                Status = Format("validationLightSteady")
            };
        }

        public M01GreyboxHint RequestHint()
        {
            if ((config.Evidence ?? new List<M01OverlapEvidenceDef>()).Count > 0)
            {
                var overlapHint = RequestOverlapEvidenceHint();
                lastHint = overlapHint;
                lastFeedback = null;
                return overlapHint;
            }

            var activeFilter = controller.GetActiveFilter();
            M01GreyboxHint hint;

            if (activeFilter == null)
            {
                hint = new M01GreyboxHint
                {
                    Level = 1,
                    Text = Format("hintNoFilter"),
                    TargetIds = (config.Filters ?? new List<M01FilterDef>()).Select(filter => filter.Id).ToList()
                };
            }
            else if (selectedFragmentId == null)
            {
                hint = new M01GreyboxHint
                {
                    Level = 2,
                    Text = Format("hintActiveFilter"),
                    TargetIds = controller.GetDraggableFragmentIds()
                };
            }
            else
            {
                hint = new M01GreyboxHint
                {
                    Level = 3,
                    Text = Format("hintSelectedFragment"),
                    TargetIds = FindTargetSlotIds(selectedFragmentId)
                };
            }

            lastHint = hint;
            lastFeedback = null;
            return hint;
        }

        public string? GetSelectedFragmentId() => selectedFragmentId;

        public M01GreyboxFilterView GetFilterView(string filterId)
        {
            var activeFilter = controller.GetActiveFilter();
            var active = activeFilter?.Id == filterId;
            var hinted = !active && lastHint != null && lastHint.TargetIds.Contains(filterId);

            return new M01GreyboxFilterView
            {
                FilterId = filterId,
                Active = active,
                Hinted = hinted,
                Presentation = active ? "active" : hinted ? "hinted" : "normal"
            };
        }

        public M01GreyboxFragmentView GetFragmentView(string fragmentId)
        {
            var fragment = controller.GetFragmentState(fragmentId);
            var selected = selectedFragmentId == fragmentId;
            var observedColor = GetObservedFragmentColor(fragmentId);
            var validationColor = GetValidationFlashFragmentColor(fragmentId);

            if (fragment == null)
            {
                return new M01GreyboxFragmentView
                {
                    FragmentId = fragmentId,
                    Selected = false,
                    Placed = false,
                    Hinted = false,
                    Interactive = false,
                    Presentation = "normal"
                };
            }

            if (fragment.Sorted)
            {
                return new M01GreyboxFragmentView
                {
                    FragmentId = fragmentId,
                    Selected = false,
                    Placed = true,
                    Hinted = false,
                    Interactive = false,
                    SlotId = fragment.SlotId,
                    Presentation = "placed"
                };
            }

            if (selected)
            {
                return new M01GreyboxFragmentView
                {
                    FragmentId = fragmentId,
                    Selected = true,
                    Placed = false,
                    Hinted = false,
                    Interactive = true,
                    Presentation = "selected"
                };
            }

            if (validationColor != null)
            {
                return new M01GreyboxFragmentView
                {
                    FragmentId = fragmentId,
                    Selected = false,
                    Placed = false,
                    Hinted = false,
                    Interactive = false,
                    ValidationColor = validationColor,
                    Presentation = "highlighted"
                };
            }

            var activeFilter = controller.GetActiveFilter();
            if (activeFilter == null)
            {
                if (observedColor != null)
                {
                    return new M01GreyboxFragmentView
                    {
                        FragmentId = fragmentId,
                        Selected = false,
                        Placed = false,
                        Hinted = false,
                        Interactive = true,
                        ObservedColor = observedColor,
                        Presentation = "highlighted"
                    };
                }

                return new M01GreyboxFragmentView
                {
                    FragmentId = fragmentId,
                    Selected = false,
                    Placed = false,
                    Hinted = false,
                    Interactive = false,
                    Presentation = "normal"
                };
            }

            var interactive = controller.IsFragmentDraggable(fragmentId);
            var hinted = interactive && lastHint != null && lastHint.TargetIds.Contains(fragmentId);

            return new M01GreyboxFragmentView
            {
                FragmentId = fragmentId,
                Selected = false,
                Placed = false,
                Hinted = hinted,
                Interactive = interactive,
                Presentation = hinted ? "hinted" : interactive ? "highlighted" : "dimmed"
            };
        }

        public M01GreyboxSlotView GetSlotView(string slotId)
        {
            var error = lastFeedback != null && lastFeedback.Kind == "error" && lastFeedback.TargetIds.Contains(slotId);
            var hinted = !error && lastHint != null && lastHint.TargetIds.Contains(slotId);

            return new M01GreyboxSlotView
            {
                SlotId = slotId,
                Hinted = hinted,
                Error = error,
                Presentation = error ? "error" : hinted ? "hinted" : "normal"
            };
        }

        public M01GreyboxRepairView GetRepairView()
        {
            var repaired = controller.HasCompletedRepair();

            return new M01GreyboxRepairView
            {
                Repaired = repaired,
                Presentation = repaired ? "repaired" : "normal"
            };
        }

        public M01CompletionState GetCompletionState() => controller.GetCompletionState();

        public M01GreyboxFeedback? GetLastFeedback() =>
            lastFeedback == null
                ? null
                : new M01GreyboxFeedback
                {
                    Kind = lastFeedback.Kind,
                    Message = lastFeedback.Message,
                    TargetIds = lastFeedback.TargetIds.ToList()
                };

        public ToolCard? GetLastToolCard() => lastToolCard;

        private string? GetObservedFragmentColor(string fragmentId)
        {
            var observed = observedFragmentColors.Get(fragmentId);
            if (observed == null)
            {
                return null;
            }

            if (observed.ExpiresAt != null && observed.ExpiresAt.Value <= now())
            {
                observedFragmentColors.Remove(fragmentId);
                return null;
            }

            return observed.Color;
        }

        private string? GetValidationFlashFragmentColor(string fragmentId)
        {
            if (controller.GetCompletionState().BottomLight != M01BottomLightState.FlashThenOff)
            {
                return null;
            }

            if (!controller.IsFragmentStaged(fragmentId))
            {
                return null;
            }

            return controller.GetFragmentState(fragmentId)?.HiddenColor;
        }

        private List<string> FindTargetSlotIds(string fragmentId)
        {
            var fragment = controller.GetFragmentState(fragmentId);
            if (fragment == null)
            {
                return new List<string>();
            }

            var slot = (config.Slots ?? new List<M01SlotDef>())
                .FirstOrDefault(candidate =>
                    candidate.Accepts.Color == fragment.Color && candidate.Accepts.Shape == fragment.Shape);

            return slot != null ? new List<string> { slot.Id } : new List<string>();
        }

        private M01GreyboxHint RequestOverlapEvidenceHint()
        {
            var selected = heldFragmentId ?? selectedFragmentId;

            if (activeFlashlightColor == null)
            {
                return new M01GreyboxHint
                {
                    Level = 1,
                    Text = Format("hintNoFilter"),
                    TargetIds = (config.Flashlights ?? new List<M01FlashlightDef>()).Select(flashlight => flashlight.Id).ToList()
                };
            }

            if (selected == null)
            {
                return new M01GreyboxHint
                {
                    Level = 2,
                    Text = Format("hintActiveFilter"),
                    TargetIds = config.Fragments.Select(fragment => fragment.Id).ToList()
                };
            }

            return new M01GreyboxHint
            {
                Level = 3,
                Text = Format("hintSelectedFragment"),
                TargetIds = FindTargetEvidenceIds(selected)
            };
        }

        private List<string> FindTargetEvidenceIds(string fragmentId)
        {
            var fragment = controller.GetFragmentState(fragmentId);
            if (fragment == null)
            {
                return new List<string>();
            }

            var fragmentTags = new HashSet<string> { fragment.EdgeShape };
            if (fragment.Tags != null)
            {
                foreach (var tag in fragment.Tags)
                {
                    fragmentTags.Add(tag);
                }
            }

            return (config.Evidence ?? new List<M01OverlapEvidenceDef>())
                .Where(evidence => evidence.ShapeTags.Any(tag => fragmentTags.Contains(tag)))
                .Select(evidence => evidence.Id)
                .ToList();
        }

        private bool FragmentMatchesEvidenceShape(M01FragmentState fragment, string evidenceId)
        {
            var evidence = (config.Evidence ?? new List<M01OverlapEvidenceDef>())
                .FirstOrDefault(candidate => candidate.Id == evidenceId);
            if (evidence == null)
            {
                return false;
            }

            var fragmentTags = new HashSet<string> { fragment.EdgeShape };
            if (fragment.Tags != null)
            {
                foreach (var tag in fragment.Tags)
                {
                    fragmentTags.Add(tag);
                }
            }

            return evidence.ShapeTags.Any(tag => fragmentTags.Contains(tag));
        }

        private string Format(string key, IReadOnlyDictionary<string, object>? parameters = null) =>
            M01GreyboxText.Format(key, parameters, text);

        private static double DefaultNow() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }
}
