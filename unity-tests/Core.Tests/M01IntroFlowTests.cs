// 从 tests/cocos/M01IntroFlow.test.ts 逐条迁移 —— 规格不变, 断言一一对应.
using System.Collections.Generic;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01IntroFlowTests
    {
        // describe("M01 intro phase machine (headbutt 顶篮 + 自由走位重构 2026-06-08)")

        [Fact(DisplayName = "runs the full diegetic intro in order (走入→自由走→篮下点篮→收耳→顶篮→倒出→手电)")]
        public void RunsTheFullDiegeticIntroInOrder()
        {
            var path = new (M01IntroPhase From, M01IntroEvent Event, M01IntroPhase To)[]
            {
                (M01IntroPhase.Approaching, M01IntroEvent.WalkArrived, M01IntroPhase.Roaming),
                (M01IntroPhase.Roaming, M01IntroEvent.HeadbuttStarted, M01IntroPhase.Folding),
                (M01IntroPhase.Folding, M01IntroEvent.FoldDone, M01IntroPhase.Headbutting),
                (M01IntroPhase.Headbutting, M01IntroEvent.HeadbuttContact, M01IntroPhase.SpillingFragments),
                (M01IntroPhase.SpillingFragments, M01IntroEvent.FragmentsSettled, M01IntroPhase.Bonking),
                (M01IntroPhase.Bonking, M01IntroEvent.FlashlightBonked, M01IntroPhase.WaitingPickup),
                (M01IntroPhase.WaitingPickup, M01IntroEvent.FlashlightTapped, M01IntroPhase.PickingUp),
                (M01IntroPhase.PickingUp, M01IntroEvent.CrouchDone, M01IntroPhase.Acquired)
            };
            foreach (var (from, evt, to) in path)
            {
                Assert.Equal(to, M01IntroFlow.NextIntroPhase(from, evt));
            }
        }

        [Fact(DisplayName = "does NOT leave 'roaming' until the headbutt is triggered (自由走位/侧边晃不推进相位)")]
        public void DoesNotLeaveRoamingUntilHeadbuttTriggered()
        {
            // roaming 期间玩家随便走、点篮侧边晃 —— 这些都不改相位; 只有 cc 判定"篮正下方点篮"才喂 headbuttStarted。
            var nonAdvancing = new[]
            {
                M01IntroEvent.WalkArrived,
                M01IntroEvent.FoldDone,
                M01IntroEvent.HeadbuttContact,
                M01IntroEvent.FragmentsSettled,
                M01IntroEvent.FlashlightBonked,
                M01IntroEvent.FlashlightTapped,
                M01IntroEvent.CrouchDone
            };
            foreach (var evt in nonAdvancing)
            {
                Assert.Equal(M01IntroPhase.Roaming, M01IntroFlow.NextIntroPhase(M01IntroPhase.Roaming, evt));
            }
            Assert.Equal(M01IntroPhase.Folding, M01IntroFlow.NextIntroPhase(M01IntroPhase.Roaming, M01IntroEvent.HeadbuttStarted));
        }

        [Fact(DisplayName = "does NOT leave 'waitingPickup' until the player taps the flashlight (no auto-pickup)")]
        public void DoesNotLeaveWaitingPickupUntilFlashlightTapped()
        {
            var nonAdvancing = new[]
            {
                M01IntroEvent.WalkArrived,
                M01IntroEvent.HeadbuttStarted,
                M01IntroEvent.FoldDone,
                M01IntroEvent.HeadbuttContact,
                M01IntroEvent.FragmentsSettled,
                M01IntroEvent.FlashlightBonked,
                M01IntroEvent.CrouchDone
            };
            foreach (var evt in nonAdvancing)
            {
                Assert.Equal(M01IntroPhase.WaitingPickup, M01IntroFlow.NextIntroPhase(M01IntroPhase.WaitingPickup, evt));
            }
            Assert.Equal(M01IntroPhase.PickingUp, M01IntroFlow.NextIntroPhase(M01IntroPhase.WaitingPickup, M01IntroEvent.FlashlightTapped));
        }

        [Fact(DisplayName = "headbutt 序列按 收耳→起跳→撞击 顺序推进, 不跳步")]
        public void HeadbuttSequenceAdvancesInOrder()
        {
            Assert.Equal(M01IntroPhase.Folding, M01IntroFlow.NextIntroPhase(M01IntroPhase.Folding, M01IntroEvent.HeadbuttContact)); // 收耳没播完不能直接撞
            Assert.Equal(M01IntroPhase.Headbutting, M01IntroFlow.NextIntroPhase(M01IntroPhase.Folding, M01IntroEvent.FoldDone));
            Assert.Equal(M01IntroPhase.SpillingFragments, M01IntroFlow.NextIntroPhase(M01IntroPhase.Headbutting, M01IntroEvent.HeadbuttContact));
        }

        [Fact(DisplayName = "ignores events that don't match the current phase (no skipping ahead)")]
        public void IgnoresEventsThatDoNotMatchTheCurrentPhase()
        {
            Assert.Equal(M01IntroPhase.Approaching, M01IntroFlow.NextIntroPhase(M01IntroPhase.Approaching, M01IntroEvent.HeadbuttStarted));
            Assert.Equal(M01IntroPhase.SpillingFragments, M01IntroFlow.NextIntroPhase(M01IntroPhase.SpillingFragments, M01IntroEvent.FlashlightTapped));
            Assert.Equal(M01IntroPhase.Acquired, M01IntroFlow.NextIntroPhase(M01IntroPhase.Acquired, M01IntroEvent.FlashlightTapped));
        }

        [Fact(DisplayName = "可重复顶篮: 还有片→readyToHeadbutt 回到可再顶, 全出→bonking(2026-06-08)")]
        public void RepeatableHeadbuttLoop()
        {
            // 撞出一批后还有片: spillingFragments → readyToHeadbutt(玩家可再点篮)
            Assert.Equal(M01IntroPhase.ReadyToHeadbutt, M01IntroFlow.NextIntroPhase(M01IntroPhase.SpillingFragments, M01IntroEvent.PiecesRemain));
            // readyToHeadbutt 再点篮 → 直接再顶(已在篮下耳后贴, 跳过收耳)
            Assert.Equal(M01IntroPhase.Headbutting, M01IntroFlow.NextIntroPhase(M01IntroPhase.ReadyToHeadbutt, M01IntroEvent.HeadbuttStarted));
            // 走一整轮"顶3批清空"的回环: 批1→批2→批3全出→bonking
            var p = M01IntroPhase.Headbutting;
            for (var hit = 1; hit <= 3; hit += 1)
            {
                p = M01IntroFlow.NextIntroPhase(p, M01IntroEvent.HeadbuttContact); // → spillingFragments
                Assert.Equal(M01IntroPhase.SpillingFragments, p);
                if (hit < 3)
                {
                    p = M01IntroFlow.NextIntroPhase(p, M01IntroEvent.PiecesRemain); // 还有片 → readyToHeadbutt
                    Assert.Equal(M01IntroPhase.ReadyToHeadbutt, p);
                    p = M01IntroFlow.NextIntroPhase(p, M01IntroEvent.HeadbuttStarted); // 再点篮 → headbutting
                    Assert.Equal(M01IntroPhase.Headbutting, p);
                }
            }
            p = M01IntroFlow.NextIntroPhase(p, M01IntroEvent.FragmentsSettled); // 全出 → bonking
            Assert.Equal(M01IntroPhase.Bonking, p);
        }

        [Fact(DisplayName = "readyToHeadbutt 只认 headbuttStarted(等玩家再点篮), 不自动推进")]
        public void ReadyToHeadbuttOnlyAcceptsHeadbuttStarted()
        {
            var nonAdvancing = new[]
            {
                M01IntroEvent.WalkArrived,
                M01IntroEvent.FoldDone,
                M01IntroEvent.HeadbuttContact,
                M01IntroEvent.PiecesRemain,
                M01IntroEvent.FragmentsSettled,
                M01IntroEvent.FlashlightBonked,
                M01IntroEvent.FlashlightTapped,
                M01IntroEvent.CrouchDone
            };
            foreach (var evt in nonAdvancing)
            {
                Assert.Equal(M01IntroPhase.ReadyToHeadbutt, M01IntroFlow.NextIntroPhase(M01IntroPhase.ReadyToHeadbutt, evt));
            }
            Assert.Equal(M01IntroPhase.Headbutting, M01IntroFlow.NextIntroPhase(M01IntroPhase.ReadyToHeadbutt, M01IntroEvent.HeadbuttStarted));
        }

        [Fact(DisplayName = "首次点篮不会替玩家走到篮下顶: 不在篮下会走近、伸手、转脸摇头")]
        public void FirstBasketTapDoesNotAutoWalkIntoAHeadbutt()
        {
            Assert.Equal(
                M01IntroBasketTapAction.ApproachReachAndShake,
                M01IntroFlow.ResolveBasketTapAction(M01IntroPhase.Roaming, isUnderBasket: false));
            Assert.Equal(
                M01IntroBasketTapAction.Headbutt,
                M01IntroFlow.ResolveBasketTapAction(M01IntroPhase.Roaming, isUnderBasket: true));
        }

        [Fact(DisplayName = "重复顶篮阶段莱米走开后，点篮不能替玩家自动回到篮下")]
        public void RepeatBasketTapDoesNotAutoReturnAfterLemmyWalksAway()
        {
            Assert.Equal(
                M01IntroBasketTapAction.ApproachReachAndShake,
                M01IntroFlow.ResolveBasketTapAction(M01IntroPhase.ReadyToHeadbutt, isUnderBasket: false));
            Assert.Equal(
                M01IntroBasketTapAction.Headbutt,
                M01IntroFlow.ResolveBasketTapAction(M01IntroPhase.ReadyToHeadbutt, isUnderBasket: true));
        }

        [Theory(DisplayName = "basket tap interrupts a still-finishing roam before starting the basket action")]
        [InlineData(M01IntroPhase.Roaming)]
        [InlineData(M01IntroPhase.ReadyToHeadbutt)]
        public void BasketTapInterruptsStillFinishingRoam(M01IntroPhase phase)
        {
            Assert.True(M01IntroFlow.ShouldInterruptRoamForBasketTap(phase));
            Assert.False(M01IntroFlow.ShouldInterruptRoamForBasketTap(M01IntroPhase.Acquired));
        }

        [Fact(DisplayName = "flashlight pickup interrupts an in-flight roam before pickup changes position and ear state")]
        public void FlashlightPickupInterruptsInFlightRoam()
        {
            Assert.True(M01IntroFlow.ShouldInterruptRoamForPickup(M01IntroPhase.WaitingPickup));
            Assert.False(M01IntroFlow.ShouldInterruptRoamForPickup(M01IntroPhase.PickingUp));
        }

        [Theory(DisplayName = "position-driven ear state is committed before its interruptible animation")]
        [InlineData(false, true, M01IntroEarTransition.Fold)]
        [InlineData(true, false, M01IntroEarTransition.Raise)]
        [InlineData(true, true, M01IntroEarTransition.None)]
        public void PositionCommitsEarStateBeforeAnimation(
            bool initialState,
            bool shouldFold,
            M01IntroEarTransition expectedTransition)
        {
            var earsFolded = initialState;

            var transition = M01IntroFlow.CommitEarState(ref earsFolded, shouldFold);

            Assert.Equal(expectedTransition, transition);
            Assert.Equal(shouldFold, earsFolded);
        }

        [Theory(DisplayName = "flashlight pickup crouches only when the flashlight is resting on the ground")]
        [InlineData(false, M01IntroPickupMotion.Crouch)]
        [InlineData(true, M01IntroPickupMotion.Standing)]
        public void PickupMotionDependsOnFragmentSupport(
            bool isSupportedByFragment,
            M01IntroPickupMotion expected)
        {
            Assert.Equal(expected, M01IntroFlow.ResolvePickupMotion(isSupportedByFragment));
        }

        [Theory(DisplayName = "flashlight pickup stops on Lemmy's current side instead of crossing over the flashlight")]
        [InlineData(-100, 0, -30)]
        [InlineData(100, 0, 30)]
        public void PickupApproachStaysOnTheNearSide(
            double lemmyX,
            double flashlightX,
            double expectedX)
        {
            Assert.Equal(
                expectedX,
                M01IntroFlow.ResolvePickupApproachX(lemmyX, flashlightX, standOff: 30));
        }
    }
}
