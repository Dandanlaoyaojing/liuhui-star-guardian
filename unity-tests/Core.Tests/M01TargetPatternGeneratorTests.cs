// 从 tests/cocos/M01TargetPatternGenerator.test.ts 迁移 —— 规则不变, 断言一一对应。
//
// vitest 原有 3 条; 本波仅转写第 1 条(deriveM01TargetEvidenceFromPlacements)。另 2 条:
//   · "uses generated overlap outlines as the magnetic hit contour"
//   · "derives locked evidence from the current targetPattern pieces instead of stale config evidence"
// 都依赖 buildM01GreyboxLayout(M01GreyboxLayout)与 resolveM01GreyboxDrop(M01GreyboxDrag) —— 这两个下游
// 模块尚未转写为 C#(M01/ 下不存在)。第 3 条更含一条 `layout.evidence.map(...)` 断言与布局强耦合, 依「断言
// 一一对应不增不减」不做残缺转写(不静默丢断言)。→ 待 M01GreyboxLayout/M01GreyboxDrag 落地后, 与本文件一并补齐这 2 条。
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01TargetPatternGeneratorTests
    {
        /// <summary>沿目录向上找仓库根读同一份真 config, 反序列化成 M01MemoryGearConfig —— 同 PuzzleConfigTests/ToolCardTests 模式。</summary>
        private static readonly M01MemoryGearConfig Config = LoadConfig();

        [Fact(DisplayName = "turns standard-piece intersections into overlap evidence targets")]
        public void TurnsStandardPieceIntersectionsIntoOverlapEvidenceTargets()
        {
            var placements = new List<M01ManualTargetPiecePlacement>
            {
                new() { FragmentId = "fragment_circle_red_2", Position = new(0, 0) },
                new() { FragmentId = "fragment_circle_blue_1", Position = new(24, 0) },
                new() { FragmentId = "fragment_triangle_red_1", Position = new(0, -100) }
            };

            var evidence = M01TargetPatternGenerator.DeriveTargetEvidenceFromPlacements(Config, placements);

            // expect(evidence).toHaveLength(1)
            Assert.Single(evidence);

            // expect(evidence[0]).toMatchObject({ id, targetShape, targetBlendColor, shapeTags,
            //   generatedOverlap: { sourceShapes, offset }, solution: { fragmentIds } })
            var first = evidence[0];
            Assert.Equal("target_overlap_purple_circle_circle_1", first.Id);
            Assert.Equal("generated_overlap", first.TargetShape);
            Assert.Equal("purple", first.TargetBlendColor);
            Assert.Equal(new[] { "shape:circle", "shape:circle" }, first.ShapeTags);
            Assert.NotNull(first.GeneratedOverlap);
            var generatedOverlap = first.GeneratedOverlap!;
            Assert.Equal(new[] { "circle", "circle" }, generatedOverlap.SourceShapes);
            Assert.Equal(24.0, generatedOverlap.Offset.X);
            Assert.Equal(0.0, generatedOverlap.Offset.Y);
            Assert.Equal(
                new[] { "fragment_circle_red_2", "fragment_circle_blue_1" },
                first.Solution.FragmentIds);

            // expect(evidence[0].generatedOverlap?.outline).toEqual(
            //   expect.arrayContaining([expect.objectContaining({ x: any Number, y: any Number })]))
            //   —— Vec2Def 的 X/Y 恒为 double, 故「含一个数值 {x,y}」等价于 outline 非空。
            Assert.NotNull(generatedOverlap.Outline);
            Assert.NotEmpty(generatedOverlap.Outline!);

            // expect(evidence[0].tolerance).toBeGreaterThan(0)
            Assert.True(first.Tolerance > 0);
        }

        private static M01MemoryGearConfig LoadConfig()
        {
            var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
            while (dir != null &&
                   !File.Exists(Path.Combine(dir.FullName, "assets", "resources", "configs", "stage1", "m01-memory-gear.json")))
            {
                dir = dir.Parent;
            }

            Assert.NotNull(dir);
            var path = Path.Combine(dir!.FullName, "assets", "resources", "configs", "stage1", "m01-memory-gear.json");
            var config = JsonConvert.DeserializeObject<M01MemoryGearConfig>(File.ReadAllText(path));
            Assert.NotNull(config);
            return config!;
        }
    }
}
