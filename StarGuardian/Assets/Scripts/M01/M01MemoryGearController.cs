// M01「记忆齿轮」的颜色逻辑 + 谜题状态机 —— 引擎无关, 由 xUnit 钉死正确性.
// 从 assets/scripts/levels/stage1/M01MemoryGearController.ts 迁移, 规则不变。
// 顶层导出的纯函数(blendM01PigmentColors / revealM01FragmentColor + 颜色常量/类型)见 M01MemoryGearColors;
// 2026-07-12 追加: 有状态的 M01MemoryGearController 状态机类(过滤/归类/手电显色/交叠证据校验/工具卡解锁)
//   转写落地于本文件下半部, 供 M01GreyboxSession 包裹复用(此前 wave 只转纯函数, 状态机遗留未转)。
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里。
//
// TS→C# 语义映射:
//   - 字符串字面量联合 M01BaseColor("red"|"yellow"|"blue") / M01BlendColor(+"orange"|"green"|"purple")
//     → string 常量类(禁 enum, 逐字保留; 同 PuzzleConfig.cs 的 GoalType/EntityType 白名单风格)。
//     M01Color / M01Shape 在 TS 本就是纯 string 别名, 不单立类型。
//   - [a,b].sort() 用 UTF-16 码元序 → StringComparer.Ordinal(同 M01StandardPieceBlend.BlendPigmentColors)。
//   - blends[key] 未命中→undefined: 输入受 M01BaseColor 契约保证只三原色, a≠b 时三 key 必命中;
//     C# 无法返回 null string → 不可达 default 抛异常显式标记(同 M01StandardPieceBlend 先例)。
//
// 去重备注: M01StandardPieceBlend.cs 早前把 blendM01PigmentColors 内联为 private helper(其头注已标"控制器落地后可去重");
//   本文件为正式版, StandardPieceBlend 的私有 BlendPigmentColors 可改为引用 M01MemoryGearColors.BlendPigmentColors。
//   本波不动 StandardPieceBlend(避免跨文件牵连), 去重留待后续。
#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.Core;

namespace StarGuardian.M01
{
    /// <summary>三原色白名单 —— TS 类型别名 M01BaseColor = "red" | "yellow" | "blue"。</summary>
    public static class M01BaseColor
    {
        public const string Red = "red";
        public const string Yellow = "yellow";
        public const string Blue = "blue";

        public static readonly IReadOnlyList<string> All = new[] { Red, Yellow, Blue };
    }

    /// <summary>混色白名单 —— TS 类型别名 M01BlendColor = M01BaseColor | "orange" | "green" | "purple"。</summary>
    public static class M01BlendColor
    {
        public const string Red = "red";
        public const string Yellow = "yellow";
        public const string Blue = "blue";
        public const string Orange = "orange";
        public const string Green = "green";
        public const string Purple = "purple";

        public static readonly IReadOnlyList<string> All =
            new[] { Red, Yellow, Blue, Orange, Green, Purple };
    }

    /// <summary>
    /// M01MemoryGearController.ts 顶层导出的纯颜色函数(blendM01PigmentColors / revealM01FragmentColor)汇成静态类。
    /// 方法名沿用 PascalCase, 语义一一对应。
    /// </summary>
    public static class M01MemoryGearColors
    {
        /// <summary>两原色的颜料混色 —— TS blendM01PigmentColors。同色返回自身; 否则按序拼 key 查三项混色表。</summary>
        public static string BlendPigmentColors(string a, string b)
        {
            if (a == b)
            {
                return a;
            }

            var key = string.Join("+", new[] { a, b }.OrderBy(color => color, StringComparer.Ordinal));
            return key switch
            {
                "blue+red" => M01BlendColor.Purple,
                "blue+yellow" => M01BlendColor.Green,
                "red+yellow" => M01BlendColor.Orange,
                _ => throw new ArgumentException($"unsupported pigment blend: {key}")
            };
        }

