// M02 Cocos → Unity 渲染等价契约。
// 真源: assets/scripts/cocos/M02StarWebView.ts(标注 SWV:行号)与 M02PrologueView.ts(标注 PV:行号)。
// 纯 C#，不得引用 UnityEngine；由 xUnit 与 Unity 共同编译(C#9, 禁 record struct/文件级 namespace)。
// 坐标约定与 M01RenderContract 相同: Cocos 960×640 中心原点 px → Unity 世界 units ÷ PixelsPerUnit;
// 旋转两边同为逆时针正角, 不取负(M01BoardProbe:404 审查 CONFIRMED)。
// 色值复用 M01Color32(同装配体, 字节真值语义一致), 点复用 Interaction.Point2(值相等)。
#nullable enable

using System;
using System.Collections.Generic;
using System.Text;
using StarGuardian.Interaction;
using StarGuardian.M01.Rendering;

namespace StarGuardian.M02.Rendering
{
    /// <summary>圆(Cocos graphics.circle(x, y, r) 的参数三元组); C#9 无 record struct → 手写只读值类型。</summary>
    public readonly struct M02CirclePx
    {
        public double X { get; }
        public double Y { get; }
        public double Radius { get; }

        public M02CirclePx(double x, double y, double radius)
        {
            X = x;
            Y = y;
            Radius = radius;
        }
    }

    /// <summary>完成面板一条 Label 的布局(SWV addCardLabel:420-444 的实参逐值)。
    /// Field 标记文案来源: "wisdomCrystal"=config.wisdomCrystal, 其余为 ToolCardPreview 具名字段。</summary>
    public sealed class M02CardLabelSpec
    {
        public string Name { get; }
        public string Field { get; }
        public double XPx { get; }
        public double YPx { get; }
        public double FontSizePx { get; }
        public double WidthPx { get; }
        public double HeightPx { get; }
        /// <summary>0 = 不折行; 否则先经 WrapCardText(text, WrapChars)(SWV:399-400)。</summary>
        public int WrapChars { get; }

        public M02CardLabelSpec(string name, string field, double xPx, double yPx, double fontSizePx, double widthPx, double heightPx, int wrapChars = 0)
        {
            Name = name;
            Field = field;
            XPx = xPx;
            YPx = yPx;
            FontSizePx = fontSizePx;
            WidthPx = widthPx;
            HeightPx = heightPx;
            WrapChars = wrapChars;
        }
    }

    public static class M02RenderContract
    {
        // ── 画布/坐标(与 M01 同一套) ──
        public const double DesignWidthPx = 960;
        public const double DesignHeightPx = 640;
        public const double PixelsPerUnit = 100;
        /// <summary>根节点触摸区(星跨 ±~230px, 默认 100×100 收不到点击) SWV:90 / PV:66</summary>
        public const double TouchAreaWidthPx = 1000;
        public const double TouchAreaHeightPx = 720;

        /// <summary>
        /// 点是否落在触摸区内(Cocos 把 TOUCH_START/END 挂在 setContentSize(1000,720) 的 UITransform
        /// 节点上, 触摸按该矩形命中派发 → 框外点击根本不进 onTouchStart/onTouchEnd)。
        /// Unity 用轮询 Pointer 没有这层裁剪, 必须显式判定, 否则宽屏(16:9 可见 ±569px)下点框外
        /// 会触发 Cocos 里不会发生的行为。锚点 0.5/0.5 居中 → 半宽/半高对称。SWV:90 / PV:66。
        /// </summary>
        public static bool IsInsideTouchArea(double cocosX, double cocosY) =>
            Math.Abs(cocosX) <= TouchAreaWidthPx / 2 && Math.Abs(cocosY) <= TouchAreaHeightPx / 2;

