// 从 tests/core/PuzzleConfig.test.ts 逐条迁移 —— 规则不变, 断言一一对应。
// TS 里输入是对象字面量 / 导入的 JSON; C# 用 Newtonsoft JToken 承接(合成配置走 JObject.FromObject,
// 真 config 沿目录向上找仓库根读取, 与 ToolCardTests 同一模式)。
using System.IO;
using Newtonsoft.Json.Linq;
using StarGuardian.Core;
using Xunit;

namespace StarGuardian.Core.Tests
{
    public class PuzzleConfigTests
    {
        /// <summary>TS 里的 validM01LikeConfig 对象字面量 —— 每次返回全新 JObject(便于就地改坏)。</summary>
        private static JObject ValidM01LikeConfig() => JObject.FromObject(new
        {
            id = "m01",
            name = "记忆齿轮的卡顿",
            stage = 1,
            cognitiveSkill = "分类与归纳",
            wisdomCrystal = "秩序，是为相似之物找到归处。",
            scene = new
            {
                background = "textures/stars/m01",
                ambientAudio = "audio/ambient/m01",
                camera = new
                {
                    position = new { x = 0, y = 0 },
                    zoom = 1
                },
                entities = new object[]
                {
                    new
                    {
                        id = "fragment_red_circle_1",
                        type = "draggable",
                        sprite = "textures/fragments/circle",
                        position = new { x = 12, y = 24 },
                        properties = new { color = "red", shape = "circle" },
                        tags = new[] { "fragment", "red", "circle" }
                    }
                }
            },
            interactions = new object[]
            {
                new
                {
                    trigger = "drag:filter_red -> slot:gear_slot_red",
                    effect = "highlight:tag:red | dim:tag:!red"
                }
            },
            goals = new object[]
            {
                new
                {
                    type = "all_sorted",
                    @params = new
                    {
                        dimensions = new[] { "color", "shape" },
                        colors = new[] { "red", "blue", "yellow" },
                        shapes = new[] { "circle", "triangle", "hexagon" }
                    }
                }
            },
            hints = new object[]
            {
                new { level = 1, delay = 30, text = "filter glows", highlight = new[] { "filter_red" } },
                new { level = 2, delay = 60, text = "matching fragments pulse" },
                new { level = 3, delay = 90, text = "target slot outline appears" }
            },
            repair = new
            {
                steps = new object[]
                {
                    new
                    {
                        type = "entity_animate",
                        @params = new { entityId = "memory_gear", animation = "turn" },
                        duration = 2.5,
                        delay = 0
                    }
                }
            }
        });

        [Fact(DisplayName = "accepts an M01-like data-driven puzzle config")]
        public void AcceptsAnM01LikeDataDrivenPuzzleConfig()
        {
            var result = PuzzleConfigValidator.Validate(ValidM01LikeConfig());

            Assert.True(result.Ok);
            var config = result.Value!;
            Assert.Equal("all_sorted", config.Goals[0].Type);
            Assert.Equal("red", (string?)config.Scene.Entities[0].Properties["color"]);
        }

        [Fact(DisplayName = "accepts the real M01 memory gear config")]
        public void AcceptsTheRealM01MemoryGearConfig()
        {
            var result = PuzzleConfigValidator.Validate(LoadM01Config());

            Assert.True(result.Ok);
            var config = result.Value!;
            Assert.Equal("m01", config.Id);
            Assert.Equal("overlap_evidence_reconstructed", config.Goals[0].Type);
            Assert.True(config.Scene.Entities.Count > 0);
        }

        [Fact(DisplayName = "rejects overlap-evidence goals with malformed params")]
        public void RejectsOverlapEvidenceGoalsWithMalformedParams()
        {
            var invalidConfig = LoadM01Config();
            var goalParams = (JObject)invalidConfig["goals"]![0]!["params"]!;
            goalParams["validationLightSeconds"] = 0;
            goalParams["baseColors"] = new JArray();
            goalParams["blendColors"] = new JArray("orange");
            goalParams["recommendedCandidateRange"] = new JArray(16);
            goalParams["evidenceCount"] = new JArray(4);

            var result = PuzzleConfigValidator.Validate(invalidConfig);

            Assert.False(result.Ok);
            Assert.Contains(
                "goals[0].params.validationLightSeconds must be a positive finite number",
                result.Errors);
            Assert.Contains(
                "goals[0].params.baseColors must be a non-empty string array",
                result.Errors);
            Assert.Contains(
                "goals[0].params.blendColors must contain at least two entries",
                result.Errors);
            Assert.Contains(
                "goals[0].params.recommendedCandidateRange must be a [min, max] tuple",
                result.Errors);
            Assert.Contains(
                "goals[0].params.evidenceCount must be a [min, max] tuple",
                result.Errors);
        }

        [Fact(DisplayName = "rejects configs with missing required scene data")]
        public void RejectsConfigsWithMissingRequiredSceneData()
        {
            var invalidConfig = ValidM01LikeConfig();
            ((JObject)invalidConfig["scene"]!)["entities"] = new JArray();

            var result = PuzzleConfigValidator.Validate(invalidConfig);

            Assert.False(result.Ok);
            Assert.Contains("scene.entities must include at least one entity", result.Errors);
        }

        /// <summary>沿目录向上找仓库根, 读同一份真 config(单一真源, 不复制夹具) —— 同 ToolCardTests 模式。</summary>
        private static JObject LoadM01Config()
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
