import { describe, expect, it } from "vitest";

import {
  cycleLight,
  fragmentsInCoverage,
  type LightState
} from "../../assets/scripts/cocos/M01FlashlightObservation.ts";

describe("M01 held-flashlight light-state cycle", () => {
  it("cycles off → red → yellow → blue → off on each tap of the held flashlight", () => {
    const sequence: LightState[] = ["off"];
    let state: LightState = "off";
    for (let i = 0; i < 4; i += 1) {
      state = cycleLight(state);
      sequence.push(state);
    }
    expect(sequence).toEqual(["off", "red", "yellow", "blue", "off"]);
  });
});

describe("M01 flashlight coverage hit-test", () => {
  const fragments = [
    { id: "a", pos: { x: 30, y: 0 } }, // 30 from origin → inside r=100
    { id: "b", pos: { x: 60, y: 60 } }, // ~84.9 from origin → inside r=100
    { id: "c", pos: { x: 200, y: 0 } }, // 200 from origin → outside r=100
    { id: "d", pos: { x: 10, y: 10 }, onTray: true } // inside radius but already on the tray
  ];

  it("lights every candidate within the beam radius (a coverage area, not just one)", () => {
    const lit = fragmentsInCoverage({ x: 0, y: 0 }, 100, fragments);
    expect(lit).toEqual(["a", "b"]);
    expect(lit.length).toBeGreaterThan(1);
  });

  it("excludes candidates outside the radius", () => {
    expect(fragmentsInCoverage({ x: 0, y: 0 }, 100, fragments)).not.toContain("c");
  });

  it("never lights candidates already on the assembly tray (beam does not hit the tray)", () => {
    expect(fragmentsInCoverage({ x: 0, y: 0 }, 100, fragments)).not.toContain("d");
  });

  it("recomputes from the beam center, so moving Lemmy changes which candidates light up", () => {
    expect(fragmentsInCoverage({ x: 200, y: 0 }, 50, fragments)).toEqual(["c"]);
  });
});
