// 智慧结晶卡数据模型 + 校验 —— 从 assets/scripts/core/ToolCard.ts 迁移, 规则不变.
// validateToolCard 的输入是"未知形状的 JSON"(TS unknown) → C# 用 Newtonsoft JToken 承接
// (Unity 官方包 com.unity.nuget.newtonsoft-json / dotnet 测试侧 NuGet, 两边同一库).

using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace StarGuardian.Core
{
    public sealed class ToolCardFront
    {
        public string ToolName { get; init; } = "";
        public string Scene { get; init; } = "";
        public string WisdomCrystal { get; init; } = "";
    }

    public sealed class ToolCardBack
    {
        public string CoreAction { get; init; } = "";
        public IReadOnlyList<string> WhenToUse { get; init; } = Array.Empty<string>();
        public IReadOnlyList<string> RealLifeExamples { get; init; } = Array.Empty<string>();
        public string CommonTraps { get; init; } = "";
    }

    /// <summary>无 UnlockedAt 的草稿(config 里的形态) —— TS 的 ToolCardDraft</summary>
    public sealed class ToolCardDraft
    {
        public string PuzzleId { get; init; } = "";
        public int Stage { get; init; }
        public ToolCardFront Front { get; init; } = new();
        public ToolCardBack Back { get; init; } = new();
    }

    public sealed class ToolCard
    {
        public string PuzzleId { get; init; } = "";
        public int Stage { get; init; }
        public ToolCardFront Front { get; init; } = new();
        public ToolCardBack Back { get; init; } = new();
        public long UnlockedAt { get; init; }
    }

    public sealed class ToolCardValidationResult
    {
        public bool Ok { get; }
        public IReadOnlyList<string> Errors { get; }

        private ToolCardValidationResult(bool ok, IReadOnlyList<string> errors)
        {
            Ok = ok;
            Errors = errors;
        }

        public static ToolCardValidationResult Success() =>
            new(true, Array.Empty<string>());

        public static ToolCardValidationResult Failure(IReadOnlyList<string> errors) =>
            new(false, errors);
    }

    public static class ToolCardFactory
    {
        /// <summary>从草稿造卡(拷贝数组, 不共享引用) —— TS createToolCard</summary>
        public static ToolCard Create(ToolCardDraft draft, long unlockedAt)
        {
            return new ToolCard
            {
                PuzzleId = draft.PuzzleId,
                Stage = draft.Stage,
                Front = new ToolCardFront
                {
                    ToolName = draft.Front.ToolName,
                    Scene = draft.Front.Scene,
                    WisdomCrystal = draft.Front.WisdomCrystal
                },
                Back = new ToolCardBack
                {
                    CoreAction = draft.Back.CoreAction,
                    WhenToUse = draft.Back.WhenToUse.ToList(),
                    RealLifeExamples = draft.Back.RealLifeExamples.ToList(),
                    CommonTraps = draft.Back.CommonTraps
                },
                UnlockedAt = unlockedAt
            };
        }

        /// <summary>校验未知 JSON 是否为合法 ToolCard —— TS validateToolCard, 错误文案逐字保持</summary>
        public static ToolCardValidationResult Validate(JToken? value)
        {
            var errors = new List<string>();

            if (value is not JObject obj)
            {
                return ToolCardValidationResult.Failure(new[] { "tool card must be an object" });
            }

            RequireNonEmptyString(obj, "puzzleId", errors);
            var stage = obj["stage"];
            if (stage is not { Type: JTokenType.Integer } || (long)stage! < 1 || (long)stage! > 5)
            {
                errors.Add("stage must be an integer from 1 to 5");
            }

            ValidateFront(obj["front"], errors);
            ValidateBack(obj["back"], errors);

            var unlockedAt = obj["unlockedAt"];
            var isFiniteNumber =
                unlockedAt is { Type: JTokenType.Integer } ||
                (unlockedAt is { Type: JTokenType.Float } && double.IsFinite((double)unlockedAt!));
            if (!isFiniteNumber)
            {
                errors.Add("unlockedAt must be a finite number");
            }

            return errors.Count > 0
                ? ToolCardValidationResult.Failure(errors)
                : ToolCardValidationResult.Success();
        }

        /// <summary>校验已构造的卡(常用捷径: 序列化后走同一套 JSON 校验, 单一真源)</summary>
        public static ToolCardValidationResult Validate(ToolCard card) =>
            Validate(JToken.FromObject(new
            {
                puzzleId = card.PuzzleId,
                stage = card.Stage,
                front = new
                {
                    toolName = card.Front.ToolName,
                    scene = card.Front.Scene,
                    wisdomCrystal = card.Front.WisdomCrystal
                },
                back = new
                {
                    coreAction = card.Back.CoreAction,
                    whenToUse = card.Back.WhenToUse,
                    realLifeExamples = card.Back.RealLifeExamples,
                    commonTraps = card.Back.CommonTraps
                },
                unlockedAt = card.UnlockedAt
            }));

        private static void ValidateFront(JToken? value, List<string> errors)
        {
            if (value is not JObject obj)
            {
                errors.Add("front must be an object");
                return;
            }

            RequireNonEmptyString(obj, "toolName", errors, "front.toolName");
            RequireNonEmptyString(obj, "scene", errors, "front.scene");
            RequireNonEmptyString(obj, "wisdomCrystal", errors, "front.wisdomCrystal");
        }

        private static void ValidateBack(JToken? value, List<string> errors)
        {
            if (value is not JObject obj)
            {
                errors.Add("back must be an object");
                return;
            }

            RequireNonEmptyString(obj, "coreAction", errors, "back.coreAction");
            RequireNonEmptyStringArray(obj, "whenToUse", errors, "back.whenToUse");
            RequireNonEmptyStringArray(obj, "realLifeExamples", errors, "back.realLifeExamples");
            RequireNonEmptyString(obj, "commonTraps", errors, "back.commonTraps");
        }

        private static void RequireNonEmptyString(JObject obj, string key, List<string> errors, string? path = null)
        {
            var token = obj[key];
            if (token is not { Type: JTokenType.String } || string.IsNullOrWhiteSpace((string?)token))
            {
                errors.Add($"{path ?? key} must be a non-empty string");
            }
        }

        private static void RequireNonEmptyStringArray(JObject obj, string key, List<string> errors, string path)
        {
            if (obj[key] is not JArray array || array.Count == 0)
            {
                errors.Add($"{path} must include at least one entry");
                return;
            }

            var allNonEmptyStrings = array.All(item =>
                item.Type == JTokenType.String && !string.IsNullOrWhiteSpace((string?)item));
            if (!allNonEmptyStrings)
            {
                errors.Add($"{path} must contain only non-empty strings");
            }
        }
    }
}