        /// <summary>
        /// 隐藏本色在某手电色下的显色 —— TS revealM01FragmentColor(fragment: { hiddenColor }, flashlightColor)。
        /// TS 传整个碎片对象取其 hiddenColor; C# 直接取 hiddenColor 字符串(解耦本纯函数与 config 类型),
        /// 调用方传 fragment.HiddenColor 即可。
        /// </summary>
        public static string RevealFragmentColor(string hiddenColor, string flashlightColor) =>
            BlendPigmentColors(hiddenColor, flashlightColor);
    }

    /// <summary>底光三态 —— TS 类型别名 M01BottomLightState = "off" | "flash_then_off" | "steady_on"(纯 string 常量, 不建 enum)。</summary>
    public static class M01BottomLightState
    {
        public const string Off = "off";
        public const string FlashThenOff = "flash_then_off";
        public const string SteadyOn = "steady_on";
    }

    /// <summary>碎片运行时状态 —— TS interface M01FragmentState extends M01CandidateFragmentDef。
    /// 内部 map 存的是本对象(sorted/slotId 就地可变); GetFragmentState/GetFragments 返回 Clone 副本(对应 TS `{...fragment}`)。</summary>
    public sealed class M01FragmentState
    {
        // M01CandidateFragmentDef 承接字段
        public string Id { get; init; } = "";
        public string HiddenColor { get; init; } = "";
        public string EdgeShape { get; init; } = "";
        public IReadOnlyList<string>? Tags { get; init; }
        public Vec2Def? Position { get; init; }
        public string? Color { get; init; }
        public string? Shape { get; init; }
        public string? Sprite { get; init; }
        // M01FragmentState 追加字段(就地可变)
        public bool Sorted { get; set; }
        public string? SlotId { get; set; }
        public bool HiddenColorVisible { get; set; }

        /// <summary>TS `{ ...fragment }` 浅拷贝(Tags 共享引用, 同 TS 展开语义)。</summary>
        public M01FragmentState Clone() => new M01FragmentState
        {
            Id = Id,
            HiddenColor = HiddenColor,
            EdgeShape = EdgeShape,
            Tags = Tags,
            Position = Position,
            Color = Color,
            Shape = Shape,
            Sprite = Sprite,
            Sorted = Sorted,
            SlotId = SlotId,
            HiddenColorVisible = HiddenColorVisible
        };
    }

    /// <summary>整体完成状态 —— TS interface M01CompletionState。计数字段用 int; bottomLight 取 M01BottomLightState 之一。</summary>
    public sealed class M01CompletionState
    {
        public bool Completed { get; init; }
        public int SortedCount { get; init; }
        public int TotalFragments { get; init; }
        public int ReconstructedEvidenceCount { get; init; }
        public int TotalEvidenceCount { get; init; }
        public int UsedFragmentCount { get; init; }
        public string BottomLight { get; init; } = "";
    }

    /// <summary>手电显色结果 —— TS 可辨识联合 M01RevealResult。accepted=false 时仅 Reason/FragmentId 有意义。</summary>
    public sealed class M01RevealResult
    {
        public bool Accepted { get; init; }
        public string? Reason { get; init; }
        public string FragmentId { get; init; } = "";
        public string? FlashlightColor { get; init; }
        public string? RevealedColor { get; init; }
    }

    /// <summary>暂存证据对结果 —— TS 联合 M01EvidenceStageResult。</summary>
    public sealed class M01EvidenceStageResult
    {
        public bool Accepted { get; init; }
        public string? Reason { get; init; }
        public string EvidenceId { get; init; } = "";
        public IReadOnlyList<string> FragmentIds { get; init; } = Array.Empty<string>();
        public bool ColorRevealed { get; init; }
    }

    /// <summary>验证时逐证据显色对照项 —— TS revealedEvidence 元素 { evidenceId, actualBlendColor, expectedBlendColor }。</summary>
    public sealed class M01RevealedEvidence
    {
        public string EvidenceId { get; init; } = "";
        public string ActualBlendColor { get; init; } = "";
        public string ExpectedBlendColor { get; init; } = "";
    }

