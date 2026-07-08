import { describe, expect, it } from "vitest";

import { StarNetworkModel } from "../../assets/scripts/core/StarNetworkModel.ts";
import { boardGraph, validateStarWebConfig } from "../../assets/scripts/core/StarWebConfig.ts";
import { createToolCard, validateToolCard } from "../../assets/scripts/core/ToolCard.ts";
import type { BoardGraph } from "../../assets/scripts/core/StarNetworkModel.ts";
import starWeb from "../../assets/resources/configs/stage1/m02-starweb-warmth.json" with { type: "json" };

// 覆盖下界: 若 maxTaps 次连"点亮过所有节点"都做不到, 就必然不可能全锁胜利。
function canLightEveryNodeWithinTaps(graph: BoardGraph, maxTaps: number): boolean {
  const nodeIndex = new Map(graph.nodes.map((node, index) => [node, index]));
  const coverageMasks = graph.nodes.map((_, index) => 1n << BigInt(index));
  for (const [a, b] of graph.edges) {
    const ai = nodeIndex.get(a);
    const bi = nodeIndex.get(b);
    if (ai === undefined || bi === undefined || ai === bi) continue;
    coverageMasks[ai] |= 1n << BigInt(bi);
    coverageMasks[bi] |= 1n << BigInt(ai);
  }
  const allLitMask = (1n << BigInt(graph.nodes.length)) - 1n;

  const search = (start: number, remaining: number, litMask: bigint): boolean => {
    if (litMask === allLitMask) return true;
    if (remaining === 0) return false;
    for (let i = start; i <= coverageMasks.length - remaining; i++) {
      if (search(i + 1, remaining - 1, litMask | coverageMasks[i])) return true;
    }
    return false;
  };

  return search(0, maxTaps, 0n);
}

