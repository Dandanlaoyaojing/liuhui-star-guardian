// 莱米逐帧动画缓存的引擎无关 LRU 策略。
// 实际 Sprite 释放由 Unity 胶水执行；这里仅决定保留与淘汰哪些动作。
#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;

namespace StarGuardian.M01.Rendering
{
    public sealed class M01LemmyClipCachePolicy
    {
        private readonly int capacity;
        private readonly LinkedList<string> recency = new();
        private readonly HashSet<string> cached = new(StringComparer.Ordinal);

        public M01LemmyClipCachePolicy(int capacity)
        {
            if (capacity < 1) throw new ArgumentOutOfRangeException(nameof(capacity));
            this.capacity = capacity;
        }

        public IReadOnlyList<string> CachedActions => recency.ToArray();

        public void Touch(string action)
        {
            if (!cached.Contains(action)) return;
            recency.Remove(action);
            recency.AddLast(action);
        }

        public IReadOnlyList<string> RecordLoaded(string loadingAction, string? activeAction)
        {
            if (cached.Add(loadingAction))
            {
                recency.AddLast(loadingAction);
            }
            else
            {
                Touch(loadingAction);
            }

            var evicted = new List<string>();
            while (cached.Count > capacity)
            {
                var candidate = recency.First;
                while (candidate != null &&
                       (candidate.Value == loadingAction || candidate.Value == activeAction))
                {
                    candidate = candidate.Next;
                }
                if (candidate == null) break;

                var action = candidate.Value;
                recency.Remove(candidate);
                cached.Remove(action);
                evicted.Add(action);
            }
            return evicted;
        }
    }
}
