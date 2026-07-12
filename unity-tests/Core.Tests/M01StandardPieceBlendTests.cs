// 从 tests/cocos/M01StandardPieceBlend.test.ts 逐条迁移 —— 规则不变, 断言一一对应。
using System;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01StandardPieceBlendTests
    {
        [Fact(DisplayName = "returns explicit pigment blend color for overlapping standard pieces")]
        public void ReturnsExplicitPigmentBlendColorForOverlappingStandardPieces()
        {
            var overlays = M01StandardPieceBlend.ResolveOverlays(new[]
            {
                new M01StandardPieceBlendPlacement
                {
                    Id = "red_circle",
                    ShapeToken = "circle",
                    ColorToken = "red",
                    Position = new(0, 0),
                    Size = new(56, 56)
                },
                new M01StandardPieceBlendPlacement
                {
                    Id = "blue_circle",
                    ShapeToken = "circle",
                    ColorToken = "blue",
                    Position = new(22, 0),
                    Size = new(56, 56)
                }
            });

            Assert.Single(overlays);
            Assert.Equal("purple", overlays[0].ColorToken);
            Assert.Equal(new[] { "red_circle", "blue_circle" }, overlays[0].SourceIds);
            Assert.True(overlays[0].Points.Count >= 3);
        }

        [Fact(DisplayName = "ignores disjoint pieces and non-primary colors")]
        public void IgnoresDisjointPiecesAndNonPrimaryColors()
        {
            var overlays = M01StandardPieceBlend.ResolveOverlays(new[]
            {
                new M01StandardPieceBlendPlacement
                {
                    Id = "red_circle",
                    ShapeToken = "circle",
                    ColorToken = "red",
                    Position = new(-120, 0),
                    Size = new(56, 56)
                },
                new M01StandardPieceBlendPlacement
                {
                    Id = "yellow_circle",
                    ShapeToken = "circle",
                    ColorToken = "yellow",
                    Position = new(120, 0),
                    Size = new(56, 56)
                },
                new M01StandardPieceBlendPlacement
                {
                    Id = "neutral_triangle",
                    ShapeToken = "triangle",
                    ColorToken = "neutral",
                    Position = new(0, 0),
                    Size = new(56, 56)
                }
            });

            Assert.Empty(overlays);
        }

        [Fact(DisplayName = "uses rotated exact standard-piece geometry before clipping")]
        public void UsesRotatedExactStandardPieceGeometryBeforeClipping()
        {
            var upright = M01StandardPieceBlend.BuildPolygon(new M01StandardPieceBlendPlacement
            {
                Id = "triangle",
                ShapeToken = "triangle",
                ColorToken = "yellow",
                Position = new(0, 0),
                Size = new(56, 56),
                Rotation = 0
            });
            var rotated = M01StandardPieceBlend.BuildPolygon(new M01StandardPieceBlendPlacement
            {
                Id = "triangle",
                ShapeToken = "triangle",
                ColorToken = "yellow",
                Position = new(0, 0),
                Size = new(56, 56),
                Rotation = 90
            });

            Assert.True(upright[0].Y > 0);
            Assert.True(Math.Abs(rotated[0].X) > Math.Abs(rotated[0].Y));
        }
    }
}
