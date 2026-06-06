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
  LEMMY_FRAME_ACTIONS
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

describe("Lemmy frame actions (all 5 frame-based)", () => {
  it("registers all five; idle/walk loop, reach/startle/crouch one-shot hold-last", () => {
    expect(Object.keys(LEMMY_FRAME_ACTIONS).sort()).toEqual([
      "crouch",
      "idle",
      "reach",
      "startle",
      "walk"
    ]);
    for (const spec of Object.values(LEMMY_FRAME_ACTIONS)) {
      expect(spec.fps).toBeGreaterThan(0);
      expect(spec.dir).toMatch(/^art\/characters\/lemmy\//);
    }
    expect(LEMMY_FRAME_ACTIONS.idle).toMatchObject({ loop: true, holdLast: false });
    expect(LEMMY_FRAME_ACTIONS.walk).toMatchObject({ loop: true, holdLast: false });
    expect(LEMMY_FRAME_ACTIONS.reach).toMatchObject({ loop: false, holdLast: true });
    expect(LEMMY_FRAME_ACTIONS.startle).toMatchObject({ loop: false, holdLast: true });
    expect(LEMMY_FRAME_ACTIONS.crouch).toMatchObject({ loop: false, holdLast: true });
  });

  it("accepts every frame action id where a LemmyActionId is expected (no cast)", () => {
    const accept = (id: LemmyActionId): LemmyActionId => id;
    for (const id of ["idle", "walk", "reach", "startle", "crouch"] as const) {
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

  it("keeps looping locomotion (walk/idle) free of gameplay events", () => {
    expect(LEMMY_FRAME_ACTIONS.walk.events ?? []).toHaveLength(0);
    expect(LEMMY_FRAME_ACTIONS.idle.events ?? []).toHaveLength(0);
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
