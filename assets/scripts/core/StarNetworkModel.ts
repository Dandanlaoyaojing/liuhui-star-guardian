// M02《点亮你温暖我》核心机制模型 —— 引擎无关的纯逻辑, 由 Vitest 钉死正确性.
// 规则(spec §5.3): 点一颗星=该星+全部直连邻居满命(lifeMax); 每拍全体同时衰减:
//   亮邻居数 >= freezeThreshold 则冻结(不掉命), 否则 -1, 归0熄灭.
//   胜利 = 所有星都亮 且 每颗亮邻居 >= freezeThreshold (整网自稳锁死).
// 语义与 scripts/m02-starweb-verify.mjs 的求解器逐位对齐(衰减用结算前快照).

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
    this.neighbors = new Map(this.nodes.map((n) => [n, [] as string[]]));
    for (const [a, b] of graph.edges) {
      this.neighbors.get(a)?.push(b);
      this.neighbors.get(b)?.push(a);
    }
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

  /** 一拍 = 点亮 + 衰减 */
  step(id: string): void {
    this.tap(id);
    this.tick();
  }

  /** 胜利: 全亮且每颗亮邻居 >= freezeThreshold */
  isWon(): boolean {
    return this.nodes.every(
      (id) => this.isLit(id) && this.litNeighborCount(id) >= this.rules.freezeThreshold
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
