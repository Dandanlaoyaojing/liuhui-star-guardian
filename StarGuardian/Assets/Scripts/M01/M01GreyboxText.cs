// M01 灰盒关卡的文案表 + 模板格式化 —— 引擎无关纯逻辑, 同时活在 dotnet test 与 Unity Assets 里.
// 从 assets/scripts/cocos/M01GreyboxText.ts 迁移, 文案逐字保持(含 {placeholder}/中文标点/省略号).
// 这些 .cs 不得 using UnityEngine。
//
// TS→C# 语义映射:
//   - export const m01GreyboxDefaultText (对象字面量) → static class 上的 const string 逐条(PascalCase 名, 中文值逐字)
//     + Defaults 查找表(键为原 camelCase 字段名, 供按键取模板)。两者同一真源: Defaults 引用各 const。
//   - type M01GreyboxTextKey = keyof typeof ... (字符串字面量联合) → 纯 string 键(不建 enum);
//     合法键即 Defaults 的键集。传入非法键时 Defaults[key] 抛 KeyNotFoundException,
//     对应 TS 对 undefined 调 .replace 的运行期 TypeError。
//   - type M01GreyboxTextOverrides = Partial<Record<key,string>> → IReadOnlyDictionary<string,string>?(可空, 缺省视为空)。
//   - params: Record<string, string | number> → IReadOnlyDictionary<string, object>?(string|number → object; 可空视为空)。
//   - 模板替换正则 /\{([a-zA-Z0-9_]+)\}/g → 同义 Regex; 命中键在 params 中缺失(TS 的 === undefined)则原样保留 {token}。
//   - String(value): 字符串原样; 数值用 InvariantCulture 格式化(避免本地化逗号小数点), 语义同 JS Number→string。
//   - overrides[key] ?? default: 用 TryGetValue —— override 存在的键其值必为非空 string(Partial 类型保证), 故命中即用, 同 ??。
//   - keyByColor / keyByShape (color/shape → key 的查表, 未命中回落原值) → 私有静态字典 + TryGetValue。

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text.RegularExpressions;

namespace StarGuardian.M01
{
    /// <summary>
    /// M01GreyboxText.ts 的文案默认表 + 三个导出函数
    /// (formatM01GreyboxText / formatM01ColorLabel / formatM01ShapeLabel)汇成静态类。
    /// 方法名去掉冗余的 M01Greybox 前缀(类名已含), 语义一一对应。
    /// </summary>
    public static class M01GreyboxText
    {
        public const string InitialInstruction = "M01 灰盒：用三色手电观察灰白碎片，再按局部交叠证据拼出成立的关系。";
        public const string PhysicsSettling = "碎片正在落下...";
        public const string LoadFailed = "M01 配置载入失败：{reason}";
        public const string NotInitialized = "M01 尚未初始化。";
        public const string UnknownFilter = "未知光源：{filterId}";
        public const string FilterActivated = "已启用 {color} 光源。请观察候选碎片。";
        public const string UnknownFragment = "未知碎片：{fragmentId}";
        public const string InactiveFragment = "碎片 {fragmentId} 暂时不适合当前线索。";
        public const string FragmentSelected = "已选择 {color} {shape}。寻找能与它形成证据关系的位置。";
        public const string SelectFragmentFirst = "请先选择或拾起一个碎片。";
        public const string PlaceRejected = "无法放置 {fragmentId}：{reason}";
        public const string SortedCount = "已暂存 {sortedCount} 个碎片关系。";
        public const string RepairCompleted = "M01 已修复，认知工具卡已解锁。";
        public const string ToolCardUnlockedSubtitle = "认知工具卡已解锁";
        public const string ToolCardWhenToUsePrefix = "何时使用：{value}";
        public const string HintButton = "提示";
        public const string HintNoFilter = "先选择一种手电光，观察灰白碎片在光下的反应。";
        public const string HintActiveFilter = "现在从候选碎片里找形状线索，别只看单个特征。";
        public const string HintSelectedFragment = "找能和这片碎片形成局部交叠证据的关系位置。";
        public const string CorrectPlacementFeedback = "这组关系成立。";
        public const string WrongPlacementFeedback = "这里的关系不成立，换一个能同时对上局部形状和颜色推理的位置。";
        public const string NoSelectionFeedback = "先拾起一个候选碎片。";
        public const string FlashlightSelected = "已选择 {color} 光手电。";
        public const string FlashlightCleared = "手电已熄灭，碎片恢复灰白。";
        public const string FragmentRevealed = "碎片 {fragmentId} 在当前光下显现为 {color}。";
        public const string FragmentPickedUp = "已拾起碎片 {fragmentId}。";
        public const string FragmentPlacedFreely = "已把碎片 {fragmentId} 放在工作区。";
        public const string WeakSnapHint = "碎片 {fragmentId} 已贴近证据 {evidenceId}。";
        public const string RotateToFitHint = "形状对上了，但方向没对准——把这片再转一下试试。";
        public const string CandidateStructureReady = "候选结构已摆好，等待底光验证。";
        public const string ValidationLightFlash = "底光闪烁后熄灭，结构还不对。";
        public const string ValidationLightSteady = "底光保持亮起，结构成立。";
        public const string EvidenceCompleted = "证据 {evidenceId} 已暂存。";
        public const string EvidenceRejected = "证据 {evidenceId} 不匹配。";
        public const string ColorRed = "红";
        public const string ColorBlue = "蓝";
        public const string ColorYellow = "黄";
        public const string ShapeCircle = "圆";
        public const string ShapeTriangle = "三角";
        public const string ShapeHexagon = "六边";
        public const string FilterLabel = "{color}光源";
        public const string TokenLabel = "{color} {shape}";