    /// <summary>候选结构验证结果 —— TS 联合 M01CandidateValidationResult。
    /// accepted=true: bottomLight steady_on / validationLightSeconds null / reconstructedEvidenceIds;
    /// accepted=false: reason / bottomLight flash_then_off / validationLightSeconds 数 / revealedEvidence。</summary>
    public sealed class M01CandidateValidationResult
    {
        public bool Accepted { get; init; }
        public string? Reason { get; init; }
        public string BottomLight { get; init; } = "";
        public double? ValidationLightSeconds { get; init; }
        public bool Completed { get; init; }
        public IReadOnlyList<string>? ReconstructedEvidenceIds { get; init; }
        public IReadOnlyList<M01RevealedEvidence>? RevealedEvidence { get; init; }
    }

    /// <summary>归类放置结果 —— TS 联合 M01PlacementResult。</summary>
    public sealed class M01PlacementResult
    {
        public bool Accepted { get; init; }
        public string? Reason { get; init; }
        public string FragmentId { get; init; } = "";
        public string SlotId { get; init; } = "";
        public int SortedCount { get; init; }
        public bool Completed { get; init; }
    }

    /// <summary>插入滤色片结果 —— TS 联合 M01FilterInsertResult。accepted=false 时无 Color。</summary>
    public sealed class M01FilterInsertResult
    {
        public bool Accepted { get; init; }
        public string? Reason { get; init; }
        public string FilterId { get; init; } = "";
        public string? Color { get; init; }
    }

    /// <summary>控制器可选项 —— TS interface M01ControllerOptions。now 为毫秒时间戳源(TS () =&gt; number → Func&lt;double&gt;)。</summary>
    public sealed class M01ControllerOptions
    {
        public IProgressStore? ProgressStore { get; init; }
        public Func<double>? Now { get; init; }
    }

    /// <summary>完成并解锁工具卡结果 —— TS 联合 M01CompletionResult。</summary>
    public sealed class M01CompletionResult
    {
        public bool Completed { get; init; }
        public bool NewlyUnlocked { get; init; }
        public ToolCard? ToolCard { get; init; }
        public string? Reason { get; init; }
    }

    /// <summary>保插入序的字符串键映射 —— 复刻 JS Map 语义(重复键更新原位、按插入序迭代、允许删除后仍保序)。
    /// C# Dictionary 不保证迭代序(尤其删除后), 而本控制器/Session 的若干路径消费插入序(证据显色对/观察色清单),
    /// 故用「Dictionary + 有序 key 列表」显式保序。值恒为引用类型。</summary>
    internal sealed class M01OrderedMap<TValue> where TValue : class
    {
        private readonly Dictionary<string, TValue> byKey = new();
        private readonly List<string> order = new();

        public int Count => order.Count;

        public bool ContainsKey(string key) => byKey.ContainsKey(key);

        /// <summary>TS Map.get: 缺失返回 null(对应 undefined)。</summary>
        public TValue? Get(string key) => byKey.TryGetValue(key, out var value) ? value : null;

        /// <summary>TS Map.set: 键存在则更新值、保持原插入位置; 否则追加。</summary>
        public void Set(string key, TValue value)
        {
            if (!byKey.ContainsKey(key))
            {
                order.Add(key);
            }
            byKey[key] = value;
        }

        /// <summary>TS Map.delete: 返回是否删除。</summary>
        public bool Remove(string key)
        {
            if (!byKey.Remove(key))
            {
                return false;
            }
            order.Remove(key);
            return true;
        }

        public void Clear()
        {
            byKey.Clear();
            order.Clear();
        }

        /// <summary>插入序键快照(materialize, 迭代中删除安全)。</summary>
        public List<string> Keys() => new List<string>(order);

        /// <summary>插入序值快照。</summary>
        public List<TValue> Values()
        {
            var list = new List<TValue>(order.Count);
            foreach (var key in order)
            {
                list.Add(byKey[key]);
            }
            return list;
        }

