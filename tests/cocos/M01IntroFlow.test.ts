import { describe, expect, it } from "vitest";

import {
  nextIntroPhase,
  type M01IntroEvent,
  type M01IntroPhase
} from "../../assets/scripts/cocos/M01IntroFlow.ts";

describe("M01 intro phase machine", () => {
  it("runs the full diegetic intro in order", () => {
    const path: Array<[M01IntroPhase, M01IntroEvent, M01IntroPhase]> = [
      ["approaching", "walkArrived", "observing"],
      ["observing", "basketTapped", "reaching"],
      ["reaching", "reachContact", "tipping"],
      ["tipping", "tipped", "spillingFragments"],
      ["spillingFragments", "fragmentsSettled", "bonking"],
      ["bonking", "flashlightBonked", "waitingPickup"],
      ["waitingPickup", "flashlightTapped", "pickingUp"],
      ["pickingUp", "crouchDone", "acquired"]
    ];
    for (const [from, event, to] of path) {
      expect(nextIntroPhase(from, event)).toBe(to);
    }
  });

  it("does NOT leave 'observing' until the player taps the basket (no auto-reach)", () => {
    const nonAdvancing: M01IntroEvent[] = [
      "walkArrived",
      "reachContact",
      "tipped",
      "fragmentsSettled",
      "flashlightBonked",
      "flashlightTapped",
      "crouchDone"
    ];
    for (const event of nonAdvancing) {
      expect(nextIntroPhase("observing", event)).toBe("observing");
    }
    expect(nextIntroPhase("observing", "basketTapped")).toBe("reaching");
  });

  it("does NOT leave 'waitingPickup' until the player taps the flashlight (no auto-pickup)", () => {
    const nonAdvancing: M01IntroEvent[] = [
      "walkArrived",
      "basketTapped",
      "reachContact",
      "tipped",
      "fragmentsSettled",
      "flashlightBonked",
      "crouchDone"
    ];
    for (const event of nonAdvancing) {
      expect(nextIntroPhase("waitingPickup", event)).toBe("waitingPickup");
    }
    expect(nextIntroPhase("waitingPickup", "flashlightTapped")).toBe("pickingUp");
  });

  it("ignores events that don't match the current phase (no skipping ahead)", () => {
    expect(nextIntroPhase("approaching", "basketTapped")).toBe("approaching");
    expect(nextIntroPhase("spillingFragments", "flashlightTapped")).toBe("spillingFragments");
    expect(nextIntroPhase("acquired", "flashlightTapped")).toBe("acquired");
  });
});
