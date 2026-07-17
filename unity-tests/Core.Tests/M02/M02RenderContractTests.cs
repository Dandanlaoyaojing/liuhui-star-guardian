// M02 渲染契约测试 —— 钉魔数与纯函数的 TS 语义(真源 M02StarWebView.ts / M02PrologueView.ts)。
// rng 黄金值由 node 逐字跑 TS 原式生成(scratch rng_golden.mjs), 钉死 JS int32/uint32 位运算的跨语言一致。
using System;
using System.Collections.Generic;
using StarGuardian.Interaction;
using StarGuardian.M02;
using StarGuardian.M02.Rendering;
using Xunit;

namespace StarGuardian.M02.Tests
{
    public class M02RenderContractTests
    {
        private static Func<double> ConstantRng(double value) => () => value;

        private static Func<double> CountingRng(double value, int[] counter) => () =>
        {
            counter[0] += 1;
            return value;
        };

        [Fact]
        public void RngFromStarId_matches_js_golden_values()
        {
            // node 黄金值(TS SWV:556-569 原式): 全整数位运算 + /2^32, double 表示精确 → 逐位相等
            AssertRngSequence("A", new[]
            {
                0.31773650576360524, 0.24113828130066395, 0.63673924421891570,
                0.47649492719210684, 0.38216484687291086, 0.75818035565316677
            });
            AssertRngSequence("e1", new[]
            {
                0.99676440027542412, 0.26185341784730554, 0.37395654944702983,
                0.44419936928898096, 0.71240830165334046, 0.71656253025867045
            });
            AssertRngSequence("AA", new[]
            {
                0.26860257354564965, 0.70403693709522486, 0.030826285481452942,
                0.69332777988165617, 0.62743674986995757, 0.53517896938137710
            });
        }

        private static void AssertRngSequence(string id, IReadOnlyList<double> expected)
        {
            var rng = M02RenderContract.RngFromStarId(id);
            foreach (var value in expected)
            {
                Assert.Equal(value, rng());
            }
        }

        [Fact]
        public void RngFromStarId_stays_on_sequence_after_full_star_render_consumption()
        {
            // 一次星渲染消耗 41 次(顶点 11 + 三道描边 30); 第 42 个值不漂(长序列黄金值)
            var rng = M02RenderContract.RngFromStarId("A");
            for (var i = 0; i < 41; i++) rng();
            Assert.Equal(0.64168099523521960, rng());
        }

        [Fact]
        public void Stargaze_vertices_form_seeded_pentagon_and_consume_rng_in_order()
        {
            var counter = new int[1];
            var vertices = M02RenderContract.GenerateStargazeStarVertices(
                M02RenderContract.NodeRadiusPx, M02RenderContract.StargazeStarWobble, CountingRng(0.5, counter));

            Assert.Equal(5, vertices.Count);
            Assert.Equal(11, counter[0]); // startAngle 1 + 每顶点 r/angleShift 各 1 (SWV:532-536)
            // rng=0.5 → 无扰动正五边形: 首顶点在 -π/2, 半径=size
            Assert.Equal(0, vertices[0].X, 9);
            Assert.Equal(-22, vertices[0].Y, 9);
            foreach (var v in vertices)
            {
                Assert.Equal(22, Math.Sqrt(v.X * v.X + v.Y * v.Y), 9);
            }
            // 顶点角步进 2π/5(SWV:534)
            var a0 = Math.Atan2(vertices[0].Y, vertices[0].X);
            var a1 = Math.Atan2(vertices[1].Y, vertices[1].X);
            Assert.Equal(Math.PI * 2 / 5, NormalizeAngle(a1 - a0), 9);
        }

        private static double NormalizeAngle(double angle)
        {
            while (angle <= -Math.PI) angle += Math.PI * 2;
            while (angle > Math.PI) angle -= Math.PI * 2;
            return angle;
        }