        // ── 主视图布局常量 SWV:17-36 ──
        public const double NodeRadiusPx = 22;                  // SWV:17 星视觉半径
        public const double TapRadiusPx = 44;                   // SWV:18 命中半径(比视觉大)
        public const double EdgeWidthPx = 4;                    // SWV:19
        public const double EdgeArcBendPx = 34;                 // SWV:20
        public const double EdgeArcReferenceDistancePx = 150;   // SWV:21
        public const double EdgeArcBendCapPx = 62;              // SWV:285 Math.min(62, ...)
        public const string BackgroundCocosResourcePath = "art/stage1-m02/bg-star-map-watercolor/spriteFrame"; // SWV:22
        public const string BackgroundUnityResourcePath = "Art/M02/bg-star-map-watercolor";
        public const double BackgroundWidthPx = 1280;           // SWV:23 (CUSTOM sizeMode 非等比拉伸 SWV:189)
        public const double BackgroundHeightPx = 720;           // SWV:24
        public const double ChargePipRadiusPx = 8;              // SWV:25
        public const double ChargePipGapPx = 24;                // SWV:26
        public const double StarGlowExtraPx = 18;               // SWV:27 光晕最大外扩
        public const double StargazeStarWobble = 0.35;          // SWV:28
        public const double FailureOverlayWidthPx = 1000;       // SWV:30
        public const double FailureOverlayHeightPx = 720;       // SWV:31
        public const double RepairFlowSeconds = 0.72;           // SWV:32
        public const double CompletionPanelWidthPx = 390;       // SWV:33
        public const double CompletionPanelHeightPx = 188;      // SWV:34
        public const double CompletionCardWidthPx = 360;        // SWV:35
        public const double CompletionCardHeightPx = 128;       // SWV:36

        /// <summary>五角星一笔画顶点序(自交路径, 非零环绕填充为实心星) SWV:29</summary>
        public static readonly IReadOnlyList<int> StargazeStarDrawOrder =
            Array.AsReadOnly(new[] { 0, 2, 4, 1, 3, 0 });

        // ── 主视图固定位置(px, 根节点局部) ──
        public static readonly Point2 ChargeMeterPositionPx = new(-430, 300);        // SWV:98
        public static readonly Point2 CompletionPanelPositionPx = new(0, -238);      // SWV:355
        public static readonly Point2 CompletionCardPositionPx = new(0, -28);        // SWV:379 (panel 局部)
        public static readonly Point2 CompletionCrystalIconPositionPx = new(-170, 72); // SWV:407 (panel 局部)

        // ── 主视图色板 SWV:38-57 ──
        public static readonly M01Color32 EdgeColor = new(110, 116, 138, 150);            // SWV:43
        public static readonly M01Color32 ChargeColor = new(248, 214, 150, 255);          // SWV:44
        public static readonly M01Color32 ChargeEmptyColor = new(92, 98, 116, 120);       // SWV:45
        public static readonly M01Color32 DecayingGlowColor = new(214, 170, 104, 95);     // SWV:46 / PV:35
        public static readonly M01Color32 FrozenGlowColor = new(248, 214, 150, 135);      // SWV:47 / PV:36
        public static readonly M01Color32 StarStrokeLitColor = new(255, 244, 202, 180);   // SWV:48
        public static readonly M01Color32 StarStrokeDarkColor = new(126, 132, 150, 150);  // SWV:49
        public static readonly M01Color32 FailureOverlayColor = new(24, 26, 34, 118);     // SWV:50
        public static readonly M01Color32 FailureLeakColor = new(214, 170, 104, 125);     // SWV:51
        public static readonly M01Color32 CompletionPanelFill = new(250, 244, 222, 242);  // SWV:52
        public static readonly M01Color32 CompletionPanelStroke = new(82, 72, 54, 255);   // SWV:53
        public static readonly M01Color32 CompletionCardFill = new(255, 250, 235, 246);   // SWV:54
        public static readonly M01Color32 CompletionCardStroke = new(132, 112, 74, 255);  // SWV:55
        public static readonly M01Color32 CompletionTextColor = new(45, 42, 36, 255);     // SWV:56
        public static readonly M01Color32 CompletionAccentColor = new(248, 214, 150, 255); // SWV:57

