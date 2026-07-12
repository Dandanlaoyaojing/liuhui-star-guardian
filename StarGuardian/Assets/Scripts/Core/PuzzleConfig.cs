// 数据驱动谜题配置的完整类型集 + 校验器 —— 引擎无关纯逻辑, 由 xUnit 钉死正确性。
// validatePuzzleConfig 的输入是"未知形状的 JSON"(TS unknown) → C# 用 Newtonsoft JToken 承接
// (同 ToolCard.cs 样板); 校验通过后 ToObject<PuzzleConfig> 投影成强类型(TS 里是 `value as PuzzleConfig`,
// C# 无结构类型故需反序列化, 让调用方/单测能按字段读取)。错误文案逐字保留 TS 原文(单测依赖)。
// 从 assets/scripts/core/PuzzleConfig.ts 迁移, 规则不变。
//
// 收编 wave1 最小集: 原 PuzzleConfigTypes.cs(GoalType/GoalDef 的占位版)已并入本文件并删除;
// GoalType 在此扩成完整 13 值; GoalDef 沿用 wave1 形态(Params:AllSortedGoalParams), 供 GoalEvaluator 复用;
// AllSortedGoalParams 仍单独定义在 GoalEvaluator.cs, 本文件与 TS 的同构 interface 在 C# 侧共用那一份, 不再重复定义。
// PuzzleDimension 在 TS 是 "color" | "shape" | (string & {}) —— 本质就是 string, 按约定直接用 C# string 表示, 不单立类型。
#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace StarGuardian.Core
{
    /// <summary>
    /// TS 的可辨识联合 `{ ok: true; value: T } | { ok: false; errors: string[] }`。
    /// Ok=true 时 Value 有值、Errors 空; Ok=false 时 Value 为 default、Errors 非空。
    /// (StarWebConfig 下一步复用本泛型。)
    /// </summary>
    public sealed class ValidationResult<T>
    {
        public bool Ok { get; }
        public T? Value { get; }
        public IReadOnlyList<string> Errors { get; }

        private ValidationResult(bool ok, T? value, IReadOnlyList<string> errors)
        {
            Ok = ok;
            Value = value;
            Errors = errors;
        }

        public static ValidationResult<T> Success(T value) =>
            new(true, value, Array.Empty<string>());

        public static ValidationResult<T> Failure(IReadOnlyList<string> errors) =>
            new(false, default, errors);
    }

    public sealed class Vec2Def
    {
        public double X { get; init; }
        public double Y { get; init; }
    }

    public sealed class CameraDef
    {
        public Vec2Def Position { get; init; } = new();
        public double? Zoom { get; init; }
        public double? Rotation { get; init; }
    }

    /// <summary>TS EntityType 字符串联合 —— 实体合法类型标识 + 校验白名单。</summary>
    public static class EntityType
    {
        public const string Draggable = "draggable";
        public const string Slot = "slot";
        public const string Rotatable = "rotatable";
        public const string Emitter = "emitter";
        public const string Static = "static";
        public const string Animated = "animated";
        public const string Particle = "particle";
        public const string Slider = "slider";

        public static readonly IReadOnlyList<string> All = new[]
        {
            Draggable, Slot, Rotatable, Emitter, Static, Animated, Particle, Slider
        };
    }

    public sealed class EntityDef
    {
        public string Id { get; init; } = "";

        /// <summary>取值属于 EntityType.All 之一(校验保证); 类型标签本身以 string 承接。</summary>
        public string Type { get; init; } = "";

        public string Sprite { get; init; } = "";
        public Vec2Def Position { get; init; } = new();
        public double? Scale { get; init; }
        public double? Rotation { get; init; }

        /// <summary>TS Record&lt;string, unknown&gt; → Dictionary&lt;string, object?&gt;(值按 JSON 原样收成 CLR 基元/JToken)。</summary>
        public Dictionary<string, object?> Properties { get; init; } = new();

        public List<string> Tags { get; init; } = new();
    }

    public sealed class InteractionDef
    {
        public string Trigger { get; init; } = "";
        public string? Condition { get; init; }
        public string Effect { get; init; } = "";
        public string? Audio { get; init; }
        public string? Animation { get; init; }
    }

    /// <summary>
    /// TS GoalType 字符串联合(完整 13 值)。GoalEvaluator 目前只消费 AllSorted;
    /// 其余类型作为校验白名单存在(requireOneOf), 具体求解随后续批次补齐。
    /// </summary>
    public static class GoalType
    {
        public const string AllSorted = "all_sorted";
        public const string AllConnected = "all_connected";
        public const string Threshold = "threshold";
        public const string Sequence = "sequence";
        public const string Alignment = "alignment";
        public const string Assembly = "assembly";
        public const string DynamicBalance = "dynamic_balance";
        public const string AllConditionsMet = "all_conditions_met";
        public const string CausalChain = "causal_chain";
        public const string PathReverse = "path_reverse";
        public const string CreativeThreshold = "creative_threshold";
        public const string OverlapEvidenceReconstructed = "overlap_evidence_reconstructed";
        public const string Custom = "custom";

        public static readonly IReadOnlyList<string> All = new[]
        {
            AllSorted, AllConnected, Threshold, Sequence, Alignment, Assembly, DynamicBalance,
            AllConditionsMet, CausalChain, PathReverse, CreativeThreshold,
            OverlapEvidenceReconstructed, Custom
        };
    }

    /// <summary>
    /// 单个目标定义。TS 里 params 是 Record&lt;string, unknown&gt;; 本 C# 端沿用 wave1 的形态,
    /// Params 直接用 AllSortedGoalParams(定义在 GoalEvaluator.cs)供其消费 —— 校验逻辑本身走原始
    /// JToken(不依赖这里的强类型), 故该投影对 all_sorted 之外的目标是有损的(未匹配键被丢弃),
    /// 但当前单测只读 GoalDef.Type, 无碍。泛化承接其余目标类型随后续批次推进。
    /// </summary>
    public sealed class GoalDef
    {
        public string Type { get; init; } = "";
        public AllSortedGoalParams Params { get; init; } = new();
        public string? CustomScript { get; init; }
    }

    public sealed class HintDef
    {
        /// <summary>TS 里是 1 | 2 | 3; C# 以 int 承接, 取值由校验保证。</summary>
        public int Level { get; init; }
        public double Delay { get; init; }
        public string Text { get; init; } = "";
        public List<string>? Highlight { get; init; }
    }

    /// <summary>TS RepairStepType 字符串联合 —— 修复动画步骤类型标识 + 校验白名单。</summary>
    public static class RepairStepType
    {
        public const string CameraZoom = "camera_zoom";
        public const string ParticleBurst = "particle_burst";
        public const string EntityAnimate = "entity_animate";
        public const string AudioPlay = "audio_play";
        public const string ScreenFlash = "screen_flash";
        public const string TextShow = "text_show";

        // M01 修复动画(spec §5.2, 2026-06-08): 碎片漩涡状喷出 / 化为持续星光(M01RepairSequence 编排)。
        public const string FragmentsSpiralOut = "fragments_spiral_out";
        public const string Starlight = "starlight";

        public static readonly IReadOnlyList<string> All = new[]
        {
            CameraZoom, ParticleBurst, EntityAnimate, AudioPlay, ScreenFlash, TextShow,
            FragmentsSpiralOut, Starlight
        };
    }

    public sealed class RepairStepDef
    {
        public string Type { get; init; } = "";

        /// <summary>TS Record&lt;string, unknown&gt; → Dictionary&lt;string, object?&gt;。</summary>
        public Dictionary<string, object?> Params { get; init; } = new();

        public double Duration { get; init; }
        public double Delay { get; init; }
    }

    public sealed class RepairSequenceDef
    {
        public List<RepairStepDef> Steps { get; init; } = new();
    }

    /// <summary>TS PuzzleConfig.scene 是内联对象类型 —— C# 提成具名类。</summary>
    public sealed class SceneDef
    {
        public string Background { get; init; } = "";
        public string AmbientAudio { get; init; } = "";
        public CameraDef Camera { get; init; } = new();
        public List<EntityDef> Entities { get; init; } = new();
    }

    // 注: 非 sealed —— M01MemoryGearConfig(StarGuardian.M01)按 TS `extends PuzzleConfig` 继承本类;
    // 解封是承接该继承的最小改动, 不影响校验/反序列化语义(无代码依赖其 sealed)。
    public class PuzzleConfig
    {
        public string Id { get; init; } = "";
        public string Name { get; init; } = "";
        public int Stage { get; init; }
        public string CognitiveSkill { get; init; } = "";
        public string WisdomCrystal { get; init; } = "";
        public SceneDef Scene { get; init; } = new();
        public List<InteractionDef> Interactions { get; init; } = new();
        public List<GoalDef> Goals { get; init; } = new();
        public List<HintDef> Hints { get; init; } = new();
        public RepairSequenceDef Repair { get; init; } = new();
    }

    /// <summary>TS 顶层导出函数 validatePuzzleConfig 落成静态类方法(同 ToolCardFactory.Validate 样板)。</summary>
    public static class PuzzleConfigValidator
    {
        public static ValidationResult<PuzzleConfig> Validate(JToken? value)
        {
            if (value is not JObject obj)
            {
                return ValidationResult<PuzzleConfig>.Failure(new[] { "config must be an object" });
            }

            var errors = new List<string>();

            RequireNonEmptyString(obj, "id", errors);
            RequireNonEmptyString(obj, "name", errors);
            RequirePositiveInteger(obj, "stage", errors);
            RequireNonEmptyString(obj, "cognitiveSkill", errors);
            RequireNonEmptyString(obj, "wisdomCrystal", errors);

            ValidateScene(obj["scene"], errors);
            ValidateInteractions(obj["interactions"], errors);
            ValidateGoals(obj["goals"], errors);
            ValidateHints(obj["hints"], errors);
            ValidateRepair(obj["repair"], errors);

            if (errors.Count > 0)
            {
                return ValidationResult<PuzzleConfig>.Failure(errors);
            }

            // TS: `return { ok: true, value: value as unknown as PuzzleConfig }`(零成本断言, 永不抛)。
            // C# 反序列化成强类型投影; 极端数值(如 stage=2^32+1)落不进 int 字段会抛 → 折成 Failure, 保"校验器永不抛"(fable 审 risk)。
            // 已知偏离(defer 到 goal 类型波次): GoalDef.Params 定型为 AllSortedGoalParams, 非 all_sorted goal 的 params
            // 会被有损投影(real m01 config 的 overlap goal 用 baseColors/evidenceCount, 落 Type 即可, 不受影响)。
            try
            {
                var config = obj.ToObject<PuzzleConfig>() ?? new PuzzleConfig();
                return ValidationResult<PuzzleConfig>.Success(config);
            }
            catch
            {
                return ValidationResult<PuzzleConfig>.Failure(new[] { "config could not be materialized" });
            }
        }

        private static void ValidateScene(JToken? value, List<string> errors)
        {
            if (value is not JObject obj)
            {
                errors.Add("scene must be an object");
                return;
            }

            RequireNonEmptyString(obj, "background", errors, "scene.background");
            RequireNonEmptyString(obj, "ambientAudio", errors, "scene.ambientAudio");
            ValidateCamera(obj["camera"], errors);

            if (obj["entities"] is not JArray entities)
            {
                errors.Add("scene.entities must be an array");
                return;
            }

            if (entities.Count == 0)
            {
                errors.Add("scene.entities must include at least one entity");
            }

            for (var index = 0; index < entities.Count; index++)
            {
                ValidateEntity(entities[index], index, errors);
            }
        }

        private static void ValidateCamera(JToken? value, List<string> errors)
        {
            if (value is not JObject obj)
            {
                errors.Add("scene.camera must be an object");
                return;
            }

            ValidateVec2(obj["position"], "scene.camera.position", errors);
            if (IsDefined(obj["zoom"]) && !IsFiniteNumber(obj["zoom"]))
            {
                errors.Add("scene.camera.zoom must be a finite number");
            }
            if (IsDefined(obj["rotation"]) && !IsFiniteNumber(obj["rotation"]))
            {
                errors.Add("scene.camera.rotation must be a finite number");
            }
        }

        private static void ValidateEntity(JToken? value, int index, List<string> errors)
        {
            var path = $"scene.entities[{index}]";
            if (value is not JObject obj)
            {
                errors.Add($"{path} must be an object");
                return;
            }

            RequireNonEmptyString(obj, "id", errors, $"{path}.id");
            RequireOneOf(obj, "type", EntityType.All, errors, $"{path}.type");
            RequireNonEmptyString(obj, "sprite", errors, $"{path}.sprite");
            ValidateVec2(obj["position"], $"{path}.position", errors);

            if (IsDefined(obj["scale"]) && !IsFiniteNumber(obj["scale"]))
            {
                errors.Add($"{path}.scale must be a finite number");
            }
            if (IsDefined(obj["rotation"]) && !IsFiniteNumber(obj["rotation"]))
            {
                errors.Add($"{path}.rotation must be a finite number");
            }
            if (obj["properties"] is not JObject)
            {
                errors.Add($"{path}.properties must be an object");
            }
            if (!IsStringArray(obj["tags"]))
            {
                errors.Add($"{path}.tags must be an array of strings");
            }
        }

        private static void ValidateInteractions(JToken? value, List<string> errors)
        {
            if (value is not JArray array)
            {
                errors.Add("interactions must be an array");
                return;
            }

            for (var index = 0; index < array.Count; index++)
            {
                var path = $"interactions[{index}]";
                if (array[index] is not JObject interaction)
                {
                    errors.Add($"{path} must be an object");
                    continue;
                }

                RequireNonEmptyString(interaction, "trigger", errors, $"{path}.trigger");
                RequireNonEmptyString(interaction, "effect", errors, $"{path}.effect");
                RequireOptionalString(interaction, "condition", errors, $"{path}.condition");
                RequireOptionalString(interaction, "audio", errors, $"{path}.audio");
                RequireOptionalString(interaction, "animation", errors, $"{path}.animation");
            }
        }

        private static void ValidateGoals(JToken? value, List<string> errors)
        {
            if (value is not JArray array)
            {
                errors.Add("goals must be an array");
                return;
            }

            if (array.Count == 0)
            {
                errors.Add("goals must include at least one goal");
            }

            for (var index = 0; index < array.Count; index++)
            {
                var path = $"goals[{index}]";
                if (array[index] is not JObject goal)
                {
                    errors.Add($"{path} must be an object");
                    continue;
                }

                RequireOneOf(goal, "type", GoalType.All, errors, $"{path}.type");
                var type = goal["type"] is { Type: JTokenType.String } ? (string?)goal["type"] : null;
                if (goal["params"] is not JObject goalParams)
                {
                    errors.Add($"{path}.params must be an object");
                }
                else if (type == GoalType.AllSorted)
                {
                    ValidateAllSortedGoalParams(goalParams, path, errors);
                }
                else if (type == GoalType.OverlapEvidenceReconstructed)
                {
                    ValidateOverlapEvidenceGoalParams(goalParams, path, errors);
                }
                RequireOptionalString(goal, "customScript", errors, $"{path}.customScript");
            }
        }

        private static void ValidateAllSortedGoalParams(JObject goalParams, string path, List<string> errors)
        {
            if (!IsNonEmptyStringArray(goalParams["dimensions"]))
            {
                errors.Add($"{path}.params.dimensions must include at least one dimension");
            }
            if (IsDefined(goalParams["colors"]) && !IsNonEmptyStringArray(goalParams["colors"]))
            {
                errors.Add($"{path}.params.colors must be a non-empty string array");
            }
            if (IsDefined(goalParams["shapes"]) && !IsNonEmptyStringArray(goalParams["shapes"]))
            {
                errors.Add($"{path}.params.shapes must be a non-empty string array");
            }
            if (IsDefined(goalParams["expectedEntityIds"]) && !IsNonEmptyStringArray(goalParams["expectedEntityIds"]))
            {
                errors.Add($"{path}.params.expectedEntityIds must be a non-empty string array");
            }
            if (IsDefined(goalParams["entityTag"]) && !IsNonEmptyString(goalParams["entityTag"]))
            {
                errors.Add($"{path}.params.entityTag must be a non-empty string");
            }
        }

        private static void ValidateOverlapEvidenceGoalParams(JObject goalParams, string path, List<string> errors)
        {
            if (!IsJsonStringEqual(goalParams["candidateFragments"], "config_defined"))
            {
                errors.Add($"{path}.params.candidateFragments must equal \"config_defined\"");
            }
            if (!IsJsonStringEqual(goalParams["requiredFragments"], "solution_defined"))
            {
                errors.Add($"{path}.params.requiredFragments must equal \"solution_defined\"");
            }
            ValidateNumberTuple(goalParams["recommendedCandidateRange"], $"{path}.params.recommendedCandidateRange", errors);
            ValidateNumberTuple(goalParams["evidenceCount"], $"{path}.params.evidenceCount", errors);

            if (!TryGetFiniteNumber(goalParams["maxLayersPerEvidence"], out var maxLayers) || maxLayers < 1)
            {
                errors.Add($"{path}.params.maxLayersPerEvidence must be a positive finite number");
            }
            if (!TryGetFiniteNumber(goalParams["validationLightSeconds"], out var lightSeconds) || lightSeconds <= 0)
            {
                errors.Add($"{path}.params.validationLightSeconds must be a positive finite number");
            }
            if (!IsNonEmptyStringArray(goalParams["baseColors"]))
            {
                errors.Add($"{path}.params.baseColors must be a non-empty string array");
            }
            if (goalParams["blendColors"] is not JArray blendColors || blendColors.Count < 2 || !IsStringArray(blendColors))
            {
                errors.Add($"{path}.params.blendColors must contain at least two entries");
            }
        }

        private static void ValidateHints(JToken? value, List<string> errors)
        {
            if (value is not JArray array)
            {
                errors.Add("hints must be an array");
                return;
            }

            for (var index = 0; index < array.Count; index++)
            {
                var path = $"hints[{index}]";
                if (array[index] is not JObject hint)
                {
                    errors.Add($"{path} must be an object");
                    continue;
                }

                var levelOk = TryGetFiniteNumber(hint["level"], out var level)
                    && (level == 1 || level == 2 || level == 3);
                if (!levelOk)
                {
                    errors.Add($"{path}.level must be 1, 2, or 3");
                }
                if (!TryGetFiniteNumber(hint["delay"], out var delay) || delay < 0)
                {
                    errors.Add($"{path}.delay must be a non-negative number");
                }
                RequireNonEmptyString(hint, "text", errors, $"{path}.text");
                if (IsDefined(hint["highlight"]) && !IsStringArray(hint["highlight"]))
                {
                    errors.Add($"{path}.highlight must be an array of strings");
                }
            }
        }

        private static void ValidateRepair(JToken? value, List<string> errors)
        {
            if (value is not JObject obj)
            {
                errors.Add("repair must be an object");
                return;
            }

            if (obj["steps"] is not JArray steps)
            {
                errors.Add("repair.steps must be an array");
                return;
            }

            for (var index = 0; index < steps.Count; index++)
            {
                var path = $"repair.steps[{index}]";
                if (steps[index] is not JObject step)
                {
                    errors.Add($"{path} must be an object");
                    continue;
                }

                RequireOneOf(step, "type", RepairStepType.All, errors, $"{path}.type");
                if (step["params"] is not JObject)
                {
                    errors.Add($"{path}.params must be an object");
                }
                if (!TryGetFiniteNumber(step["duration"], out var duration) || duration < 0)
                {
                    errors.Add($"{path}.duration must be a non-negative number");
                }
                if (!TryGetFiniteNumber(step["delay"], out var delay) || delay < 0)
                {
                    errors.Add($"{path}.delay must be a non-negative number");
                }
            }
        }

        private static void ValidateVec2(JToken? value, string path, List<string> errors)
        {
            if (value is not JObject obj)
            {
                errors.Add($"{path} must be an object");
                return;
            }
            if (!IsFiniteNumber(obj["x"]))
            {
                errors.Add($"{path}.x must be a finite number");
            }
            if (!IsFiniteNumber(obj["y"]))
            {
                errors.Add($"{path}.y must be a finite number");
            }
        }

        private static void RequireNonEmptyString(JObject obj, string key, List<string> errors, string? path = null)
        {
            if (!IsNonEmptyString(obj[key]))
            {
                errors.Add($"{path ?? key} must be a non-empty string");
            }
        }

        private static void RequireOptionalString(JObject obj, string key, List<string> errors, string? path = null)
        {
            var token = obj[key];
            if (IsDefined(token) && token!.Type != JTokenType.String)
            {
                errors.Add($"{path ?? key} must be a string");
            }
        }

        private static void RequirePositiveInteger(JObject obj, string key, List<string> errors, string? path = null)
        {
            // TS: !Number.isInteger(x) || x < 1 —— 必须是整数值的有限数且 >= 1。
            // 用 double 比较避开裸 (long) 强转的溢出抛错(范围安全)。
            var ok = TryGetFiniteNumber(obj[key], out var number)
                && Math.Floor(number) == number
                && number >= 1;
            if (!ok)
            {
                errors.Add($"{path ?? key} must be a positive integer");
            }
        }

        private static void RequireOneOf(JObject obj, string key, IReadOnlyList<string> allowedValues, List<string> errors, string? path = null)
        {
            var token = obj[key];
            var str = token is { Type: JTokenType.String } ? (string?)token : null;
            if (str == null || !allowedValues.Contains(str))
            {
                errors.Add($"{path ?? key} must be one of: {string.Join(", ", allowedValues)}");
            }
        }

        private static void ValidateNumberTuple(JToken? value, string path, List<string> errors)
        {
            // TS: !Array.isArray || length !== 2 || !finite[0] || !finite[1] || value[0] > value[1]
            var ok = value is JArray array
                && array.Count == 2
                && TryGetFiniteNumber(array[0], out var min)
                && TryGetFiniteNumber(array[1], out var max)
                && min <= max;
            if (!ok)
            {
                errors.Add($"{path} must be a [min, max] tuple");
            }
        }

        private static bool IsDefined(JToken? token) =>
            token != null && token.Type != JTokenType.Undefined;

        // TS isFiniteNumber: typeof === "number" && Number.isFinite. JSON 数字 → Integer/Float token;
        // 排除 NaN/Infinity。范围安全: 用 Newtonsoft 的转换算子(含 BigInteger), 失败当非数处理, 不抛。
        private static bool TryGetFiniteNumber(JToken? token, out double value)
        {
            value = 0;
            if (token is not JValue jv || (jv.Type != JTokenType.Integer && jv.Type != JTokenType.Float))
            {
                return false;
            }

            double number;
            try
            {
                number = (double)jv;
            }
            catch
            {
                return false;
            }

            if (!double.IsFinite(number))
            {
                return false;
            }

            value = number;
            return true;
        }

        private static bool IsFiniteNumber(JToken? token) => TryGetFiniteNumber(token, out _);

        // TS isNonEmptyString: typeof === "string" && value.trim().length > 0
        private static bool IsNonEmptyString(JToken? token) =>
            token is { Type: JTokenType.String } && !string.IsNullOrWhiteSpace((string?)token);

        // TS isStringArray: Array.isArray && every(typeof === "string")
        private static bool IsStringArray(JToken? token) =>
            token is JArray array && array.All(item => item.Type == JTokenType.String);

        // TS isNonEmptyStringArray: Array.isArray && length > 0 && every(isNonEmptyString)
        private static bool IsNonEmptyStringArray(JToken? token) =>
            token is JArray array && array.Count > 0 && array.All(IsNonEmptyString);

        // TS `x === "literal"`: 必须是恰好等于该串的 JSON 字符串(缺失/类型不符/值不符皆 false)。
        private static bool IsJsonStringEqual(JToken? token, string expected) =>
            token is { Type: JTokenType.String } && (string?)token == expected;
    }
}