        [Fact]
        public void Drifted_stroke_vertices_offset_by_half_drift_and_consume_two_rng_per_vertex()
        {
            var vertices = new List<Point2> { new(1, 2), new(-3, 4) };
            var counter = new int[1];
            var drifted = M02RenderContract.DriftStarVertices(vertices, 10, CountingRng(1.0, counter));

            Assert.Equal(4, counter[0]); // 每顶点 x/y 各 1 (SWV:516-517)
            Assert.Equal(6, drifted[0].X, 12);  // 1 + (1-0.5)*10
            Assert.Equal(7, drifted[0].Y, 12);
            Assert.Equal(2, drifted[1].X, 12);
            Assert.Equal(9, drifted[1].Y, 12);

            var unchanged = M02RenderContract.DriftStarVertices(vertices, 10, ConstantRng(0.5));
            Assert.Equal(vertices[0], unchanged[0]); // rng=0.5 → 漂移 0
            Assert.Equal(vertices[1], unchanged[1]);
        }

        [Fact]
        public void Star_stroke_passes_scale_drift_and_line_width_with_node_radius()
        {
            Assert.Equal(3, M02RenderContract.StarStrokePassCount);
            Assert.Equal(22 * 0.07, M02RenderContract.StarStrokeDriftPx(0), 12); // SWV:514
            Assert.Equal(22 * 0.12, M02RenderContract.StarStrokeDriftPx(1), 12);
            Assert.Equal(22 * 0.17, M02RenderContract.StarStrokeDriftPx(2), 12);
            Assert.Equal(22 * 0.08, M02RenderContract.StarStrokeLineWidthPx(0), 12); // SWV:520 (1.76 > 1.2 地板)
            Assert.Equal(22 * 0.10, M02RenderContract.StarStrokeLineWidthPx(1), 12);
            Assert.Equal(22 * 0.12, M02RenderContract.StarStrokeLineWidthPx(2), 12);
        }

        [Fact]
        public void Edge_arc_control_point_bends_outward_and_caps_at_62px()
        {
            // 长 150 水平边: bend=34, 法线 +y, 中点外侧
            var c1 = M02RenderContract.EdgeArcControlPoint(new Point2(0, 0), new Point2(150, 0));
            Assert.Equal(75, c1.X, 12);
            Assert.Equal(34, c1.Y, 12);

            // 长 300: 34*(300/150)=68 → 封顶 62 (SWV:285)
            var c2 = M02RenderContract.EdgeArcControlPoint(new Point2(0, 0), new Point2(300, 0));
            Assert.Equal(150, c2.X, 12);
            Assert.Equal(62, c2.Y, 12);

            // outward 随中点与法线的点积翻转(SWV:284): 右侧竖边向 +x 弯, 左侧竖边向 -x 弯
            var right = M02RenderContract.EdgeArcControlPoint(new Point2(150, 0), new Point2(150, 150));
            Assert.Equal(184, right.X, 12);
            Assert.Equal(75, right.Y, 12);
            var left = M02RenderContract.EdgeArcControlPoint(new Point2(-150, 0), new Point2(-150, 150));
            Assert.Equal(-184, left.X, 12);
            Assert.Equal(75, left.Y, 12);
        }

        [Fact]
        public void Quadratic_bezier_hits_endpoints_and_midpoint()
        {
            var p0 = new Point2(0, 0);
            var control = new Point2(75, 34);
            var p1 = new Point2(150, 0);
            Assert.Equal(p0, M02RenderContract.QuadraticBezierPoint(p0, control, p1, 0));
            Assert.Equal(p1, M02RenderContract.QuadraticBezierPoint(p0, control, p1, 1));
            var mid = M02RenderContract.QuadraticBezierPoint(p0, control, p1, 0.5);
            Assert.Equal(75, mid.X, 12);       // (p0 + 2c + p1)/4
            Assert.Equal(17, mid.Y, 12);
        }

        [Fact]
        public void Quad_in_out_easing_matches_cocos_curve()
        {
            Assert.Equal(0, M02RenderContract.QuadInOut(0), 12);
            Assert.Equal(0.125, M02RenderContract.QuadInOut(0.25), 12);
            Assert.Equal(0.5, M02RenderContract.QuadInOut(0.5), 12);
            Assert.Equal(0.875, M02RenderContract.QuadInOut(0.75), 12);
            Assert.Equal(1, M02RenderContract.QuadInOut(1), 12);
        }

