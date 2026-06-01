import { describe, expect, it } from "vitest";

import {
  createLemmyCancellationContext,
  estimateLemmyActionDurationMs,
  getLemmyTransformSchedule,
  LemmyActionInterrupted,
  LemmyActorDestroyed,
  LEMMY_APPROVED_IDENTITY_SOURCE,
  LEMMY_CLEAN_MASTER_PATH
} from "../../assets/scripts/cocos/LemmyActorContract.ts";

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
