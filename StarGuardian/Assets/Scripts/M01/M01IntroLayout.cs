// M01 篮子开场布局(篮体缩放 / 物理内腔 / 堆叠种子点 / 溢出抛速)的纯几何逻辑 —— 引擎无关, 由 xUnit 钉死正确性.
// 从 assets/scripts/cocos/M01IntroLayout.ts 迁移, 规则不变.
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里.
// TS→C# 语义映射:
//   - 顶层 export const / 自由函数 → 静态类 M01IntroLayout 的静态成员(PascalCase, 数值逐字保留);
//   - number → double(几何/尺寸/角度, 精度不变); 计数(目标片数/可见范围/索引)→ int;
//   - 匿名值对 {x,y}/{width,height}/{vx,vy}/{min,max} → 手写 readonly struct(禁 record struct →
//     IEquatable + == / != 齐全); TS interface M01IntroBasketInnerWall + 配置对象字面量
//     (内腔 / 溢出) → sealed record;
//   - 字符串字面量联合 id("bottom"|"left"|"right")与形状("circle"|"triangle"|"hexagon")→ string, 逐字保留;
//   - Math.hypot(a,b) → Math.Sqrt(a*a + b*b); Math.atan2/PI/floor/max/min → System.Math 同名;
//   - Array.map/.filter().length → LINQ Select / Count; 默认参数 = EffectiveColliderSize(const) 保持;
//   - 静态字段按文本顺序初始化: InnerCavity(static readonly)必须先于依赖它的墙面几何常量与墙面数组声明.

using System;
using System.Collections.Generic;
using System.Linq;

namespace StarGuardian.M01
{
    /// <summary>轴对齐尺寸 {width,height} —— TS 匿名对象 {width;height}</summary>
    public readonly struct M01IntroSize : IEquatable<M01IntroSize>
    {
        public double Width { get; }
        public double Height { get; }
        public M01IntroSize(double width, double height) { Width = width; Height = height; }
        public bool Equals(M01IntroSize other) => Width == other.Width && Height == other.Height;
        public override bool Equals(object? obj) => obj is M01IntroSize s && Equals(s);
        public override int GetHashCode() => HashCode.Combine(Width, Height);
        public static bool operator ==(M01IntroSize a, M01IntroSize b) => a.Equals(b);
        public static bool operator !=(M01IntroSize a, M01IntroSize b) => !a.Equals(b);
        public override string ToString() => $"M01IntroSize {{ Width = {Width}, Height = {Height} }}";
    }

    /// <summary>平面点 {x,y} —— TS 匿名对象 {x;y}(墙心 / 堆叠种子点复用同一类型)</summary>
    public readonly struct M01IntroPoint : IEquatable<M01IntroPoint>
    {
        public double X { get; }
        public double Y { get; }
        public M01IntroPoint(double x, double y) { X = x; Y = y; }
        public bool Equals(M01IntroPoint other) => X == other.X && Y == other.Y;
        public override bool Equals(object? obj) => obj is M01IntroPoint p && Equals(p);
        public override int GetHashCode() => HashCode.Combine(X, Y);
        public static bool operator ==(M01IntroPoint a, M01IntroPoint b) => a.Equals(b);
        public static bool operator !=(M01IntroPoint a, M01IntroPoint b) => !a.Equals(b);
        public override string ToString() => $"M01IntroPoint {{ X = {X}, Y = {Y} }}";
    }

    /// <summary>单片溢出抛速 {vx,vy} —— resolveM01IntroSpillFlingVelocity 的返回</summary>
    public readonly struct M01IntroFlingVelocity : IEquatable<M01IntroFlingVelocity>
    {
        public double Vx { get; }
        public double Vy { get; }
        public M01IntroFlingVelocity(double vx, double vy) { Vx = vx; Vy = vy; }
        public bool Equals(M01IntroFlingVelocity other) => Vx == other.Vx && Vy == other.Vy;
        public override bool Equals(object? obj) => obj is M01IntroFlingVelocity v && Equals(v);
        public override int GetHashCode() => HashCode.Combine(Vx, Vy);
        public static bool operator ==(M01IntroFlingVelocity a, M01IntroFlingVelocity b) => a.Equals(b);
        public static bool operator !=(M01IntroFlingVelocity a, M01IntroFlingVelocity b) => !a.Equals(b);
        public override string ToString() => $"M01IntroFlingVelocity {{ Vx = {Vx}, Vy = {Vy} }}";
    }

