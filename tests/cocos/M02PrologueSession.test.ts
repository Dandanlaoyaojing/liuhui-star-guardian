// M02 序章「三颗余烬点棒」纯逻辑测试。
// 钉死: 与主谜题同律的衰减/冻结(快照结算) + 序章特有的 实时拍推进/距离邻接/复燃无死锁/拔棒点棒。

import { describe, expect, it } from "vitest";

import { M02PrologueSession } from "../../assets/scripts/cocos/M02PrologueSession.ts";
import { StarNetworkModel, type StarNetworkRules } from "../../assets/scripts/core/StarNetworkModel.ts";
import type { PrologueEmber, StarWebPrologue } from "../../assets/scripts/core/StarWebConfig.ts";

const RULES: StarNetworkRules = { lifeMax: 3, freezeThreshold: 2 };

const PROLOGUE: StarWebPrologue = {
  beatSeconds: 1.4,
  adjacencyRadius: 90,
  rekindleBeats: 2,
  wand: { x: 320, y: -180 },
  wandDipRadius: 120,
  embers: [
    { id: "e1", x: -300, y: -80, initialLife: 3 },
    { id: "e2", x: -60, y: -170, initialLife: 2 },
    { id: "e3", x: 150, y: -60, initialLife: 1 }
  ]
};

function makeSession(): M02PrologueSession {
  return new M02PrologueSession(PROLOGUE, RULES);
}

function beat(session: M02PrologueSession, count = 1): void {
  for (let i = 0; i < count; i += 1) session.update(PROLOGUE.beatSeconds);
}

function ember(session: M02PrologueSession, id: string) {
  const found = session.view.embers.find((e) => e.id === id);
  if (!found) throw new Error(`ember ${id} missing from view`);
  return found;
}

/** 把三颗余烬摆成两两都在 adjacencyRadius 内的紧簇 */
function cluster(session: M02PrologueSession): void {
  session.moveEmber("e1", 0, 0);
  session.moveEmber("e2", 50, 0);
  session.moveEmber("e3", 25, 40);
}

describe("M02PrologueSession 开局与衰减", () => {
  it("开局: 按 initialLife 亮着、各自孤立(decaying)、棒 planted、未完成", () => {
    const view = makeSession().view;
    expect(view.embers.map((e) => [e.id, e.life, e.status])).toEqual([
      ["e1", 3, "decaying"],
      ["e2", 2, "decaying"],
      ["e3", 1, "decaying"]
    ]);
    expect(view.wandState).toBe("planted");
    expect(view.wand).toEqual({ x: 320, y: -180 });
    expect(view.done).toBe(false);
  });

  it("孤烬逐拍衰减, 命数错开先后熄灭", () => {
    const session = makeSession();
    beat(session);
    expect(ember(session, "e1").life).toBe(2);
    expect(ember(session, "e2").life).toBe(1);
    expect(ember(session, "e3").status).toBe("dark");
  });

  it("熄灭后隔 rekindleBeats 拍原地复燃至满命", () => {
    const session = makeSession();
    beat(session); // e3 熄灭
    beat(session); // 暗第 1 拍
    expect(ember(session, "e3").status).toBe("dark");
    beat(session); // 暗第 2 拍 → 复燃
    expect(ember(session, "e3").life).toBe(RULES.lifeMax);
    expect(ember(session, "e3").status).toBe("decaying");
  });

  it("无死锁: 无任何交互跑 20 拍, 每颗余烬都反复复燃过", () => {
    const session = makeSession();
    const seenLit = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      beat(session);
      for (const e of session.view.embers) {
        if (e.lit) seenLit.add(e.id);
      }
    }
    expect([...seenLit].sort()).toEqual(["e1", "e2", "e3"]);
  });
});

describe("M02PrologueSession 邻接与冻结(与主谜题同律)", () => {
  it("两颗互在半径内仍衰减(1 个亮邻居 < freezeThreshold)", () => {
    const session = makeSession();
    session.moveEmber("e1", 0, 0);
    session.moveEmber("e2", 60, 0);
    beat(session);
    expect(ember(session, "e1").life).toBe(2);
    expect(ember(session, "e2").life).toBe(1);
  });

  it("三颗成簇: 冻结状态即时可见(不等拍), 多拍不掉命", () => {
    const session = makeSession();
    cluster(session);
    // 冻结是派生态: 摆成簇的那一刻 view 立即显示 frozen
    expect(session.view.embers.every((e) => e.status === "frozen")).toBe(true);
    beat(session, 5);
    expect(ember(session, "e1").life).toBe(3);
    expect(ember(session, "e2").life).toBe(2);
    expect(ember(session, "e3").life).toBe(1);
  });

  it("拖走一颗, 剩下两颗恢复衰减", () => {
    const session = makeSession();
    cluster(session);
    session.moveEmber("e1", -300, -80);
    beat(session);
    expect(ember(session, "e2").life).toBe(1);
    expect(ember(session, "e3").status).toBe("dark");
  });

  it("暗烬不算邻居: 两亮一暗的簇不冻结", () => {
    const session = makeSession();
    beat(session); // e3 熄灭
    cluster(session);
    expect(ember(session, "e1").status).toBe("decaying");
    expect(ember(session, "e2").status).toBe("decaying");
    beat(session);
    expect(ember(session, "e1").life).toBe(1);
  });

  it("自愈: 三颗保持成簇, 熄的复燃后终态全冻结", () => {
    const session = makeSession();
    cluster(session);
    session.moveEmber("e1", -300, -80); // 先破坏一次让它们乱掉
    beat(session, 3);
    cluster(session);
    beat(session, 10);
    expect(session.view.embers.every((e) => e.status === "frozen")).toBe(true);
  });

  it("moveEmber: 未知 id 返回 false, 合法移动更新坐标", () => {
    const session = makeSession();
    expect(session.moveEmber("nope", 0, 0)).toBe(false);
    expect(session.moveEmber("e1", 12, 34)).toBe(true);
    expect(ember(session, "e1").x).toBe(12);
    expect(ember(session, "e1").y).toBe(34);
  });
});

