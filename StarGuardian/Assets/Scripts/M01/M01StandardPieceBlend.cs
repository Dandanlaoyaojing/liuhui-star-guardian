// M01 标准拼片重叠混色的纯几何逻辑 —— 引擎无关, 由 xUnit 钉死正确性.
// 从 assets/scripts/cocos/M01StandardPieceBlend.ts 迁移, 规则不变.
// 这些 .cs 不得 using UnityEngine —— 它们要同时活在 dotnet test 与 Unity Assets 里。
//
// TS→C# 语义映射:
//   - interface M01StandardPieceBlendPoint / size{width,height} → readonly struct + IEquatable + ==/!=
//     (C#9 无 record struct → 手写不可变值类型, 语义同 record struct)。源文件自带这些类型,
//     未 import Interaction.Point2, 故保留源名 M01StandardPieceBlendPoint, 不跨命名空间复用。
//   - interface M01StandardPieceBlendPlacement / Overlay(数据 DTO)→ sealed record(init 只读)。
//   - number → double(cos/sin/sqrt 几何)；CIRCLE_SEGMENTS → int 常量。
//   - rotation?: number → double? (null 区分 TS 的 undefined; ?? 0 对应 ?? 0.0)。
//   - 字符串字面量联合 M01BaseColor/M01BlendColor → 纯 string(TS 运行期即字符串)。
//   - 导出自由函数 resolve.../build... → 静态类 M01StandardPieceBlend 上的 PascalCase 方法。
//
//   依赖说明: 源 import 了 M01MemoryGearController 的 blendM01PigmentColors 与 M01BaseColor/M01BlendColor。
//   该控制器尚未转写为 C#; 这三者本质是纯字符串 + 一张 3 项颜料混色表, 故在此内联为 private helper
//   (private → 不与将来 M01MemoryGearController.cs 在同命名空间产生公共类型冲突)。控制器落地后可去重。

using System;
using System.Collections.Generic;
using System.Linq;

namespace StarGuardian.M01
{
    /// <summary>平面点 (X,Y) —— TS interface M01StandardPieceBlendPoint(number → double)</summary>
    public readonly struct M01StandardPieceBlendPoint : IEquatable<M01StandardPieceBlendPoint>
    {
        public double X { get; }
        public double Y { get; }
        public M01StandardPieceBlendPoint(double x, double y) { X = x; Y = y; }
        public bool Equals(M01StandardPieceBlendPoint other) => X == other.X && Y == other.Y;
        public override bool Equals(object obj) => obj is M01StandardPieceBlendPoint p && Equals(p);
        public override int GetHashCode() => HashCode.Combine(X, Y);
        public static bool operator ==(M01StandardPieceBlendPoint a, M01StandardPieceBlendPoint b) => a.Equals(b);
        public static bool operator !=(M01StandardPieceBlendPoint a, M01StandardPieceBlendPoint b) => !a.Equals(b);
        public override string ToString() => $"M01StandardPieceBlendPoint {{ X = {X}, Y = {Y} }}";
    }

    /// <summary>拼片尺寸 —— TS 的 size: { width: number; height: number }</summary>
    public readonly struct M01StandardPieceBlendSize : IEquatable<M01StandardPieceBlendSize>
    {
        public double Width { get; }
        public double Height { get; }
        public M01StandardPieceBlendSize(double width, double height) { Width = width; Height = height; }
        public bool Equals(M01StandardPieceBlendSize other) => Width == other.Width && Height == other.Height;
        public override bool Equals(object obj) => obj is M01StandardPieceBlendSize s && Equals(s);
        public override int GetHashCode() => HashCode.Combine(Width, Height);
        public static bool operator ==(M01StandardPieceBlendSize a, M01StandardPieceBlendSize b) => a.Equals(b);
        public static bool operator !=(M01StandardPieceBlendSize a, M01StandardPieceBlendSize b) => !a.Equals(b);
        public override string ToString() => $"M01StandardPieceBlendSize {{ Width = {Width}, Height = {Height} }}";
    }

    /// <summary>已放置的标准拼片 —— TS interface M01StandardPieceBlendPlacement</summary>
    public sealed record M01StandardPieceBlendPlacement
    {
        public string Id { get; init; } = "";
        public string ShapeToken { get; init; } = "";
        public string ColorToken { get; init; } = "";
        public M01StandardPieceBlendPoint Position { get; init; }
        public M01StandardPieceBlendSize Size { get; init; }

        /// <summary>缺省(TS 的 rotation?: undefined)时按 0° 处理</summary>
        public double? Rotation { get; init; }
    }

    /// <summary>两片重叠区域的混色覆盖 —— TS interface M01StandardPieceBlendOverlay</summary>
    public sealed record M01StandardPieceBlendOverlay
    {
        public string Id { get; init; } = "";