describe("validateStarWebConfig", () => {
  it("真实配置合法且只保留双环/双轨/花冠三板", () => {
    const result = validateStarWebConfig(starWeb);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.boards.map((b) => b.id)).toEqual(["twin", "orbital_gate", "corona_gate"]);
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

  it("拒绝同一板内重复 node id", () => {
    const broken = structuredClone(starWeb) as unknown as {
      boards: Array<{ layout: { nodes: Array<{ id: string }> } }>;
    };
    broken.boards[0].layout.nodes[1].id = broken.boards[0].layout.nodes[0].id;
    const result = validateStarWebConfig(broken);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain("is duplicated");
  });

  it("拒绝重复 board id", () => {
    const broken = structuredClone(starWeb) as unknown as { boards: Array<{ id: string }> };
    broken.boards[1].id = broken.boards[0].id;
    const result = validateStarWebConfig(broken);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain('boards[1].id "twin" is duplicated');
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

  it("拒绝与父级配置身份不一致的工具卡", () => {
    const cases = [
      (config: typeof starWeb) => {
        config.toolCard.puzzleId = "m99";
      },
      (config: typeof starWeb) => {
        config.toolCard.stage = 2;
      },
      (config: typeof starWeb) => {
        config.toolCard.front.wisdomCrystal = "不同的智慧水晶";
      }
    ];

    for (const mutate of cases) {
      const broken = structuredClone(starWeb);
      mutate(broken);
      expect(validateStarWebConfig(broken).ok).toBe(false);
    }
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

  it("双轨星门: 24 星 6 电, 参考解保留上一版", () => {
    const result = validateStarWebConfig(starWeb);
    if (!result.ok) throw new Error("config invalid");
    const gate = result.value.boards.find((b) => b.id === "orbital_gate");
    expect(gate).toBeDefined();
    if (!gate) return;
    expect(gate.name).toBe("双轨星门");
    expect(gate.layout.nodes).toHaveLength(24);
    expect(gate.charges).toBe(6);
    expect(gate.solution.referenceTaps).toEqual(["A", "M", "I", "U", "E", "Q"]);
  });

  it("双轨星门: 直觉陷阱路线会失败", () => {
    const result = validateStarWebConfig(starWeb);
    if (!result.ok) throw new Error("config invalid");
    const gate = result.value.boards.find((b) => b.id === "orbital_gate");
    if (!gate) throw new Error("no orbital_gate");
    const trapSequences = [
      ["A", "E", "I", "M", "Q", "U"],
      ["A", "I", "Q", "M", "U", "E"],
      ["M", "U", "E", "A", "I", "Q"],
      ["A", "Q", "E", "M", "I", "U"]
    ];

    for (const sequence of trapSequences) {
      const model = new StarNetworkModel(boardGraph(gate), result.value.mechanic);
      for (const id of sequence) model.step(id);
      expect(model.isWon(), `${sequence.join(",")} 应失败`).toBe(false);
    }
  });

  it("花冠星门: 31 星 7 电, 花冠中心必须参与", () => {
    const result = validateStarWebConfig(starWeb);
    if (!result.ok) throw new Error("config invalid");
    const gate = result.value.boards.find((b) => b.id === "corona_gate");
    expect(gate).toBeDefined();
    if (!gate) return;
    expect(gate.name).toBe("花冠星门");
    expect(gate.layout.nodes).toHaveLength(31);
    expect(gate.charges).toBe(7);
    expect(gate.solution.referenceTaps).toEqual(["A", "M", "I", "U", "E", "Q", "Y"]);
  });

  it("花冠星门: 直觉陷阱路线会失败", () => {
    const result = validateStarWebConfig(starWeb);
    if (!result.ok) throw new Error("config invalid");
    const gate = result.value.boards.find((b) => b.id === "corona_gate");
    if (!gate) throw new Error("no corona_gate");
    const trapSequences = [
      ["A", "E", "I", "M", "Q", "U", "Y"], // 顺着轨道扫
      ["Y", "A", "M", "I", "U", "E", "Q"], // 先点中心
      ["A", "I", "Q", "M", "U", "E", "Y"], // 先清上轨
      ["M", "U", "E", "A", "I", "Q", "Y"], // 先清下轨
      ["A", "Q", "E", "M", "I", "U", "Y"], // 先点两端
      ["A", "M", "I", "U", "E", "Q"]       // 漏掉花冠中心
    ];

    for (const sequence of trapSequences) {
      const model = new StarNetworkModel(boardGraph(gate), result.value.mechanic);
      for (const id of sequence) model.step(id);
      expect(model.isWon(), `${sequence.join(",")} 应失败`).toBe(false);
    }
  });

  it("花冠星门: 双轨外环加中心花冠连续成网", () => {
    const result = validateStarWebConfig(starWeb);
    if (!result.ok) throw new Error("config invalid");
    const gate = result.value.boards.find((b) => b.id === "corona_gate");
    if (!gate) throw new Error("no corona_gate");
    const edgeKey = (a: string, b: string): string => [a, b].sort().join("-");
    const edges = new Set(gate.layout.edges.map(([a, b]) => edgeKey(a, b)));

    for (const edge of ["C-J", "K-R", "O-V", "F-W"]) {
      expect(edges.has(edge), `${edge} 应连成连续双轨`).toBe(true);
    }
    for (const [a, b] of [["Y", "Z"], ["Y", "AA"], ["Y", "AB"], ["Y", "AC"], ["Y", "AD"], ["Y", "AE"]]) {
      expect(edges.has(edgeKey(a, b)), `${a}-${b} 应连成中心花冠`).toBe(true);
    }
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

  it("每板配额是紧的: 少一次无解", () => {
    const result = validateStarWebConfig(starWeb);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const board of result.value.boards) {
      const canCover = canLightEveryNodeWithinTaps(boardGraph(board), board.charges - 1);
      expect(canCover, `${board.id} 应少于 ${board.charges} 点无解`).toBe(false);
    }
  });
});
