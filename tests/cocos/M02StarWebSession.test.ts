import { describe, expect, it } from "vitest";

import { StarWebSession } from "../../assets/scripts/cocos/M02StarWebSession.ts";
import { validateStarWebConfig, type StarWebConfig } from "../../assets/scripts/core/StarWebConfig.ts";
import starWeb from "../../assets/resources/configs/stage1/m02-starweb-warmth.json" with { type: "json" };

function loadConfig(): StarWebConfig {
  const result = validateStarWebConfig(starWeb);
  if (!result.ok) throw new Error("config invalid: " + result.errors.join(", "));
  return result.value;
}

describe("StarWebSession 初始视图", () => {
  it("首板=独环: 6 星全暗, 电量 2, 进行中", () => {
    const s = new StarWebSession(loadConfig());
    const v = s.view;
    expect(v.boardId).toBe("tutorial");
    expect(v.boardIndex).toBe(0);
    expect(v.boardCount).toBe(3);
    expect(v.nodes).toHaveLength(6);
    expect(v.nodes.every((n) => n.status === "dark")).toBe(true);
    expect(v.chargesTotal).toBe(2);
    expect(v.chargesLeft).toBe(2);
    expect(v.status).toBe("playing");
  });
});

describe("StarWebSession 点亮与胜负", () => {
  it("参考解 [A,D] 恰用满电量并胜利, 所有星冻结", () => {
    const s = new StarWebSession(loadConfig());
    expect(s.tapNode("A").accepted).toBe(true);
    expect(s.view.chargesLeft).toBe(1);
    expect(s.tapNode("D").accepted).toBe(true);
    const v = s.view;
    expect(v.status).toBe("won");
    expect(v.chargesLeft).toBe(0);
    expect(v.nodes.every((n) => n.status === "frozen")).toBe(true);
  });

  it("未知星: 拒绝, 不耗电量", () => {
    const s = new StarWebSession(loadConfig());
    const r = s.tapNode("ZZZ");
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe("unknown_node");
    expect(s.view.chargesLeft).toBe(2);
  });

  it("电量耗尽未胜 → exhausted, 之后 tap 被拒", () => {
    const s = new StarWebSession(loadConfig());
    s.tapNode("A"); // 亮一段弧, 未合环
    s.tapNode("A"); // 白耗第二点, 仍未全锁
    const v = s.view;
    expect(v.status).toBe("exhausted");
    expect(v.chargesLeft).toBe(0);
    expect(s.tapNode("D").accepted).toBe(false); // not_playing
    expect(s.tapNode("D").reason).toBe("not_playing");
  });

  it("resetBoard 回到进行中、电量满", () => {
    const s = new StarWebSession(loadConfig());
    s.tapNode("A");
    s.tapNode("A");
    s.resetBoard();
    const v = s.view;
    expect(v.status).toBe("playing");
    expect(v.chargesLeft).toBe(2);
    expect(v.nodes.every((n) => n.status === "dark")).toBe(true);
  });
});

describe("StarWebSession 三板推进", () => {
  it("nextBoard 依次到 twin/trefoil, 末板返回 false", () => {
    const s = new StarWebSession(loadConfig());
    expect(s.nextBoard()).toBe(true);
    expect(s.view.boardId).toBe("twin");
    expect(s.view.chargesTotal).toBe(3);
    expect(s.nextBoard()).toBe(true);
    expect(s.view.boardId).toBe("trefoil");
    expect(s.view.chargesTotal).toBe(4);
    expect(s.nextBoard()).toBe(false); // 已是最后一板
    expect(s.view.boardId).toBe("trefoil");
  });

  it("每一板参考解都能在本会话内打通", () => {
    const s = new StarWebSession(loadConfig());
    const cfg = loadConfig();
    for (const board of cfg.boards) {
      for (const id of board.solution.referenceTaps) s.tapNode(id);
      expect(s.view.status, board.id).toBe("won");
      s.nextBoard();
    }
  });
});

describe("StarWebSession 整关完成", () => {
  it("三板全 won 后关卡完成", () => {
    const s = new StarWebSession(loadConfig());
    const cfg = loadConfig();
    for (const board of cfg.boards) {
      for (const id of board.solution.referenceTaps) s.tapNode(id);
      expect(s.view.status, board.id).toBe("won");
      if (s.view.boardId !== "trefoil") s.nextBoard();
    }
    expect(s.isLevelComplete()).toBe(true);
  });

  it("中途未通关不算关卡完成", () => {
    const s = new StarWebSession(loadConfig());
    expect(s.isLevelComplete()).toBe(false);
  });
});

describe("StarWebSession 呈现态", () => {
  it("点一颗后: 该星冻结/衰减态出现, 其余仍暗", () => {
    const s = new StarWebSession(loadConfig());
    s.tapNode("A"); // 独环: A 有 2 亮邻居(B,F) → frozen; B/F 各 1 亮邻居 → decaying
    const byId = new Map(s.view.nodes.map((n) => [n.id, n]));
    expect(byId.get("A")?.status).toBe("frozen");
    expect(byId.get("B")?.status).toBe("decaying");
    expect(byId.get("C")?.status).toBe("dark");
  });
});
