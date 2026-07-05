import { describe, expect, it } from "vitest";

import { StarNetworkModel, type BoardGraph } from "../../assets/scripts/core/StarNetworkModel.ts";

const RULES = { lifeMax: 3, freezeThreshold: 2 };

const triangle: BoardGraph = {
  nodes: ["A", "B", "C"],
  edges: [["A", "B"], ["B", "C"], ["C", "A"]]
};
const line: BoardGraph = {
  nodes: ["X", "Y", "Z"],
  edges: [["X", "Y"], ["Y", "Z"]]
};

describe("StarNetworkModel.tap", () => {
  it("点一颗星把它和直连邻居都置满命，其余为暗", () => {
    const m = new StarNetworkModel(triangle, RULES);
    m.tap("A");
    expect(m.lifeOf("A")).toBe(3);
    expect(m.lifeOf("B")).toBe(3);
    expect(m.lifeOf("C")).toBe(3);
  });

  it("忽略未知星，不抛错", () => {
    const m = new StarNetworkModel(triangle, RULES);
    expect(() => m.tap("ZZZ")).not.toThrow();
    expect(m.lifeOf("A")).toBe(0);
  });
});

describe("StarNetworkModel.tick", () => {
  it("环上每颗都有2个亮邻居 → 全冻结不掉命", () => {
    const m = new StarNetworkModel(triangle, RULES);
    m.tap("A");
    m.tick();
    expect(m.lifeOf("A")).toBe(3);
    expect(m.lifeOf("B")).toBe(3);
    expect(m.lifeOf("C")).toBe(3);
  });

  it("只有1个亮邻居的星会漏光 (-1)", () => {
    const m = new StarNetworkModel(line, RULES);
    m.tap("X"); // 亮 X,Y; Z 暗
    m.tick();
    expect(m.lifeOf("X")).toBe(2); // 邻居仅 Y
    expect(m.lifeOf("Y")).toBe(2); // 邻居 X 亮 / Z 暗
    expect(m.lifeOf("Z")).toBe(0);
  });

  it("命归0即熄灭", () => {
    const m = new StarNetworkModel(line, RULES);
    m.tap("X");
    m.tick(); m.tick(); m.tick(); // X: 3→2→1→0
    expect(m.isLit("X")).toBe(false);
  });
});

describe("StarNetworkModel.step / isWon / reset", () => {
  it("三角环 step 一点即全锁", () => {
    const m = new StarNetworkModel(triangle, RULES);
    m.step("A");
    expect(m.isWon()).toBe(true);
  });

  it("线状图无法自锁 (端点亮邻居不足)", () => {
    const m = new StarNetworkModel(line, RULES);
    m.step("Y"); // 亮 X,Y,Z; 但 X,Z 各只有1个亮邻居
    expect(m.isWon()).toBe(false);
  });

  it("reset 清回全暗", () => {
    const m = new StarNetworkModel(triangle, RULES);
    m.step("A");
    m.reset();
    expect(m.isWon()).toBe(false);
    expect(m.lifeOf("A")).toBe(0);
  });
});

describe("StarNetworkModel 图构造健壮性", () => {
  it("镜像/重复边不把邻居算两次", () => {
    const dup: BoardGraph = { nodes: ["P", "Q"], edges: [["P", "Q"], ["Q", "P"], ["P", "Q"]] };
    const m = new StarNetworkModel(dup, RULES);
    m.tap("P"); // 亮 P,Q
    expect(m.litNeighborCount("P")).toBe(1); // Q 只算一次
  });

  it("忽略自环", () => {
    const loop: BoardGraph = { nodes: ["P", "Q"], edges: [["P", "P"], ["P", "Q"]] };
    const m = new StarNetworkModel(loop, RULES);
    m.tap("P");
    expect(m.litNeighborCount("P")).toBe(1); // 自己不算邻居
  });

  it("忽略指向未知节点的边", () => {
    const stray: BoardGraph = { nodes: ["P", "Q"], edges: [["P", "Q"], ["P", "ZZZ"]] };
    const m = new StarNetworkModel(stray, RULES);
    m.tap("P");
    expect(m.litNeighborCount("P")).toBe(1);
  });
});