        [Fact]
        public void Repair_flow_active_index_floors_progress_over_glow_count()
        {
            Assert.Equal(0, M02RenderContract.RepairFlowActiveIndex(0, 9));
            Assert.Equal(4, M02RenderContract.RepairFlowActiveIndex(0.5, 9));
            Assert.Equal(8, M02RenderContract.RepairFlowActiveIndex(1, 9));
            Assert.Equal(0, M02RenderContract.RepairFlowActiveIndex(1, 1));  // max(0, n-1) 钳制 (SWV:317)
            Assert.Equal(0, M02RenderContract.RepairFlowActiveIndex(1, 0));
            Assert.Equal(1.16, M02RenderContract.RepairGlowScale, 12);       // SWV:319
        }

        [Fact]
        public void Star_glow_radius_scales_with_life_and_freezes_full()
        {
            Assert.Equal(40, M02RenderContract.StarGlowRadiusPx(StarNodeStatus.Frozen, 1, 3), 12); // 冻结满辐(SWV:573 lifeRatio=1)
            Assert.Equal(34, M02RenderContract.StarGlowRadiusPx(StarNodeStatus.Decaying, 2, 3), 12); // 22+18*(2/3)
            Assert.Equal(28, M02RenderContract.StarGlowRadiusPx(StarNodeStatus.Decaying, 1, 3), 12);
            Assert.Equal(3, M02RenderContract.StarGlowLineWidthPx(StarNodeStatus.Frozen), 12); // SWV:575
            Assert.Equal(2, M02RenderContract.StarGlowLineWidthPx(StarNodeStatus.Decaying), 12);
            // 字面字节(非常量比自己): 变异测试证明 routing-only 断言对错字节全绿(终审逮到)
            // 2026-07-17 视觉调优: glow alpha 135→78 / 95→58(用户: 星太亮; Play 七星叠加实测定值)
            var fg = M02RenderContract.StarGlowColor(StarNodeStatus.Frozen);
            Assert.Equal((248, 214, 150, 78), (fg.R, fg.G, fg.B, fg.A)); // SWV:46 原 alpha 135
            var dg = M02RenderContract.StarGlowColor(StarNodeStatus.Decaying);
            Assert.Equal((214, 170, 104, 58), (dg.R, dg.G, dg.B, dg.A));  // SWV:47 原 alpha 95
        }

        [Fact]
        public void Twinkle_is_deterministic_per_star_and_bounded()
        {
            // 2026-07-17 星光呼吸(Unity 侧新增, 无 Cocos 真源): 相位/周期按 id 定值, 重复调用不变
            Assert.Equal(M02RenderContract.TwinklePhase("warm-1"), M02RenderContract.TwinklePhase("warm-1"), 12);
            Assert.Equal(M02RenderContract.TwinklePeriodSeconds("warm-1"), M02RenderContract.TwinklePeriodSeconds("warm-1"), 12);
            Assert.NotEqual(M02RenderContract.TwinklePhase("warm-1"), M02RenderContract.TwinklePhase("warm-2")); // 各星错落
            var phase = M02RenderContract.TwinklePhase("warm-1");
            var period = M02RenderContract.TwinklePeriodSeconds("warm-1");
            Assert.InRange(phase, 0.0, Math.PI * 2);
            Assert.InRange(period,
                M02RenderContract.TwinkleBasePeriodSeconds,
                M02RenderContract.TwinkleBasePeriodSeconds + M02RenderContract.TwinklePeriodJitterSeconds);

            // level ∈ [0,1]; 三个系数各自钉在 [floor, 1] / [1-amp, 1+amp]
            for (var i = 0; i < 48; i++)
            {
                var level = M02RenderContract.TwinkleLevel(i * 0.137, phase, period);
                Assert.InRange(level, 0.0, 1.0);
                Assert.InRange(M02RenderContract.TwinkleGlowFactor(level), M02RenderContract.TwinkleGlowFloor, 1.0);
                Assert.InRange(M02RenderContract.TwinkleStarAlphaFactor(level), M02RenderContract.TwinkleStarAlphaFloor, 1.0);
                Assert.InRange(M02RenderContract.TwinkleScaleFactor(level),
                    1 - M02RenderContract.TwinkleScaleAmplitude, 1 + M02RenderContract.TwinkleScaleAmplitude);
            }

            // 极值锚定: 最亮 → 系数回满
            Assert.Equal(1.0, M02RenderContract.TwinkleGlowFactor(1.0), 12);
            Assert.Equal(1.0, M02RenderContract.TwinkleStarAlphaFactor(1.0), 12);
            Assert.Equal(1 + M02RenderContract.TwinkleScaleAmplitude, M02RenderContract.TwinkleScaleFactor(1.0), 12);
            Assert.Equal(M02RenderContract.TwinkleGlowFloor, M02RenderContract.TwinkleGlowFactor(0.0), 12);
        }

