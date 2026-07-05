// M02《点亮你温暖我》核心机制模型 —— 引擎无关的纯逻辑, 由 Vitest 钉死正确性.
// 规则(spec §5.3): 点一颗星=该星+全部直连邻居满命(lifeMax); 每拍全体同时衰减:
//   亮邻居数 >= freezeThreshold 则冻结(不掉命), 否则 -1, 归0熄灭.
//   胜利 = 所有星都亮 且 每颗亮邻居 >= freezeThreshold (整网自稳锁死).
// 语义由 tests/core 单测钉死(衰减用结算前快照; 见 StarNetworkModel.test.ts / StarWebConfig.test.ts:
//   后者含 BFS 最少点亮数断言, 守住"每板紧配额").

export interface StarNetworkRules {
  lifeMax: number;         // 拍；星被点亮后的满命
  freezeThreshold: number; // 个；冻结所需亮邻居数
}

export interface BoardGraph {
  nodes: string[];
  edges: [string, string][];
}

export class StarNetworkModel {
  private readonly rules: StarNetworkRules;
  private readonly nodes: string[];
  private readonly neighbors: Map<string, string[]>;
  private life: Map<string, number>;

  constructor(graph: BoardGraph, rules: StarNetworkRules) {
    this.rules = rules;
    this.nodes = [...graph.nodes];
    // 用 Set 去重邻接: 镜像边 [A,B]+[B,A] 或重复边不得把邻居算两次(否则虚高的
    // litNeighborCount 会造成假冻结/假通关); 同时忽略自环与指向未知节点的边.
    const adjacency = new Map<string, Set<string>>(this.nodes.map((n) => [n, new Set<string>()]));
    for (const [a, b] of graph.edges) {
      if (a !== b && adjacency.has(a) && adjacency.has(b)) {
        adjacency.get(a)?.add(b);
        adjacency.get(b)?.add(a);
      }
    }
    this.neighbors = new Map([...adjacency].map(([n, set]) => [n, [...set]]));
    this.life = new Map(this.nodes.map((n) => [n, 0]));
  }

  lifeOf(id: string): number {
    return this.life.get(id) ?? 0;
  }

  isLit(id: string): boolean {
    return this.lifeOf(id) > 0;
  }

  neighborsOf(id: string): readonly string[] {
    return this.neighbors.get(id) ?? [];
  }

  /** 当前状态下 id 的亮邻居数 */
  litNeighborCount(id: string): number {
    return this.countLitNeighbors(this.life, id);
  }

  /** 点亮 id 及其全部直连邻居到满命 (未知星忽略) */
  tap(id: string): void {
    if (!this.life.has(id)) return;
    this.life.set(id, this.rules.lifeMax);
    for (const n of this.neighborsOf(id)) {
      this.life.set(n, this.rules.lifeMax);
    }
  }

  /** 全体同时衰减一拍: 用结算前快照判定, 亮邻居不足 freeze 的亮星 -1 */
  tick(): void {
    const snapshot = new Map(this.life);
    for (const id of this.nodes) {
      const life = snapshot.get(id) ?? 0;
      if (life <= 0) continue;
      if (this.countLitNeighbors(snapshot, id) < this.rules.freezeThreshold) {
        this.life.set(id, life - 1);
      }
    }
  }

  /** 一拍 = 点亮 + 衰减。未知星不构成一次点亮 → 不推进衰减(不白耗一拍)，返回是否真发生了点亮 */
  step(id: string): boolean {
    if (!this.life.has(id)) return false;
    this.tap(id);
    this.tick();
    return true;
  }

  /** 胜利: 全亮且每颗亮邻居 >= freezeThreshold (空图不算胜利) */
  isWon(): boolean {
    return (
      this.nodes.length > 0 &&
      this.nodes.every(
        (id) => this.isLit(id) && this.litNeighborCount(id) >= this.rules.freezeThreshold
      )
    );
  }

  reset(): void {
    this.life = new Map(this.nodes.map((n) => [n, 0]));
  }

  private countLitNeighbors(state: Map<string, number>, id: string): number {
    let count = 0;
    for (const n of this.neighborsOf(id)) {
      if ((state.get(n) ?? 0) > 0) count += 1;
    }
    return count;
  }
}
