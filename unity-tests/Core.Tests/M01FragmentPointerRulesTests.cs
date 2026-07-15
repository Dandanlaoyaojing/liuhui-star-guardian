using StarGuardian.M01;
using Xunit;

namespace StarGuardian.M01.Tests
{
    public class M01FragmentPointerRulesTests
    {
        [Theory(DisplayName = "treats movement up to and including the Cocos 6px threshold as a rotate tap")]
        [InlineData(0, 0, true)]
        [InlineData(6, 0, true)]
        [InlineData(3, 4, true)]
        [InlineData(6.01, 0, false)]
        public void ClassifiesTapUsingCocosThreshold(double dx, double dy, bool expected)
        {
            Assert.Equal(expected, M01FragmentPointerRules.IsRotateTap(dx, dy));
        }

        [Theory(DisplayName = "rebaselines a physical tumble to the nearest quarter turn without changing the visual")]
        [InlineData(359, 0)]
        [InlineData(44, 0)]
        [InlineData(46, 90)]
        [InlineData(136, 180)]
        [InlineData(-91, 270)]
        public void RebaselinesPhysicalRotation(double visualDegrees, double expected)
        {
            Assert.Equal(expected, M01FragmentPointerRules.RebaselineRotation(visualDegrees));
        }

        [Theory(DisplayName = "rotates clockwise in exact 90 degree steps")]
        [InlineData(0, 90)]
        [InlineData(90, 180)]
        [InlineData(270, 0)]
        public void RotatesClockwise(double current, double expected)
        {
            Assert.Equal(expected, M01FragmentPointerRules.NextClockwiseRotation(current));
        }

        [Fact(DisplayName = "pins a tap-rotated fragment for the same two-second Cocos window")]
        public void UsesCocosRotatePinDuration()
        {
            Assert.Equal(2, M01FragmentPointerRules.RotatePinHoldSeconds, 12);
        }

        [Theory(DisplayName = "before global settle only a fragment truly outside the basket is pickable")]
        [InlineData(false, false, false)]
        [InlineData(false, true, true)]
        [InlineData(true, false, true)]
        [InlineData(true, true, true)]
        public void GatesPickupLikeCocos(bool physicsSettled, bool spilledOut, bool expected)
        {
            Assert.Equal(expected, M01FragmentPointerRules.CanPickFragment(physicsSettled, spilledOut));
        }

        [Theory(DisplayName = "keeps each fragment renderer in one relative visual stack while dragging and restoring")]
        [InlineData(60, 0, 60)]
        [InlineData(60, 1, 61)]
        [InlineData(0, 0, 0)]
        [InlineData(0, 1, 1)]
        public void PreservesRendererStack(int baseOrder, int relativeOffset, int expected)
        {
            Assert.Equal(expected, M01FragmentPointerRules.RendererSortingOrder(baseOrder, relativeOffset));
        }
    }
}