        /// <summary>插入序键值对快照(迭代中删除安全, 对应 TS `for (const [k,v] of map)` + 内部 delete)。</summary>
        public List<KeyValuePair<string, TValue>> Entries()
        {
            var list = new List<KeyValuePair<string, TValue>>(order.Count);
            foreach (var key in order)
            {
                list.Add(new KeyValuePair<string, TValue>(key, byKey[key]));
            }
            return list;
        }
    }

    /// <summary>
    /// M01「记忆齿轮」谜题状态机 —— TS class M01MemoryGearController。私有可变字段 + 显式状态转移, 语义一一对应。
    /// 过滤片激活 → 归类放置(legacy) / 手电显色 → 交叠证据暂存 → 结构验证 → 修复并解锁工具卡。
    /// </summary>
    public sealed class M01MemoryGearController
    {
        private readonly M01MemoryGearConfig config;
        private readonly M01ControllerOptions options;
        private readonly Dictionary<string, M01FilterDef> filtersById = new();
        private readonly Dictionary<string, M01FilterDef> filtersByColor = new();
        private readonly Dictionary<string, M01SlotDef> slotsById = new();
        private readonly M01OrderedMap<M01FragmentState> fragmentsById = new();
        private readonly M01OrderedMap<M01OverlapEvidenceDef> evidenceById = new();
        private readonly HashSet<string> reconstructedEvidenceIds = new();
        private readonly M01OrderedMap<List<string>> stagedEvidencePairs = new();
        private M01FilterDef? activeFilter;
        private ToolCard? unlockedToolCard;
        private bool repairCompleted;
        private string bottomLight = M01BottomLightState.Off;
        private double? bottomLightFlashUntil;

        private M01MemoryGearController(M01MemoryGearConfig config, M01ControllerOptions? options = null)
        {
            this.config = config;
            this.options = options ?? new M01ControllerOptions();

            foreach (var filter in config.Filters ?? new List<M01FilterDef>())
            {
                AssertUnique(filtersById.ContainsKey(filter.Id), filter.Id, "filter");
                filtersById[filter.Id] = filter;
                // TS: filtersByColor.set(...) 无 assertUnique —— 同色重复 last-wins。
                filtersByColor[filter.Color] = filter;
            }

            foreach (var slot in config.Slots ?? new List<M01SlotDef>())
            {
                AssertUnique(slotsById.ContainsKey(slot.Id), slot.Id, "slot");
                slotsById[slot.Id] = slot;
            }

            foreach (var fragment in config.Fragments)
            {
                AssertUnique(fragmentsById.ContainsKey(fragment.Id), fragment.Id, "fragment");
                // TS: { ...fragment, sorted:false, slotId:null, hiddenColorVisible:false }
                fragmentsById.Set(fragment.Id, new M01FragmentState
                {
                    Id = fragment.Id,
                    HiddenColor = fragment.HiddenColor,
                    EdgeShape = fragment.EdgeShape,
                    Tags = fragment.Tags,
                    Position = fragment.Position,
                    Color = fragment.Color,
                    Shape = fragment.Shape,
                    Sprite = fragment.Sprite,
                    Sorted = false,
                    SlotId = null,
                    HiddenColorVisible = false
                });
            }

            foreach (var evidence in config.Evidence ?? new List<M01OverlapEvidenceDef>())
            {
                AssertUnique(evidenceById.ContainsKey(evidence.Id), evidence.Id, "evidence");
                evidenceById.Set(evidence.Id, evidence);
            }
        }

        public static M01MemoryGearController FromConfig(
            M01MemoryGearConfig config,
            M01ControllerOptions? options = null) =>
            new M01MemoryGearController(config, options ?? new M01ControllerOptions());

