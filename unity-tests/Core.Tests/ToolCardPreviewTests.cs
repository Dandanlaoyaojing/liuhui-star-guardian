// 从 tests/ui/ToolCardView.test.ts 逐条迁移 —— 断言一一对应, 文案字面值逐字保留.
// 真实配置 assets/resources/configs/stage1/m01-memory-gear.json 由向上查根加载(同 M02StarWebSessionTests 模式).
using System;
using System.IO;
using Newtonsoft.Json.Linq;
using StarGuardian.Core;
using StarGuardian.UI;
using Xunit;

namespace StarGuardian.UI.Tests
{
    public class ToolCardPreviewTests
    {
        private static ToolCard LoadM01Card()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            var rel = Path.Combine("assets", "resources", "configs", "stage1", "m01-memory-gear.json");
            while (dir != null && !File.Exists(Path.Combine(dir.FullName, rel)))
            {
                dir = dir.Parent;
            }
            if (dir == null) throw new FileNotFoundException($"repo root with {rel} not found");
            var json = (JObject)JToken.Parse(File.ReadAllText(Path.Combine(dir.FullName, rel)));
            var draft = json["toolCard"]!.ToObject<ToolCardDraft>()!;
            return ToolCardFactory.Create(draft, 12345); // TS: { ...toolCard, unlockedAt: 12345 }
        }

        [Fact]
        public void Builds_a_compact_m01_unlock_preview_with_tool_name_and_wisdom_crystal()
        {
            var preview = ToolCardPreviewBuilder.Build(LoadM01Card());

            Assert.Equal("分类与归纳", preview.Title);
            Assert.Equal("认知工具卡已解锁", preview.Subtitle);
            Assert.Equal(new[]
            {
                "秩序，不在碎片本身，而在它们终于显现的关系里。",
                "从局部证据中找出能彼此成立的关系，再把相关碎片归成结构。",
                "何时使用：面对一堆线索却不知道哪些真正相关时"
            }, preview.Lines);
            // 具名字段: 锁的是"哪个语义", 不依赖 Lines 顺序
            Assert.Contains("秩序", preview.Crystal);
            Assert.Contains("局部证据", preview.CoreAction);
            Assert.Contains("何时使用", preview.WhenToUse);
        }

        [Fact]
        public void Allows_visible_preview_copy_to_be_replaced_for_localization()
        {
            var preview = ToolCardPreviewBuilder.Build(LoadM01Card(), new ToolCardPreviewOptions
            {
                Text = new ToolCardPreviewText
                {
                    UnlockedSubtitle = "UNLOCKED",
                    WhenToUsePrefix = "USE: {value}"
                }
            });

            Assert.Equal("UNLOCKED", preview.Subtitle);
            Assert.Equal("USE: 面对一堆线索却不知道哪些真正相关时", preview.Lines[2]);
            Assert.Equal("USE: 面对一堆线索却不知道哪些真正相关时", preview.WhenToUse);
        }
    }
}
