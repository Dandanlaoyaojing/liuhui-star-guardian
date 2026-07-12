// M01 手电光束逐像素强度(纯几何, 无引擎依赖 → dotnet 可跑)。
// ⚠️ GLSL(assets/resources/shaders/fx_color-filter.effect) 必须复刻同一公式 ——
//    改这里的强度数学要同步改 .effect(轴向投影 + 垂距 + 沿光向 pow(1-u,0.8) × 横向 1-q²)。
// 从 assets/scripts/cocos/M01FlashlightBeam.ts 迁移, 规则不变.
// TS 语义映射:
//   number → double; Math.abs/pow/hypot → Math.Abs/Pow/Sqrt(vx²+vy²);
//   点参 { x, y } / { mx, my } / { cx, cy } 都是纯 2D 点 → 复用 StarGuardian.Interaction.Point2(勿重定义);
//   BeamField 接口 → 不可变 record(测试里 { ...beam, on:false } 展开 → `beam with { On = false }`);
//   opts 对象 → BeamOptions record。

using System;
using StarGuardian.Interaction;

namespace StarGuardian.M01
{
    /// <summary>光锥场(muzzle 世界坐标 + 单位光向 + 轴向长度 + 近/远锥半宽 + 开关)—— TS BeamField</summary>
    public sealed record BeamField
    {
        /// <summary>光锥顶(muzzle)世界坐标 X</summary>
        public double Ox { get; init; }

        /// <summary>光锥顶(muzzle)世界坐标 Y</summary>
        public double Oy { get; init; }

        /// <summary>光向单位向量 X(muzzle→落地)</summary>
        public double Dx { get; init; }

        /// <summary>光向单位向量 Y(muzzle→落地)</summary>
        public double Dy { get; init; }

        /// <summary>轴向长度</summary>
        public double Length { get; init; }

        /// <summary>锥顶半宽</summary>
        public double NearHalf { get; init; }

        /// <summary>锥底半宽</summary>
        public double FarHalf { get; init; }

        public bool On { get; init; }
    }

    /// <summary>worldBeamFromGeometry 的 opts 入参(锥半宽 + 开关)—— TS { nearHalf, farHalf, on }</summary>
    public sealed record BeamOptions
    {
        public double NearHalf { get; init; }
        public double FarHalf { get; init; }
        public bool On { get; init; }
    }

    public static class M01FlashlightBeam
    {
        // ⚠️ 公式 + CONE_ALONG_POW 必须与 fx_color-filter.effect 的 GLSL 一致, 且与可见光锥纹理
        //    getConeGlowSpriteFrame 同一套衰减(bAlong=pow(1-along,0.8) × bAcross=1-q²) —— 这样
        //    "光打在拼片上的显色"与"手电光束本身"质感完全一致(同一衰减形状)。漂移哨兵 grep 这个数。
        // 常量名刻意保留 TS 的 CONE_ALONG_POW(非 PascalCase)—— 跨 TS/GLSL/C# 同一 grep 令牌不断链。
        private const double CONE_ALONG_POW = 0.8; // 沿光向衰减(近出光口最亮→远端落地渐暗); = bootstrap CONE_ALONG_POW

        public static double FlashlightBeamIntensity(Point2 p, BeamField b)
        {
            if (!b.On || b.Length <= 0) return 0;
            var px = p.X - b.Ox;
            var py = p.Y - b.Oy;
            var t = px * b.Dx + py * b.Dy; // 轴向投影(沿光向距离)
            if (t < 0 || t > b.Length) return 0;
            var u = t / b.Length; // 0=出光口 .. 1=落地远端
            var d = Math.Abs(px * -b.Dy + py * b.Dx); // 垂距(法向 = (-dy,dx))
            var halfAt = b.NearHalf + u * (b.FarHalf - b.NearHalf); // 锥半宽随轴向线性张开
            if (halfAt <= 0) return 0;
            var q = d / halfAt; // 0=锥轴, 1=锥侧
            var bAcross = Math.Max(0.0, 1 - q * q); // 轴最亮→锥侧 0(柔抛物边, 同锥纹理)
            var bAlong = Math.Pow(Math.Max(0.0, 1 - u), CONE_ALONG_POW); // 近端亮→远端暗(同锥纹理)
            return Math.Max(0.0, bAlong * bAcross);
        }

        // drawing 空间几何(muzzle/center 世界点)→ 世界空间 BeamField。世界坐标的获取(node.worldPosition)
        // 在 bootstrap 做; 这里只做无引擎的组装, 便于单测。muzzle≈center(零长)→ on=false 不显色。
        public static BeamField WorldBeamFromGeometry(Point2 muzzle, Point2 center, BeamOptions opts)
        {
            var vx = center.X - muzzle.X;
            var vy = center.Y - muzzle.Y;
            var length = Math.Sqrt(vx * vx + vy * vy);
            if (length < 1e-3)
            {
                return new BeamField
                {
                    Ox = muzzle.X,
                    Oy = muzzle.Y,
                    Dx = 1,
                    Dy = 0,
                    Length = 0,
                    NearHalf = opts.NearHalf,
                    FarHalf = opts.FarHalf,
                    On = false
                };
            }
            return new BeamField
            {
                Ox = muzzle.X,
                Oy = muzzle.Y,
                Dx = vx / length,
                Dy = vy / length,
                Length = length,
                NearHalf = opts.NearHalf,
                FarHalf = opts.FarHalf,
                On = opts.On
            };
        }
    }
}