        /// <summary>星体填充色(呈现态→色) SWV:38-42; 序章余烬同 palette 按值复用 PV:30-34</summary>
        public static M01Color32 StarFillColor(string status) => status switch
        {
            StarNodeStatus.Dark => new M01Color32(92, 98, 116, 255),      // SWV:39
            StarNodeStatus.Decaying => new M01Color32(214, 170, 104, 255), // SWV:40
            StarNodeStatus.Frozen => new M01Color32(248, 214, 150, 255),   // SWV:41
            _ => throw new ArgumentException($"Unsupported star status: {status}", nameof(status))
        };

        // ── 手绘星形(fill + 3 道漂移描边) SWV:505-543 ──

        public const int StarStrokePassCount = 3; // SWV:513

        /// <summary>第 pass 道描边的顶点漂移幅度(px) SWV:514</summary>
        public static double StarStrokeDriftPx(int pass) => NodeRadiusPx * (0.07 + pass * 0.05);

        /// <summary>第 pass 道描边线宽(px) SWV:520</summary>
        public static double StarStrokeLineWidthPx(int pass) => Math.Max(1.2, NodeRadiusPx * (0.08 + pass * 0.02));

        /// <summary>描边色: 暗星用暗描边, 其余用亮描边 SWV:512</summary>
        public static M01Color32 StarStrokeColor(string status) =>
            status == StarNodeStatus.Dark ? StarStrokeDarkColor : StarStrokeLitColor;

        /// <summary>五角星顶点(极坐标带 wobble 扰动); rng 消耗序: startAngle 1 次, 每顶点 r/angleShift 各 1 次。SWV:526-543</summary>
        public static List<Point2> GenerateStargazeStarVertices(double size, double wobble, Func<double> rng)
        {
            var vertices = new List<Point2>(5);
            var startAngle = -Math.PI / 2 + (rng() - 0.5) * 0.4; // SWV:532
            for (var i = 0; i < 5; i++)
            {
                var angle = startAngle + i * Math.PI * 2 / 5;    // SWV:534
                var r = size * (1 + (rng() - 0.5) * wobble);     // SWV:535
                var angleShift = (rng() - 0.5) * wobble * 0.5;   // SWV:536
                vertices.Add(new Point2(
                    Math.Cos(angle + angleShift) * r,            // SWV:538
                    Math.Sin(angle + angleShift) * r));          // SWV:539
            }
            return vertices;
        }

        /// <summary>一道描边的漂移顶点; rng 消耗序: 每顶点 x/y 各 1 次。SWV:515-518</summary>
        public static List<Point2> DriftStarVertices(IReadOnlyList<Point2> vertices, double driftPx, Func<double> rng)
        {
            var drifted = new List<Point2>(vertices.Count);
            foreach (var v in vertices)
            {
                drifted.Add(new Point2(
                    v.X + (rng() - 0.5) * driftPx,   // SWV:516
                    v.Y + (rng() - 0.5) * driftPx)); // SWV:517
            }
            return drifted;
        }

        /// <summary>星 id → 确定性 rng(mulberry32 变体, FNV-1a 播种)。SWV:556-569。
        /// JS 语义忠实映射: seed 的浮点累加(SWV:563)后续总被 ToInt32/ToUint32 归约, 与 uint32 环绕加
        /// 模 2^32 同余; Math.imul = int32 环绕乘, 与 uint32 环绕乘位型同构; charCodeAt = UTF-16 码元。
        /// 黄金值由 node 跑 TS 原式生成, xUnit 钉死跨语言一致。</summary>
        public static Func<double> RngFromStarId(string id)
        {
            var seed = 2166136261u;                       // SWV:557
            for (var i = 0; i < id.Length; i++)
            {
                seed ^= id[i];                            // SWV:559
                seed = unchecked(seed * 16777619u);       // SWV:560
            }
            return () =>
            {
                seed = unchecked(seed + 0x6D2B79F5u);     // SWV:563
                var t = seed;
                t = unchecked((t ^ (t >> 15)) * (t | 1u));       // SWV:565
                t ^= unchecked(t + (t ^ (t >> 7)) * (t | 61u));  // SWV:566
                return (t ^ (t >> 14)) / 4294967296.0;           // SWV:567
            };
        }