        /// <summary>TS 的 [string, string]: 恰好两个源拼片 Id</summary>
        public IReadOnlyList<string> SourceIds { get; init; } = Array.Empty<string>();

        /// <summary>混色后的颜色(M01BlendColor)</summary>
        public string ColorToken { get; init; } = "";

        public IReadOnlyList<M01StandardPieceBlendPoint> Points { get; init; } =
            Array.Empty<M01StandardPieceBlendPoint>();
    }

    /// <summary>
    /// M01StandardPieceBlend.ts 的两个导出自由函数
    /// (resolveM01StandardPieceBlendOverlays / buildM01StandardPiecePolygon)与私有几何工具汇成静态类。
    /// 方法名去掉冗余的 M01StandardPiece 前缀(类名已含), 语义一一对应。
    /// </summary>
    public static class M01StandardPieceBlend
    {
        private const int CircleSegments = 72;
        private const double MinVisibleOverlapArea = 8;

        /// <summary>两两求原色拼片的可见重叠区并给出颜料混色 —— TS resolveM01StandardPieceBlendOverlays</summary>
        public static IReadOnlyList<M01StandardPieceBlendOverlay> ResolveOverlays(
            IReadOnlyList<M01StandardPieceBlendPlacement> pieces)
        {
            var overlays = new List<M01StandardPieceBlendOverlay>();

            for (var firstIndex = 0; firstIndex < pieces.Count; firstIndex += 1)
            {
                var first = pieces[firstIndex];
                if (!IsBaseColor(first.ColorToken))
                {
                    continue;
                }

                for (var secondIndex = firstIndex + 1; secondIndex < pieces.Count; secondIndex += 1)
                {
                    var second = pieces[secondIndex];
                    if (!IsBaseColor(second.ColorToken))
                    {
                        continue;
                    }

                    var points = ClipPolygon(
                        BuildPolygon(first),
                        BuildPolygon(second));
                    if (points.Count < 3 || PolygonArea(points) < MinVisibleOverlapArea)
                    {
                        continue;
                    }

                    overlays.Add(new M01StandardPieceBlendOverlay
                    {
                        Id = $"blend_{first.Id}_{second.Id}",
                        SourceIds = new[] { first.Id, second.Id },
                        ColorToken = BlendPigmentColors(first.ColorToken, second.ColorToken),
                        Points = points
                    });
                }
            }

            return overlays;
        }

        /// <summary>把一片的本地多边形按其位置+旋转变换到世界坐标 —— TS buildM01StandardPiecePolygon</summary>
        public static IReadOnlyList<M01StandardPieceBlendPoint> BuildPolygon(
            M01StandardPieceBlendPlacement piece)
        {
            var localPoints = BuildLocalPolygon(piece.ShapeToken, piece.Size);
            var rotation = (piece.Rotation ?? 0.0) * Math.PI / 180.0;
            var cos = Math.Cos(rotation);
            var sin = Math.Sin(rotation);

            var result = new List<M01StandardPieceBlendPoint>(localPoints.Count);
            foreach (var point in localPoints)
            {
                result.Add(new M01StandardPieceBlendPoint(
                    piece.Position.X + point.X * cos - point.Y * sin,
                    piece.Position.Y + point.X * sin + point.Y * cos));
            }

            return result;
        }

        private static IReadOnlyList<M01StandardPieceBlendPoint> BuildLocalPolygon(
            string shapeToken,
            M01StandardPieceBlendSize size)
        {
            if (shapeToken == "triangle")
            {
                var sideLength = Math.Min(size.Width, size.Height * 2.0 / Math.Sqrt(3.0));
                var halfSide = sideLength / 2.0;
                var triangleHeight = sideLength * Math.Sqrt(3.0) / 2.0;

                return new List<M01StandardPieceBlendPoint>
                {
                    new(0, triangleHeight / 2.0),
                    new(-halfSide, -triangleHeight / 2.0),
                    new(halfSide, -triangleHeight / 2.0)
                };
            }

            if (shapeToken == "hexagon")
            {
                var radius = Math.Min(size.Width / 2.0, size.Height / Math.Sqrt(3.0));
                var halfRadius = radius / 2.0;
                var halfHeight = Math.Sqrt(3.0) * radius / 2.0;

                return new List<M01StandardPieceBlendPoint>
                {
                    new(-radius, 0),
                    new(-halfRadius, halfHeight),
                    new(halfRadius, halfHeight),
                    new(radius, 0),
                    new(halfRadius, -halfHeight),
                    new(-halfRadius, -halfHeight)
                };
            }

            var circleRadius = Math.Min(size.Width, size.Height) / 2.0;
            var circle = new List<M01StandardPieceBlendPoint>(CircleSegments);
            for (var index = 0; index < CircleSegments; index += 1)
            {
                var angle = Math.PI * 2.0 * index / CircleSegments;
                circle.Add(new M01StandardPieceBlendPoint(
                    Math.Cos(angle) * circleRadius,
                    Math.Sin(angle) * circleRadius));
            }

            return circle;
        }

