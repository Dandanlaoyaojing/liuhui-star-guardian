// 从 tests/cocos/M01IntroLayout.test.ts 逐条迁移 —— 规则不变, 断言一一对应, DisplayName 保留原描述.
// M01_STANDARD_PIECE_DISPLAY_SIZE.width(=56)来自尚未转写的 M01GreyboxLayout.ts; 此处以本地常量内联,
// 待 M01GreyboxLayout 转写后应改为引用其公开常量(见返回的 ambiguities)。
using System.Linq;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01IntroLayoutTests
    {
        // M01GreyboxLayout.M01_STANDARD_PIECE_DISPLAY_SIZE.width —— 标准片显示宽 56(暂内联)。
        private const double StandardPieceDisplayWidth = 56;

        [Fact(DisplayName = "defines a real basket inner cavity with a floor and two sloped side walls")]
        public void DefinesRealInnerCavityWithFloorAndTwoSlopedSideWalls()
        {
            Assert.Equal(
                new[] { "bottom", "left", "right" },
                M01IntroLayout.InnerCavityWalls.Select(wall => wall.Id).ToArray());
            Assert.True(M01IntroLayout.InnerCavity.FloorY < M01IntroLayout.InnerCavity.FrontOcclusionY);
            Assert.True(M01IntroLayout.InnerCavity.FloorY < M01IntroLayout.InnerCavity.WallTopY);
            Assert.True(M01IntroLayout.InnerCavity.TopHalfWidth > M01IntroLayout.InnerCavity.BottomHalfWidth);
        }

        [Fact(DisplayName = "stages all 9 basket fragments as separated physical pieces inside the cavity")]
        public void StagesAllNineFragmentsSeparatedInsideCavity()
        {
            Assert.Equal(M01IntroLayout.TargetPieceCount, M01IntroLayout.PileOffsets.Count);
            Assert.True(M01IntroLayout.IsPileInsideInnerCavity());
            Assert.True(M01IntroLayout.ArePileOffsetsSeparated());
            Assert.True(M01IntroLayout.EffectiveColliderSize > StandardPieceDisplayWidth);
        }

        [Fact(DisplayName = "only leaves the upper 4-5 basket fragments visible above the front wall")]
        public void OnlyLeavesUpperFourToFiveFragmentsVisible()
        {
            var visibleCount = M01IntroLayout.CountVisiblePileOffsets(StandardPieceDisplayWidth);

            Assert.True(visibleCount >= M01IntroLayout.VisiblePieceCountRange.Min);
            Assert.True(visibleCount <= M01IntroLayout.VisiblePieceCountRange.Max);
            Assert.True(M01IntroLayout.TargetPieceCount - visibleCount >= 4);
        }
    }
}
