// Cocos M01 渲染几何的纯 C# 兼容层；不得引用 UnityEngine。
#nullable enable

using System;

namespace StarGuardian.M01.Rendering
{
    public readonly struct M01RenderPoint : IEquatable<M01RenderPoint>
    {
        public double X { get; }
        public double Y { get; }

        public M01RenderPoint(double x, double y)
        {
            X = x;
            Y = y;
        }

        public bool Equals(M01RenderPoint other) => X.Equals(other.X) && Y.Equals(other.Y);
        public override bool Equals(object? obj) => obj is M01RenderPoint other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(X, Y);
    }

    public readonly struct M01RenderSize : IEquatable<M01RenderSize>
    {
        public double Width { get; }
        public double Height { get; }

        public M01RenderSize(double width, double height)
        {
            Width = width;
            Height = height;
        }

        public bool Equals(M01RenderSize other) => Width.Equals(other.Width) && Height.Equals(other.Height);
        public override bool Equals(object? obj) => obj is M01RenderSize other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(Width, Height);
    }

    public static class M01RenderGeometry
    {
        /// <summary>Exact port of M01SpriteAspect.aspectContentSize.</summary>
        public static M01RenderSize AspectContentSize(
            double frameWidth,
            double frameHeight,
            double boxWidth,
            double boxHeight,
            string axis = "height")
        {
            if (frameWidth <= 0 || frameHeight <= 0)
            {
                return new M01RenderSize(boxWidth, boxHeight);
            }

            var ratio = frameWidth / frameHeight;
            if (axis == "width")
            {
                return new M01RenderSize(boxWidth, boxWidth / ratio);
            }

            if (axis == "contain")
            {
                var scale = Math.Min(boxWidth / frameWidth, boxHeight / frameHeight);
                return new M01RenderSize(frameWidth * scale, frameHeight * scale);
            }

            return new M01RenderSize(boxHeight * ratio, boxHeight);
        }

        public static M01RenderPoint CocosPxToUnityWorld(double x, double y) =>
            new(x / M01RenderContract.PixelsPerUnit, y / M01RenderContract.PixelsPerUnit);

        /// <summary>
        /// Cocos Creator 3.x and Unity both use positive counter-clockwise Euler Z in this M01 path.
        /// The old probe's sign-negation note was investigated and removed in bd3fbd2 ancestry.
        /// </summary>
        public static double CocosEulerZToUnityZ(double cocosDegrees) => cocosDegrees;

        /// <summary>
        /// A Cocos node position denotes its UITransform anchor. Unity SpriteRenderer objects use
        /// a centered transform here, so move the visual center relative to the anchor.
        /// </summary>
        public static M01RenderPoint AnchorCenterOffsetPx(
            double width,
            double height,
            double anchorX,
            double anchorY) =>
            new((0.5 - anchorX) * width, (0.5 - anchorY) * height);

        /// <summary>
        /// Cocos SpriteFrame may trim transparent padding while Unity keeps the full PNG canvas.
        /// Return the full-canvas display size required for the visible trimmed content to occupy
        /// exactly displayWidth x displayHeight.
        /// </summary>
        public static M01RenderSize UntrimmedCanvasDisplaySize(
            double rawWidth,
            double rawHeight,
            double trimmedWidth,
            double trimmedHeight,
            double displayWidth,
            double displayHeight)
        {
            if (rawWidth <= 0 || rawHeight <= 0 || trimmedWidth <= 0 || trimmedHeight <= 0)
            {
                return new M01RenderSize(displayWidth, displayHeight);
            }

            return new M01RenderSize(
                displayWidth * rawWidth / trimmedWidth,
                displayHeight * rawHeight / trimmedHeight);
        }

        /// <summary>Exact foot-lock compensation from LemmyActor.fitFramePlaybackSprite.</summary>
        public static double LemmyFootLiftPx(double fittedHeight, double displayHeight) =>
            (fittedHeight - displayHeight) * (M01RenderContract.LemmyFrameFootFraction - 0.5);
    }
}
