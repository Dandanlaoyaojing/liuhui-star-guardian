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

        [Theory(DisplayName = "keeps basket pieces dynamic while settling, colliding on headbutt, and released")]
        [InlineData(M01IntroBasketPiecePhase.Settling)]
        [InlineData(M01IntroBasketPiecePhase.Headbutting)]
        [InlineData(M01IntroBasketPiecePhase.Released)]
        public void KeepsBasketPiecesDynamicDuringPhysicalPhases(M01IntroBasketPiecePhase phase)
        {
            var physics = M01IntroLayout.ResolveBasketPiecePhysics(phase);

            Assert.True(physics.IsDynamic);
            Assert.True(physics.Simulated);
            Assert.Equal(640d / 981d, physics.GravityScale, 12);
        }

        [Fact(DisplayName = "keeps the final settled ground pile simulated so removing a support can restack it")]
        public void KeepsFinalSettledGroundPileSimulated()
        {
            var physics = M01IntroLayout.ResolveGroundPileSettledPhysics();

            Assert.True(physics.IsDynamic);
            Assert.True(physics.Simulated);
            Assert.Equal(640d / 981d, physics.GravityScale, 12);
        }

        [Fact(DisplayName = "freezes the settled pile only between basket impacts")]
        public void FreezesSettledPileOnlyBetweenImpacts()
        {
            var physics = M01IntroLayout.ResolveBasketPiecePhysics(M01IntroBasketPiecePhase.Frozen);

            Assert.False(physics.IsDynamic);
            Assert.False(physics.Simulated);
            Assert.Equal(0.9d, M01IntroLayout.BasketPileSettleSeconds, 12);
        }

        [Theory(DisplayName = "uses the stable Cocos settled local pose for every opening basket fragment")]
        [InlineData("fragment_circle_blue_1", -81.3525, -47.7649, -17.1982)]
        [InlineData("fragment_circle_yellow_1", -25.0806, -67.6560, -6.3931)]
        [InlineData("fragment_circle_red_2", 34.5899, -67.6519, 5.9655)]
        [InlineData("fragment_triangle_blue_1", 95.5603, -53.9077, -55.5286)]
        [InlineData("fragment_triangle_red_1", -56.5537, 6.0865, -13.9099)]
        [InlineData("fragment_triangle_yellow_2", 0.5336, -9.4670, 0.0764)]
        [InlineData("fragment_hexagon_blue_1", 67.8033, -16.9585, 4.3036)]
        [InlineData("fragment_hexagon_yellow_1", -21.0267, 35.0244, -30.2997)]
        [InlineData("fragment_hexagon_red_2", 30.2181, 19.6052, 6.3084)]
        public void UsesStableCocosSettledBasketPose(
            string fragmentId,
            double expectedX,
            double expectedY,
            double expectedRotation)
        {
            Assert.True(M01IntroLayout.TryResolveCocosSettledPilePose(fragmentId, out var pose));
            Assert.Equal(fragmentId, pose.FragmentId);
            Assert.Equal(expectedX, pose.X, 4);
            Assert.Equal(expectedY, pose.Y, 4);
            Assert.Equal(expectedRotation, pose.RotationDeg, 4);
        }

        [Fact(DisplayName = "does not invent a settled pose for a fragment outside the Cocos opening pile")]
        public void DoesNotResolveUnknownSettledBasketPose()
        {
            Assert.False(M01IntroLayout.TryResolveCocosSettledPilePose("unknown", out _));
        }

        [Theory(DisplayName = "reuses every final Cocos fragment physics property in the basket")]
        [InlineData(M01PhysicsShape.Circle, 0.18)]
        [InlineData(M01PhysicsShape.Triangle, 0.6)]
        [InlineData(M01PhysicsShape.Hexagon, 0.6)]
        public void ReusesFinalFragmentPhysicsProperties(M01PhysicsShape shape, double expectedFriction)
        {
            var material = M01IntroLayout.ResolveFragmentMaterial(shape);

            Assert.Equal(expectedFriction, material.Friction, 12);
            Assert.Equal(0.08, material.Restitution, 12);
            Assert.Equal(1, material.Density, 12);
            Assert.Equal(0.05, M01IntroLayout.FragmentLinearDamping, 12);
            Assert.Equal(0.55, M01IntroLayout.FragmentAngularDamping, 12);
        }

        [Fact(DisplayName = "compensates the source PNG transparent gutters so the visible flashlight matches the Cocos 12 by 30 silhouette")]
        public void RestoresFlashlightPresentationAndLaunchTiming()
        {
            Assert.Equal(new M01IntroSize(12, 30), M01IntroLayout.FlashlightDisplaySize);
            Assert.Equal(new M01IntroSize(198, 437), M01IntroLayout.FlashlightSourceCanvasSize);
            Assert.Equal(new M01IntroSize(94, 409), M01IntroLayout.FlashlightSourceTrimSize);

            var canvasDisplay = M01IntroLayout.FlashlightCanvasDisplaySize;
            var visibleWidth = canvasDisplay.Width *
                               M01IntroLayout.FlashlightSourceTrimSize.Width /
                               M01IntroLayout.FlashlightSourceCanvasSize.Width;
            var visibleHeight = canvasDisplay.Height *
                                M01IntroLayout.FlashlightSourceTrimSize.Height /
                                M01IntroLayout.FlashlightSourceCanvasSize.Height;

            Assert.Equal(12, visibleWidth, 10);
            Assert.Equal(30, visibleHeight, 10);
            Assert.Equal(0.4,
                visibleWidth / visibleHeight,
                10);
            Assert.Equal(new M01IntroSize(14, 30), M01IntroLayout.FlashlightColliderSize);
            Assert.Equal(44, M01IntroLayout.FlashlightTapMinimumPixels, 12);
            Assert.Equal(11, M01IntroLayout.FlashlightHeadGlowOffsetY, 12);
            Assert.Equal(18, M01IntroLayout.FlashlightHeadGlowDiameter, 12);
            Assert.Equal(0, M01IntroLayout.FlashlightLaunchDelaySeconds, 12);
            Assert.Equal(0.42, M01IntroLayout.FlashlightBonkSeconds, 12);
            Assert.Equal(1.1, M01IntroLayout.FlashlightSettleSeconds, 12);
        }

        [Theory(DisplayName = "removes the basket cavity on the first three-piece headbutt batch")]
        [InlineData(0, true)]
        [InlineData(3, false)]
        [InlineData(6, false)]
        [InlineData(9, false)]
        public void RemovesCavityAfterFirstReleasedBatch(int releasedCount, bool expectedActive)
        {
            Assert.Equal(expectedActive, M01IntroLayout.ShouldKeepBasketCavityActive(releasedCount));
        }

        [Fact(DisplayName = "releases exactly the top three fragments per headbutt")]
        public void ReleasesThreeFragmentsPerHeadbutt()
        {
            Assert.Equal(3, M01IntroLayout.HeadbuttPiecesPerBatch);
        }

        [Fact(DisplayName = "converts Cocos Box2D linear velocity through PTM32 instead of treating it as pixels per second")]
        public void ConvertsCocosBox2DLinearVelocityThroughPtm32()
        {
            var unityVelocity = M01IntroLayout.CocosBodyLinearVelocityToUnity(20, unityPixelsPerUnit: 100);
            var unityGravity = 9.81 * M01IntroLayout.BasketPieceGravityScale;
            var visibleRisePixels = unityVelocity * unityVelocity / (2 * unityGravity) * 100;

            Assert.Equal(6.4, unityVelocity, 12);
            Assert.Equal(320, visibleRisePixels, 10);
        }

        [Fact(DisplayName = "converts Cocos Box2D angular radians per second to Unity degrees per second")]
        public void ConvertsCocosAngularRadiansToUnityDegrees()
        {
            Assert.Equal(
                22 * 180 / System.Math.PI,
                M01IntroLayout.CocosBodyAngularVelocityToUnity(22),
                12);
        }

        [Fact(DisplayName = "preserves Box2D auto-mass when PTM32 geometry is represented at Unity PPU100")]
        public void ConvertsCocosColliderDensityThroughAreaScale()
        {
            Assert.Equal(
                9.765625,
                M01IntroLayout.CocosColliderDensityToUnity(1, unityPixelsPerUnit: 100),
                12);
        }

        [Fact(DisplayName = "uses the Cocos Physics2D fixed step of one sixtieth second")]
        public void PreservesCocosPhysicsFixedStep()
        {
            Assert.Equal(1d / 60d, M01IntroLayout.CocosPhysicsFixedStepSeconds, 12);
        }
    }
}