        // ── 星光晕(点亮的星才画) SWV:571-579 ──

        /// <summary>光晕半径: 冻结满辐, 衰减随命数收缩。SWV:573-574</summary>
        public static double StarGlowRadiusPx(string status, int life, int lifeMax)
        {
            var lifeRatio = status == StarNodeStatus.Frozen ? 1.0 : life / (double)Math.Max(1, lifeMax); // SWV:573
            return NodeRadiusPx + StarGlowExtraPx * lifeRatio;                                           // SWV:574
        }

        /// <summary>光晕描边线宽: 冻结 3 / 衰减 2。SWV:575</summary>
        /// <summary>⚠️ Unity 不消费: Cocos 光晕是 stroke 圆环(半径+alpha+线宽三轴区分冻结/衰减),
        /// Unity 换填充径向加法光晕后线宽轴不存在, 区分只剩半径+alpha 两轴。保留作 Cocos 参照记录。</summary>
        public static double StarGlowLineWidthPx(string status) => status == StarNodeStatus.Frozen ? 3 : 2;

        /// <summary>光晕色: 冻结暖金 / 衰减琥珀。SWV:576</summary>
        public static M01Color32 StarGlowColor(string status) =>
            status == StarNodeStatus.Frozen ? FrozenGlowColor : DecayingGlowColor;

        // ── 边弧(二次贝塞尔) SWV:270-290 ──

        /// <summary>边弧控制点: 中点沿外法线弯出, 弯度随边长缩放、封顶 62px。SWV:276-290</summary>
        public static Point2 EdgeArcControlPoint(Point2 from, Point2 to)
        {
            var dx = to.X - from.X;                                       // SWV:277
            var dy = to.Y - from.Y;                                       // SWV:278
            var distance = Math.Max(1, Math.Sqrt(dx * dx + dy * dy));     // SWV:279 Math.hypot(游戏坐标幅值下与 sqrt 无差)
            var midX = (from.X + to.X) / 2;                               // SWV:280
            var midY = (from.Y + to.Y) / 2;                               // SWV:281
            var normalX = -dy / distance;                                 // SWV:282
            var normalY = dx / distance;                                  // SWV:283
            var outward = midX * normalX + midY * normalY >= 0 ? 1 : -1;  // SWV:284
            var bend = Math.Min(EdgeArcBendCapPx, EdgeArcBendPx * (distance / EdgeArcReferenceDistancePx)); // SWV:285
            return new Point2(
                midX + normalX * outward * bend,                          // SWV:287
                midY + normalY * outward * bend);                         // SWV:288
        }

        /// <summary>二次贝塞尔取样(Cocos graphics.quadraticCurveTo(SWV:273) 渲染的正是这条曲线; 供 Unity 折线化)。</summary>
        public static Point2 QuadraticBezierPoint(Point2 p0, Point2 control, Point2 p1, double t)
        {
            var u = 1 - t;
            return new Point2(
                u * u * p0.X + 2 * u * t * control.X + t * t * p1.X,
                u * u * p0.Y + 2 * u * t * control.Y + t * t * p1.Y);
        }

        // ── 胜利修复流(光晕依次放大) SWV:306-333 ──

        /// <summary>Cocos easing "quadInOut"(SWV:314): 前半 0.5·(2t)², 后半 1-0.5·(2-2t)²。</summary>
        public static double QuadInOut(double t)
        {
            var k = t * 2;
            if (k < 1) return 0.5 * k * k;
            k -= 1;
            return -0.5 * (k * (k - 2) - 1);
        }

        /// <summary>已放大的最大光晕下标 = floor(progress·(n-1))(progress 已过缓动)。SWV:317</summary>
        public static int RepairFlowActiveIndex(double progress, int glowCount) =>
            (int)Math.Floor(progress * Math.Max(0, glowCount - 1));

        public const double RepairGlowScale = 1.16; // SWV:319 (未轮到=1)

        // ── 完成面板(通关奖励) SWV:342-471 ──

