// 从 tests/cocos/M02CompletionController.test.ts 逐条迁移 —— 断言一一对应.
// 真实配置 assets/resources/configs/stage1/m02-starweb-warmth.json 由向上查根加载(同 StarWebConfigTests 模式).
using System;
using System.IO;
using Newtonsoft.Json.Linq;
using StarGuardian.Core;
using Xunit;

namespace StarGuardian.M02.Tests
{
    public class M02CompletionControllerTests
    {
        private static readonly JObject ConfigJson = LoadConfigJson();

        private static JObject LoadConfigJson()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            var rel = Path.Combine("assets", "resources", "configs", "stage1", "m02-starweb-warmth.json");
            while (dir != null && !File.Exists(Path.Combine(dir.FullName, rel)))
            {
                dir = dir.Parent;
            }
            if (dir == null) throw new FileNotFoundException($"repo root with {rel} not found");
            return (JObject)JToken.Parse(File.ReadAllText(Path.Combine(dir.FullName, rel)));
        }

        private static StarWebConfig LoadConfig()
        {
            var result = StarWebConfigValidator.Validate(ConfigJson);
            if (!result.Ok) throw new InvalidOperationException("config invalid: " + string.Join(", ", result.Errors));
            return result.Value!;
        }

        private static IProgressStore MakeStore() =>
            ProgressStore.CreateProgressStore(new CreateProgressStoreOptions { Storage = ProgressStore.CreateMemoryStorage() });

        [Fact(DisplayName = "marks M02 complete, unlocks its tool card, and is idempotent")]
        public void MarksCompleteUnlocksCardIdempotently()
        {
            var store = MakeStore();
            var cfg = LoadConfig();

            var firstCard = M02CompletionController.GrantM02Completion(store, cfg.ToolCard, 1000);
            var secondCard = M02CompletionController.GrantM02Completion(store, cfg.ToolCard, 9999);
            var progress = store.GetProgress();

            Assert.True(store.IsPuzzleCompleted("m02"));
            Assert.True(store.HasToolCard("m02"));
            Assert.Equal(1000, firstCard.UnlockedAt);
            Assert.Equal(1000, secondCard.UnlockedAt);
            Assert.Equal(1000, progress.CompletedPuzzles["m02"].CompletedAt);
            Assert.Equal(1000, progress.UnlockedToolCards["m02"].UnlockedAt);
        }

        [Fact(DisplayName = "rejects tool cards from another puzzle before writing progress")]
        public void RejectsWrongPuzzleCardBeforeWritingProgress()
        {
            var store = MakeStore();
            var cfg = LoadConfig();
            // TS: structuredClone(cfg.toolCard) 后改 puzzleId —— C# init-only 属性无法就地改,
            // 复制字段构造新草稿(front/back 未被本测试改动, 共享引用行为等价)
            var wrongCard = new ToolCardDraft
            {
                PuzzleId = "m99",
                Stage = cfg.ToolCard.Stage,
                Front = cfg.ToolCard.Front,
                Back = cfg.ToolCard.Back
            };

            var ex = Assert.Throws<InvalidOperationException>(
                () => M02CompletionController.GrantM02Completion(store, wrongCard, 1000));
            Assert.Equal("toolCardData.puzzleId must be m02", ex.Message); // TS toThrow 为包含匹配, 此处消息全等更严
            var progress = store.GetProgress();
            Assert.Empty(progress.CompletedPuzzles); // TS: toEqual({ completedPuzzles: {}, unlockedToolCards: {} })
            Assert.Empty(progress.UnlockedToolCards);
        }
    }
}