        public M01FilterInsertResult InsertFilter(string filterIdOrColor)
        {
            // TS: filtersById.get(x) ?? filtersByColor.get(x)
            var filter = (filtersById.TryGetValue(filterIdOrColor, out var byId) ? byId : null)
                ?? (filtersByColor.TryGetValue(filterIdOrColor, out var byColor) ? byColor : null);

            if (filter == null)
            {
                return new M01FilterInsertResult
                {
                    Accepted = false,
                    Reason = "invalid_filter",
                    FilterId = filterIdOrColor
                };
            }

            activeFilter = filter;
            return new M01FilterInsertResult
            {
                Accepted = true,
                FilterId = filter.Id,
                Color = filter.Color
            };
        }

        public M01FilterInsertResult SelectActiveFilter(string filterIdOrColor) => InsertFilter(filterIdOrColor);

        // TS: this.activeFilter ? { ...this.activeFilter } : null —— 返回副本。
        public M01FilterDef? GetActiveFilter() =>
            activeFilter == null
                ? null
                : new M01FilterDef
                {
                    Id = activeFilter.Id,
                    Color = activeFilter.Color,
                    Label = activeFilter.Label,
                    EntityId = activeFilter.EntityId
                };

        public List<string> GetDraggableFragmentIds() =>
            GetFragments().Where(fragment => IsFragmentDraggable(fragment.Id)).Select(fragment => fragment.Id).ToList();

        public bool IsFragmentDraggable(string fragmentId)
        {
            var fragment = fragmentsById.Get(fragmentId);
            if (fragment == null || activeFilter == null || fragment.Sorted)
            {
                return false;
            }

            return fragment.Color == activeFilter.Color;
        }

        public M01PlacementResult PlaceFragmentInSlot(string fragmentId, string slotId)
        {
            var fragment = fragmentsById.Get(fragmentId);
            if (fragment == null)
            {
                return new M01PlacementResult { Accepted = false, Reason = "invalid_fragment", FragmentId = fragmentId, SlotId = slotId };
            }

            if (!slotsById.TryGetValue(slotId, out var slot))
            {
                return new M01PlacementResult { Accepted = false, Reason = "invalid_slot", FragmentId = fragmentId, SlotId = slotId };
            }

            if (fragment.Sorted)
            {
                return new M01PlacementResult { Accepted = false, Reason = "already_sorted", FragmentId = fragmentId, SlotId = slotId };
            }

            if (!IsFragmentDraggable(fragmentId))
            {
                return new M01PlacementResult { Accepted = false, Reason = "inactive_filter", FragmentId = fragmentId, SlotId = slotId };
            }

            if (!SlotAcceptsFragment(slot, fragment))
            {
                return new M01PlacementResult { Accepted = false, Reason = "wrong_slot", FragmentId = fragmentId, SlotId = slotId };
            }

            if (IsSlotFull(slot))
            {
                return new M01PlacementResult { Accepted = false, Reason = "slot_full", FragmentId = fragmentId, SlotId = slotId };
            }

            fragment.SlotId = slot.Id;
            fragment.Sorted = true;

            return new M01PlacementResult
            {
                Accepted = true,
                FragmentId = fragmentId,
                SlotId = slotId,
                SortedCount = GetCompletionState().SortedCount,
                Completed = IsComplete()
            };
        }

        public M01RevealResult RevealFragmentWithFlashlight(string fragmentId, string flashlightColor)
        {
            var fragment = fragmentsById.Get(fragmentId);
            if (fragment == null)
            {
                return new M01RevealResult { Accepted = false, Reason = "invalid_fragment", FragmentId = fragmentId };
            }

            return new M01RevealResult
            {
                Accepted = true,
                FragmentId = fragmentId,
                FlashlightColor = flashlightColor,
                RevealedColor = M01MemoryGearColors.RevealFragmentColor(fragment.HiddenColor, flashlightColor)
            };
        }

