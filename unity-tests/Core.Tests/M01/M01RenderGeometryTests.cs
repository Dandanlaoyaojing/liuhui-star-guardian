using System;
using System.Reflection;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01RenderGeometryTests
    {
        [Fact]
        public void DefinesSharedCocosGeometryAdapter()
        {
            Assert.NotNull(GeometryType());
        }

        [Theory]
        [InlineData(200, 100, 180, 180, "height", 360, 180)]
        [InlineData(200, 100, 180, 180, "width", 180, 90)]
        [InlineData(200, 100, 180, 180, "contain", 180, 90)]
        [InlineData(100, 200, 180, 180, "contain", 90, 180)]
        [InlineData(0, 0, 180, 120, "contain", 180, 120)]
        public void MatchesCocosAspectContentSize(
            double frameWidth,
            double frameHeight,
            double boxWidth,
            double boxHeight,
            string axis,
            double expectedWidth,
            double expectedHeight)
        {
            var size = Invoke(
                "AspectContentSize",
                frameWidth,
                frameHeight,
                boxWidth,
                boxHeight,
                axis);

            Assert.Equal(expectedWidth, Number(size, "Width"), 10);
            Assert.Equal(expectedHeight, Number(size, "Height"), 10);
        }

        [Fact]
        public void ConvertsCocosPixelsToUnityWorldWithoutChangingAxes()
        {
            var point = Invoke("CocosPxToUnityWorld", -120d, 275d);

            Assert.Equal(-1.2d, Number(point, "X"), 12);
            Assert.Equal(2.75d, Number(point, "Y"), 12);
        }

        [Theory]
        [InlineData(0, 0)]
        [InlineData(90, 90)]
        [InlineData(240, 240)]
        [InlineData(-82, -82)]
        public void KeepsCocosThreePointXEulerZSign(double cocosDegrees, double expectedUnityDegrees)
        {
            Assert.Equal(expectedUnityDegrees, (double)Invoke("CocosEulerZToUnityZ", cocosDegrees), 12);
        }

        [Theory]
        [InlineData(100, 40, 0.5, 0.5, 0, 0)]
        [InlineData(100, 40, 0, 0, 50, 20)]
        [InlineData(100, 40, 1, 1, -50, -20)]
        [InlineData(100, 40, 0.25, 0.75, 25, -10)]
        public void ConvertsCocosAnchorToCenteredSpriteOffset(
            double width,
            double height,
            double anchorX,
            double anchorY,
            double expectedX,
            double expectedY)
        {
            var point = Invoke("AnchorCenterOffsetPx", width, height, anchorX, anchorY);

            Assert.Equal(expectedX, Number(point, "X"), 12);
            Assert.Equal(expectedY, Number(point, "Y"), 12);
        }

        [Fact]
        public void PreservesLemmyFootAnchorWhenAFrameIsScaled()
        {
            var lift = (double)Invoke("LemmyFootLiftPx", 225d, 180d);

            Assert.Equal((225d - 180d) * (490d / 512d - 0.5d), lift, 12);
        }

        [Fact]
        public void SizesTheFullRopeCanvasFromItsTrimmedVisibleContent()
        {
            var size = Invoke(
                "UntrimmedCanvasDisplaySize",
                204d,
                550d,
                29d,
                550d,
                12d,
                180d);

            Assert.Equal(204d / 29d * 12d, Number(size, "Width"), 10);
            Assert.Equal(180d, Number(size, "Height"), 10);
        }

        private static object Invoke(string method, params object[] args)
        {
            var info = GeometryType().GetMethod(method, BindingFlags.Public | BindingFlags.Static)
                ?? throw new Xunit.Sdk.XunitException($"M01RenderGeometry.{method} is missing");
            return info.Invoke(null, args)
                   ?? throw new Xunit.Sdk.XunitException($"M01RenderGeometry.{method} returned null");
        }

        private static double Number(object instance, string property) => Convert.ToDouble(
            instance.GetType().GetProperty(property, BindingFlags.Public | BindingFlags.Instance)?.GetValue(instance)
            ?? throw new Xunit.Sdk.XunitException($"{instance.GetType().Name}.{property} is missing"));

        private static Type GeometryType() =>
            Type.GetType("StarGuardian.M01.Rendering.M01RenderGeometry, Core.Tests")
            ?? throw new Xunit.Sdk.XunitException("M01RenderGeometry is missing");
    }
}
