// 从 tests/cocos/M01PhysicsRotation.test.ts 逐条迁移 —— 规则不变, 断言一一对应.
// ⚠️ TS 的 rng `() => i / 20` / `() => i / 30` 是浮点除法; C# 里 int/int 会退化成整除(恒 0),
//    必须写 20.0 / 30.0 才与 TS 语义一致(number 除法陷阱)。
using System.Collections.Generic;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01PhysicsRotationTests
    {
        [Fact(DisplayName = "returns a value in [0, 360) for circle (any rotation stable)")]
        public void Circle_ReturnsValueInRange()
        {
            for (var i = 0; i < 20; i += 1)
            {
                var r = M01PhysicsRotation.PickStableRotation(M01PhysicsShape.Circle, () => i / 20.0);
                Assert.True(r >= 0);
                Assert.True(r < 360);
            }
        }

        [Fact(DisplayName = "returns one of {0, 120, 240} for triangle")]
        public void Triangle_ReturnsOneOfStableBases()
        {
            var allowed = new HashSet<int> { 0, 120, 240 };
            for (var i = 0; i < 30; i += 1)
            {
                var r = M01PhysicsRotation.PickStableRotation(M01PhysicsShape.Triangle, () => i / 30.0);
                Assert.Contains(r, allowed);
            }
        }

        [Fact(DisplayName = "returns one of {0, 60, 120, 180, 240, 300} for hexagon")]
        public void Hexagon_ReturnsOneOfStableBases()
        {
            var allowed = new HashSet<int> { 0, 60, 120, 180, 240, 300 };
            for (var i = 0; i < 30; i += 1)
            {
                var r = M01PhysicsRotation.PickStableRotation(M01PhysicsShape.Hexagon, () => i / 30.0);
                Assert.Contains(r, allowed);
            }
        }
    }
}
