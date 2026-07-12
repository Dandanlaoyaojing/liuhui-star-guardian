// 从 tests/cocos/M01PhysicsRandom.test.ts 逐条迁移 —— 规则不变, 断言一一对应.
// TS `toBe` 是严格相等(Object.is) → 同种子逐比特一致, 用 Assert.Equal(exact)/Assert.NotEqual 对应。
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01PhysicsRandomTests
    {
        [Fact(DisplayName = "produces values in [0, 1) for any seed")]
        public void ProducesValuesInUnitInterval()
        {
            var rng = M01PhysicsRandom.CreateRng(42);
            for (var i = 0; i < 100; i += 1)
            {
                var v = rng();
                Assert.True(v >= 0);
                Assert.True(v < 1);
            }
        }

        [Fact(DisplayName = "is deterministic for a given seed")]
        public void IsDeterministicForSameSeed()
        {
            var a = M01PhysicsRandom.CreateRng(12345);
            var b = M01PhysicsRandom.CreateRng(12345);
            for (var i = 0; i < 10; i += 1)
            {
                Assert.Equal(a(), b());
            }
        }

        [Fact(DisplayName = "produces different sequences for different seeds")]
        public void ProducesDifferentSequencesForDifferentSeeds()
        {
            var a = M01PhysicsRandom.CreateRng(1);
            var b = M01PhysicsRandom.CreateRng(2);
            Assert.NotEqual(a(), b());
        }
    }
}