        public M01EvidenceStageResult StageEvidencePair(string evidenceId, IReadOnlyList<string> fragmentIds)
        {
            var evidence = evidenceById.Get(evidenceId);
            if (evidence == null)
            {
                return new M01EvidenceStageResult
                {
                    Accepted = false,
                    Reason = "invalid_evidence",
                    EvidenceId = evidenceId,
                    FragmentIds = fragmentIds.ToList()
                };
            }

            if (fragmentIds.Count != 2)
            {
                return new M01EvidenceStageResult
                {
                    Accepted = false,
                    Reason = "wrong_shape",
                    EvidenceId = evidenceId,
                    FragmentIds = fragmentIds.ToList()
                };
            }

            var fragments = fragmentIds.Select(id => fragmentsById.Get(id)).ToList();
            if (fragments.Any(fragment => fragment == null))
            {
                return new M01EvidenceStageResult
                {
                    Accepted = false,
                    Reason = "invalid_fragment",
                    EvidenceId = evidenceId,
                    FragmentIds = fragmentIds.ToList()
                };
            }

            var pair = new List<string> { fragmentIds[0], fragmentIds[1] };
            if (!PairMatchesEvidenceShape(evidence, fragments[0]!, fragments[1]!))
            {
                return new M01EvidenceStageResult
                {
                    Accepted = false,
                    Reason = "wrong_shape",
                    EvidenceId = evidenceId,
                    FragmentIds = pair
                };
            }

            InvalidateValidatedStructure();
            stagedEvidencePairs.Set(evidenceId, pair);
            if (GetCurrentBottomLight() != M01BottomLightState.SteadyOn)
            {
                bottomLight = M01BottomLightState.Off;
                bottomLightFlashUntil = null;
            }

            return new M01EvidenceStageResult
            {
                Accepted = true,
                EvidenceId = evidenceId,
                FragmentIds = pair,
                ColorRevealed = false
            };
        }

        public List<string> UnstageFragment(string fragmentId)
        {
            var removedEvidenceIds = new List<string>();

            // Entries() 是快照 → 迭代中删除安全(对应 TS for-of + 内部 delete)。
            foreach (var entry in stagedEvidencePairs.Entries())
            {
                if (!entry.Value.Contains(fragmentId))
                {
                    continue;
                }

                stagedEvidencePairs.Remove(entry.Key);
                removedEvidenceIds.Add(entry.Key);
            }

            if (removedEvidenceIds.Count > 0)
            {
                InvalidateValidatedStructure();
                bottomLight = M01BottomLightState.Off;
                bottomLightFlashUntil = null;
            }

            return removedEvidenceIds;
        }

        public bool IsEvidenceStaged(string evidenceId) => stagedEvidencePairs.ContainsKey(evidenceId);

        public bool IsFragmentStaged(string fragmentId) =>
            stagedEvidencePairs.Values().Any(pair => pair.Contains(fragmentId));

        public List<string> GetStagedEvidenceIds() => stagedEvidencePairs.Keys();

        public List<string> ResetCandidateStructure()
        {
            // TS: [...new Set([...values()].flat())] —— 扁平化去重, 保首次出现序。
            var stagedFragmentIds = new List<string>();
            var seen = new HashSet<string>();
            foreach (var pair in stagedEvidencePairs.Values())
            {
                foreach (var fragmentId in pair)
                {
                    if (seen.Add(fragmentId))
                    {
                        stagedFragmentIds.Add(fragmentId);
                    }
                }
            }

            stagedEvidencePairs.Clear();
            InvalidateValidatedStructure();
            bottomLight = M01BottomLightState.Off;
            bottomLightFlashUntil = null;
            return stagedFragmentIds;
        }

