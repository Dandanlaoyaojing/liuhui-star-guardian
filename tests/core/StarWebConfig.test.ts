import { describe, expect, it } from "vitest";

import { StarNetworkModel } from "../../assets/scripts/core/StarNetworkModel.ts";
import { boardGraph, validateStarWebConfig } from "../../assets/scripts/core/StarWebConfig.ts";
import starWeb from "../../assets/resources/configs/stage1/m02-starweb-warmth.json" with { type: "json" };

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
});
