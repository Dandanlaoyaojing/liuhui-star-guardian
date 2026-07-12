// 从 tests/cocos/M01FlashlightBeam.test.ts 逐条迁移 —— 规则不变, 断言一一对应.
using StarGuardian.Interaction; // Point2 (2D 点, 复用勿重定义)
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01FlashlightBeamTests
    {
        // 光束: 从 (0,0) 沿 +x, 长 100, 扇底半宽 40(锥顶半宽 4)
        private static readonly BeamField Beam = new()
        {
            Ox = 0,
            Oy = 0,
            Dx = 1,
            Dy = 0,
            Length = 100,
            NearHalf = 4,
            FarHalf = 40,
            On = true
        };

        // --- flashlightBeamIntensity ---

        [Fact(DisplayName = "近出光口、锥轴上最强 ≈1")]
        public void NearMuzzleOnAxis_IsStrongest()
        {
            Assert.True(M01FlashlightBeam.FlashlightBeamIntensity(new Point2(5, 0), Beam) > 0.9);
        }

        [Fact(DisplayName = "锥外(超长度)=0")]
        public void BeyondLength_IsZero()
        {
            Assert.Equal(0.0, M01FlashlightBeam.FlashlightBeamIntensity(new Point2(130, 0), Beam));
        }

        [Fact(DisplayName = "muzzle 之后(负轴向)=0")]
        public void BehindMuzzle_IsZero()
        {
            Assert.Equal(0.0, M01FlashlightBeam.FlashlightBeamIntensity(new Point2(-10, 0), Beam));
        }

        [Fact(DisplayName = "扇形外(垂距 > 锥半宽)=0")]
        public void OutsideCone_IsZero()
        {
            Assert.Equal(0.0, M01FlashlightBeam.FlashlightBeamIntensity(new Point2(50, 60), Beam));
        }

        [Fact(DisplayName = "沿光向衰减: 近端 > 远端(锥轴上)")]
        public void AlongAxis_NearBrighterThanFar()
        {
            var near = M01FlashlightBeam.FlashlightBeamIntensity(new Point2(10, 0), Beam);
            var far = M01FlashlightBeam.FlashlightBeamIntensity(new Point2(90, 0), Beam);
            Assert.True(near > far);
            Assert.True(far > 0);
        }

        [Fact(DisplayName = "横向抛物柔边单调: 轴心 > 半幅 > 锥侧")]
        public void AcrossAxis_ParabolicSoftEdgeMonotonic()
        {
            var mid = M01FlashlightBeam.FlashlightBeamIntensity(new Point2(50, 0), Beam); // q=0
            var half = M01FlashlightBeam.FlashlightBeamIntensity(new Point2(50, 11), Beam); // halfAt@u0.5=22, q≈0.5
            var edge = M01FlashlightBeam.FlashlightBeamIntensity(new Point2(50, 21), Beam); // q≈0.95
            Assert.True(mid > half);
            Assert.True(half > edge);
        }

        [Fact(DisplayName = "lightOn=false 全灭")]
        public void LightOff_IsZero()
        {
            Assert.Equal(0.0, M01FlashlightBeam.FlashlightBeamIntensity(new Point2(5, 0), Beam with { On = false }));
        }

        // --- worldBeamFromGeometry ---

        [Fact(DisplayName = "由 muzzle/center 世界点算出单位光向与长度")]
        public void WorldBeam_ComputesUnitDirAndLength()
        {
            var f = M01FlashlightBeam.WorldBeamFromGeometry(
                new Point2(10, 10),
                new Point2(110, 10),
                new BeamOptions { NearHalf = 4, FarHalf = 40, On = true });
            Assert.Equal(100.0, f.Length, 5);
            Assert.Equal(1.0, f.Dx, 5);
            Assert.Equal(0.0, f.Dy, 5);
            Assert.Equal(10.0, f.Ox);
            Assert.True(f.On);
        }

        [Fact(DisplayName = "muzzle==center 退化为 on=false(零长不显色)")]
        public void WorldBeam_DegenerateBecomesOff()
        {
            var f = M01FlashlightBeam.WorldBeamFromGeometry(
                new Point2(5, 5),
                new Point2(5, 5),
                new BeamOptions { NearHalf = 4, FarHalf = 40, On = true });
            Assert.False(f.On);
        }
    }
}
