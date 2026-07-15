// 工具卡解锁预览的纯文案装配 —— 引擎无关, 从 assets/scripts/ui/ToolCardView.ts 逐字迁移, 规则不变.
// M02StarWebView 完成面板消费(SWV:345-350); 这些 .cs 不得 using UnityEngine.
#nullable enable

using System;
using System.Collections.Generic;
using StarGuardian.Core;

namespace StarGuardian.UI
{
    public sealed class ToolCardPreview
    {
        public string Title { get; init; } = "";
        public string Subtitle { get; init; } = "";
        /// <summary>智慧结晶(= Lines[0]); 具名字段以免消费方按下标耦合 Lines 顺序</summary>
        public string Crystal { get; init; } = "";
        /// <summary>核心动作(= Lines[1])</summary>
        public string CoreAction { get; init; } = "";
        /// <summary>何时使用(= Lines[2])</summary>
        public string WhenToUse { get; init; } = "";
        /// <summary>完整行数组, 保留供需要逐行渲染的场景与既有测试; 顺序见上方具名字段注释</summary>
        public IReadOnlyList<string> Lines { get; init; } = Array.Empty<string>();
    }

    /// <summary>TS ToolCardPreviewText —— 两条可见文案; TS Partial 的"字段可缺省"落成可空属性(null=用默认)。</summary>
    public sealed class ToolCardPreviewText
    {
        public string? UnlockedSubtitle { get; init; }
        public string? WhenToUsePrefix { get; init; }
    }

    public sealed class ToolCardPreviewOptions
    {
        public ToolCardPreviewText? Text { get; init; }
    }

    /// <summary>TS 顶层导出函数 buildToolCardPreview 落成静态类方法(同 M01 顶层函数迁移样板)。</summary>
    public static class ToolCardPreviewBuilder
    {
        // TS defaultToolCardPreviewText
        public const string DefaultUnlockedSubtitle = "认知工具卡已解锁";
        public const string DefaultWhenToUsePrefix = "何时使用：{value}";

        public static ToolCardPreview Build(ToolCard card, ToolCardPreviewOptions? options = null)
        {
            // TS: { ...default, ...options.text } —— 逐字段"有则覆盖"
            var subtitle = options?.Text?.UnlockedSubtitle ?? DefaultUnlockedSubtitle;
            var whenToUsePrefix = options?.Text?.WhenToUsePrefix ?? DefaultWhenToUsePrefix;

            var lines = new List<string>
            {
                card.Front.WisdomCrystal,
                card.Back.CoreAction,
                // TS: card.back.whenToUse[0] ?? "" —— 空数组回退空串
                whenToUsePrefix.Replace("{value}", card.Back.WhenToUse.Count > 0 ? card.Back.WhenToUse[0] : "")
            };

            return new ToolCardPreview
            {
                Title = card.Front.ToolName,
                Subtitle = subtitle,
                Crystal = lines[0],
                CoreAction = lines[1],
                WhenToUse = lines[2],
                Lines = lines
            };
        }
    }
}
