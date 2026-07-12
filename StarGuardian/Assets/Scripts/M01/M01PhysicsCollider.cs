// M01 物理翻滚拼片的碰撞体几何 + 可见圆片间隔判定 —— 引擎无关纯逻辑, 由 xUnit 钉死正确性.
// 从 assets/scripts/cocos/M01PhysicsCollider.ts 迁移, 规则不变.
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里.
//
// TS→C# 语义映射:
//   - M01PhysicsShape("circle"|"triangle"|"hexagon" 字符串联合)已在 M01PhysicsRotation.cs 转为 enum, 此处复用不重定义.
//   - interface M01PhysicsPoint {x,y} → readonly struct + IEquatable + ==/!=(C#9 无 record struct;
//     double 字段的 Equals 用 .Equals() 而非 ==, 兑现 record struct 的 NaN 自反语义, 防 wave-1 fable 审复发).
//   - 判别联合 M01PhysicsColliderSpec = {kind:"circle";radius} | {kind:"polygon";points} → 抽象 record 基类
//     + 两个 sealed 派生 record(circle 无 points / polygon 无 radius, 逐字还原联合各分支的字段集).
//     kind 判别式保为 string 字面量 "circle" / "polygon"(逐字, 测试断言依赖).
//   - interface M01PhysicsFragmentSeparationSample(数据 DTO)→ sealed record(init 只读), shape 字段用复用的 enum.
//   - 导出 const M01_PHYSICS_COLLIDER_VISUAL_PADDING_BY_SHAPE: Record<Shape,number> → public static readonly
//     IReadOnlyDictionary<M01PhysicsShape,double>(枚举键 → double; 三键齐全, 索引 [shape] 逐字对应 TS 的下标).
//   - 导出 const M01_PHYSICS_VISIBLE_OVERLAP_TOLERANCE=0.75 → public const double(可作默认参数值).
//   - 导出自由函数 build/resolve/are/visible... → 静态类 M01PhysicsCollider 上的 PascalCase 方法(去冗余前缀).
//   - number → double(几何); Math.sqrt/cos/sin/PI → System.Math 同名; Math.hypot(dx,dy) → Sqrt(dx*dx+dy*dy).

using System;
using System.Collections.Generic;

namespace StarGuardian.M01
{
    /// <summary>平面点 {x,y} —— TS interface M01PhysicsPoint(number → double)</summary>
    public readonly struct M01PhysicsPoint : IEquatable<M01PhysicsPoint>
    {
        public double X { get; }
        public double Y { get; }
        public M01PhysicsPoint(double x, double y) { X = x; Y = y; }
        public bool Equals(M01PhysicsPoint other) => X.Equals(other.X) && Y.Equals(other.Y);
        public override bool Equals(object? obj) => obj is M01PhysicsPoint p && Equals(p);
        public override int GetHashCode() => HashCode.Combine(X, Y);
        public static bool operator ==(M01PhysicsPoint a, M01PhysicsPoint b) => a.Equals(b);
        public static bool operator !=(M01PhysicsPoint a, M01PhysicsPoint b) => !a.Equals(b);
        public override string ToString() => $"M01PhysicsPoint {{ X = {X}, Y = {Y} }}";
    }

    /// <summary>
    /// 碰撞体几何 —— TS 判别联合 M01PhysicsColliderSpec.
    /// kind 判别式: "circle"(带 radius)| "polygon"(带 points). C#9 无判别联合 → 抽象基 record + 两派生 record.
    /// </summary>
    public abstract record M01PhysicsColliderSpec
    {
        /// <summary>判别式, 逐字保留 TS 字面量: "circle" | "polygon"</summary>
        public abstract string Kind { get; }
    }

    /// <summary>圆形碰撞体 —— TS 联合分支 {kind:"circle"; radius}</summary>
    public sealed record M01PhysicsCircleCollider : M01PhysicsColliderSpec
    {
        public override string Kind => "circle";
        public double Radius { get; init; }
    }

    /// <summary>多边形碰撞体 —— TS 联合分支 {kind:"polygon"; points}</summary>
    public sealed record M01PhysicsPolygonCollider : M01PhysicsColliderSpec
    {
        public override string Kind => "polygon";

        // 含 IReadOnlyList 字段: record 合成 == 只做引用相等, 本类型不被结构比较消费(仅读 Points), 故无碍.
        public IReadOnlyList<M01PhysicsPoint> Points { get; init; } = Array.Empty<M01PhysicsPoint>();
    }

