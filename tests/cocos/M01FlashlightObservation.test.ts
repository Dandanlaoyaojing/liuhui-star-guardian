import { describe, expect, it } from "vitest";

import {
  coveragePoolHalfHeight,
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

describe("M01 coverage-pool board exclusion (spec §5.2: 光束只照候选区, 不照拼接盘)", () => {
  // M01 stage facts: assembly board circle at (-60, 0) with 430px bounding box → bottom edge -215;
  // the beam pool centers near the fragment ground line (~y -242).
  const board = { x: -60, y: 0, width: 430, height: 430 };

  it("keeps the natural pool height when the pool is horizontally clear of the board", () => {
    const half = coveragePoolHalfHeight({
      center: { x: 400, y: -242 },
      radiusX: 140,
      naturalHalfHeight: 48,
      board,
      clearance: 6
    });
    expect(half).toBe(48);
  });

  it("clamps the pool top below the board bottom edge when their x-spans overlap", () => {
    const half = coveragePoolHalfHeight({
      center: { x: -60, y: -242 },
      radiusX: 140,
      naturalHalfHeight: 48,
      board,
      clearance: 6
    });
    // board bottom (-215) - clearance (6) - center (-242) = 21 → pool never touches the board.
    expect(half).toBe(21);
    expect(-242 + half).toBeLessThanOrEqual(-215 - 6);
  });

  it("does not grow the pool when the natural height already clears the board", () => {
    const half = coveragePoolHalfHeight({
      center: { x: -60, y: -242 },
      radiusX: 140,
      naturalHalfHeight: 10,
      board,
      clearance: 6
    });
    expect(half).toBe(10);
  });

  it("suppresses the pool entirely when the center would sit at or above the board bottom", () => {
    const half = coveragePoolHalfHeight({
      center: { x: -60, y: -210 },
      radiusX: 140,
      naturalHalfHeight: 48,
      board,
      clearance: 6
    });
    expect(half).toBe(0);
  });
});