        public M01CandidateValidationResult ValidateCandidateStructure()
        {
            var evidenceDefs = GetEvidenceDefs();
            if (evidenceDefs.Count == 0 || evidenceDefs.Any(evidence => !stagedEvidencePairs.ContainsKey(evidence.Id)))
            {
                return RejectCandidateStructure("incomplete_candidate", new List<M01RevealedEvidence>());
            }

            var revealedEvidence = new List<M01RevealedEvidence>(evidenceDefs.Count);
            foreach (var evidence in evidenceDefs)
            {
                var pair = stagedEvidencePairs.Get(evidence.Id);
                var first = pair != null ? fragmentsById.Get(pair[0]) : null;
                var second = pair != null ? fragmentsById.Get(pair[1]) : null;
                var actualBlendColor = first != null && second != null
                    ? M01MemoryGearColors.BlendPigmentColors(first.HiddenColor, second.HiddenColor)
                    : "red";

                revealedEvidence.Add(new M01RevealedEvidence
                {
                    EvidenceId = evidence.Id,
                    ActualBlendColor = actualBlendColor,
                    ExpectedBlendColor = evidence.TargetBlendColor
                });
            }

            if (revealedEvidence.Any(evidence => evidence.ActualBlendColor != evidence.ExpectedBlendColor))
            {
                return RejectCandidateStructure("wrong_blend_color", revealedEvidence);
            }

            if (!StagedFragmentSetMatchesSolution())
            {
                return RejectCandidateStructure("wrong_fragment_set", revealedEvidence);
            }

            bottomLight = M01BottomLightState.SteadyOn;
            bottomLightFlashUntil = null;
            foreach (var evidence in evidenceDefs)
            {
                reconstructedEvidenceIds.Add(evidence.Id);
            }

            return new M01CandidateValidationResult
            {
                Accepted = true,
                BottomLight = M01BottomLightState.SteadyOn,
                ValidationLightSeconds = null,
                Completed = true,
                ReconstructedEvidenceIds = evidenceDefs.Select(evidence => evidence.Id).ToList()
            };
        }

        public M01FragmentState? GetFragmentState(string fragmentId) => fragmentsById.Get(fragmentId)?.Clone();

        public List<M01FragmentState> GetFragments() =>
            fragmentsById.Values().Select(fragment => fragment.Clone()).ToList();

        public M01CompletionState GetCompletionState()
        {
            var fragments = fragmentsById.Values();
            var sortedCount = fragments.Count(fragment => fragment.Sorted);
            var evidenceDefs = GetEvidenceDefs();
            var completed = evidenceDefs.Count > 0
                ? reconstructedEvidenceIds.Count == evidenceDefs.Count
                : sortedCount == fragments.Count;

            return new M01CompletionState
            {
                Completed = completed,
                SortedCount = sortedCount,
                TotalFragments = fragments.Count,
                ReconstructedEvidenceCount = reconstructedEvidenceIds.Count,
                TotalEvidenceCount = evidenceDefs.Count,
                UsedFragmentCount = GetSolutionFragmentIds().Count,
                BottomLight = GetCurrentBottomLight()
            };
        }

        public bool IsComplete() => GetCompletionState().Completed;

        public (string LevelId, ToolCard ToolCard)? GetToolCardUnlock()
        {
            if (!IsComplete())
            {
                return null;
            }

            var toolCard = unlockedToolCard ?? CreateUnlockedToolCard();
            return (config.Id, toolCard);
        }

        public M01CompletionResult CompleteRepairAndUnlockToolCard()
        {
            if (!IsComplete())
            {
                return new M01CompletionResult { Completed = false, Reason = "not_complete" };
            }

            if (unlockedToolCard != null)
            {
                return new M01CompletionResult { Completed = true, NewlyUnlocked = false, ToolCard = unlockedToolCard };
            }

            var toolCard = CreateUnlockedToolCard();
            unlockedToolCard = toolCard;
            repairCompleted = true;
            options.ProgressStore?.MarkPuzzleCompleted(config.Id, toolCard.UnlockedAt);
            options.ProgressStore?.UnlockToolCard(toolCard);

            return new M01CompletionResult { Completed = true, NewlyUnlocked = true, ToolCard = toolCard };
        }

        public bool HasCompletedRepair() => repairCompleted;

        // TS: createToolCard(this.config.toolCard, this.options.now?.()) —— now 缺省时走 createToolCard 的默认 Date.now()。
        private ToolCard CreateUnlockedToolCard()
        {
            var unlockedAt = options.Now != null ? (long)options.Now() : DefaultNow();
            return ToolCardFactory.Create(config.ToolCard, unlockedAt);
        }