        public const double CompletionPanelLineWidthPx = 2; // SWV:362(面板)/384(卡)/410(结晶icon) 同值
        public const string CompletionUnlockedSubtitle = "认知工具卡已解锁";  // SWV:347
        public const string CompletionWhenToUsePrefix = "何时使用：{value}"; // SWV:348
        public const int CardActionWrapChars = 24; // SWV:399
        public const int CardUseWrapChars = 27;    // SWV:400

        /// <summary>智慧结晶菱形 icon 顶点(icon 局部 px, close 闭合) SWV:411-415</summary>
        public static readonly IReadOnlyList<Point2> CompletionCrystalDiamondPx = Array.AsReadOnly(new[]
        {
            new Point2(0, 18),   // SWV:411 moveTo
            new Point2(14, 0),   // SWV:412
            new Point2(0, -18),  // SWV:413
            new Point2(-14, 0)   // SWV:414
        });

        /// <summary>面板直属 Label(panel 局部坐标) SWV:375</summary>
        public static readonly IReadOnlyList<M02CardLabelSpec> CompletionPanelLabels = Array.AsReadOnly(new[]
        {
            new M02CardLabelSpec("M02WisdomCrystal", "wisdomCrystal", 0, 72, 13, 350, 28) // SWV:375
        });

        /// <summary>工具卡预览 Label(cardRoot 局部坐标) SWV:396-400</summary>
        public static readonly IReadOnlyList<M02CardLabelSpec> CompletionCardLabels = Array.AsReadOnly(new[]
        {
            new M02CardLabelSpec("M02ToolCardSubtitle", "subtitle", 0, 42, 12, 320, 20),                    // SWV:396
            new M02CardLabelSpec("M02ToolCardTitle", "title", 0, 22, 20, 320, 24),                          // SWV:397
            new M02CardLabelSpec("M02ToolCardCrystal", "crystal", 0, -4, 12, 330, 22),                      // SWV:398
            new M02CardLabelSpec("M02ToolCardAction", "coreAction", 0, -30, 11, 330, 36, CardActionWrapChars), // SWV:399
            new M02CardLabelSpec("M02ToolCardUse", "whenToUse", 0, -56, 10, 330, 32, CardUseWrapChars)      // SWV:400
        });

        /// <summary>Label 行高 = fontSize + 5 SWV:440; 水平对齐=居中(horizontalAlign=1) SWV:442</summary>
        public static double LabelLineHeightPx(double fontSizePx) => fontSizePx + 5;

        /// <summary>超长文案定长折行(UTF-16 码元计数)。SWV:446-449。
        /// TS 用正则 .{1,N} 切块('.' 不吃换行); 卡面文案无换行, 与定长切块等价。maxChars&lt;1 时 TS 正则
        /// 构造即抛(SyntaxError), 此处同样抛出。</summary>
        public static string WrapCardText(string text, int maxChars)
        {
            if (maxChars < 1) throw new ArgumentOutOfRangeException(nameof(maxChars));
            if (text.Length <= maxChars) return text; // SWV:447
            var sb = new StringBuilder(text.Length + text.Length / maxChars + 1);
            for (var i = 0; i < text.Length; i += maxChars)
            {
                if (i > 0) sb.Append('\n'); // SWV:448 .join("\n")
                sb.Append(text, i, Math.Min(maxChars, text.Length - i));
            }
            return sb.ToString();
        }

        // ── 完成面板脉冲(已展示后再点) SWV:451-471; Cocos tween 默认缓动=线性 ──
        public const double PulseUpSeconds = 0.08;  // SWV:457
        public const double PulseUpScale = 1.03;    // SWV:457
        public const double PulseDownSeconds = 0.12; // SWV:463

        // ── 电量计 SWV:581-595 ──

        /// <summary>第 i 颗 pip 的 X 偏移(chargeLayer 局部) SWV:590</summary>
        public static double ChargePipOffsetXPx(int index) => index * ChargePipGapPx;

