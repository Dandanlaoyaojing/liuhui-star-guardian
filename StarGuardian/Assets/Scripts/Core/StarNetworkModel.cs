// M02《点亮你温暖我》核心机制模型 —— 引擎无关的纯逻辑, 由 xUnit 钉死正确性.
// 规则(spec §5.3): 点一颗星=该星+全部直连邻居满命(lifeMax); 每拍全体同时衰减:
//   亮邻居数 >= freezeThreshold 则冻结(不掉命), 否则 -1, 归0熄灭.
//   胜利 = 所有星都亮 且 每颗亮邻居 >= freezeThreshold (整网自稳锁死).
// 语义由 unity-tests 单测钉死(衰减用结算前快照); 从 assets/scripts/core/StarNetworkModel.ts 迁移, 规则不变.

using System.Collections.Generic;
using System.Linq;

namespace StarGuardian.Core
{
    public readonly struct StarNetworkRules
    {
        /// <summary>拍；星被点亮后的满命</summary>
        public int LifeMax { get; init; }

        /// <summary>个；冻结所需亮邻居数</summary>
        public int FreezeThreshold { get; init; }
    }

    public sealed class BoardGraph
    {
        public IReadOnlyList<string> Nodes { get; }
        public IReadOnlyList<(string A, string B)> Edges { get; }

        public BoardGraph(IEnumerable<string> nodes, IEnumerable<(string A, string B)> edges)
        {
            Nodes = nodes.ToList();
            Edges = edges.ToList();
        }
    }

    public sealed class StarNetworkModel
    {
        private readonly StarNetworkRules rules;
        private readonly List<string> nodes;
        private readonly Dictionary<string, List<string>> neighbors;
        private Dictionary<string, int> life;

        public StarNetworkModel(BoardGraph graph, StarNetworkRules rules)
        {
            this.rules = rules;
            nodes = new List<string>(graph.Nodes);
            // 用 Set 去重邻接: 镜像边 [A,B]+[B,A] 或重复边不得把邻居算两次(否则虚高的
            // litNeighborCount 会造成假冻结/假通关); 同时忽略自环与指向未知节点的边.
            var adjacency = nodes.ToDictionary(n => n, _ => new HashSet<string>());
            foreach (var (a, b) in graph.Edges)
            {
                if (a != b && adjacency.ContainsKey(a) && adjacency.ContainsKey(b))
                {
                    adjacency[a].Add(b);
                    adjacency[b].Add(a);
                }
            }
            neighbors = adjacency.ToDictionary(kv => kv.Key, kv => kv.Value.ToList());
            life = nodes.ToDictionary(n => n, _ => 0);
        }

        public int LifeOf(string id) => life.TryGetValue(id, out var v) ? v : 0;

        public bool IsLit(string id) => LifeOf(id) > 0;

        public IReadOnlyList<string> NeighborsOf(string id) =>
            neighbors.TryGetValue(id, out var list) ? list : (IReadOnlyList<string>)System.Array.Empty<string>();

        /// <summary>当前状态下 id 的亮邻居数</summary>
        public int LitNeighborCount(string id) => CountLitNeighbors(life, id);

        /// <summary>点亮 id 及其全部直连邻居到满命 (未知星忽略)</summary>
        public void Tap(string id)
        {
            if (!life.ContainsKey(id)) return;
            life[id] = rules.LifeMax;
            foreach (var n in NeighborsOf(id))
            {
                life[n] = rules.LifeMax;
            }
        }

        /// <summary>全体同时衰减一拍: 用结算前快照判定, 亮邻居不足 freeze 的亮星 -1</summary>
        public void Tick()
        {
            var snapshot = new Dictionary<string, int>(life);
            foreach (var id in nodes)
            {
                var current = snapshot.TryGetValue(id, out var v) ? v : 0;
                if (current <= 0) continue;
                if (CountLitNeighbors(snapshot, id) < rules.FreezeThreshold)
                {
                    life[id] = current - 1;
                }
            }
        }

        /// <summary>一拍 = 点亮 + 衰减。未知星不构成一次点亮 → 不推进衰减(不白耗一拍)，返回是否真发生了点亮</summary>
        public bool Step(string id)
        {
            if (!life.ContainsKey(id)) return false;
            Tap(id);
            Tick();
            return true;
        }

        /// <summary>胜利: 全亮且每颗亮邻居 >= freezeThreshold (空图不算胜利)</summary>
        public bool IsWon() =>
            nodes.Count > 0 &&
            nodes.All(id => IsLit(id) && LitNeighborCount(id) >= rules.FreezeThreshold);

        public void Reset()
        {
            life = nodes.ToDictionary(n => n, _ => 0);
        }

        private int CountLitNeighbors(Dictionary<string, int> state, string id)
        {
            var count = 0;
            foreach (var n in NeighborsOf(id))
            {
                if (state.TryGetValue(n, out var v) && v > 0) count += 1;
            }
            return count;
        }
    }
}