        private static bool SlotAcceptsFragment(M01SlotDef slot, M01FragmentState fragment) =>
            slot.Accepts.Color == fragment.Color && slot.Accepts.Shape == fragment.Shape;

        private bool IsSlotFull(M01SlotDef slot)
        {
            if (slot.Capacity == null)
            {
                return false;
            }

            var placedCount = fragmentsById.Values().Count(fragment => fragment.SlotId == slot.Id);
            return placedCount >= slot.Capacity.Value;
        }

        private List<M01OverlapEvidenceDef> GetEvidenceDefs() => evidenceById.Values();

        private HashSet<string> GetSolutionFragmentIds()
        {
            var set = new HashSet<string>();
            foreach (var evidence in GetEvidenceDefs())
            {
                foreach (var fragmentId in evidence.Solution.FragmentIds)
                {
                    set.Add(fragmentId);
                }
            }

            return set;
        }

        // TS: evidence.shapeTags.every(tag => { i = available.indexOf(tag); if(-1) false; available.splice(i,1); true }) —— 多重集包含。
        private static bool PairMatchesEvidenceShape(
            M01OverlapEvidenceDef evidence,
            M01FragmentState first,
            M01FragmentState second)
        {
            var availableShapeTags = new List<string>();
            foreach (var fragment in new[] { first, second })
            {
                availableShapeTags.Add(fragment.EdgeShape);
                if (fragment.Tags != null)
                {
                    availableShapeTags.AddRange(fragment.Tags);
                }
            }

            foreach (var tag in evidence.ShapeTags)
            {
                var index = availableShapeTags.IndexOf(tag);
                if (index == -1)
                {
                    return false;
                }

                availableShapeTags.RemoveAt(index);
            }

            return true;
        }

        private bool StagedFragmentSetMatchesSolution()
        {
            foreach (var evidence in GetEvidenceDefs())
            {
                var stagedPair = stagedEvidencePairs.Get(evidence.Id);
                if (stagedPair == null || !SameUnorderedPair(stagedPair, evidence.Solution.FragmentIds))
                {
                    return false;
                }
            }

            return true;
        }

        private M01CandidateValidationResult RejectCandidateStructure(
            string reason,
            IReadOnlyList<M01RevealedEvidence> revealedEvidence)
        {
            bottomLight = M01BottomLightState.FlashThenOff;
            bottomLightFlashUntil = GetNow() + config.Goal.Params.ValidationLightSeconds * 1000;

            return new M01CandidateValidationResult
            {
                Accepted = false,
                Reason = reason,
                BottomLight = M01BottomLightState.FlashThenOff,
                ValidationLightSeconds = config.Goal.Params.ValidationLightSeconds,
                Completed = false,
                RevealedEvidence = revealedEvidence
            };
        }

        private string GetCurrentBottomLight()
        {
            if (bottomLight == M01BottomLightState.FlashThenOff &&
                bottomLightFlashUntil != null &&
                GetNow() >= bottomLightFlashUntil.Value)
            {
                bottomLight = M01BottomLightState.Off;
                bottomLightFlashUntil = null;
            }

            return bottomLight;
        }

        private double GetNow() => options.Now != null ? options.Now() : DefaultNow();

        private void InvalidateValidatedStructure()
        {
            if (repairCompleted)
            {
                return;
            }

            reconstructedEvidenceIds.Clear();
        }

        // TS Date.now(): 毫秒时间戳 → long(同 ToolCard.UnlockedAt / ProgressStore.DefaultNow)。
        private static long DefaultNow() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        private static void AssertUnique(bool exists, string id, string label)
        {
            if (exists)
            {
                throw new InvalidOperationException($"Duplicate M01 {label} id: {id}");
            }
        }

        // TS: sameUnorderedPair —— 两对(各恰好两 id)无序相等。
        private static bool SameUnorderedPair(IReadOnlyList<string> a, IReadOnlyList<string> b) =>
            (a[0] == b[0] && a[1] == b[1]) || (a[0] == b[1] && a[1] == b[0]);
    }
}