        [Fact]
        public void Star_palette_matches_view_source_bytes()
        {
            // 2026-07-17 视觉调优字节(用户: 星太亮/灰线丑): 点亮两态调暗、边换暖蜜金; dark 态保持 Cocos 原值
            var dark = M02RenderContract.StarFillColor(StarNodeStatus.Dark);
            Assert.Equal((92, 98, 116, 255), (dark.R, dark.G, dark.B, dark.A));           // SWV:39
            var decaying = M02RenderContract.StarFillColor(StarNodeStatus.Decaying);
            Assert.Equal((198, 156, 96, 255), (decaying.R, decaying.G, decaying.B, decaying.A)); // SWV:40 原(214,170,104)
            var frozen = M02RenderContract.StarFillColor(StarNodeStatus.Frozen);
            Assert.Equal((228, 188, 122, 255), (frozen.R, frozen.G, frozen.B, frozen.A)); // SWV:41 原(248,214,150)
            Assert.Throws<ArgumentException>(() => M02RenderContract.StarFillColor("nova"));

            Assert.Equal((196, 166, 118, 132), (M02RenderContract.EdgeColor.R, M02RenderContract.EdgeColor.G, M02RenderContract.EdgeColor.B, M02RenderContract.EdgeColor.A)); // SWV:43 原(110,116,138,150)
            var sd = M02RenderContract.StarStrokeColor(StarNodeStatus.Dark);   // SWV:512 字面字节
            Assert.Equal((126, 132, 150, 150), (sd.R, sd.G, sd.B, sd.A)); // SWV:49 DARK_STAR_STROKE_COLOR
            var sl = M02RenderContract.StarStrokeColor(StarNodeStatus.Frozen);
            Assert.Equal((246, 228, 178, 122), (sl.R, sl.G, sl.B, sl.A)); // SWV:48 原(255,244,202,180)
            Assert.Equal(new[] { 0, 2, 4, 1, 3, 0 }, M02RenderContract.StargazeStarDrawOrder);                             // SWV:29
        }

        [Fact]
        public void Charge_pips_lay_out_on_gap_and_color_by_remaining()
        {
            Assert.Equal(0, M02RenderContract.ChargePipOffsetXPx(0), 12);
            Assert.Equal(48, M02RenderContract.ChargePipOffsetXPx(2), 12); // SWV:590 i*24
            var cOn = M02RenderContract.ChargePipColor(1, 2);   // SWV:591 i<left; 字面字节
            Assert.Equal((248, 214, 150, 255), (cOn.R, cOn.G, cOn.B, cOn.A));
            var cOff = M02RenderContract.ChargePipColor(2, 2);
            Assert.Equal((92, 98, 116, 120), (cOff.R, cOff.G, cOff.B, cOff.A)); // SWV:45 CHARGE_EMPTY_COLOR
        }

