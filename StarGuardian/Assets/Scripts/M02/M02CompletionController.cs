// M02 通关落账 —— 从 assets/scripts/cocos/M02CompletionController.ts 逐字迁移, 规则不变:
// 标记完成 + 发智慧结晶卡, 幂等(已有记录时既不重写进度也不改时间戳)。
#nullable enable

using System;
using StarGuardian.Core;

namespace StarGuardian.M02
{
    /// <summary>TS 顶层导出函数 grantM02Completion 落成静态类方法(同 M01 顶层函数迁移样板)</summary>
    public static class M02CompletionController
    {
        private const string M02PuzzleId = "m02"; // TS 行 4: const M02_PUZZLE_ID

        public static ToolCard GrantM02Completion(IProgressStore store, ToolCardDraft toolCardData, long now)
        {
            if (toolCardData.PuzzleId != M02PuzzleId)
            {
                // TS 行 12: throw new Error(`toolCardData.puzzleId must be ${M02_PUZZLE_ID}`)
                throw new InvalidOperationException($"toolCardData.puzzleId must be {M02PuzzleId}");
            }

            var progress = store.GetProgress();
            // TS 行 16-17: progress.completedPuzzles[id]?.completedAt —— 键缺失→undefined, C# 落成 long?
            // (记录存在时字段恒为数值, 见 ProgressStore.NormalizeProgress, 故"键在/键不在"与 undefined 判定一一对应)
            long? completedAt = progress.CompletedPuzzles.TryGetValue(M02PuzzleId, out var completion)
                ? completion.CompletedAt
                : (long?)null;
            long? unlockedAt = progress.UnlockedToolCards.TryGetValue(M02PuzzleId, out var unlock)
                ? unlock.UnlockedAt
                : (long?)null;

            if (completedAt != null && unlockedAt != null)
            {
                return ToolCardFactory.Create(toolCardData, unlockedAt.Value); // TS 行 19-21
            }

            var timestamp = completedAt ?? unlockedAt ?? now; // TS 行 23
            if (completedAt == null) store.MarkPuzzleCompleted(M02PuzzleId, timestamp); // TS 行 24

            var card = ToolCardFactory.Create(toolCardData, timestamp); // TS 行 26
            if (unlockedAt == null) store.UnlockToolCard(card); // TS 行 27
            return card;
        }
    }
}
