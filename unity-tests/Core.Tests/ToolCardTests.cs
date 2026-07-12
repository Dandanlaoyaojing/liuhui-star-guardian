// 从 tests/core/ToolCard.test.ts 逐条迁移 —— 含加载真实 m01 config JSON 的对齐测试.
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json.Linq;
using StarGuardian.Core;
using Xunit;

namespace StarGuardian.Core.Tests
{
    public class ToolCardTests
    {
        private static ToolCardDraft M01Draft => new()
        {
            PuzzleId = "m01",
            Stage = 1,
            Front = new ToolCardFront
            {
                ToolName = "分类与归纳",
                Scene = "textures/tools/m01-card",
                WisdomCrystal = "秩序，不在碎片本身，而在它们终于显现的关系里。"
            },
            Back = new ToolCardBack
            {
                CoreAction = "从局部证据中找出能彼此成立的关系，再把相关碎片归成结构。",
                WhenToUse = new[]
                {
                    "面对一堆线索却不知道哪些真正相关时",
                    "需要从局部证据复原整体结构时",
                    "整理材料时发现单个标签不足以分类时"
                },
                RealLifeExamples = new[]
                {
                    "做访谈分析时，把彼此能解释的片段归成同一主题",
                    "整理创作素材时，先找能互相呼应的片段，而不是按表面颜色分堆"
                },
                CommonTraps = "只看单个碎片的表面特征，忽略它和其他碎片放在一起时才显现的关系。"
            }
        };

        [Fact(DisplayName = "creates a valid M01-like ToolCard with completion metadata")]
        public void Create_ValidM01Card_WithMetadata()
        {
            var card = ToolCardFactory.Create(M01Draft, 12345);

            Assert.Equal(12345, card.UnlockedAt);
            Assert.Equal("分类与归纳", card.Front.ToolName);
            Assert.True(ToolCardFactory.Validate(card).Ok);
        }

        [Fact(DisplayName = "rejects cards without useful back-side content")]
        public void Validate_EmptyWhenToUse_Fails()
        {
            var draft = new ToolCardDraft
            {
                PuzzleId = M01Draft.PuzzleId,
                Stage = M01Draft.Stage,
                Front = M01Draft.Front,
                Back = new ToolCardBack
                {
                    CoreAction = M01Draft.Back.CoreAction,
                    WhenToUse = new string[0],
                    RealLifeExamples = M01Draft.Back.RealLifeExamples,
                    CommonTraps = M01Draft.Back.CommonTraps
                }
            };
            var card = ToolCardFactory.Create(draft, 12345);

            var result = ToolCardFactory.Validate(card);

            Assert.False(result.Ok);
            Assert.Contains("back.whenToUse must include at least one entry", result.Errors);
        }

        [Fact(DisplayName = "keeps the real M01 ToolCard aligned with overlap-evidence relation sorting")]
        public void RealM01Config_ToolCardStaysAligned()
        {
            var config = LoadM01Config();
            var wisdomCrystal = (string?)config["wisdomCrystal"];
            var toolCard = (JObject?)config["toolCard"];
            Assert.NotNull(toolCard);

            Assert.Equal("秩序，不在碎片本身，而在它们终于显现的关系里。", wisdomCrystal);
            Assert.Equal(wisdomCrystal, (string?)toolCard!["front"]?["wisdomCrystal"]);
            Assert.Equal(
                "从局部证据中找出能彼此成立的关系，再把相关碎片归成结构。",
                (string?)toolCard["back"]?["coreAction"]);
            Assert.Equal(
                new[]
                {
                    "面对一堆线索却不知道哪些真正相关时",
                    "需要从局部证据复原整体结构时",
                    "整理材料时发现单个标签不足以分类时"
                },
                toolCard["back"]!["whenToUse"]!.ToObject<string[]>());
            Assert.Equal(
                new[]
                {
                    "做访谈分析时，把彼此能解释的片段归成同一主题",
                    "整理创作素材时，先找能互相呼应的片段，而不是按表面颜色分堆"
                },
                toolCard["back"]!["realLifeExamples"]!.ToObject<string[]>());
            Assert.Equal(
                "只看单个碎片的表面特征，忽略它和其他碎片放在一起时才显现的关系。",
                (string?)toolCard["back"]?["commonTraps"]);

            // 真 config 草稿 → 造卡 → 校验通过(与 TS 测试同断言)
            var draft = new ToolCardDraft
            {
                PuzzleId = (string?)toolCard["puzzleId"] ?? "",
                Stage = (int?)toolCard["stage"] ?? 0,
                Front = new ToolCardFront
                {
                    ToolName = (string?)toolCard["front"]?["toolName"] ?? "",
                    Scene = (string?)toolCard["front"]?["scene"] ?? "",
                    WisdomCrystal = (string?)toolCard["front"]?["wisdomCrystal"] ?? ""
                },
                Back = new ToolCardBack
                {
                    CoreAction = (string?)toolCard["back"]?["coreAction"] ?? "",
                    WhenToUse = toolCard["back"]!["whenToUse"]!.ToObject<List<string>>()!,
                    RealLifeExamples = toolCard["back"]!["realLifeExamples"]!.ToObject<List<string>>()!,
                    CommonTraps = (string?)toolCard["back"]?["commonTraps"] ?? ""
                }
            };
            var card = ToolCardFactory.Create(draft, 12345);

            Assert.True(ToolCardFactory.Validate(card).Ok);
        }

        /// <summary>沿目录向上找仓库根, 读同一份真 config(单一真源, 不复制夹具)</summary>
        internal static JObject LoadM01Config()
        {
            var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
            while (dir != null && !File.Exists(Path.Combine(dir.FullName, "assets", "resources", "configs", "stage1", "m01-memory-gear.json")))
            {
                dir = dir.Parent;
            }
            Assert.NotNull(dir);
            var path = Path.Combine(dir!.FullName, "assets", "resources", "configs", "stage1", "m01-memory-gear.json");
            return JObject.Parse(File.ReadAllText(path));
        }
    }
}
