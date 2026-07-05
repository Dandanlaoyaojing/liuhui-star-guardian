import { describe, expect, it } from "vitest";

import { StarNetworkModel } from "../../assets/scripts/core/StarNetworkModel.ts";
import { boardGraph, validateStarWebConfig } from "../../assets/scripts/core/StarWebConfig.ts";
import { createToolCard, validateToolCard } from "../../assets/scripts/core/ToolCard.ts";
import type { BoardGraph, StarNetworkRules } from "../../assets/scripts/core/StarNetworkModel.ts";
import starWeb from "../../assets/resources/configs/stage1/m02-starweb-warmth.json" with { type: "json" };

// 穷举最少点亮数(探到 maxLen 为止): 每条长度序列用全新 model 回放, 判是否全锁.
// 返回首个能全锁的序列长度; 探不到返回 Infinity. 用于断言"紧配额"(少一次无解)。
function minTapsToWin(graph: BoardGraph, rules: StarNetworkRules, maxLen: number): number {
  const wins = (seq: string[]): boolean => {
    const model = new StarNetworkModel(graph, rules);
    for (const id of seq) model.step(id);
    return model.isWon();
  };
  let seqs: string[][] = [[]];
  for (let len = 1; len <= maxLen; len++) {
    seqs = seqs.flatMap((s) => graph.nodes.map((n) => [...s, n]));
    for (const seq of seqs) {
      if (wins(seq)) return len;
    }
  }
  return Number.POSITIVE_INFINITY;
}

describe("validateStarWebConfig", () => {
  it("真实配置合法且三板顺序正确", () => {
    const result = validateStarWebConfig(starWeb);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.boards.map((b) => b.id)).toEqual(["tutorial", "twin", "trefoil"]);
      expect(result.value.mechanic.lifeMax).toBe(3);
      expect(result.value.mechanic.freezeThreshold).toBe(2);
    }
  });

  it("拒绝 edges 引用不存在的节点", () => {
    const broken = structuredClone(starWeb) as unknown as Record<string, unknown>;
    (broken.boards as Array<{ layout: { edges: string[][] } }>)[0].layout.edges.push(["A", "ZZZ"]);
    const result = validateStarWebConfig(broken);
    expect(result.ok).toBe(false);
  });

  it("拒绝不受支持的 mechanic flag (tapLightsNeighbors=false)", () => {
    const broken = structuredClone(starWeb) as unknown as { mechanic: Record<string, unknown> };
    broken.mechanic.tapLightsNeighbors = false;
    expect(validateStarWebConfig(broken).ok).toBe(false);
  });

  it("拒绝自环边", () => {
    const broken = structuredClone(starWeb) as unknown as { boards: Array<{ layout: { edges: string[][] } }> };
    broken.boards[0].layout.edges.push(["A", "A"]);
    expect(validateStarWebConfig(broken).ok).toBe(false);
  });

  it("拒绝重复/镜像边", () => {
    const broken = structuredClone(starWeb) as unknown as { boards: Array<{ layout: { edges: string[][] } }> };
    const first = broken.boards[0].layout.edges[0]; // 已有的一条
    broken.boards[0].layout.edges.push([first[1], first[0]]); // 反向重复
    expect(validateStarWebConfig(broken).ok).toBe(false);
  });

  it("拒绝非字符串的可选字段 (description)", () => {
    const broken = structuredClone(starWeb) as unknown as Record<string, unknown>;
    broken.description = 123;
    expect(validateStarWebConfig(broken).ok).toBe(false);
  });

  it("真实配置包含可生成合法工具卡的文案", () => {
    const result = validateStarWebConfig(starWeb);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const card = createToolCard(result.value.toolCard, 1000);
    const validation = validateToolCard(card);
    expect(validation.ok).toBe(true);
    expect(card.front.toolName).toBe("协同与临界质量");
    expect(card.front.wisdomCrystal).toContain("挨在一起");
    expect(card.back.whenToUse.length).toBeGreaterThan(0);
    expect(card.back.realLifeExamples.length).toBeGreaterThan(0);
  });
});

describe("配置 × 模型 集成 (verify 折进测试套件)", () => {
  it("每板参考解在配额内全锁", () => {
    const result = validateStarWebConfig(starWeb);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const board of result.value.boards) {
      const model = new StarNetworkModel(boardGraph(board), result.value.mechanic);
      for (const id of board.solution.referenceTaps) model.step(id);
      expect(model.isWon(), `${board.id} 参考解应全锁`).toBe(true);
      expect(board.solution.referenceTaps.length, `${board.id} 解应正好用满配额`).toBe(board.charges);
    }
  });

  it("三瓣花: 先点枢纽 A 必崩 (顺序也要命)", () => {
    const result = validateStarWebConfig(starWeb);
    if (!result.ok) throw new Error("config invalid");
    const trefoil = result.value.boards.find((b) => b.id === "trefoil");
    expect(trefoil).toBeDefined();
    if (!trefoil) return;
    const model = new StarNetworkModel(boardGraph(trefoil), result.value.mechanic);
    for (const id of ["A", "C", "G", "K"]) model.step(id); // 先枢纽
    expect(model.isWon()).toBe(false);
  });

  it("双环: 漏掉一个环的锚 (A,B,D) 无法全锁", () => {
    const result = validateStarWebConfig(starWeb);
    if (!result.ok) throw new Error("config invalid");
    const twin = result.value.boards.find((b) => b.id === "twin");
    if (!twin) throw new Error("no twin");
    const model = new StarNetworkModel(boardGraph(twin), result.value.mechanic);
    for (const id of ["A", "B", "D"]) model.step(id);
    expect(model.isWon()).toBe(false);
  });

  it("每板配额是紧的: 最少点亮数 === charges (少一次无解)", () => {
    const result = validateStarWebConfig(starWeb);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const board of result.value.boards) {
      const min = minTapsToWin(boardGraph(board), result.value.mechanic, board.charges);
      expect(min, `${board.id} 应恰好 ${board.charges} 点可解`).toBe(board.charges);
    }
  });
});
