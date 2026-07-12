// 从 tests/cocos/M01PuzzleInputRouter.test.ts 逐条迁移 —— 规格不变, 断言一一对应.
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01PuzzleInputRouterTests
    {
        // describe 级共享 ctx: 拾起手电前 / 后。
        private static readonly TapContext BeforePickup =
            new() { FlashlightAcquired = false, HoldingPiece = false };

        private static readonly TapContext AfterPickup =
            new() { FlashlightAcquired = true, HoldingPiece = false };

        // --- 拿着碎片 ---

        [Fact(DisplayName = "drops the held piece on any tap, overriding everything else")]
        public void DropsHeldPieceOnAnyTap()
        {
            Assert.Equal(
                "dropPiece",
                M01PuzzleInputRouter.RouteTap(
                    new TapHit { Fragment = true },
                    new TapContext { FlashlightAcquired = true, HoldingPiece = true }));
            Assert.Equal(
                "dropPiece",
                M01PuzzleInputRouter.RouteTap(
                    new TapHit { HeldFlashlight = true },
                    new TapContext { FlashlightAcquired = true, HoldingPiece = true }));
            Assert.Equal(
                "dropPiece",
                M01PuzzleInputRouter.RouteTap(
                    new TapHit(),
                    new TapContext { FlashlightAcquired = false, HoldingPiece = true }));
        }

        // --- 拾起手电前 ---

        [Fact(DisplayName = "picks up the fallen flashlight")]
        public void PicksUpFallenFlashlight()
        {
            Assert.Equal(
                "pickupFlashlight",
                M01PuzzleInputRouter.RouteTap(new TapHit { FallenFlashlight = true }, BeforePickup));
        }

        [Fact(DisplayName = "walks Lemmy on empty ground (no beam yet)")]
        public void WalksLemmyOnEmptyGroundNoBeam()
        {
            Assert.Equal(
                "walkLemmy",
                M01PuzzleInputRouter.RouteTap(new TapHit(), BeforePickup));
        }

        [Fact(DisplayName = "picks up a spilled fragment even before the flashlight (no beam → no light-off)")]
        public void PicksUpSpilledFragmentBeforeFlashlight()
        {
            Assert.Equal(
                "pickupPiece",
                M01PuzzleInputRouter.RouteTap(new TapHit { Fragment = true }, BeforePickup));
        }

        [Fact(DisplayName = "prefers the fallen flashlight when it overlaps a fragment")]
        public void PrefersFallenFlashlightOverFragment()
        {
            Assert.Equal(
                "pickupFlashlight",
                M01PuzzleInputRouter.RouteTap(
                    new TapHit { FallenFlashlight = true, Fragment = true }, BeforePickup));
        }

        // --- 拾起手电后 ---

        [Fact(DisplayName = "cycles the light when the held flashlight is tapped")]
        public void CyclesLightOnHeldFlashlightTap()
        {
            Assert.Equal(
                "cycleLight",
                M01PuzzleInputRouter.RouteTap(new TapHit { HeldFlashlight = true }, AfterPickup));
        }

        [Fact(DisplayName = "walks Lemmy with the beam following on empty ground")]
        public void WalksLemmyWithBeamOnEmptyGround()
        {
            Assert.Equal(
                "walkLemmyWithBeam",
                M01PuzzleInputRouter.RouteTap(new TapHit(), AfterPickup));
        }

        [Fact(DisplayName = "picks up a candidate and turns the light off")]
        public void PicksUpCandidateAndTurnsLightOff()
        {
            Assert.Equal(
                "pickupPieceAndLightOff",
                M01PuzzleInputRouter.RouteTap(new TapHit { Fragment = true }, AfterPickup));
        }

        [Fact(DisplayName = "prefers picking up the fragment when it overlaps the held flashlight")]
        public void PrefersFragmentOverHeldFlashlight()
        {
            Assert.Equal(
                "pickupPieceAndLightOff",
                M01PuzzleInputRouter.RouteTap(
                    new TapHit { Fragment = true, HeldFlashlight = true }, AfterPickup));
        }
    }
}
