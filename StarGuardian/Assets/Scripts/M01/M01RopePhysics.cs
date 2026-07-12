// 割绳子式软绳物理(纯逻辑, 无 cc/引擎依赖 → dotnet 可跑) —— M01 吊篮的两根吊绳共用一条物理链。
//
// 做法 = 2D 游戏绳子的业界标准(Cut the Rope 同族; Jakobsen "Advanced Character Physics", GDC 2001):
// 绳 = 一串 Verlet 粒子 + 段间距离约束(迭代松弛); 重物(篮子)不是独立系统, 而是【链的末端粒子】,
// 质量远大于绳点 → 约束修正按逆质量加权(invMass), 绳让位、篮子稳。钉子端 invMass=0(钉死)。
// 被顶起 = 给尾粒子注入速度 → 链松弛(自然下垂/甩动)→ 回落绷紧瞬间, 径向分量被位置投影吸收
// (不可拉伸、非弹簧、不回弹), 切向分量保留 → 篮子被绳拽住左右乱晃、随阻尼渐渐收住。
// 稳定性要点(文献一致): 固定子步长(不可变 dt)、迭代次数 ≈ 2×节点数、速度阻尼 <1。
//
// 从 assets/scripts/cocos/M01RopePhysics.ts 迁移, 规则不变.
// TS 语义映射:
//   number → double(iterations 例外: 循环计数 → int); Math.hypot → Math.Sqrt(x²+y²);
//   RopePoint/RopeState 会被逐点【就地改写】(kickTail/stepRope 抓引用改字段) → 可变 class(引用语义),
//     不可用 struct(装箱/写回会丢改动), 也不用 record(无需值相等/with);
//   RopeOptions 只读入参 + 测试 `{ ...OPTS, gravity: 0 }` 展开 → record(`opts with { Gravity = 0 }`);
//   `Math.hypot(dx,dy) || 1e-9` 的 JS falsy 兜底(0/NaN 都当假)→ 显式 0/NaN 判后置 1e-9。

using System;
using System.Collections.Generic;

namespace StarGuardian.M01
{
    /// <summary>一枚 Verlet 粒子(会被就地改写) —— TS RopePoint</summary>
    public sealed class RopePoint
    {
        public double X { get; set; }
        public double Y { get; set; }

        /// <summary>Verlet 上一位置(速度隐含在 (x,y)-(px,py) 里)。</summary>
        public double Px { get; set; }
        public double Py { get; set; }

        /// <summary>逆质量: 0=钉死(钉子), 1=普通绳点, 小值=重物(篮子)。约束修正按 invMass 比例分摊。</summary>
        public double InvMass { get; set; }
    }

    /// <summary>一条绳的全部状态(acc 会被就地推进) —— TS RopeState</summary>
    public sealed class RopeState
    {
        /// <summary>[0]=钉子(钉死), [length-1]=尾端重物(篮子挂点)。</summary>
        public List<RopePoint> Pts { get; init; } = new();

        /// <summary>每段静止长度。</summary>
        public double SegLength { get; init; }

        /// <summary>子步时间累加器(秒): 帧时间不是子步整数倍时把余数带到下一帧 → 帧率无关(codex 审出取整丢余数)。</summary>
        public double Acc { get; set; }
    }

    /// <summary>仿真旋钮(只读) —— TS RopeOptions。record 以支持测试的 `opts with { ... }`。</summary>
    public sealed record RopeOptions
    {
        /// <summary>重力加速度 px/s²(向下为负, 与世界 y-up 一致)。</summary>
        public double Gravity { get; init; }

        /// <summary>每子步速度保留系数(&lt;1; 越小越快静止)。</summary>
        public double Damping { get; init; }

        /// <summary>每子步距离约束松弛迭代数(≈2×节点数; 越多绳越不可拉伸)。</summary>
        public int Iterations { get; init; }

        /// <summary>固定子步长(秒)。帧时间被切成整数个子步, 文献强调不可用可变 dt。</summary>
        public double SubstepDt { get; init; }
    }

    public static class M01RopePhysics
    {
        /// <summary>总绳长(段长×段数)。</summary>
        public static double RopeLengthOf(RopeState state) =>
            state.SegLength * (state.Pts.Count - 1);

