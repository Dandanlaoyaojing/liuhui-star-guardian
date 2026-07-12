// 从 tests/cocos/M01RepairSequence.test.ts 逐条迁移 —— 规格不变, 断言一一对应.
// spec §5.2 修复动画: 齿轮转动 → 碎片以漩涡状【喷出】→ 化为持续星光(镜头拉远本轮省略).
using System;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.Interaction;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01RepairSequenceTests
    {
        private static IReadOnlyList<RepairStepConfig> Steps => new[]
        {
            new RepairStepConfig
            {
                Type = "entity_animate",
                Params = new Dictionary<string, object?>
                {
                    ["entityId"] = "entity_memory_gear",
                    ["animation"] = "turn",
                    ["turns"] = 2
                },
                Duration = 2.5,
                Delay = 0
            },
            new RepairStepConfig
            {
                Type = "fragments_spiral_out",
                Params = new Dictionary<string, object?> { ["radius"] = 320, ["turnsDeg"] = 540 },
                Duration = 1.6,
                Delay = 0.6
            },
            new RepairStepConfig
            {
                Type = "starlight",
                Params = new Dictionary<string, object?> { ["pulses"] = 3 },
                Duration = 2.0,
                Delay = 2.2
            }
        };

        [Fact(DisplayName = "buildRepairTimeline: delay+duration → 绝对时间窗, 总时长 = 最晚结束")]
        public void BuildRepairTimeline_DelayPlusDuration_ToAbsoluteWindows()
        {
            var tl = M01RepairSequence.BuildRepairTimeline(Steps);
            Assert.Equal(3, tl.Segments.Count);

            Assert.Equal("entity_animate", tl.Segments[0].Type);
            Assert.Equal(0.0, tl.Segments[0].Start);
            Assert.Equal(2.5, tl.Segments[0].End);

            Assert.Equal("fragments_spiral_out", tl.Segments[1].Type);
            Assert.Equal(0.6, tl.Segments[1].Start);
            Assert.Equal(2.2, tl.Segments[1].End);

            Assert.Equal("starlight", tl.Segments[2].Type);
            Assert.Equal(2.2, tl.Segments[2].Start);
            Assert.Equal(4.2, tl.Segments[2].End);

            Assert.Equal(4.2, tl.Total, 5);
            // 原 config 的 params 原样带过(cc 胶水按 type 消费)
            Assert.Equal("entity_memory_gear", tl.Segments[0].Params["entityId"] as string);
        }

        [Fact(DisplayName = "空/缺省字段稳健: 无 delay 视为 0, 无 duration 视为 0, 空表总时长 0")]
        public void BuildRepairTimeline_MissingFields_AreRobust()
        {
            var tl = M01RepairSequence.BuildRepairTimeline(new[]
            {
                new RepairStepConfig { Type = "starlight", Params = new Dictionary<string, object?>() }
            });
            Assert.Equal(0.0, tl.Segments[0].Start);
            Assert.Equal(0.0, tl.Segments[0].End);

            Assert.Equal(0.0, M01RepairSequence.BuildRepairTimeline(Array.Empty<RepairStepConfig>()).Total);
        }

        [Fact(DisplayName = "spiralOutTargets: 确定性(同输入同输出)、每片角度错开、半径全到终半径、途中旋转角=turnsDeg")]
        public void SpiralOutTargets_DeterministicEvenlySpreadOnRadius()
        {
            var origin = new Point2(100, -50);
            var spiralParams = new SpiralParams { Radius = 320, TurnsDeg = 540 };
            var a = M01RepairSequence.SpiralOutTargets(9, origin, spiralParams);
            var b = M01RepairSequence.SpiralOutTargets(9, origin, spiralParams);
            Assert.Equal(a, b); // 确定性(无 RNG → 帧率/重放无关)
            Assert.Equal(9, a.Count);

            var angles = new HashSet<int>(a.Select(t => (int)Math.Round(t.AngleDeg, MidpointRounding.AwayFromZero)));
            Assert.Equal(9, angles.Count); // 9 路角度互不相同(漩涡均匀喷出, 不叠成一柱)

            foreach (var t in a)
            {
                var dx = t.X - 100;
                var dy = t.Y + 50;
                Assert.Equal(320.0, Math.Sqrt(dx * dx + dy * dy), 5); // 终点都在终半径圆上
                Assert.Equal(540.0, t.SpinDeg); // 途中自旋角来自 config
            }

            // 角度覆盖整圈(最大相邻间隔 < 2×均匀间隔 → 没有大缺口)
            var sorted = a.Select(t => ((t.AngleDeg % 360) + 360) % 360).OrderBy(v => v).ToList();
            var maxGap = 0.0;
            for (var i = 0; i < sorted.Count; i += 1)
            {
                var next = i + 1 < sorted.Count ? sorted[i + 1] : sorted[0] + 360;
                maxGap = Math.Max(maxGap, next - sorted[i]);
            }
            Assert.True(maxGap < (360.0 / 9) * 2);
        }
    }
}
