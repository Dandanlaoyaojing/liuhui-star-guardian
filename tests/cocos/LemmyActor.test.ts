import { describe, expect, it } from "vitest";

import {
  advanceFramePlayback,
  createFramePlayback,
  createLemmyCancellationContext,
  frameEventsBetween,
  LemmyActionInterrupted,
  LemmyActorDestroyed,
  LEMMY_APPROVED_IDENTITY_SOURCE,
  LEMMY_CLEAN_MASTER_PATH,
  LEMMY_FRAME_ACTIONS,
  lemmyRenderScaleAt
} from "../../assets/scripts/cocos/LemmyActorContract.ts";
import type { LemmyActionId } from "../../assets/scripts/cocos/LemmyActorContract.ts";

describe("LemmyActor identity constants", () => {
  it("locks the approved Lemmy identity source and clean master path", () => {
    expect(LEMMY_APPROVED_IDENTITY_SOURCE).toBe(
      "assets/art/style-references/lemmy-rabbit-canonical-pencil.png"
    );
    expect(LEMMY_CLEAN_MASTER_PATH).toBe(
      "assets/art/style-references/lemmy-rabbit-trademark-master.png"
    );
  });
});

describe("Lemmy frame actions (11 frame-based: 5 base + reachmiss + 耳后贴系列)", () => {
  it("registers all eleven; idle/walk/idleback/walkback loop, the rest one-shot hold-last", () => {
    expect(Object.keys(LEMMY_FRAME_ACTIONS).sort()).toEqual([
      "crouch",
      "earsback",
      "earsup",
      "headbutt",
      "idle",
      "idleback",
      "reach",
      "reachmiss",
      "startle",
      "walk",
      "walkback"
    ]);
    for (const spec of Object.values(LEMMY_FRAME_ACTIONS)) {
      expect(spec.fps).toBeGreaterThan(0);
      expect(spec.dir).toMatch(/^art\/characters\/lemmy\//);
    }
    // 循环(idle/呼吸/走): loop true, 不 hold-last。
    for (const id of ["idle", "walk", "idleback", "walkback"] as const) {
      expect(LEMMY_FRAME_ACTIONS[id]).toMatchObject({ loop: true, holdLast: false });
    }
    // 一次性反应/转换(够篮/受惊/蹲/收耳/展耳/顶篮): loop false, hold-last 停末帧。
    for (const id of ["reach", "startle", "crouch", "earsback", "earsup", "headbutt"] as const) {
      expect(LEMMY_FRAME_ACTIONS[id]).toMatchObject({ loop: false, holdLast: true });
    }
  });

  it("accepts every frame action id where a LemmyActionId is expected (no cast)", () => {
    const accept = (id: LemmyActionId): LemmyActionId => id;
    for (const id of [
      "idle", "walk", "reach", "startle", "crouch",
      "earsback", "idleback", "walkback", "headbutt", "earsup"
    ] as const) {
      expect(accept(id)).toBe(id);
    }
  });
});

describe("Lemmy reach_contact frame event", () => {
  it("reach carries exactly one reach_contact, near the apex (late, before the last frame)", () => {
    const events = LEMMY_FRAME_ACTIONS.reach.events ?? [];
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("reach_contact");
    // 36-frame reach: Lemmy extends to the basket near the end, so the apex is late.
    expect(events[0].frameIndex).toBeGreaterThan(18);
    expect(events[0].frameIndex).toBeLessThan(36);
  });

  it("keeps looping locomotion (walk/idle/idleback/walkback) free of gameplay events", () => {
    for (const id of ["walk", "idle", "idleback", "walkback"] as const) {
      expect(LEMMY_FRAME_ACTIONS[id].events ?? []).toHaveLength(0);
    }
  });

  it("headbutt carries exactly one headbutt_contact at first basket contact on the rise (124-frame crouch→jump→land)", () => {
    const events = LEMMY_FRAME_ACTIONS.headbutt.events ?? [];
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("headbutt_contact");
    // 上升段头初次触篮底(~#66, 距头顶峰值仅 10px), 在跳跃后段、不在首帧、不越界。
    expect(events[0].frameIndex).toBeGreaterThan(60);
    expect(events[0].frameIndex).toBeLessThan(124);
  });

  it("fires headbutt_contact once at first contact, never re-fires", () => {
    const events = LEMMY_FRAME_ACTIONS.headbutt.events;
    const contact = (events ?? [])[0].frameIndex;
    expect(frameEventsBetween(events, contact - 1, contact)).toEqual(["headbutt_contact"]);
    expect(frameEventsBetween(events, 0, contact - 1)).toEqual([]);
    expect(frameEventsBetween(events, contact, 123)).toEqual([]);
  });

  it("ear transitions (earsback/earsup) carry no gameplay events", () => {
    expect(LEMMY_FRAME_ACTIONS.earsback.events ?? []).toHaveLength(0);
    expect(LEMMY_FRAME_ACTIONS.earsup.events ?? []).toHaveLength(0);
  });

  it("fires reach_contact exactly once when the apex frame is crossed, never re-fires", () => {
    const events = LEMMY_FRAME_ACTIONS.reach.events;
    const apex = (events ?? [])[0].frameIndex;
    expect(frameEventsBetween(events, apex - 1, apex)).toEqual(["reach_contact"]);
    expect(frameEventsBetween(events, 0, apex - 1)).toEqual([]); // before apex
    expect(frameEventsBetween(events, apex, 35)).toEqual([]); // already past
    expect(frameEventsBetween(events, 0, 35)).toEqual(["reach_contact"]); // straddles apex in one big jump
  });

  it("non-event actions never fire", () => {
    expect(frameEventsBetween(LEMMY_FRAME_ACTIONS.walk.events, 0, 47)).toEqual([]);
    expect(frameEventsBetween(LEMMY_FRAME_ACTIONS.startle.events, 0, 28)).toEqual([]);
  });
});

describe("LemmyActor cancellation context", () => {
  it("interrupts the previous action when a new one begins", async () => {
    const context = createLemmyCancellationContext();
    const first = context.beginAction("walk");
    const second = context.beginAction("reach");

    await expect(first.promise).rejects.toBeInstanceOf(LemmyActionInterrupted);
    expect(first.token.isActive).toBe(false);
    expect(second.token.isActive).toBe(true);
  });

  it("rejects the active action when destroyed", async () => {
    const context = createLemmyCancellationContext();
    const active = context.beginAction("walk");

    context.destroy();

    await expect(active.promise).rejects.toBeInstanceOf(LemmyActorDestroyed);
    expect(active.token.isActive).toBe(false);
  });

  it("resolves the active action explicitly", async () => {
    const context = createLemmyCancellationContext();
    const active = context.beginAction("idle");

    context.resolveActive();

    await expect(active.promise).resolves.toBeUndefined();
    expect(active.token.isActive).toBe(false);
  });
});

describe("Lemmy frame playback (pure)", () => {
  it("clamps to the last frame and reports done after a one-shot completes", () => {
    let state = createFramePlayback("startle", 29);
    expect(state.frameIndex).toBe(0);
    expect(state.done).toBe(false);

    state = advanceFramePlayback(state, 5000); // well past the end
    expect(state.frameIndex).toBe(28);
    expect(state.done).toBe(true);
  });

  it("steps frame-by-frame using fps before completion", () => {
    // crouch 40 frames @ 16fps = 62.5ms/frame
    let state = createFramePlayback("crouch", 40);
    state = advanceFramePlayback(state, 70);
    expect(state.frameIndex).toBe(1);
    expect(state.done).toBe(false);
  });

  it("wraps without finishing for a looping playback (walk)", () => {
    const looping = createFramePlayback("walk", 48);
    const advanced = advanceFramePlayback(looping, 100000);
    expect(advanced.done).toBe(false);
    expect(advanced.frameIndex).toBeGreaterThanOrEqual(0);
    expect(advanced.frameIndex).toBeLessThan(48);
  });
});

// ── 渲染缩放(治"收耳后变小", 2026-06-08) ──────────────────────────────────────────
// 实测站姿去耳身体高(scripts/lemmy-measure-framesets.py, 2026-06-08): 各接缝端点帧。
// 折耳族源姿势更胖更矮(≈75%), 等比缩放在引擎渲染时补回, 接缝处显示身体高必须恒等 idle。
const IDLE_BODY_H = 404;
const MEASURED_BODY_H = {
  earsbackStart: 402,
  earsbackEnd: 301,
  idleback: 302,
  walkback: 302,
  earsupStart: 303,
  earsupEnd: 390,
  headbuttStart: 284,
  headbuttEnd: 269
} as const;

const displayedBody = (bodyH: number, scale: number): number => bodyH * scale;
const expectSeam = (bodyH: number, scale: number): void => {
  const shown = displayedBody(bodyH, scale);
  expect(Math.abs(shown - IDLE_BODY_H) / IDLE_BODY_H).toBeLessThan(0.015);
};

describe("lemmyRenderScaleAt (逐动作渲染缩放, ramp 按帧插值)", () => {
  it("defaults to 1 when unset; constant number applies across all frames", () => {
    expect(lemmyRenderScaleAt(undefined, 0, 40)).toBe(1);
    expect(lemmyRenderScaleAt(1.338, 0, 48)).toBe(1.338);
    expect(lemmyRenderScaleAt(1.338, 47, 48)).toBe(1.338);
  });

  it("ramp lerps from→to across the frame range and clamps", () => {
    const ramp = { from: 1.0, to: 1.342 };
    expect(lemmyRenderScaleAt(ramp, 0, 40)).toBeCloseTo(1.0, 5);
    expect(lemmyRenderScaleAt(ramp, 39, 40)).toBeCloseTo(1.342, 5);
    const mid = lemmyRenderScaleAt(ramp, 20, 40);
    expect(mid).toBeGreaterThan(1.16);
    expect(mid).toBeLessThan(1.19);
    expect(lemmyRenderScaleAt(ramp, 99, 40)).toBeCloseTo(1.342, 5); // 越界帧夹到末端
    expect(lemmyRenderScaleAt({ from: 1.2, to: 1.4 }, 0, 1)).toBeCloseTo(1.4, 5); // 单帧取 to
  });

  it("non-ear actions carry no renderScale (idle/walk/reach/startle/crouch 不缩放)", () => {
    for (const id of ["idle", "walk", "reach", "reachmiss", "startle", "crouch"] as const) {
      expect(LEMMY_FRAME_ACTIONS[id].renderScale).toBeUndefined();
    }
  });

  it("every transition seam shows the SAME body height as idle (404±1.5%) — 治忽大忽小的核心不变量", () => {
    const acts = LEMMY_FRAME_ACTIONS;
    // idle → earsback 首帧(源本就≈idle, 缩放≈1)
    expectSeam(
      MEASURED_BODY_H.earsbackStart,
      lemmyRenderScaleAt(acts.earsback.renderScale, 0, 40)
    );
    // earsback 末帧 → idleback / walkback(折耳态全程恒 404)
    expectSeam(
      MEASURED_BODY_H.earsbackEnd,
      lemmyRenderScaleAt(acts.earsback.renderScale, 39, 40)
    );
    expectSeam(MEASURED_BODY_H.idleback, lemmyRenderScaleAt(acts.idleback.renderScale, 0, 48));
    expectSeam(MEASURED_BODY_H.walkback, lemmyRenderScaleAt(acts.walkback.renderScale, 0, 28));
    // idleback → headbutt 首帧, headbutt 末帧 → idleback
    expectSeam(
      MEASURED_BODY_H.headbuttStart,
      lemmyRenderScaleAt(acts.headbutt.renderScale, 0, 124)
    );
    expectSeam(
      MEASURED_BODY_H.headbuttEnd,
      lemmyRenderScaleAt(acts.headbutt.renderScale, 123, 124)
    );
    // idleback → earsup 首帧, earsup 末帧 → idle
    expectSeam(
      MEASURED_BODY_H.earsupStart,
      lemmyRenderScaleAt(acts.earsup.renderScale, 0, 38)
    );
    expectSeam(
      MEASURED_BODY_H.earsupEnd,
      lemmyRenderScaleAt(acts.earsup.renderScale, 37, 38)
    );
  });
});

describe("renderScale 逐帧曲线 (earsback/earsup, codex High 修复守卫)", () => {
  it("array 形态: 越界夹到末端, 空数组回退 1", () => {
    expect(lemmyRenderScaleAt([1.1, 1.2, 1.3], 99, 3)).toBe(1.3);
    expect(lemmyRenderScaleAt([1.1, 1.2, 1.3], -1, 3)).toBe(1.1);
    expect(lemmyRenderScaleAt([], 0, 0)).toBe(1);
  });

  it("曲线长度与盘上帧数一致 (重抽帧后必须重测重定曲线)", () => {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const root = join(process.cwd(), "assets/resources/art/characters/lemmy");
    for (const action of ["earsback", "earsup"] as const) {
      const curve = LEMMY_FRAME_ACTIONS[action].renderScale;
      expect(Array.isArray(curve)).toBe(true);
      const pngs = readdirSync(join(root, action)).filter((f: string) => f.endsWith(".png"));
      expect((curve as ReadonlyArray<number>).length).toBe(pngs.length);
    }
  });

  it("曲线平滑: 帧间变化 ≤5% (防量具伪影直灌曲线造成尺寸脉冲)", () => {
    for (const action of ["earsback", "earsup"] as const) {
      const curve = LEMMY_FRAME_ACTIONS[action].renderScale as ReadonlyArray<number>;
      for (let i = 1; i < curve.length; i += 1) {
        expect(Math.abs(curve[i] - curve[i - 1]) / curve[i - 1]).toBeLessThanOrEqual(0.05);
      }
    }
  });
});
