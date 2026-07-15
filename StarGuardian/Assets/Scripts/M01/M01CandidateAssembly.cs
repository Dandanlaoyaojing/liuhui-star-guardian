#nullable enable

using System;
using System.Collections.Generic;

namespace StarGuardian.M01
{
    /// <summary>候选平台的引擎无关装配规则；Unity 胶水只负责收集实时占用状态。</summary>
    public static class M01CandidateAssembly
    {
        public static bool ShouldValidate(
            bool allTargetSlotsPositionOccupied,
            bool allEvidenceStaged) =>
            allTargetSlotsPositionOccupied || allEvidenceStaged;

        public static string[]? ResolveTargetEvidencePair(
            IReadOnlyList<string> solutionFragmentIds,
            IReadOnlyDictionary<string, string> liveOccupantByExpectedFragment)
        {
            if (solutionFragmentIds.Count != 2 ||
                !liveOccupantByExpectedFragment.TryGetValue(solutionFragmentIds[0], out var first) ||
                !liveOccupantByExpectedFragment.TryGetValue(solutionFragmentIds[1], out var second) ||
                string.Equals(first, second, StringComparison.Ordinal))
            {
                return null;
            }

            return new[] { first, second };
        }
    }
}