    /// <summary>可见片数区间 {min,max} —— TS {min:4,max:5}(计数, int)</summary>
    public readonly struct M01IntroPieceCountRange : IEquatable<M01IntroPieceCountRange>
    {
        public int Min { get; }
        public int Max { get; }
        public M01IntroPieceCountRange(int min, int max) { Min = min; Max = max; }
        public bool Equals(M01IntroPieceCountRange other) => Min == other.Min && Max == other.Max;
        public override bool Equals(object? obj) => obj is M01IntroPieceCountRange r && Equals(r);
        public override int GetHashCode() => HashCode.Combine(Min, Max);
        public static bool operator ==(M01IntroPieceCountRange a, M01IntroPieceCountRange b) => a.Equals(b);
        public static bool operator !=(M01IntroPieceCountRange a, M01IntroPieceCountRange b) => !a.Equals(b);
        public override string ToString() => $"M01IntroPieceCountRange {{ Min = {Min}, Max = {Max} }}";
    }

    /// <summary>篮子物理内腔配置 —— TS 对象字面量 M01_INTRO_BASKET_INNER_CAVITY</summary>
    public sealed record M01IntroBasketCavity
    {
        public double FloorY { get; init; }
        public double WallTopY { get; init; }
        public double BottomHalfWidth { get; init; }
        public double TopHalfWidth { get; init; }
        public double FrontOcclusionY { get; init; }
        public double WallThickness { get; init; }
        public double WallFriction { get; init; }
        public double WallRestitution { get; init; }
    }

    /// <summary>第二次点击的溢出抛速配置 —— TS 对象字面量 M01_INTRO_BASKET_SPILL</summary>
    public sealed record M01IntroBasketSpill
    {
        public double FlingVx { get; init; }
        public double FlingVxJitter { get; init; }
        public double FlingVy { get; init; }
        public double FlingVyJitter { get; init; }
    }

    /// <summary>内腔一面墙(底/左/右)—— TS interface M01IntroBasketInnerWall</summary>
    public sealed record M01IntroBasketInnerWall
    {
        // id: "bottom" | "left" | "right" —— 逐字保留(测试断言依赖)。
        public string Id { get; init; } = "";
        public M01IntroPoint Center { get; init; }
        public M01IntroSize Size { get; init; }
        public double AngleDeg { get; init; }
    }

    public static class M01IntroLayout
    {
        // 一个旋钮温和放大整套篮子, 让 9 片标准尺寸(56×56)在其中堆成可见的一摞。片仍保持标准尺寸;
        // 只有篮体贴图 + 物理内腔 + 堆叠偏移 + 钉高按此缩放。用户只想比原始 387×242 托盘(1.0)大约 5-10%。
        public const double BasketScale = 1.12;

        public static readonly M01IntroSize BasketDisplaySize =
            new(387 * BasketScale, 242 * BasketScale);

        public const int TargetPieceCount = 9;

        public static readonly M01IntroPieceCountRange VisiblePieceCountRange = new(4, 5);

        public const double EffectiveColliderSize = 60;

        // 把整个内腔(地板 + 墙)相对篮子向下移。-y = 下。单位 px。
        public const double CavityYShift = -15;

        // 此处所有几何都是篮子局部世界单位, 随 BasketScale 缩放, 使物理内腔始终匹配(缩放后的)可见碗。
        // 隐形容纳墙比可见碗更高(WallTopY), 让 9 片堆在沉降时保持被容纳。
        public static readonly M01IntroBasketCavity InnerCavity = new()
        {
            FloorY = -74 * BasketScale + CavityYShift,
            WallTopY = -25 * BasketScale + CavityYShift,
            BottomHalfWidth = 126 * BasketScale,
            TopHalfWidth = 149 * BasketScale,
            FrontOcclusionY = 20 * BasketScale + CavityYShift,
            WallThickness = 16 * BasketScale,
            WallFriction = 0.76,
            WallRestitution = 0.03
        };