describe("M02PrologueSession 实时拍推进", () => {
  it("dt 累积不足一拍不结算, 累积过拍一次性补齐多拍", () => {
    const session = makeSession();
    session.update(0.7);
    expect(ember(session, "e3").lit).toBe(true);
    session.update(0.7); // 满 1.4 → 走 1 拍
    expect(ember(session, "e3").status).toBe("dark");

    const fresh = makeSession();
    fresh.update(PROLOGUE.beatSeconds * 3); // 一次性 3 拍
    expect(ember(fresh, "e1").status).toBe("dark"); // 3 命耗尽
  });
});

describe("M02PrologueSession 拔棒与点棒", () => {
  it("pullWand: planted→held 一次成功, 重复拔失败", () => {
    const session = makeSession();
    expect(session.pullWand()).toBe(true);
    expect(session.view.wandState).toBe("held");
    expect(session.pullWand()).toBe(false);
  });

  it("未拔棒不能点火: dipWand → wand_not_held", () => {
    const session = makeSession();
    cluster(session);
    expect(session.dipWand(25, 15)).toEqual({ accepted: false, reason: "wand_not_held" });
  });

  it("手持但点击处半径内没有冻结余烬 → no_frozen_ember (含'簇在别处'的情况)", () => {
    const session = makeSession();
    session.pullWand();
    // 尚无簇
    expect(session.dipWand(0, 0)).toEqual({ accepted: false, reason: "no_frozen_ember" });
    // 有簇但点得太远 (簇在原点附近, 点在 400px 外)
    cluster(session);
    expect(session.dipWand(400, 400)).toEqual({ accepted: false, reason: "no_frozen_ember" });
    expect(session.view.wandState).toBe("held");
  });

  it("revision: 静止 update 不变, 走拍/拖动/拔棒/点棒各 +1(重绘门控依据)", () => {
    const session = makeSession();
    const base = session.revision;
    session.update(0.5); // 不足一拍
    expect(session.revision).toBe(base);
    beat(session);
    expect(session.revision).toBe(base + 1);
    session.moveEmber("e1", 5, 5);
    expect(session.revision).toBe(base + 2);
    session.moveEmber("nope", 0, 0); // 未知 id 无变更
    expect(session.revision).toBe(base + 2);
    session.pullWand();
    expect(session.revision).toBe(base + 3);
  });

  it("点中冻结火簇 → 棒亮、序章完成、场景冻结", () => {
    const session = makeSession();
    session.pullWand();
    cluster(session);
    const result = session.dipWand(25, 15);
    expect(result.accepted).toBe(true);
    expect(session.view.wandState).toBe("lit");
    expect(session.view.done).toBe(true);
    // 完成后模拟停摆: 再走拍不掉命
    const livesBefore = session.view.embers.map((e) => e.life);
    beat(session, 5);
    expect(session.view.embers.map((e) => e.life)).toEqual(livesBefore);
    // 完成后再点/再拔均拒绝
    expect(session.dipWand(25, 15)).toEqual({ accepted: false, reason: "done" });
    expect(session.pullWand()).toBe(false);
  });
});

// 跨模型契约: 序章(距离邻接/实时拍)与主谜题 StarNetworkModel(固定边表/回合拍)必须执行同一条衰减律。
// 若任何一边的规则内核被单独改动, 这组镜像对比会当场变红 —— 序章的教学价值全押在"同律"上。
describe("序章与主谜题同律(跨模型契约)", () => {
  function makeCustomSession(embers: PrologueEmber[]): M02PrologueSession {
    return new M02PrologueSession({ ...PROLOGUE, embers }, RULES);
  }

  it("三角簇 vs 三角图: 逐拍命数完全一致(双方都冻结)", () => {
    const session = makeCustomSession([
      { id: "a", x: 0, y: 0, initialLife: 3 },
      { id: "b", x: 50, y: 0, initialLife: 3 },
      { id: "c", x: 25, y: 40, initialLife: 3 }
    ]);
    const model = new StarNetworkModel(
      { nodes: ["a", "b", "c"], edges: [["a", "b"], ["b", "c"], ["c", "a"]] },
      RULES
    );
    model.tap("a"); // a + 邻居 b,c 全满命, 与序章初始等价

    for (let k = 0; k < 6; k += 1) {
      expect(session.view.embers.map((e) => e.life)).toEqual(["a", "b", "c"].map((id) => model.lifeOf(id)));
      beat(session);
      model.tick();
    }
  });

  it("双星线 vs 一条边: 两端各 1 亮邻居, 同步漏光到全灭(只比到复燃前)", () => {
    const session = makeCustomSession([
      { id: "a", x: 0, y: 0, initialLife: 3 },
      { id: "b", x: 60, y: 0, initialLife: 3 }
    ]);
    const model = new StarNetworkModel({ nodes: ["a", "b"], edges: [["a", "b"]] }, RULES);
    model.tap("a");

    // lifeMax=3 → 第 3 拍双方归零; 序章的复燃是刻意的额外机制, 不在同律范围, 故只比衰减段
    for (let k = 0; k < 3; k += 1) {
      expect(session.view.embers.map((e) => e.life)).toEqual(["a", "b"].map((id) => model.lifeOf(id)));
      beat(session);
      model.tick();
    }
    expect(session.view.embers.every((e) => e.status === "dark")).toBe(true);
    expect(["a", "b"].every((id) => !model.isLit(id))).toBe(true);
  });
});
