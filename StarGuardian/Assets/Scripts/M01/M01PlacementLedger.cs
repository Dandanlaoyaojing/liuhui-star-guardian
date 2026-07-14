// M01 拼片在弱证据区与目标槽位中的运行时占用账本。
// 纯 C#：Cocos 与 Unity 的关键语义（最近两片、单槽互斥）在这里集中并可由 xUnit 验证。
#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;

namespace StarGuardian.M01
{
    public sealed class M01PlacementLedger
    {
        private const int WeakEvidenceCapacity = 2;
        private readonly Dictionary<string, List<string>> weakByEvidence = new();
        private readonly Dictionary<string, string> slotOccupants = new();

        public void TrackWeakSnap(string evidenceId, string fragmentId)
        {
            RemoveWeak(fragmentId);
            if (!weakByEvidence.TryGetValue(evidenceId, out var fragments))
            {
                fragments = new List<string>(WeakEvidenceCapacity);
                weakByEvidence[evidenceId] = fragments;
            }

            fragments.Remove(fragmentId);
            fragments.Add(fragmentId);
            while (fragments.Count > WeakEvidenceCapacity)
            {
                fragments.RemoveAt(0);
            }
        }

        public bool TryGetWeakPair(string evidenceId, out IReadOnlyList<string> pair)
        {
            if (weakByEvidence.TryGetValue(evidenceId, out var fragments) &&
                fragments.Count == WeakEvidenceCapacity)
            {
                pair = fragments.ToArray();
                return true;
            }

            pair = Array.Empty<string>();
            return false;
        }

        public IReadOnlyList<string> WeakFragments(string evidenceId) =>
            weakByEvidence.TryGetValue(evidenceId, out var fragments)
                ? fragments.ToArray()
                : Array.Empty<string>();

        public string? OccupySlot(string slotId, string fragmentId)
        {
            RemoveWeak(fragmentId);
            RemoveSlot(fragmentId);
            slotOccupants.TryGetValue(slotId, out var displaced);
            slotOccupants[slotId] = fragmentId;
            return displaced == fragmentId ? null : displaced;
        }

        public bool TryGetSlotOccupant(string slotId, out string fragmentId) =>
            slotOccupants.TryGetValue(slotId, out fragmentId!);

        public bool IsPlaced(string fragmentId) =>
            slotOccupants.Values.Contains(fragmentId) ||
            weakByEvidence.Values.Any(fragments => fragments.Contains(fragmentId));

        public IReadOnlyList<string> PlacedFragments() =>
            weakByEvidence.Values.SelectMany(fragments => fragments)
                .Concat(slotOccupants.Values)
                .Distinct(StringComparer.Ordinal)
                .ToArray();

        public void Remove(string fragmentId)
        {
            RemoveWeak(fragmentId);
            RemoveSlot(fragmentId);
        }

        public void Clear()
        {
            weakByEvidence.Clear();
            slotOccupants.Clear();
        }

        private void RemoveWeak(string fragmentId)
        {
            foreach (var evidenceId in weakByEvidence.Keys.ToArray())
            {
                var fragments = weakByEvidence[evidenceId];
                fragments.RemoveAll(candidate => candidate == fragmentId);
                if (fragments.Count == 0)
                {
                    weakByEvidence.Remove(evidenceId);
                }
            }
        }

        private void RemoveSlot(string fragmentId)
        {
            foreach (var slotId in slotOccupants
                         .Where(pair => pair.Value == fragmentId)
                         .Select(pair => pair.Key)
                         .ToArray())
            {
                slotOccupants.Remove(slotId);
            }
        }
    }
}