        [Fact]
        public void Failure_overlay_leak_circles_match_view_literals()
        {
            var leaks = M02RenderContract.FailureLeakCircles; // SWV:611
            Assert.Equal(3, leaks.Count);
            Assert.Equal((-74d, 24d, 18d), (leaks[0].X, leaks[0].Y, leaks[0].Radius));
            Assert.Equal((0d, -16d, 24d), (leaks[1].X, leaks[1].Y, leaks[1].Radius));
            Assert.Equal((82d, 18d, 14d), (leaks[2].X, leaks[2].Y, leaks[2].Radius));
        }

        [Fact]
        public void Wrap_card_text_chunks_by_utf16_length()
        {
            Assert.Equal("短文案", M02RenderContract.WrapCardText("短文案", 24)); // SWV:447 不超长原样
            var text = new string('甲', 33);
            var wrapped = M02RenderContract.WrapCardText(text, 24);
            Assert.Equal(new string('甲', 24) + "\n" + new string('甲', 9), wrapped); // SWV:448 定长切块
            Assert.Equal(new string('乙', 24), M02RenderContract.WrapCardText(new string('乙', 24), 24)); // 恰好边界
            Assert.Throws<ArgumentOutOfRangeException>(() => M02RenderContract.WrapCardText("x", 0));
        }

        [Fact]
        public void Completion_label_specs_match_view_call_sites()
        {
            var panel = Assert.Single(M02RenderContract.CompletionPanelLabels); // SWV:375
            Assert.Equal(("M02WisdomCrystal", 0d, 72d, 13d, 350d, 28d, 0), (panel.Name, panel.XPx, panel.YPx, panel.FontSizePx, panel.WidthPx, panel.HeightPx, panel.WrapChars));

            var card = M02RenderContract.CompletionCardLabels; // SWV:396-400
            Assert.Equal(5, card.Count);
            Assert.Equal(("M02ToolCardSubtitle", "subtitle", 42d, 12d), (card[0].Name, card[0].Field, card[0].YPx, card[0].FontSizePx));
            Assert.Equal(("M02ToolCardTitle", "title", 22d, 20d), (card[1].Name, card[1].Field, card[1].YPx, card[1].FontSizePx));
            Assert.Equal(("M02ToolCardCrystal", "crystal", -4d, 12d), (card[2].Name, card[2].Field, card[2].YPx, card[2].FontSizePx));
            Assert.Equal(("M02ToolCardAction", "coreAction", -30d, 11d, 24), (card[3].Name, card[3].Field, card[3].YPx, card[3].FontSizePx, card[3].WrapChars));
            Assert.Equal(("M02ToolCardUse", "whenToUse", -56d, 10d, 27), (card[4].Name, card[4].Field, card[4].YPx, card[4].FontSizePx, card[4].WrapChars));
            Assert.Equal(18, M02RenderContract.LabelLineHeightPx(13), 12); // SWV:440 fontSize+5
        }

        [Fact]
        public void Prologue_ember_and_wand_geometry_matches_view_source()
        {
            // 光晕: 冻结满辐(PV:219) / 衰减随命数收缩(PV:224) / 暗烬无光晕
            Assert.Equal(32, M02RenderContract.EmberGlowRadiusPx(StarNodeStatus.Frozen, 1, 3), 12);
            Assert.Equal(10 + 22.0 * 2 / 3, M02RenderContract.EmberGlowRadiusPx(StarNodeStatus.Decaying, 2, 3), 12);
            Assert.Equal(0, M02RenderContract.EmberGlowRadiusPx(StarNodeStatus.Dark, 0, 3), 12);
            // 核心: 暗烬 ×0.7 (PV:230)
            Assert.Equal(7, M02RenderContract.EmberCoreRadiusResolvedPx(StarNodeStatus.Dark), 12);
            Assert.Equal(10, M02RenderContract.EmberCoreRadiusResolvedPx(StarNodeStatus.Frozen), 12);
            Assert.Equal(M02RenderContract.StarFillColor(StarNodeStatus.Decaying), M02RenderContract.EmberColor(StarNodeStatus.Decaying)); // PV:29 同 palette

            // 棒: 插地=斜杆(30, 64), 在手/点亮=竖杆(0, 84) (PV:241); 杆基 (0,-16) (PV:244)
            Assert.Equal(new Point2(30, 64), M02RenderContract.WandTipOffsetPx(WandState.Planted));
            Assert.Equal(new Point2(0, 84), M02RenderContract.WandTipOffsetPx(WandState.Held));
            Assert.Equal(new Point2(0, 84), M02RenderContract.WandTipOffsetPx(WandState.Lit));
            Assert.Equal(new Point2(0, -16), M02RenderContract.WandBaseOffsetPx);
            Assert.Equal(M02RenderContract.WandTipLitColor, M02RenderContract.WandTipColor(WandState.Lit));   // PV:253
            Assert.Equal(M02RenderContract.WandTipDimColor, M02RenderContract.WandTipColor(WandState.Planted));
        }
    