        // 第二次点击溢出。片随篮子摇晃"骑"在上面, 然后释放为 Dynamic 并按倾倒方向(左下)抛出。
        // 我们脚本化抛速而非依赖碗壁扫出: node-tween 用瞬移搬动刚体不带 Box2D 速度, 挥动的"运动学"墙
        // 不产生甩劲 —— 片会直直落下。速度单位 px/s; 重力(-640)再把它们弧射到静态地面边界。
        public static readonly M01IntroBasketSpill Spill = new()
        {
            FlingVx = -150,      // 朝倾倒口(左下)的基础水平抛
            FlingVxJitter = 80,  // 每片水平散布, 使其倾泻而非整块移动
            FlingVy = 70,        // 小幅上抛外弧; 重力随后拉入堆里
            FlingVyJitter = 55   // 每片竖直散布
        };

        /// <summary>
        /// 确定性的单片抛速(无 RNG → 帧率无关且可单测)。每片得一个向左 vx(出倾倒口)带散布, 和一个小外弧 vy。
        /// —— TS resolveM01IntroSpillFlingVelocity
        /// </summary>
        public static M01IntroFlingVelocity ResolveSpillFlingVelocity(int index)
        {
            var xPhase = (index % 3) - 1;   // -1, 0, +1 循环 → 围绕 flingVx 散布
            var yPhase = (index % 2) * 2 - 1; // -1, +1 交替
            return new M01IntroFlingVelocity(
                Spill.FlingVx + xPhase * Spill.FlingVxJitter,
                Spill.FlingVy + yPhase * Spill.FlingVyJitter);
        }

        private static readonly double LeftWallDx =
            -InnerCavity.TopHalfWidth + InnerCavity.BottomHalfWidth;
        private static readonly double RightWallDx =
            InnerCavity.TopHalfWidth - InnerCavity.BottomHalfWidth;
        private static readonly double WallDy =
            InnerCavity.WallTopY - InnerCavity.FloorY;
        private static readonly double SideWallLength =
            Math.Sqrt(RightWallDx * RightWallDx + WallDy * WallDy);

        // 把内腔两面侧墙都对称地向中心拉进这么多, 使其对齐碗的内壁并留在画布内。
        // 左墙 +x(向右); 右墙 -x(向左)。
        private const double WallXInwardNudge = 40;

        public static readonly IReadOnlyList<M01IntroBasketInnerWall> InnerCavityWalls =
            new List<M01IntroBasketInnerWall>
            {
                new()
                {
                    Id = "bottom",
                    Center = new M01IntroPoint(0, InnerCavity.FloorY - InnerCavity.WallThickness / 2),
                    Size = new M01IntroSize(InnerCavity.BottomHalfWidth * 2, InnerCavity.WallThickness),
                    AngleDeg = 0
                },
                new()
                {
                    Id = "left",
                    Center = new M01IntroPoint(
                        (-InnerCavity.BottomHalfWidth - InnerCavity.TopHalfWidth) / 2 + WallXInwardNudge,
                        (InnerCavity.FloorY + InnerCavity.WallTopY) / 2),
                    Size = new M01IntroSize(SideWallLength, InnerCavity.WallThickness),
                    AngleDeg = Math.Atan2(WallDy, LeftWallDx) * 180 / Math.PI
                },
                new()
                {
                    Id = "right",
                    Center = new M01IntroPoint(
                        (InnerCavity.BottomHalfWidth + InnerCavity.TopHalfWidth) / 2 - WallXInwardNudge,
                        (InnerCavity.FloorY + InnerCavity.WallTopY) / 2),
                    Size = new M01IntroSize(SideWallLength, InnerCavity.WallThickness),
                    AngleDeg = Math.Atan2(WallDy, RightWallDx) * 180 / Math.PI
                }
            };

        // 9 片真实游戏片在篮内的布局(篮子节点局部)。底排藏在前墙后, 中/上排只露 5 个上缘剪影。
        // 中心按加垫物理碰撞直径分开, 使堆叠遵守与地面堆同样的"物体有体积"规则。
        // 这些是掉落种子(非最终位置): 片从此起步, 再由物理沉降成一摞。随篮子缩放。
        public static readonly IReadOnlyList<M01IntroPoint> PileOffsets =
            new List<M01IntroPoint>
            {
                // 底排: 四片贴近内地板。
                new(-90 * BasketScale, -44 * BasketScale),
                new(-30 * BasketScale, -44 * BasketScale),
                new(30 * BasketScale, -44 * BasketScale),
                new(90 * BasketScale, -44 * BasketScale),
                // 中排。
                new(-60 * BasketScale, 8 * BasketScale),
                new(0 * BasketScale, 8 * BasketScale),
                new(60 * BasketScale, 8 * BasketScale),
                // 上排。
                new(-30 * BasketScale, 56 * BasketScale),
                new(30 * BasketScale, 56 * BasketScale)
            };

