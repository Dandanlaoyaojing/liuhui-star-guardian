// 从 tests/cocos/M01PhysicsCollider.test.ts 逐条迁移 —— 规则不变, 断言一一对应, DisplayName 保留原描述.
// TS 判别式访问(result.kind !== "polygon" 后取 result.points)→ 先断言 Kind 字面量, 再 Assert.IsType<派生> 取字段.
// Number(p.y.toFixed(4)) → Math.Round(p.Y, 4, AwayFromZero)(测试用值皆精确, 舍入模式不影响结果, 仅抹浮点尘).
using System;
using System.Linq;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01PhysicsColliderTests
    {
        [Fact(DisplayName = "returns 3 points for triangle, apex up, flat bottom")]
        public void ReturnsThreePointsForTriangleApexUpFlatBottom()
        {
            var result = M01PhysicsCollider.Build(M01PhysicsShape.Triangle, 36);
            Assert.Equal("polygon", result.Kind);
            var polygon = Assert.IsType<M01PhysicsPolygonCollider>(result);
            Assert.Equal(3, polygon.Points.Count);
            Assert.True(polygon.Points[0].Y > 0);
            Assert.Equal(polygon.Points[1].Y, polygon.Points[2].Y);
            Assert.True(polygon.Points[1].Y < 0);
        }

        [Fact(DisplayName = "centers triangle colliders in their visible bounding height")]
        public void CentersTriangleCollidersInTheirVisibleBoundingHeight()
        {
            var result = M01PhysicsCollider.Build(M01PhysicsShape.Triangle, 36);
            Assert.Equal("polygon", result.Kind);
            var polygon = Assert.IsType<M01PhysicsPolygonCollider>(result);

            var ys = polygon.Points.Select(p => Math.Round(p.Y, 4, MidpointRounding.AwayFromZero)).ToList();
            Assert.Equal(18d, ys.Max());
            Assert.Equal(-18d, ys.Min());
        }

        [Fact(DisplayName = "returns 6 points for hexagon with flat-top orientation")]
        public void ReturnsSixPointsForHexagonWithFlatTopOrientation()
        {
            var result = M01PhysicsCollider.Build(M01PhysicsShape.Hexagon, 36);
            Assert.Equal("polygon", result.Kind);
            var polygon = Assert.IsType<M01PhysicsPolygonCollider>(result);
            Assert.Equal(6, polygon.Points.Count);
            // Flat-top: two vertices share the maximal Y (forming the top edge),
            // and two share the minimal Y (forming the bottom edge).
            var ys = polygon.Points.Select(p => Math.Round(p.Y, 4, MidpointRounding.AwayFromZero)).ToList();
            var maxY = ys.Max();
            var minY = ys.Min();
            Assert.Equal(2, ys.Count(y => y == maxY));
            Assert.Equal(2, ys.Count(y => y == minY));
        }

        [Fact(DisplayName = "returns radius for circle")]
        public void ReturnsRadiusForCircle()
        {
            var result = M01PhysicsCollider.Build(M01PhysicsShape.Circle, 36);
            Assert.Equal("circle", result.Kind);
            var circle = Assert.IsType<M01PhysicsCircleCollider>(result);
            Assert.Equal(18d, circle.Radius);
        }

        [Fact(DisplayName = "keeps visible circle fragments separated before physics settling can freeze them")]
        public void KeepsVisibleCircleFragmentsSeparatedBeforePhysicsSettlingCanFreezeThem()
        {
            Assert.Equal(4d, M01PhysicsCollider.ResolveVisualPadding(M01PhysicsShape.Circle));
            Assert.False(
                M01PhysicsCollider.AreCircleFragmentsVisuallySeparated(new[]
                {
                    new M01PhysicsFragmentSeparationSample { Shape = M01PhysicsShape.Circle, Size = 56, X = 0, Y = 0 },
                    new M01PhysicsFragmentSeparationSample { Shape = M01PhysicsShape.Circle, Size = 56, X = 58, Y = 0 }
                }));
            Assert.True(
                M01PhysicsCollider.AreCircleFragmentsVisuallySeparated(new[]
                {
                    new M01PhysicsFragmentSeparationSample { Shape = M01PhysicsShape.Circle, Size = 56, X = 0, Y = 0 },
                    new M01PhysicsFragmentSeparationSample { Shape = M01PhysicsShape.Circle, Size = 56, X = 59.5, Y = 0 }
                }));
        }
    }
}
