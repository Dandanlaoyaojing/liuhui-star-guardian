import { describe, expect, it } from "vitest";

import {
  flashlightBeamIntensity,
  worldBeamFromGeometry,
  type BeamField
} from "../../assets/scripts/cocos/M01FlashlightBeam.ts";

// 光束: 从 (0,0) 沿 +x, 长 100, 扇底半宽 40(锥顶半宽 4)
const beam: BeamField = {
  ox: 0,
  oy: 0,
  dx: 1,
  dy: 0,
  length: 100,
  nearHalf: 4,
  farHalf: 40,
  on: true
};

describe("flashlightBeamIntensity", () => {
  it("近出光口、锥轴上最强 ≈1", () => {
    expect(flashlightBeamIntensity({ x: 5, y: 0 }, beam)).toBeGreaterThan(0.9);
  });
  it("锥外(超长度)=0", () => {
    expect(flashlightBeamIntensity({ x: 130, y: 0 }, beam)).toBe(0);
  });
  it("muzzle 之后(负轴向)=0", () => {
    expect(flashlightBeamIntensity({ x: -10, y: 0 }, beam)).toBe(0);
  });
  it("扇形外(垂距 > 锥半宽)=0", () => {
    expect(flashlightBeamIntensity({ x: 50, y: 60 }, beam)).toBe(0);
  });
  it("沿光向衰减: 近端 > 远端(锥轴上)", () => {
    const near = flashlightBeamIntensity({ x: 10, y: 0 }, beam);
    const far = flashlightBeamIntensity({ x: 90, y: 0 }, beam);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });
  it("横向抛物柔边单调: 轴心 > 半幅 > 锥侧", () => {
    const mid = flashlightBeamIntensity({ x: 50, y: 0 }, beam); // q=0
    const half = flashlightBeamIntensity({ x: 50, y: 11 }, beam); // halfAt@u0.5=22, q≈0.5
    const edge = flashlightBeamIntensity({ x: 50, y: 21 }, beam); // q≈0.95
    expect(mid).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(edge);
  });
  it("lightOn=false 全灭", () => {
    expect(flashlightBeamIntensity({ x: 5, y: 0 }, { ...beam, on: false })).toBe(0);
  });
});

describe("worldBeamFromGeometry", () => {
  it("由 muzzle/center 世界点算出单位光向与长度", () => {
    const f = worldBeamFromGeometry(
      { mx: 10, my: 10 },
      { cx: 110, cy: 10 },
      { nearHalf: 4, farHalf: 40, on: true }
    );
    expect(f.length).toBeCloseTo(100, 5);
    expect(f.dx).toBeCloseTo(1, 5);
    expect(f.dy).toBeCloseTo(0, 5);
    expect(f.ox).toBe(10);
    expect(f.on).toBe(true);
  });
  it("muzzle==center 退化为 on=false(零长不显色)", () => {
    const f = worldBeamFromGeometry(
      { mx: 5, my: 5 },
      { cx: 5, cy: 5 },
      { nearHalf: 4, farHalf: 40, on: true }
    );
    expect(f.on).toBe(false);
  });
});