        /// <summary>头端(钉子)到尾端(篮子)拉一条直链, 点均匀分布。tailInvMass 越小篮子越重。</summary>
        public static RopeState CreateRope(
            double nailX,
            double nailY,
            double tailX,
            double tailY,
            int pointCount,
            double tailInvMass)
        {
            var pts = new List<RopePoint>();
            for (var i = 0; i < pointCount; i += 1)
            {
                var t = (double)i / (pointCount - 1); // 整数除法陷阱: 必须提升到 double
                var x = nailX + (tailX - nailX) * t;
                var y = nailY + (tailY - nailY) * t;
                var invMass = i == 0 ? 0.0 : i == pointCount - 1 ? tailInvMass : 1.0;
                pts.Add(new RopePoint { X = x, Y = y, Px = x, Py = y, InvMass = invMass });
            }
            var segLength = Math.Sqrt((tailX - nailX) * (tailX - nailX) + (tailY - nailY) * (tailY - nailY)) / (pointCount - 1);
            return new RopeState { Pts = pts, SegLength = segLength, Acc = 0 };
        }

        /// <summary>
        /// 给尾端(篮子)注入速度(px/s) —— 顶篮冲击。Verlet 里速度 = (当前-上一位置)/dt,
        /// 故把 prev 反向偏移一个子步的位移。可叠加(连顶)。
        /// </summary>
        public static void KickTail(RopeState state, double vx, double vy, double substepDt)
        {
            var tail = state.Pts[state.Pts.Count - 1];
            tail.Px -= vx * substepDt;
            tail.Py -= vy * substepDt;
        }

        /// <summary>
        /// 推进 elapsed 秒。固定子步 + 余数累加器(acc): 帧时间切成整数个子步, 余数带到下一帧 →
        /// 任何帧率下单位真实时间跑的子步数相同(帧率无关, 项目铁律)。子步数上限防卡顿死亡螺旋,
        /// 截断时丢弃多余积压(宁可慢一拍, 不补爆发步)。
        /// 每子步: Verlet 积分(重力+阻尼) → iterations 轮距离约束(质量加权·【仅拉伸侧】投影) → 钉死头端。
        /// </summary>
        public static void StepRope(RopeState state, double elapsedSeconds, RopeOptions opts)
        {
            state.Acc += Math.Max(0.0, elapsedSeconds);
            var steps = Math.Floor(state.Acc / opts.SubstepDt); // number(可能极大)→ 保 double, 钳后再当计数, 避免 (int) 溢出偏离 TS
            if (steps > 16)
            {
                steps = 16;
                state.Acc = opts.SubstepDt * 16; // 卡顿积压: 截到上限, 不让 acc 无界增长
            }
            state.Acc -= steps * opts.SubstepDt;
            var dt = opts.SubstepDt;
            var g = opts.Gravity * dt * dt;
            var pts = state.Pts;
            var nailX = pts[0].X;
            var nailY = pts[0].Y;

            for (var s = 0; s < steps; s += 1)
            {
                // Verlet 积分: 钉死点(invMass 0)不动。
                for (var i = 1; i < pts.Count; i += 1)
                {
                    var p = pts[i];
                    var vx = (p.X - p.Px) * opts.Damping;
                    var vy = (p.Y - p.Py) * opts.Damping;
                    p.Px = p.X;
                    p.Py = p.Y;
                    p.X += vx;
                    p.Y += vy + g;
                }
                // 距离约束【仅拉伸侧】: 段被拉长才收紧; 压缩(松弛)不撑开 —— 真软绳会垮不会顶。
                // (codex 数值复现: 双向投影会把竖直上顶的篮子"推"回去 —— 正下方顶击只抬 ~11px。)
                for (var iter = 0; iter < opts.Iterations; iter += 1)
                {
                    for (var i = 0; i < pts.Count - 1; i += 1)
                    {
                        var a = pts[i];
                        var b = pts[i + 1];
                        var dx = b.X - a.X;
                        var dy = b.Y - a.Y;
                        var dist = Math.Sqrt(dx * dx + dy * dy);
                        if (dist == 0 || double.IsNaN(dist)) dist = 1e-9; // TS `|| 1e-9`: 0/NaN(falsy)→兜底非零, 防除零
                        if (dist <= state.SegLength) continue; // 松弛段: 软绳不传压力
                        var wSum = a.InvMass + b.InvMass;
                        if (wSum == 0) continue;
                        var diff = (dist - state.SegLength) / dist / wSum;
                        var ox = dx * diff;
                        var oy = dy * diff;
                        a.X += ox * a.InvMass;
                        a.Y += oy * a.InvMass;
                        b.X -= ox * b.InvMass;
                        b.Y -= oy * b.InvMass;
                    }
                    pts[0].X = nailX; // invMass 0 本就不动, 双保险钉死
                    pts[0].Y = nailY;
                }
            }
        }
    }
}
