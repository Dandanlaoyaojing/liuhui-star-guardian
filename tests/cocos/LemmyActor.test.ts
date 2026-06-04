import { describe, expect, it } from "vitest";

import {
  createLemmyCancellationContext,
  estimateLemmyActionDurationMs,
  getLemmyTransformSchedule,
  LemmyActionInterrupted,
  LemmyActorDestroyed,
  LEMMY_APPROVED_IDENTITY_SOURCE,
  LEMMY_CLEAN_MASTER_PATH,
  LEMMY_FRAME_ACTIONS,
  createFramePlayback,
  advanceFramePlayback
} from "../../assets/scripts/cocos/LemmyActorContract.ts";
import type { LemmyActionId } from "../../assets/scripts/cocos/LemmyActorContract.ts";

describe("LemmyActor identity constants", () => {
  it("locks the approved Lemmy identity source and clean master path", () => {
    expect(LEMMY_APPROVED_IDENTITY_SOURCE).toBe(
      "assets/art/style-references/lemmy-rabbit-canonical.png"
    );
    expect(LEMMY_CLEAN_MASTER_PATH).toBe(
      "assets/art/style-references/lemmy-rabbit-canonical.png"
    );
  });
});

describe("LemmyActor action schedules", () => {
  it("emits exactly one reach_contact during reach_up_right", () => {
    const schedule = getLemmyTransformSchedule("reach_up_right");
    const contacts = schedule.keyframes.filter((entry) => entry.event === "reach_contact");
    const duration = estimateLemmyActionDurationMs("reach_up_right");

    expect(contacts).toHaveLength(1);
    expect(contacts[0].atMs).toBeGreaterThan(100);
    expect(contacts[0].atMs).toBeLessThan(duration - 100);
  });

  it("keeps walk_right free of basket contact events", () => {
    expect(getLemmyTransformSchedule("walk_right").keyframes.some((entry) => entry.event === "reach_contact")).toBe(
      false
    );
  });

  it("uses whole-sprite transform schedules instead of stale layer-pose fields", () => {
    const reach = getLemmyTransformSchedule("reach_up_right");
    const apex = reach.keyframes.find((entry) => entry.event === "reach_contact");

    expect(apex).toBeDefined();
    expect(apex?.scaleY).toBeGreaterThan(1);
    for (const actionId of ["idle_right", "walk_right", "reach_up_right"] as const) {
      for (const keyframe of getLemmyTransformSchedule(actionId).keyframes) {
        expect(keyframe).not.toHaveProperty("bodyOffsetY");
        expect(keyframe).not.toHaveProperty("bodyRotateDeg");
        expect(keyframe).not.toHaveProperty("earLeftRotateDeg");
        expect(keyframe).not.toHaveProperty("earRightRotateDeg");
        expect(keyframe).not.toHaveProperty("armFrontRotateDeg");
        expect(keyframe).not.toHaveProperty("pose");
      }
    }
  });
});

describe("LemmyActor cancellation context", () => {
  it("interrupts the previous action when a new one begins", async () => {
    const context = createLemmyCancellationContext();
    const first = context.beginAction("walk_right");
    const second = context.beginAction("reach_up_right");

    await expect(first.promise).rejects.toBeInstanceOf(LemmyActionInterrupted);
    expect(first.token.isActive).toBe(false);
    expect(second.token.isActive).toBe(true);
  });

  it("rejects the active action when destroyed", async () => {
    const context = createLemmyCancellationContext();
    const active = context.beginAction("walk_right");

    context.destroy();

    await expect(active.promise).rejects.toBeInstanceOf(LemmyActorDestroyed);
    expect(active.token.isActive).toBe(false);
  });

  it("resolves the active action explicitly", async () => {
    const context = createLemmyCancellationContext();
    const active = context.beginAction("idle_right");

    context.resolveActive();

    await expect(active.promise).resolves.toBeUndefined();
    expect(active.token.isActive).toBe(false);
  });
});

describe("Lemmy frame actions (startle / crouch / walk)", () => {
  it("exposes startle/crouch as one-shot hold-last, and walk as a loop", () => {
    expect(Object.keys(LEMMY_FRAME_ACTIONS).sort()).toEqual(["crouch", "startle", "walk"]);
    for (const spec of Object.values(LEMMY_FRAME_ACTIONS)) {
      expect(spec.fps).toBeGreaterThan(0);
      expect(spec.dir).toMatch(/^art\/characters\/lemmy\//);
    }
    expect(LEMMY_FRAME_ACTIONS.startle).toMatchObject({ loop: false, holdLast: true });
    expect(LEMMY_FRAME_ACTIONS.crouch).toMatchObject({ loop: false, holdLast: true });
    expect(LEMMY_FRAME_ACTIONS.walk).toMatchObject({ loop: true, holdLast: false });
  });

  it("accepts frame action ids where a LemmyActionId is expected (widened union, no cast)", () => {
    const accept = (id: LemmyActionId): LemmyActionId => id;
    expect(accept("startle")).toBe("startle");
    expect(accept("crouch")).toBe("crouch");
    expect(accept("idle_right")).toBe("idle_right");
  });
});

describe("Lemmy frame playback (pure)", () => {
  it("clamps to the last frame and reports done after a one-shot completes", () => {
    let state = createFramePlayback("startle", 23);
    expect(state.frameIndex).toBe(0);
    expect(state.done).toBe(false);

    // 23 frames @ 16fps ≈ 1437ms; advance well past the end
    state = advanceFramePlayback(state, 5000);
    expect(state.frameIndex).toBe(22);
    expect(state.done).toBe(true);
  });

  it("steps frame-by-frame using fps before completion", () => {
    // crouch 24 frames @ 14fps ≈ 71.4ms/frame
    let state = createFramePlayback("crouch", 24);
    state = advanceFramePlayback(state, 80);
    expect(state.frameIndex).toBe(1);
    expect(state.done).toBe(false);
  });

  it("wraps without finishing for a looping playback", () => {
    const looping = { ...createFramePlayback("startle", 4), loop: true };
    const advanced = advanceFramePlayback(looping, 1000);
    expect(advanced.done).toBe(false);
    expect(advanced.frameIndex).toBeGreaterThanOrEqual(0);
    expect(advanced.frameIndex).toBeLessThan(4);
  });
});
