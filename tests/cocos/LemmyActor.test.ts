import { describe, expect, it } from "vitest";

import {
  advanceFramePlayback,
  buildPacedFrameDurations,
  createFramePlayback,
  createLemmyCancellationContext,
  frameEventsBetween,
  framesInPlayOrder,
  LemmyActionInterrupted,
  LemmyActorDestroyed,
  LEMMY_APPROVED_IDENTITY_SOURCE,
  LEMMY_CLEAN_MASTER_PATH,
  LEMMY_FRAME_ACTIONS,
  lemmyRenderScaleAt,
  reverseSupportedFor
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

describe("Lemmy frame actions (frame-based: 5 base + reachmiss + startleback + 耳后贴系列 + celebrate)", () => {
  it("registers all eighteen; idle/walk/idleback/walkback loop, the rest one-shot hold-last", () => {
    expect(Object.keys(LEMMY_FRAME_ACTIONS).sort()).toEqual([
      "celebrate",
      "crouch",
      "earsback",
      "earsup",
      "headbutt",
      "headshake",
      "idle",
      "idleback",
      "nod",
      "nodside",
      "puzzled",
      "reach",
      "reachmiss",
      "startle",
      "startleback",
      "turnface",
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
    for (const id of ["reach", "startle", "startleback", "crouch", "earsback", "earsup", "headbutt", "headshake", "celebrate"] as const) {
      expect(LEMMY_FRAME_ACTIONS[id]).toMatchObject({ loop: false, holdLast: true });
    }
  });

  it("skipLeadFrames(砍铺垫帧)仅设在无 events/无 renderScale 的动作上(切片不会错位事件/缩放)", () => {
    for (const [id, spec] of Object.entries(LEMMY_FRAME_ACTIONS)) {
      if (spec.skipLeadFrames === undefined) continue;
      expect(spec.skipLeadFrames, id).toBeGreaterThan(0);
      expect(spec.events ?? [], id).toHaveLength(0);
      expect(spec.renderScale, id).toBeUndefined();
    }
    // 立耳 startle 用 skip 砍掉"愣住"铺垫帧 → 反应不迟缓。
    // (收耳 startleback 改为从源重抽、抽帧时已剔除铺垫与静止深蹲, 故不设 skip; 见 LemmyActorContract 注释。)
    expect(LEMMY_FRAME_ACTIONS.startle.skipLeadFrames).toBeGreaterThan(0);
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
    // 与 crouch fps 解耦: 推进 1.5 帧时长 → 必落在第 1 帧(以后改调速度不破此测)。
    const msPerFrame = 1000 / LEMMY_FRAME_ACTIONS.crouch.fps;
    let state = createFramePlayback("crouch", 40);
    state = advanceFramePlayback(state, msPerFrame * 1.5);
    expect(state.frameIndex).toBe(1);
    expect(state.done).toBe(false);
  });

  it("变速节奏: 顶点定格(惊魂未定) + 回正降速 + 末帧 done", () => {
    // head 2 帧 @100ms, 顶点(idx1)再 hold 300ms, tail 1 帧 @200ms。skip 0, count 3。
    const spec = { dir: "x", fps: 10, loop: false, holdLast: true,
      pacing: { peakFrame: 1, peakHoldMs: 300, tailFps: 5 } };
    const durs = buildPacedFrameDurations(spec, 0, 3);
    expect(durs).toEqual([100, 400, 200]); // 顶点帧 100+300, tail 1000/5
    let state = createFramePlayback("startleback", 3, durs);
    state = advanceFramePlayback(state, 150); // 进入顶点帧
    expect(state.frameIndex).toBe(1);
    state = advanceFramePlayback(state, 200); // 仍在顶点定格窗口(100..500)
    expect(state.frameIndex).toBe(1);
    expect(state.done).toBe(false);
    state = advanceFramePlayback(state, 200); // 总 550 → 越过末帧起点(500) → done
    expect(state.frameIndex).toBe(2);
    expect(state.done).toBe(true);
  });

  it("skipLeadFrames 偏移源帧: peakFrame 在切片后正确落位", () => {
    // skip 5, 源顶点 10 → 切片后 idx 5。head 5 帧(src5..9)+顶点(src10).
    const spec = { dir: "x", fps: 20, loop: false, holdLast: true,
      pacing: { peakFrame: 10, peakHoldMs: 100, tailFps: 10 } };
    const durs = buildPacedFrameDurations(spec, 5, 8)!; // 源 5..12
    expect(durs[5]).toBe(1000 / 20 + 100); // 切片 idx5 = 源10 = 顶点(+hold)
    expect(durs[6]).toBe(1000 / 10); // 源11 = tail
  });

  it("wraps without finishing for a looping playback (walk)", () => {
    const looping = createFramePlayback("walk", 48);
    const advanced = advanceFramePlayback(looping, 100000);
    expect(advanced.done).toBe(false);
    expect(advanced.frameIndex).toBeGreaterThanOrEqual(0);
    expect(advanced.frameIndex).toBeLessThan(48);
  });
});

// ── 渲染缩放: 当前全部动作【不设】renderScale ──────────────────────────────────────
// 2026-06-15 修「走到篮下变大」: LemmyActor.fitSpriteToFrame 的 contain 适配已把每帧裁剪框
// (竖长 → 高度受限)归一到 displayH, 再乘 renderScale = 整体超调 34~50%。各帧脚底恒 y≈490、
// 源帧本就等比, 不需要逐动作缩放。旧测试守的是"身体像素高×renderScale≈404"(自洽标定, 与运行时
// contain 渲染无关 → 测试绿而画面错), 已删。守卫改为: 任何动作都不得带 renderScale(见下)。

describe("framesInPlayOrder (起身 = 反播 crouch 帧)", () => {
  it("reverse 倒序且不原地改输入(防污染 loadFrames 缓存)", () => {
    const src = ["a", "b", "c"];
    const out = framesInPlayOrder(src, true);
    expect(out).toEqual(["c", "b", "a"]);
    expect(src).toEqual(["a", "b", "c"]); // 缓存数组未被原地 reverse
    expect(out).not.toBe(src);
  });

  it("非 reverse 原样返回同一引用(零拷贝)", () => {
    const src = ["a", "b", "c"];
    expect(framesInPlayOrder(src, false)).toBe(src);
  });
});

describe("reverseSupportedFor (倒放仅限无 events/无 renderScale 的对称动作)", () => {
  it("crouch 可倒放(无 events/无 renderScale); reach 不可(带 reach_contact 事件)", () => {
    expect(reverseSupportedFor("crouch")).toBe(true);
    expect(reverseSupportedFor("reach")).toBe(false);
  });
});

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

  it("NO action carries renderScale — contain 适配已归一, 折耳族不得再放大(治走到篮下变大)", () => {
    for (const id of Object.keys(LEMMY_FRAME_ACTIONS) as LemmyActionId[]) {
      expect(LEMMY_FRAME_ACTIONS[id].renderScale).toBeUndefined();
    }
  });
});

// lemmyRenderScaleAt 仍是工具函数(showFrame 每帧调用, 当前所有动作传 undefined → 恒返回 1)。
// 数组/越界处理保留单测, 以便日后若按身体高重启逐帧缩放时函数行为可靠。
describe("lemmyRenderScaleAt array 形态 (工具函数; 当前无动作使用)", () => {
  it("越界夹到末端, 空数组回退 1", () => {
    expect(lemmyRenderScaleAt([1.1, 1.2, 1.3], 99, 3)).toBe(1.3);
    expect(lemmyRenderScaleAt([1.1, 1.2, 1.3], -1, 3)).toBe(1.1);
    expect(lemmyRenderScaleAt([], 0, 0)).toBe(1);
  });
});
