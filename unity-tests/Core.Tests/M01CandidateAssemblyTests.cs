using System.Collections.Generic;
using StarGuardian.M01;
using Xunit;

namespace StarGuardian.Tests
{
    public sealed class M01CandidateAssemblyTests
    {
        [Theory(DisplayName = "a complete platform validates even before every pose-dependent evidence pair is staged")]
        [InlineData(true, false, true)]
        [InlineData(false, true, true)]
        [InlineData(false, false, false)]
        public void ResolvesValidationGate(
            bool allSlotsPositionOccupied,
            bool allEvidenceStaged,
            bool expected)
        {
            Assert.Equal(
                expected,
                M01CandidateAssembly.ShouldValidate(
                    allSlotsPositionOccupied,
                    allEvidenceStaged));
        }

        [Fact(DisplayName = "target evidence is composed from live occupants rather than solution fragment ids")]
        public void ResolvesLiveTargetEvidencePair()
        {
            var actualOccupants = new Dictionary<string, string>
            {
                ["solution-red"] = "wrong-color-blue",
                ["solution-yellow"] = "wrong-color-red"
            };

            var pair = M01CandidateAssembly.ResolveTargetEvidencePair(
                new[] { "solution-red", "solution-yellow" },
                actualOccupants);

            Assert.Equal(new[] { "wrong-color-blue", "wrong-color-red" }, pair);
        }

        [Theory(DisplayName = "incomplete or duplicate live occupants do not form target evidence")]
        [InlineData(false, false)]
        [InlineData(true, true)]
        public void RejectsInvalidTargetEvidencePair(bool hasSecondOccupant, bool duplicateOccupant)
        {
            var actualOccupants = new Dictionary<string, string>
            {
                ["solution-a"] = "actual-a"
            };
            if (hasSecondOccupant)
            {
                actualOccupants["solution-b"] = duplicateOccupant ? "actual-a" : "actual-b";
            }

            Assert.Null(M01CandidateAssembly.ResolveTargetEvidencePair(
                new[] { "solution-a", "solution-b" },
                actualOccupants));
        }
    }
}