    /// <summary>可见圆片间隔判定的取样 —— TS interface M01PhysicsFragmentSeparationSample</summary>
    public sealed record M01PhysicsFragmentSeparationSample
    {
        public M01PhysicsShape Shape { get; init; }
        public double Size { get; init; }
        public double X { get; init; }
        public double Y { get; init; }
    }

    /// <summary>
    /// M01PhysicsCollider.ts 的导出常量与四个自由函数(build/resolve/are/visible...)汇成静态类.
    /// 方法名去掉冗余的 M01PhysicsCollider 前缀(类名已含), 语义一一对应.
    /// </summary>
    public static class M01PhysicsCollider
    {
        /// <summary>各形状的可见留白(用于把碰撞体涨到视觉直径)—— TS M01_PHYSICS_COLLIDER_VISUAL_PADDING_BY_SHAPE</summary>
        public static readonly IReadOnlyDictionary<M01PhysicsShape, double> VisualPaddingByShape =
            new Dictionary<M01PhysicsShape, double>
            {
                [M01PhysicsShape.Circle] = 4,
                [M01PhysicsShape.Triangle] = 0,
                [M01PhysicsShape.Hexagon] = 0
            };

        /// <summary>可见重叠容差(px)—— TS M01_PHYSICS_VISIBLE_OVERLAP_TOLERANCE</summary>
        public const double VisibleOverlapTolerance = 0.75;

        /// <summary>
        /// 为一种拼片形状构建以原点为中心的碰撞体. size 为包围直径(宽/高较大者). —— TS buildM01PhysicsCollider
        /// </summary>
        public static M01PhysicsColliderSpec Build(M01PhysicsShape shape, double size)
        {
            var r = size / 2.0;
            if (shape == M01PhysicsShape.Circle)
            {
                return new M01PhysicsCircleCollider { Radius = r };
            }
            if (shape == M01PhysicsShape.Triangle)
            {
                var halfHeight = size / 2.0;
                var halfSide = size / Math.Sqrt(3.0);
                var trianglePoints = new List<M01PhysicsPoint>
                {
                    new(0, halfHeight),
                    new(-halfSide, -halfHeight),
                    new(halfSide, -halfHeight)
                };
                return new M01PhysicsPolygonCollider { Points = trianglePoints };
            }
            var points = new List<M01PhysicsPoint>();
            for (var i = 0; i < 6; i += 1)
            {
                // 六边形, 平顶朝向(顶部与底部为水平边)
                var angle = Math.PI / 3.0 * i;
                points.Add(new M01PhysicsPoint(r * Math.Cos(angle), r * Math.Sin(angle)));
            }
            return new M01PhysicsPolygonCollider { Points = points };
        }

        /// <summary>取一种形状的可见留白 —— TS resolveM01PhysicsColliderVisualPadding</summary>
        public static double ResolveVisualPadding(M01PhysicsShape shape) => VisualPaddingByShape[shape];

        /// <summary>
        /// 在物理沉降冻结之前, 判断所有圆片是否两两视觉分离(圆-圆才检查, 非圆跳过). —— TS areM01PhysicsCircleFragmentsVisuallySeparated
        /// </summary>
        public static bool AreCircleFragmentsVisuallySeparated(
            IReadOnlyList<M01PhysicsFragmentSeparationSample> fragments,
            double tolerance = VisibleOverlapTolerance)
        {
            for (var leftIndex = 0; leftIndex < fragments.Count; leftIndex += 1)
            {
                var left = fragments[leftIndex];
                if (left.Shape != M01PhysicsShape.Circle)
                {
                    continue;
                }
                for (var rightIndex = leftIndex + 1; rightIndex < fragments.Count; rightIndex += 1)
                {
                    var right = fragments[rightIndex];
                    if (right.Shape != M01PhysicsShape.Circle)
                    {
                        continue;
                    }
                    var dx = right.X - left.X;
                    var dy = right.Y - left.Y;
                    var distance = Math.Sqrt(dx * dx + dy * dy);
                    var minDistance =
                        VisibleCircleRadius(left) + VisibleCircleRadius(right) - tolerance;
                    if (distance < minDistance)
                    {
                        return false;
                    }
                }
            }

            return true;
        }

        /// <summary>圆片的可见半径(含留白)—— TS visibleCircleRadius</summary>
        public static double VisibleCircleRadius(M01PhysicsFragmentSeparationSample fragment) =>
            (fragment.Size + ResolveVisualPadding(fragment.Shape)) / 2.0;
    }
}