        /// <summary>Sutherland–Hodgman: 用 clip 多边形裁剪 subject 多边形 —— TS clipPolygon</summary>
        private static IReadOnlyList<M01StandardPieceBlendPoint> ClipPolygon(
            IReadOnlyList<M01StandardPieceBlendPoint> subject,
            IReadOnlyList<M01StandardPieceBlendPoint> clip)
        {
            var orientation = PolygonOrientation(clip);
            IReadOnlyList<M01StandardPieceBlendPoint> output = subject;

            for (var index = 0; index < clip.Count; index += 1)
            {
                var start = clip[index];
                var end = clip[(index + 1) % clip.Count];
                var input = output;
                var next = new List<M01StandardPieceBlendPoint>();
                output = next;
                if (input.Count == 0)
                {
                    break;
                }

                var previous = input[input.Count - 1];
                foreach (var current in input)
                {
                    var currentInside = IsInside(current, start, end, orientation);
                    var previousInside = IsInside(previous, start, end, orientation);

                    if (currentInside)
                    {
                        if (!previousInside)
                        {
                            next.Add(Intersection(previous, current, start, end));
                        }
                        next.Add(current);
                    }
                    else if (previousInside)
                    {
                        next.Add(Intersection(previous, current, start, end));
                    }

                    previous = current;
                }
            }

            return output;
        }

        private static double PolygonArea(IReadOnlyList<M01StandardPieceBlendPoint> points)
        {
            var sum = 0.0;
            for (var index = 0; index < points.Count; index += 1)
            {
                var point = points[index];
                var nextPoint = points[(index + 1) % points.Count];
                sum += point.X * nextPoint.Y - nextPoint.X * point.Y;
            }

            return Math.Abs(sum / 2.0);
        }

        private static int PolygonOrientation(IReadOnlyList<M01StandardPieceBlendPoint> points)
        {
            var signedArea = 0.0;
            for (var index = 0; index < points.Count; index += 1)
            {
                var point = points[index];
                var nextPoint = points[(index + 1) % points.Count];
                signedArea += point.X * nextPoint.Y - nextPoint.X * point.Y;
            }

            return signedArea >= 0 ? 1 : -1;
        }

        private static bool IsInside(
            M01StandardPieceBlendPoint point,
            M01StandardPieceBlendPoint start,
            M01StandardPieceBlendPoint end,
            int orientation)
        {
            var cross = (end.X - start.X) * (point.Y - start.Y) - (end.Y - start.Y) * (point.X - start.X);
            return orientation * cross >= -0.0001;
        }

        private static M01StandardPieceBlendPoint Intersection(
            M01StandardPieceBlendPoint firstStart,
            M01StandardPieceBlendPoint firstEnd,
            M01StandardPieceBlendPoint secondStart,
            M01StandardPieceBlendPoint secondEnd)
        {
            var firstDx = firstEnd.X - firstStart.X;
            var firstDy = firstEnd.Y - firstStart.Y;
            var secondDx = secondEnd.X - secondStart.X;
            var secondDy = secondEnd.Y - secondStart.Y;
            var denominator = firstDx * secondDy - firstDy * secondDx;

            if (Math.Abs(denominator) < 0.0001)
            {
                return firstEnd;
            }

            var ratio =
                ((secondStart.X - firstStart.X) * secondDy - (secondStart.Y - firstStart.Y) * secondDx) /
                denominator;

            return new M01StandardPieceBlendPoint(
                firstStart.X + firstDx * ratio,
                firstStart.Y + firstDy * ratio);
        }

        // isM01BaseColor: 是否为三原色之一 —— TS 的类型守卫。
        private static bool IsBaseColor(string colorToken) =>
            colorToken == "red" || colorToken == "yellow" || colorToken == "blue";

        // blendM01PigmentColors(内联自 M01MemoryGearController.ts, 规则不变):
        //   同色返回自身; 否则把两色按序拼成 key 查颜料混色表。
        //   TS [a,b].sort() 用 UTF-16 码元序 → StringComparer.Ordinal 匹配。
        //   default 分支在原色且 a≠b 的输入下不可达(三 key 必命中); TS 此时会返回 undefined,
        //   C# 无法返回 null string → 抛异常显式标记不可达路径。
        private static string BlendPigmentColors(string a, string b)
        {
            if (a == b)
            {
                return a;
            }

            var key = string.Join("+", new[] { a, b }.OrderBy(color => color, StringComparer.Ordinal));
            return key switch
            {
                "blue+red" => "purple",
                "blue+yellow" => "green",
                "red+yellow" => "orange",
                _ => throw new ArgumentException($"unsupported pigment blend: {key}")
            };
        }
    }
}
