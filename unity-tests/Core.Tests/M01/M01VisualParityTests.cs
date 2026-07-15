using StarGuardian.M01.Rendering;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public sealed class M01VisualParityTests
    {
        [Fact(DisplayName = "uses the exact Cocos paper and flashlight beam visual colors")]
        public void UsesExactCocosPaperAndBeamVisualColors()
        {
            Assert.Equal(new M01Color32(247, 244, 235, 255), M01VisualParity.Paper);
            Assert.Equal(new M01Color32(255, 255, 255, 210), M01VisualParity.GearSpriteTint);
            Assert.Equal(new M01Color32(255, 130, 110, 110), M01VisualParity.BeamVisualColor("red"));
            Assert.Equal(new M01Color32(255, 200, 55, 110), M01VisualParity.BeamVisualColor("yellow"));
            Assert.Equal(new M01Color32(120, 160, 240, 110), M01VisualParity.BeamVisualColor("blue"));
        }

        [Fact(DisplayName = "compensates Unity Linear blending so watercolor gear and basket match the Cocos Gamma capture")]
        public void CompensatesUnityLinearWatercolorRendering()
        {
            Assert.Equal(
                new M01Color32(255, 254, 247, 232),
                M01VisualParity.UnityLinearGearSpriteTint);
            Assert.Equal(
                new M01Color32(253, 251, 249, 255),
                M01VisualParity.UnityLinearBasketSpriteTint);
        }

        [Theory(DisplayName = "applies the user-approved 1.65 saturation (2026-07-15) atop the Cocos channel-multiply palette; intentional divergence from Cocos 1.4")]
        [InlineData("red", 255, 29, 6)]
        [InlineData("yellow", 255, 206, 0)]
        [InlineData("blue", 28, 94, 255)]
        [InlineData("orange", 233, 147, 81)]
        [InlineData("green", 124, 174, 128)]
        [InlineData("purple", 177, 133, 176)]
        public void ReproducesObservedFragmentPalette(string token, byte red, byte green, byte blue)
        {
            Assert.Equal(
                new M01Color32(red, green, blue, 255),
                M01VisualParity.ObservedFragmentTint(token));
        }

        [Fact(DisplayName = "keeps Cocos flashlight geometry and alpha constants independent")]
        public void KeepsFlashlightVisualConstantsIndependent()
        {
            Assert.Equal(190d, M01VisualParity.BeamLengthPx);
            Assert.Equal(1d, M01VisualParity.ConeFan);
            Assert.Equal(14d, M01VisualParity.CoreDiameterPx);
            Assert.Equal((byte)120, M01VisualParity.CoreAlpha);
            Assert.Equal(11d, M01VisualParity.HeadGlowOffsetYPx);
            Assert.Equal(18d, M01VisualParity.HeadGlowDiameterPx);
            Assert.Equal((byte)210, M01VisualParity.HeadGlowAlpha);
        }
    }
}