        /// <summary>pip 填充色: 剩余电量内=暖金, 其余=灰。SWV:591</summary>
        public static M01Color32 ChargePipColor(int index, int chargesLeft) =>
            index < chargesLeft ? ChargeColor : ChargeEmptyColor;

        // ── 竭状态遮罩 SWV:597-615 ──

        /// <summary>漏光点(遮罩层局部 px) SWV:611</summary>
        public static readonly IReadOnlyList<M02CirclePx> FailureLeakCircles = Array.AsReadOnly(new[]
        {
            new M02CirclePx(-74, 24, 18),
            new M02CirclePx(0, -16, 24),
            new M02CirclePx(82, 18, 14)
        });

        // ── 序章「三颗余烬点棒」 PV:21-40, 205-256 ──

        public const double EmberCoreRadiusPx = 10;      // PV:21
        public const double EmberGlowExtraPx = 22;       // PV:22 光晕最大外扩(随命数收缩)
        public const double EmberDragRadiusPx = 48;      // PV:23 拾取命中半径
        public const double WandTapRadiusPx = 70;        // PV:24 点棒命中半径
        public const double WandLengthPx = 84;           // PV:25
        public const double WandTipRadiusPx = 9;         // PV:26
        public const double DoneDelaySeconds = 1.1;      // PV:27 棒亮后停一拍再交还主谜题
        public const double DarkEmberCoreRadiusFactor = 0.7; // PV:230 暗烬核心缩小
        public const double WandLineWidthPx = 5;         // PV:242
        public const double WandLitGlowExtraPx = 12;     // PV:250 点亮棒尖光晕外扩

        public static readonly M01Color32 WandStickColor = new(126, 132, 150, 220);  // PV:37
        public static readonly M01Color32 WandTipDimColor = new(92, 98, 116, 255);   // PV:38
        public static readonly M01Color32 WandTipLitColor = new(248, 214, 150, 255); // PV:39
        public static readonly M01Color32 WandTipLitGlowColor = new(248, 214, 150, 120); // PV:40

        /// <summary>余烬核心色 = 主视图星色 palette 按值复用 PV:29-34</summary>
        public static M01Color32 EmberColor(string status) => StarFillColor(status);

        /// <summary>余烬核心半径: 暗烬 ×0.7。PV:230</summary>
        public static double EmberCoreRadiusResolvedPx(string status) =>
            status == StarNodeStatus.Dark ? EmberCoreRadiusPx * DarkEmberCoreRadiusFactor : EmberCoreRadiusPx;

        /// <summary>余烬光晕半径: 冻结满辐(PV:219), 衰减随命数收缩(PV:224), 暗烬不画(返回 0, PV:217-226 无分支)。</summary>
        public static double EmberGlowRadiusPx(string status, int life, int lifeMax)
        {
            if (status == StarNodeStatus.Frozen) return EmberCoreRadiusPx + EmberGlowExtraPx;      // PV:219
            if (status == StarNodeStatus.Decaying) return EmberCoreRadiusPx + EmberGlowExtraPx * life / lifeMax; // PV:224
            return 0;
        }

        /// <summary>余烬光晕色(填充圆): 冻结暖金 / 衰减琥珀。PV:218/223</summary>
        public static M01Color32 EmberGlowColor(string status) =>
            status == StarNodeStatus.Frozen ? FrozenGlowColor : DecayingGlowColor;

        /// <summary>棒杆基点(棒节点局部 px) PV:244 moveTo(0, -16)</summary>
        public static readonly Point2 WandBaseOffsetPx = new(0, -16);

        /// <summary>棒尖位置(棒节点局部 px): 插地=斜杆(30, 84-20), 在手/点亮=竖杆(0, 84)。PV:241</summary>
        public static Point2 WandTipOffsetPx(string wandState) =>
            wandState == WandState.Planted ? new Point2(30, WandLengthPx - 20) : new Point2(0, WandLengthPx);

        /// <summary>棒尖圆色: 点亮=暖金, 其余=暗灰。PV:253</summary>
        public static M01Color32 WandTipColor(string wandState) =>
            wandState == WandState.Lit ? WandTipLitColor : WandTipDimColor;
    }
}
