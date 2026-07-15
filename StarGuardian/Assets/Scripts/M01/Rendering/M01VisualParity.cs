// M01 Cocos 视觉调色契约。保持引擎无关，Unity/Cocos 截图与 xUnit 共用同一组字节真值。
// 真源: assets/scripts/cocos/M01GreyboxBootstrap.ts
#nullable enable
using System;

namespace StarGuardian.M01.Rendering
{
    public readonly struct M01Color32 : IEquatable<M01Color32>
    {
        public byte R { get; }
        public byte G { get; }
        public byte B { get; }
        public byte A { get; }

        public M01Color32(byte r, byte g, byte b, byte a)
        {
            R = r;
            G = g;
            B = b;
            A = a;
        }

        public M01Color32 WithAlpha(byte alpha) => new(R, G, B, alpha);

        public bool Equals(M01Color32 other) =>
            R == other.R && G == other.G && B == other.B && A == other.A;

        public override bool Equals(object? obj) => obj is M01Color32 other && Equals(other);
        public override int GetHashCode() => HashCode.Combine(R, G, B, A);
        public static bool operator ==(M01Color32 left, M01Color32 right) => left.Equals(right);
        public static bool operator !=(M01Color32 left, M01Color32 right) => !left.Equals(right);
    }

    public static class M01VisualParity
    {
        public static readonly M01Color32 Paper = new(247, 244, 235, 255);
        public static readonly M01Color32 GearSpriteTint = new(255, 255, 255, 210);

        // Unity 工程必须保持 Linear，供 URP 2D 光效/Bloom 使用。Cocos 开场截图则按接近 Gamma 的方式
        // 混合和缩采样半透明水彩；以下两值是以同一 960×640 截图逐像素标定后的局部补偿，
        // 不改 Cocos 源真值，也不改变项目全局色彩空间。
        public static readonly M01Color32 UnityLinearGearSpriteTint = new(255, 254, 247, 232);
        public static readonly M01Color32 UnityLinearBasketSpriteTint = new(253, 251, 249, 255);

        public const double BeamLengthPx = 190;
        public const double ConeFan = 1.0;
        public const byte ConeAlpha = 110;
        public const double CoreDiameterPx = 14;
        public const byte CoreAlpha = 120;
        public const double HeadGlowOffsetYPx = 11;
        public const double HeadGlowDiameterPx = 18;
        public const byte HeadGlowAlpha = 210;
        public const double ObservedTintSaturation = 1.65; // 2026-07-15 用户拍板: 手电下显色提饱和保持醒目; 有意偏离 Cocos 参照 1.4(不回改, 历史参照)

        public static M01Color32 BeamVisualColor(string token)
        {
            var rgb = token switch
            {
                "red" => new M01Color32(255, 130, 110, ConeAlpha),
                "yellow" => new M01Color32(255, 200, 55, ConeAlpha),
                "blue" => new M01Color32(120, 160, 240, ConeAlpha),
                _ => throw new ArgumentException($"Unsupported flashlight color: {token}", nameof(token))
            };
            return rgb;
        }

        public static M01Color32 ObservedFragmentTint(string token)
        {
            switch (token)
            {
                case "red":
                    return Saturate(Multiply(
                        new M01Color32(230, 120, 110, 255),
                        new M01Color32(255, 130, 110, 255)));
                case "yellow":
                    return Saturate(Multiply(
                        new M01Color32(240, 220, 130, 255),
                        new M01Color32(255, 235, 130, 255)));
                case "blue":
                    return Saturate(Multiply(
                        new M01Color32(115, 150, 215, 255),
                        new M01Color32(120, 160, 240, 255)));
                case "orange":
                    return Saturate(new M01Color32(206, 154, 114, 255));
                case "green":
                    return Saturate(new M01Color32(136, 166, 138, 255));
                case "purple":
                    return Saturate(new M01Color32(167, 140, 166, 255));
                default:
                    throw new ArgumentException($"Unsupported M01 blend color: {token}", nameof(token));
            }
        }

        private static M01Color32 Multiply(M01Color32 left, M01Color32 right) => new(
            JsRound(left.R * right.R / 255d),
            JsRound(left.G * right.G / 255d),
            JsRound(left.B * right.B / 255d),
            255);

        private static M01Color32 Saturate(M01Color32 color)
        {
            var lum = 0.299 * color.R + 0.587 * color.G + 0.114 * color.B;
            return new M01Color32(
                ClampRound(lum + (color.R - lum) * ObservedTintSaturation),
                ClampRound(lum + (color.G - lum) * ObservedTintSaturation),
                ClampRound(lum + (color.B - lum) * ObservedTintSaturation),
                color.A);
        }

        private static byte ClampRound(double value) => JsRound(Math.Min(255, Math.Max(0, value)));

        // JavaScript Math.round 对本模块的非负输入等价于 floor(x + 0.5)，避免 C# 银行家舍入漂移。
        private static byte JsRound(double value) => (byte)Math.Floor(value + 0.5);
    }
}