        [Theory(DisplayName = "touch area rect mirrors Cocos setContentSize(1000,720) hit-test (SWV:90 / PV:66)")]
        [InlineData(0, 0, true)]
        [InlineData(500, 360, true)]      // 边界含(Cocos 矩形命中含边)
        [InlineData(-500, -360, true)]
        [InlineData(500.1, 0, false)]     // 宽屏 16:9 可见 ±569px, 框外 Cocos 不派发
        [InlineData(569, 0, false)]
        [InlineData(0, 360.1, false)]
        [InlineData(-569, -400, false)]
        public void IsInsideTouchAreaMirrorsCocosRectHitTest(double x, double y, bool expected)
        {
            Assert.Equal(expected, M02RenderContract.IsInsideTouchArea(x, y));
        }

        [Fact(DisplayName = "touch area dimensions stay at the Cocos values")]
        public void TouchAreaDimensionsPinned()
        {
            Assert.Equal(1000d, M02RenderContract.TouchAreaWidthPx);
            Assert.Equal(720d, M02RenderContract.TouchAreaHeightPx);
        }

        [Fact(DisplayName = "wobble actually perturbs vertices (rng!=0.5; 变异测试逮到 rng=0.5 令 wobble 项代数归零=假覆盖)")]
        public void Stargaze_wobble_perturbs_vertices()
        {
            // rng=1.0 → (rng-0.5)*wobble = +0.5*wobble ≠ 0, 常量真正参与
            var wobbled = M02RenderContract.GenerateStargazeStarVertices(
                M02RenderContract.NodeRadiusPx, M02RenderContract.StargazeStarWobble, ConstantRng(1.0));
            var none = M02RenderContract.GenerateStargazeStarVertices(
                M02RenderContract.NodeRadiusPx, 0d, ConstantRng(1.0));
            Assert.Equal(5, wobbled.Count);
            // wobble≠0 必须改变几何(否则 0.35→777.5 之类的错值无人可挡)
            var differs = false;
            for (var i = 0; i < 5; i += 1)
            {
                if (Math.Abs(wobbled[i].X - none[i].X) > 1e-9 || Math.Abs(wobbled[i].Y - none[i].Y) > 1e-9) differs = true;
            }
            Assert.True(differs, "StargazeStarWobble 未影响顶点 → 手绘抖动丢失(星变机械正五边形)");
            Assert.Equal(0.35d, M02RenderContract.StargazeStarWobble); // SWV:28 值本身
        }

        [Fact(DisplayName = "live input/timing thresholds pinned (变异测试证明这批零覆盖: 改成 4 则整关点不动仍全绿)")]
        public void LiveGameplayThresholdsPinned()
        {
            Assert.Equal(44d, M02RenderContract.TapRadiusPx);        // SWV:18 星命中半径
            Assert.Equal(48d, M02RenderContract.EmberDragRadiusPx);  // PV:23 余烬拾取半径
            Assert.Equal(70d, M02RenderContract.WandTapRadiusPx);    // PV:24 点棒半径
            Assert.Equal(1.1d, M02RenderContract.DoneDelaySeconds);  // PV:27 序章→主盘交接
            Assert.Equal(960d, M02RenderContract.DesignWidthPx);
            Assert.Equal(640d, M02RenderContract.DesignHeightPx);
            Assert.Equal(100d, M02RenderContract.PixelsPerUnit);
        }
}
}