        /// <summary>
        /// 默认文案查找表 —— 键为 TS 原 camelCase 字段名(即 M01GreyboxTextKey 的成员), 值引用上方 const。
        /// 声明顺序 = TS 插入顺序(仅供可读性; Format 只按键取值, 不消费枚举顺序)。
        /// </summary>
        public static readonly IReadOnlyDictionary<string, string> Defaults =
            new Dictionary<string, string>
            {
                ["initialInstruction"] = InitialInstruction,
                ["physicsSettling"] = PhysicsSettling,
                ["loadFailed"] = LoadFailed,
                ["notInitialized"] = NotInitialized,
                ["unknownFilter"] = UnknownFilter,
                ["filterActivated"] = FilterActivated,
                ["unknownFragment"] = UnknownFragment,
                ["inactiveFragment"] = InactiveFragment,
                ["fragmentSelected"] = FragmentSelected,
                ["selectFragmentFirst"] = SelectFragmentFirst,
                ["placeRejected"] = PlaceRejected,
                ["sortedCount"] = SortedCount,
                ["repairCompleted"] = RepairCompleted,
                ["toolCardUnlockedSubtitle"] = ToolCardUnlockedSubtitle,
                ["toolCardWhenToUsePrefix"] = ToolCardWhenToUsePrefix,
                ["hintButton"] = HintButton,
                ["hintNoFilter"] = HintNoFilter,
                ["hintActiveFilter"] = HintActiveFilter,
                ["hintSelectedFragment"] = HintSelectedFragment,
                ["correctPlacementFeedback"] = CorrectPlacementFeedback,
                ["wrongPlacementFeedback"] = WrongPlacementFeedback,
                ["noSelectionFeedback"] = NoSelectionFeedback,
                ["flashlightSelected"] = FlashlightSelected,
                ["flashlightCleared"] = FlashlightCleared,
                ["fragmentRevealed"] = FragmentRevealed,
                ["fragmentPickedUp"] = FragmentPickedUp,
                ["fragmentPlacedFreely"] = FragmentPlacedFreely,
                ["weakSnapHint"] = WeakSnapHint,
                ["rotateToFitHint"] = RotateToFitHint,
                ["candidateStructureReady"] = CandidateStructureReady,
                ["validationLightFlash"] = ValidationLightFlash,
                ["validationLightSteady"] = ValidationLightSteady,
                ["evidenceCompleted"] = EvidenceCompleted,
                ["evidenceRejected"] = EvidenceRejected,
                ["colorRed"] = ColorRed,
                ["colorBlue"] = ColorBlue,
                ["colorYellow"] = ColorYellow,
                ["shapeCircle"] = ShapeCircle,
                ["shapeTriangle"] = ShapeTriangle,
                ["shapeHexagon"] = ShapeHexagon,
                ["filterLabel"] = FilterLabel,
                ["tokenLabel"] = TokenLabel
            };

        // TS /\{([a-zA-Z0-9_]+)\}/g —— 匹配 {token}。
        private static readonly Regex PlaceholderPattern =
            new Regex(@"\{([a-zA-Z0-9_]+)\}", RegexOptions.Compiled);

        // keyByColor —— color → 文案键; 未命中回落原 color。
        private static readonly IReadOnlyDictionary<string, string> KeyByColor =
            new Dictionary<string, string>
            {
                ["red"] = "colorRed",
                ["blue"] = "colorBlue",
                ["yellow"] = "colorYellow"
            };

        // keyByShape —— shape → 文案键; 未命中回落原 shape。
        private static readonly IReadOnlyDictionary<string, string> KeyByShape =
            new Dictionary<string, string>
            {
                ["circle"] = "shapeCircle",
                ["triangle"] = "shapeTriangle",
                ["hexagon"] = "shapeHexagon"
            };

        /// <summary>
        /// 按键取模板(overrides 优先, 否则默认表), 再把 {token} 用 params 值替换; 缺失的 token 原样保留。
        /// —— TS formatM01GreyboxText
        /// </summary>
        public static string Format(
            string key,
            IReadOnlyDictionary<string, object>? parameters = null,
            IReadOnlyDictionary<string, string>? overrides = null)
        {
            var template = overrides != null && overrides.TryGetValue(key, out var overrideTemplate)
                ? overrideTemplate
                : Defaults[key];

            return PlaceholderPattern.Replace(template, match =>
            {
                var paramKey = match.Groups[1].Value;
                if (parameters != null && parameters.TryGetValue(paramKey, out var value))
                {
                    return Stringify(value);
                }

                return match.Value;
            });
        }

        /// <summary>color → 文案标签(red/blue/yellow), 未知色原样返回 —— TS formatM01ColorLabel</summary>
        public static string FormatColorLabel(
            string color,
            IReadOnlyDictionary<string, string>? overrides = null)
        {
            return KeyByColor.TryGetValue(color, out var key)
                ? Format(key, null, overrides)
                : color;
        }

        /// <summary>shape → 文案标签(circle/triangle/hexagon), 未知形状原样返回 —— TS formatM01ShapeLabel</summary>
        public static string FormatShapeLabel(
            string shape,
            IReadOnlyDictionary<string, string>? overrides = null)
        {
            return KeyByShape.TryGetValue(shape, out var key)
                ? Format(key, null, overrides)
                : shape;
        }

        // JS String(string|number): 字符串原样; 数值用 InvariantCulture(与 JS Number→string 一致的点小数、无千分位)。
        private static string Stringify(object? value)
        {
            if (value is string text)
            {
                return text;
            }
            if (value is IFormattable formattable)
            {
                return formattable.ToString(null, CultureInfo.InvariantCulture);
            }

            return value?.ToString() ?? string.Empty;
        }
    }
}