        public static readonly IReadOnlyList<string> PileShapes =
            new List<string>
            {
                "circle",
                "circle",
                "circle",
                "triangle",
                "triangle",
                "triangle",
                "hexagon",
                "hexagon",
                "hexagon"
            };

        /// <summary>内腔在给定 y 处的半宽(底窄顶宽线性内插, 夹在 [floor, wallTop])—— TS resolveM01IntroBasketInnerHalfWidthAtY</summary>
        public static double ResolveInnerHalfWidthAtY(double y)
        {
            var range = InnerCavity.WallTopY - InnerCavity.FloorY;
            var t = range <= 0
                ? 1
                : Math.Max(0, Math.Min(1, (y - InnerCavity.FloorY) / range));
            return InnerCavity.BottomHalfWidth +
                   (InnerCavity.TopHalfWidth - InnerCavity.BottomHalfWidth) * t;
        }

        /// <summary>堆叠种子点是否两两分开(中心距 + 容差 >= 最小允许中心距)—— TS areM01IntroBasketPileOffsetsSeparated</summary>
        public static bool ArePileOffsetsSeparated(
            double pieceDiameter = EffectiveColliderSize,
            double tolerance = 0.75)
        {
            for (var left = 0; left < PileOffsets.Count; left += 1)
            {
                for (var right = left + 1; right < PileOffsets.Count; right += 1)
                {
                    var dx = PileOffsets[right].X - PileOffsets[left].X;
                    var dy = PileOffsets[right].Y - PileOffsets[left].Y;
                    if (Math.Sqrt(dx * dx + dy * dy) + tolerance <
                        ResolveMinCenterDistance(left, right, pieceDiameter))
                    {
                        return false;
                    }
                }
            }

            return true;
        }

        /// <summary>两片最小允许中心距: 双圆用圆直径, 否则 56 —— TS resolveM01IntroBasketMinCenterDistance</summary>
        public static double ResolveMinCenterDistance(
            int leftIndex,
            int rightIndex,
            double circleDiameter = EffectiveColliderSize)
        {
            var leftShape = ShapeAt(leftIndex);
            var rightShape = ShapeAt(rightIndex);
            return leftShape == "circle" && rightShape == "circle" ? circleDiameter : 56;
        }

        /// <summary>所有堆叠种子点是否都在内腔内(不穿地板、不超当地半宽)—— TS isM01IntroBasketPileInsideInnerCavity</summary>
        public static bool IsPileInsideInnerCavity(double pieceDiameter = EffectiveColliderSize)
        {
            for (var index = 0; index < PileOffsets.Count; index += 1)
            {
                var offset = PileOffsets[index];
                var radius = ResolveCavityRadius(index, pieceDiameter);
                if (offset.Y - radius < InnerCavity.FloorY)
                {
                    return false;
                }
                // 注: 掉落种子可能坐在(矮的)容纳墙之上 —— 片从上方掉入内腔, 故此处不设 wallTopY 顶棚检查。
                if (Math.Abs(offset.X) + radius > ResolveInnerHalfWidthAtY(offset.Y))
                {
                    return false;
                }
            }

            return true;
        }

        private static double ResolveCavityRadius(int index, double circleDiameter)
        {
            var shape = ShapeAt(index);
            return shape == "circle" ? circleDiameter / 2 : 28;
        }

        // TS `arr[i % len]`: i>=0 取(取模包裹的)形状; i<0 → undefined(非 circle)。C# List 负索引会抛, 故显式复刻。
        private static string? ShapeAt(int index) =>
            index >= 0 ? PileShapes[index % PileShapes.Count] : null;

        /// <summary>露出前墙上缘之上的种子点数(y + 半径 > frontOcclusionY)—— TS countM01IntroBasketVisiblePileOffsets</summary>
        public static int CountVisiblePileOffsets(double pieceDisplaySize)
        {
            var radius = pieceDisplaySize / 2;
            return PileOffsets.Count(offset => offset.Y + radius > InnerCavity.FrontOcclusionY);
        }
    }
}
