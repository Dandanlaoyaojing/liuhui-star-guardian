// 从 tests/cocos/M01RopePhysics.test.ts 逐条迁移 —— 规则不变, 断言一一对应.
using System;
using System.Collections.Generic;
using System.Linq;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01RopePhysicsTests
    {
        // 标准测试参数(与运行时旋钮同量级; 物理正确性不依赖具体值)。
        private static readonly RopeOptions Opts = new()
        {
            Gravity = -1500,
            Damping = 0.995,
            Iterations = 24,
            SubstepDt = 1.0 / 120
        };

        private const double NailX = 100;
        private const double NailY = 200;
        private const double TailX = 100;
        private const double TailY = -100; // 钉子正下方 300px
        private const int Points = 12;
        private const double TailInvMass = 0.05; // 篮子 ≈ 20× 绳点质量

        private static RopeState MakeRope() =>
            M01RopePhysics.CreateRope(NailX, NailY, TailX, TailY, Points, TailInvMass);

        private static void Simulate(
            RopeState state,
            double seconds,
            Action<double>? perStep = null,
            double fps = 60)
        {
            var frame = 1.0 / fps;
            for (var t = 0.0; t < seconds; t += frame)
            {
                M01RopePhysics.StepRope(state, frame, Opts);
                perStep?.Invoke(t);
            }
        }

        private static bool IsFinite(double v) => !double.IsNaN(v) && !double.IsInfinity(v);

        private static double Amp(IEnumerable<double> arr) => arr.Select(Math.Abs).Max();

        [Fact(DisplayName = "createRope: 点均匀分布, 头端钉死(invMass 0), 尾端=重物(给定 invMass), 中间=1")]
        public void CreateRope_UniformDistribution_PinnedHead_HeavyTail()
        {
            var rope = MakeRope();
            Assert.Equal(Points, rope.Pts.Count);
            // pts[0]: 钉子端 (x, y, invMass)
            Assert.Equal(NailX, rope.Pts[0].X);
            Assert.Equal(NailY, rope.Pts[0].Y);
            Assert.Equal(0.0, rope.Pts[0].InvMass);
            // pts[last]: 尾端重物
            Assert.Equal(TailX, rope.Pts[Points - 1].X);
            Assert.Equal(TailY, rope.Pts[Points - 1].Y);
            Assert.Equal(TailInvMass, rope.Pts[Points - 1].InvMass);
            for (var i = 1; i < Points - 1; i += 1) Assert.Equal(1.0, rope.Pts[i].InvMass);
            // 段长 = 总长/段数
            Assert.Equal(300.0, rope.SegLength * (Points - 1), 5);
            Assert.Equal(300.0, M01RopePhysics.RopeLengthOf(rope), 5);
        }

        [Fact(DisplayName = "静置: 自然悬垂稳定, 尾端保持在钉子正下方约绳长处, 无 NaN")]
        public void AtRest_HangsStable_NoNaN()
        {
            var rope = MakeRope();
            Simulate(rope, 5);
            var tail = rope.Pts[Points - 1];
            Assert.True(IsFinite(tail.X) && IsFinite(tail.Y));
            Assert.True(Math.Abs(tail.X - NailX) < 2); // 不侧漂
            Assert.True(NailY - tail.Y > 295); // 垂到接近绳长(catenary 略短不超 5px)
            Assert.True(NailY - tail.Y <= 306); // 不可拉伸: 不超绳长(+2% 迭代容差)
        }

        [Fact(DisplayName = "头端永远钉死在钉子上(任何仿真/踢击都不动)")]
        public void Head_StaysPinned()
        {
            var rope = MakeRope();
            M01RopePhysics.KickTail(rope, 400, 700, Opts.SubstepDt);
            Simulate(rope, 3);
            Assert.Equal(NailX, rope.Pts[0].X);
            Assert.Equal(NailY, rope.Pts[0].Y);
        }

        [Fact(DisplayName = "被顶起: 尾端先升起(绳松弛), 回落被绳拽住, 距离从不超过绳长×1.05")]
        public void KickedUp_RisesThenCaught_NeverExceedsRope()
        {
            var rope = MakeRope();
            Simulate(rope, 1.5); // 先静置
            var restY = rope.Pts[Points - 1].Y;
            M01RopePhysics.KickTail(rope, 120, 650, Opts.SubstepDt); // 向上为主+侧向(头偏心顶)
            var peakY = double.NegativeInfinity;
            var maxDist = 0.0;
            Simulate(rope, 6, _ =>
            {
                var cur = rope.Pts[Points - 1];
                peakY = Math.Max(peakY, cur.Y);
                maxDist = Math.Max(maxDist, Math.Sqrt((cur.X - NailX) * (cur.X - NailX) + (cur.Y - NailY) * (cur.Y - NailY)));
            });
            Assert.True(peakY > restY + 60); // 真的被顶起了
            Assert.True(maxDist < 300 * 1.05); // 软绳不可拉伸(5% 迭代容差)
            var tail = rope.Pts[Points - 1];
            Assert.True(IsFinite(tail.X) && IsFinite(tail.Y));
        }

        [Fact(DisplayName = "被绳子拽着乱晃: 侧向踢出后 x 多次过零(摆动), 且振幅随时间衰减")]
        public void SwingsAndDecays()
        {
            var rope = MakeRope();
            Simulate(rope, 1.5);
            M01RopePhysics.KickTail(rope, 260, 620, Opts.SubstepDt);
            var xs = new List<double>();
            Simulate(rope, 12, _ => xs.Add(rope.Pts[Points - 1].X - NailX));
            // 摆动: 相对钉子的 x 至少 3 次符号翻转(来回荡)
            var flips = 0;
            for (var i = 1; i < xs.Count; i += 1)
            {
                if (Math.Sign(xs[i]) != 0 && Math.Sign(xs[i - 1]) != 0 && Math.Sign(xs[i]) != Math.Sign(xs[i - 1]))
                    flips += 1;
            }
            Assert.True(flips >= 3);
            // 衰减: 前 1/3 段最大摆幅 > 末 1/3 段最大摆幅 × 2(渐渐收住)
            var third = xs.Count / 3;
            Assert.True(Amp(xs.GetRange(0, third)) > Amp(xs.GetRange(xs.Count - third, third)) * 2);
        }

        [Fact(DisplayName = "正下方竖直顶击也能明显顶起(约束仅拉伸侧; codex 复现: 双向投影会把竖直上抛吃掉只剩 ~11px)")]
        public void VerticalKick_LiftsClearly()
        {
            var rope = MakeRope();
            Simulate(rope, 1.5);
            var restY = rope.Pts[Points - 1].Y;
            M01RopePhysics.KickTail(rope, 0, 650, Opts.SubstepDt); // 纯竖直, 无侧向救场
            var peak = double.NegativeInfinity;
            Simulate(rope, 1.5, _ => peak = Math.Max(peak, rope.Pts[Points - 1].Y));
            Assert.True(peak - restY > 60);
        }

        [Fact(DisplayName = "帧率无关: 同一真实时长在 30/48/60fps 下轨迹一致(固定子步+余数累加器)")]
        public void FrameRateIndependent()
        {
            var peaks = new List<double>();
            foreach (var fps in new[] { 30, 48, 60 })
            {
                var rope = MakeRope();
                Simulate(rope, 1.5, null, fps);
                M01RopePhysics.KickTail(rope, 200, 600, Opts.SubstepDt);
                var peak = double.NegativeInfinity;
                var finalX = 0.0;
                Simulate(
                    rope,
                    2.0,
                    _ =>
                    {
                        peak = Math.Max(peak, rope.Pts[Points - 1].Y);
                        finalX = rope.Pts[Points - 1].X;
                    },
                    fps);
                peaks.Add(peak);
                _ = finalX;
            }
            Assert.True(Math.Abs(peaks[0] - peaks[2]) < 4); // 30 vs 60fps 峰值几乎相同
            Assert.True(Math.Abs(peaks[1] - peaks[2]) < 4); // 48 vs 60fps(余数路径)同
        }

        [Fact(DisplayName = "质量加权: 约束修正主要移动轻绳点, 重尾少动(invMass 比例)")]
        public void MassWeighted_LightPointMovesMoreThanHeavyTail()
        {
            var rope = MakeRope();
            // 人为把尾端拉远 40px 制造拉伸, 步进一次极短(无重力干扰): 尾端被拉回的位移应远小于邻点
            var tail = rope.Pts[Points - 1];
            var neighbor = rope.Pts[Points - 2];
            var tailBeforeX = tail.X;
            var tailBeforeY = tail.Y - 40;
            tail.Y -= 40;
            tail.Py = tail.Y; // 无初速
            var nBeforeX = neighbor.X;
            var nBeforeY = neighbor.Y;
            M01RopePhysics.StepRope(rope, Opts.SubstepDt, Opts with { Gravity = 0 });
            var tailMoved = Math.Sqrt((tail.X - tailBeforeX) * (tail.X - tailBeforeX) + (tail.Y - tailBeforeY) * (tail.Y - tailBeforeY));
            var nMoved = Math.Sqrt((neighbor.X - nBeforeX) * (neighbor.X - nBeforeX) + (neighbor.Y - nBeforeY) * (neighbor.Y - nBeforeY));
            Assert.True(nMoved > tailMoved * 3); // 轻点让位远多于重物
        }
    }
}
