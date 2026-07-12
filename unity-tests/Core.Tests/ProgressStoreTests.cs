// 从 tests/core/ProgressStore.test.ts 逐条迁移 —— 规格不变, 断言一一对应.
using System.Collections.Generic;
using StarGuardian.Core;
using Xunit;

namespace StarGuardian.Core.Tests
{
    public class ProgressStoreTests
    {
        [Fact(DisplayName = "persists completed puzzles and unlocked cards in memory mode")]
        public void PersistsCompletedPuzzlesAndUnlockedCardsInMemoryMode()
        {
            var storage = ProgressStore.CreateMemoryStorage();
            var store = ProgressStore.CreateProgressStore(new CreateProgressStoreOptions { Storage = storage });

            store.MarkPuzzleCompleted("m01", 1000);
            store.UnlockToolCard("m01", 1000);

            var reloadedStore = ProgressStore.CreateProgressStore(new CreateProgressStoreOptions { Storage = storage });

            Assert.True(reloadedStore.IsPuzzleCompleted("m01"));
            Assert.True(reloadedStore.HasToolCard("m01"));
            Assert.Equal(1000L, reloadedStore.GetProgress().CompletedPuzzles["m01"].CompletedAt);
        }

        [Fact(DisplayName = "uses an empty in-memory store when no storage adapter is provided")]
        public void UsesEmptyInMemoryStoreWhenNoStorageAdapterIsProvided()
        {
            var store = ProgressStore.CreateProgressStore(new CreateProgressStoreOptions { Storage = null });

            Assert.False(store.IsPuzzleCompleted("m01"));

            store.MarkPuzzleCompleted("m01", 2000);

            Assert.True(store.IsPuzzleCompleted("m01"));
        }

        // ↓↓ C# 转写专属回归桩(TS 无对应)—— 钉住 fable 审发现的 number→long 语义偏离。

        [Fact(DisplayName = "单条超 long 范围的脏时间戳只跳过自己, 不清空其余存档(逐条打捞, 非整档清空)")]
        public void OutOfRangeTimestampDoesNotWipeOtherRecords()
        {
            // m01 的 completedAt 超出 long 范围(旧实现 (long) 强转抛 OverflowException → 被 catch-all 吞成整档清空);
            // m02 有效。修复后: m01 当脏数据跳过, m02 存活。
            const string key = "liuhui-star-guardian:progress:v1";
            const string dirty =
                "{\"completedPuzzles\":{\"m01\":{\"completedAt\":99999999999999999999}," +
                "\"m02\":{\"completedAt\":1000}},\"unlockedToolCards\":{}}";
            var storage = ProgressStore.CreateMemoryStorage(new Dictionary<string, string> { [key] = dirty });
            var store = ProgressStore.CreateProgressStore(new CreateProgressStoreOptions { Storage = storage });

            Assert.True(store.IsPuzzleCompleted("m02"));                                  // 有效记录存活
            Assert.Equal(1000L, store.GetProgress().CompletedPuzzles["m02"].CompletedAt);
            Assert.False(store.IsPuzzleCompleted("m01"));                                 // 脏记录跳过, 不连累整档
        }

        [Fact(DisplayName = "浮点时间戳当脏数据跳过, 不静默舍入固化")]
        public void FloatTimestampIsSkippedNotRounded()
        {
            const string key = "liuhui-star-guardian:progress:v1";
            const string dirty =
                "{\"completedPuzzles\":{\"m01\":{\"completedAt\":1000.9}," +
                "\"m02\":{\"completedAt\":2000}},\"unlockedToolCards\":{}}";
            var storage = ProgressStore.CreateMemoryStorage(new Dictionary<string, string> { [key] = dirty });
            var store = ProgressStore.CreateProgressStore(new CreateProgressStoreOptions { Storage = storage });

            Assert.False(store.IsPuzzleCompleted("m01"));   // 1000.9 浮点 → 跳过(不 →1001 固化)
            Assert.True(store.IsPuzzleCompleted("m02"));    // 整数正常
        }
    }
}
