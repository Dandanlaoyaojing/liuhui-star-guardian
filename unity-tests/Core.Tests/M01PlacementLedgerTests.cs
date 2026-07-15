using System.Linq;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.Tests
{
    public sealed class M01PlacementLedgerTests
    {
        [Fact(DisplayName = "weak evidence keeps the two most recently placed fragments in order")]
        public void WeakEvidenceKeepsLastTwoFragments()
        {
            var ledger = new M01PlacementLedger();

            ledger.TrackWeakSnap("evidence", "first");
            ledger.TrackWeakSnap("evidence", "second");
            ledger.TrackWeakSnap("evidence", "third");

            Assert.True(ledger.TryGetWeakPair("evidence", out var pair));
            Assert.Equal(new[] { "second", "third" }, pair);
            Assert.False(ledger.IsPlaced("first"));
        }

        [Fact(DisplayName = "moving a weak-snapped fragment transfers it instead of duplicating it")]
        public void WeakFragmentMovesBetweenEvidenceAreas()
        {
            var ledger = new M01PlacementLedger();
            ledger.TrackWeakSnap("first_evidence", "fragment");

            ledger.TrackWeakSnap("second_evidence", "fragment");

            Assert.False(ledger.TryGetWeakPair("first_evidence", out _));
            Assert.Equal(new[] { "fragment" }, ledger.WeakFragments("second_evidence"));
        }

        [Fact(DisplayName = "occupying a slot returns the displaced fragment and records only the replacement")]
        public void SlotOccupancyIsMutuallyExclusive()
        {
            var ledger = new M01PlacementLedger();
            Assert.Null(ledger.OccupySlot("slot", "old"));

            var displaced = ledger.OccupySlot("slot", "replacement");

            Assert.Equal("old", displaced);
            Assert.True(ledger.TryGetSlotOccupant("slot", out var occupant));
            Assert.Equal("replacement", occupant);
            Assert.False(ledger.IsPlaced("old"));
        }

        [Fact(DisplayName = "removing a fragment clears both weak evidence and target-slot occupancy")]
        public void RemoveClearsEveryPlacementKind()
        {
            var ledger = new M01PlacementLedger();
            ledger.TrackWeakSnap("evidence", "weak");
            ledger.OccupySlot("slot", "target");

            ledger.Remove("weak");
            ledger.Remove("target");

            Assert.Empty(ledger.WeakFragments("evidence"));
            Assert.False(ledger.TryGetSlotOccupant("slot", out _));
            Assert.Empty(ledger.PlacedFragments().ToArray());
        }

        [Theory(DisplayName = "target slots preserve a correct occupant without rejecting the incoming parked fragment")]
        [InlineData(false, false, M01TargetSlotPlacementAction.ClaimIncoming)]
        [InlineData(true, false, M01TargetSlotPlacementAction.ReleaseExistingAndClaimIncoming)]
        [InlineData(true, true, M01TargetSlotPlacementAction.PreserveExistingAndParkIncoming)]
        public void ResolvesTargetSlotOccupantWithoutRejectingIncoming(
            bool hasDifferentOccupant,
            bool existingOccupantPoseCorrect,
            M01TargetSlotPlacementAction expected)
        {
            Assert.Equal(
                expected,
                M01PlacementLedger.ResolveTargetSlotPlacement(hasDifferentOccupant, existingOccupantPoseCorrect));
        }

        [Fact(DisplayName = "placing onto a correct target occupant preserves its ledger entry while parking the incoming fragment separately")]
        public void CorrectTargetOccupantRemainsRecorded()
        {
            var ledger = new M01PlacementLedger();
            ledger.OccupySlot("slot", "correct");

            var action = ledger.PlaceIntoTargetSlot(
                "slot",
                "incoming",
                existingOccupantPoseCorrect: true,
                out var displaced);

            Assert.Equal(M01TargetSlotPlacementAction.PreserveExistingAndParkIncoming, action);
            Assert.Null(displaced);
            Assert.True(ledger.TryGetSlotOccupant("slot", out var occupant));
            Assert.Equal("correct", occupant);
            Assert.False(ledger.IsPlaced("incoming"));
        }

        [Fact(DisplayName = "placing onto an incorrect target occupant atomically replaces the ledger entry")]
        public void IncorrectTargetOccupantIsReplacedAtomically()
        {
            var ledger = new M01PlacementLedger();
            ledger.OccupySlot("slot", "incorrect");

            var action = ledger.PlaceIntoTargetSlot(
                "slot",
                "incoming",
                existingOccupantPoseCorrect: false,
                out var displaced);

            Assert.Equal(M01TargetSlotPlacementAction.ReleaseExistingAndClaimIncoming, action);
            Assert.Equal("incorrect", displaced);
            Assert.True(ledger.TryGetSlotOccupant("slot", out var occupant));
            Assert.Equal("incoming", occupant);
            Assert.False(ledger.IsPlaced("incorrect"));
        }
    }
}
