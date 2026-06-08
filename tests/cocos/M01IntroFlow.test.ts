import { describe, expect, it } from "vitest";

import {
  nextIntroPhase,
  type M01IntroEvent,
  type M01IntroPhase
} from "../../assets/scripts/cocos/M01IntroFlow.ts";

describe("M01 intro phase machine (headbutt 顶篮 + 自由走位重构 2026-06-08)", () => {
  it("runs the full diegetic intro in order (走入→自由走→篮下点篮→收耳→顶篮→倒出→手电)", () => {
    const path: Array<[M01IntroPhase, M01IntroEvent, M01IntroPhase]> = [
      ["approaching", "walkArrived", "roaming"],
      ["roaming", "headbuttStarted", "folding"],
      ["folding", "foldDone", "headbutting"],
      ["headbutting", "headbuttContact", "spillingFragments"],
      ["spillingFragments", "fragmentsSettled", "bonking"],
      ["bonking", "flashlightBonked", "waitingPickup"],
      ["waitingPickup", "flashlightTapped", "pickingUp"],
      ["pickingUp", "crouchDone", "acquired"]
    ];
    for (const [from, event, to] of path) {
      expect(nextIntroPhase(from, event)).toBe(to);
    }
  });

  it("does NOT leave 'roaming' until the headbutt is triggered (自由走位/侧边晃不推进相位)", () => {
    // roaming 期间玩家随便走、点篮侧边晃 —— 这些都不改相位; 只有 cc 判定"篮正下方点篮"才喂 headbuttStarted。
    const nonAdvancing: M01IntroEvent[] = [
      "walkArrived",
      "foldDone",
      "headbuttContact",
      "fragmentsSettled",
      "flashlightBonked",
      "flashlightTapped",
      "crouchDone"
    ];
    for (const event of nonAdvancing) {
      expect(nextIntroPhase("roaming", event)).toBe("roaming");
    }
    expect(nextIntroPhase("roaming", "headbuttStarted")).toBe("folding");
  });

  it("does NOT leave 'waitingPickup' until the player taps the flashlight (no auto-pickup)", () => {
    const nonAdvancing: M01IntroEvent[] = [
      "walkArrived",
      "headbuttStarted",
      "foldDone",
      "headbuttContact",
      "fragmentsSettled",
      "flashlightBonked",
      "crouchDone"
    ];
    for (const event of nonAdvancing) {
      expect(nextIntroPhase("waitingPickup", event)).toBe("waitingPickup");
    }
    expect(nextIntroPhase("waitingPickup", "flashlightTapped")).toBe("pickingUp");
  });

  it("headbutt 序列按 收耳→起跳→撞击 顺序推进, 不跳步", () => {
    expect(nextIntroPhase("folding", "headbuttContact")).toBe("folding"); // 收耳没播完不能直接撞
    expect(nextIntroPhase("folding", "foldDone")).toBe("headbutting");
    expect(nextIntroPhase("headbutting", "headbuttContact")).toBe("spillingFragments");
  });

  it("ignores events that don't match the current phase (no skipping ahead)", () => {
    expect(nextIntroPhase("approaching", "headbuttStarted")).toBe("approaching");
    expect(nextIntroPhase("spillingFragments", "flashlightTapped")).toBe("spillingFragments");
    expect(nextIntroPhase("acquired", "flashlightTapped")).toBe("acquired");
  });

  it("可重复顶篮: 还有片→readyToHeadbutt 回到可再顶, 全出→bonking(2026-06-08)", () => {
    // 撞出一批后还有片: spillingFragments → readyToHeadbutt(玩家可再点篮)
    expect(nextIntroPhase("spillingFragments", "piecesRemain")).toBe("readyToHeadbutt");
    // readyToHeadbutt 再点篮 → 直接再顶(已在篮下耳后贴, 跳过收耳)
    expect(nextIntroPhase("readyToHeadbutt", "headbuttStarted")).toBe("headbutting");
    // 走一整轮"顶3批清空"的回环: 批1→批2→批3全出→bonking
    let p: M01IntroPhase = "headbutting";
    for (let hit = 1; hit <= 3; hit += 1) {
      p = nextIntroPhase(p, "headbuttContact"); // → spillingFragments
      expect(p).toBe("spillingFragments");
      if (hit < 3) {
        p = nextIntroPhase(p, "piecesRemain"); // 还有片 → readyToHeadbutt
        expect(p).toBe("readyToHeadbutt");
        p = nextIntroPhase(p, "headbuttStarted"); // 再点篮 → headbutting
        expect(p).toBe("headbutting");
      }
    }
    p = nextIntroPhase(p, "fragmentsSettled"); // 全出 → bonking
    expect(p).toBe("bonking");
  });

  it("readyToHeadbutt 只认 headbuttStarted(等玩家再点篮), 不自动推进", () => {
    const nonAdvancing: M01IntroEvent[] = [
      "walkArrived",
      "foldDone",
      "headbuttContact",
      "piecesRemain",
      "fragmentsSettled",
      "flashlightBonked",
      "flashlightTapped",
      "crouchDone"
    ];
    for (const event of nonAdvancing) {
      expect(nextIntroPhase("readyToHeadbutt", event)).toBe("readyToHeadbutt");
    }
    expect(nextIntroPhase("readyToHeadbutt", "headbuttStarted")).toBe("headbutting");
  });
});
