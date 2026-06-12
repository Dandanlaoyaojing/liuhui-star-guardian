import { describe, expect, it } from "vitest";

import {
  createRope,
  kickTail,
  ropeLengthOf,
  stepRope,
  type RopeOptions
} from "../../assets/scripts/cocos/M01RopePhysics.ts";

// 标准测试参数(与运行时旋钮同量级; 物理正确性不依赖具体值)。
const OPTS: RopeOptions = {
  gravity: -1500,
  damping: 0.995,
  iterations: 24,
  substepDt: 1 / 120
};

const NAIL = { x: 100, y: 200 };
const TAIL = { x: 100, y: -100 }; // 钉子正下方 300px
const POINTS = 12;
const TAIL_INV_MASS = 0.05; // 篮子 ≈ 20× 绳点质量

const makeRope = () => createRope(NAIL.x, NAIL.y, TAIL.x, TAIL.y, POINTS, TAIL_INV_MASS);

const simulate = (state: ReturnType<typeof createRope>, seconds: number, perStep?: (t: number) => void) => {
  const frame = 1 / 60;
  for (let t = 0; t < seconds; t += frame) {
    stepRope(state, frame, OPTS);
    perStep?.(t);
  }
};

describe("M01RopePhysics (割绳子式 Verlet 重尾链)", () => {
  it("createRope: 点均匀分布, 头端钉死(invMass 0), 尾端=重物(给定 invMass), 中间=1", () => {
    const rope = makeRope();
    expect(rope.pts).toHaveLength(POINTS);
    expect(rope.pts[0]).toMatchObject({ x: NAIL.x, y: NAIL.y, invMass: 0 });
    expect(rope.pts[POINTS - 1]).toMatchObject({ x: TAIL.x, y: TAIL.y, invMass: TAIL_INV_MASS });
    for (let i = 1; i < POINTS - 1; i += 1) expect(rope.pts[i].invMass).toBe(1);
    // 段长 = 总长/段数
    expect(rope.segLength * (POINTS - 1)).toBeCloseTo(300, 5);
    expect(ropeLengthOf(rope)).toBeCloseTo(300, 5);
  });

  it("静置: 自然悬垂稳定, 尾端保持在钉子正下方约绳长处, 无 NaN", () => {
    const rope = makeRope();
    simulate(rope, 5);
    const tail = rope.pts[POINTS - 1];
    expect(Number.isFinite(tail.x) && Number.isFinite(tail.y)).toBe(true);
    expect(Math.abs(tail.x - NAIL.x)).toBeLessThan(2); // 不侧漂
    expect(NAIL.y - tail.y).toBeGreaterThan(295); // 垂到接近绳长(catenary 略短不超 5px)
    expect(NAIL.y - tail.y).toBeLessThanOrEqual(306); // 不可拉伸: 不超绳长(+2% 迭代容差)
  });

  it("头端永远钉死在钉子上(任何仿真/踢击都不动)", () => {
    const rope = makeRope();
    kickTail(rope, 400, 700, OPTS.substepDt);
    simulate(rope, 3);
    expect(rope.pts[0].x).toBe(NAIL.x);
    expect(rope.pts[0].y).toBe(NAIL.y);
  });

  it("被顶起: 尾端先升起(绳松弛), 回落被绳拽住, 距离从不超过绳长×1.05", () => {
    const rope = makeRope();
    simulate(rope, 1.5); // 先静置
    const restY = rope.pts[POINTS - 1].y;
    kickTail(rope, 120, 650, OPTS.substepDt); // 向上为主+侧向(头偏心顶)
    let peakY = -Infinity;
    let maxDist = 0;
    simulate(rope, 6, () => {
      const tail = rope.pts[POINTS - 1];
      peakY = Math.max(peakY, tail.y);
      maxDist = Math.max(maxDist, Math.hypot(tail.x - NAIL.x, tail.y - NAIL.y));
    });
    expect(peakY).toBeGreaterThan(restY + 60); // 真的被顶起了
    expect(maxDist).toBeLessThan(300 * 1.05); // 软绳不可拉伸(5% 迭代容差)
    const tail = rope.pts[POINTS - 1];
    expect(Number.isFinite(tail.x) && Number.isFinite(tail.y)).toBe(true);
  });

  it("被绳子拽着乱晃: 侧向踢出后 x 多次过零(摆动), 且振幅随时间衰减", () => {
    const rope = makeRope();
    simulate(rope, 1.5);
    kickTail(rope, 260, 620, OPTS.substepDt);
    const xs: number[] = [];
    simulate(rope, 12, () => {
      xs.push(rope.pts[POINTS - 1].x - NAIL.x);
    });
    // 摆动: 相对钉子的 x 至少 3 次符号翻转(来回荡)
    let flips = 0;
    for (let i = 1; i < xs.length; i += 1) {
      if (Math.sign(xs[i]) !== 0 && Math.sign(xs[i - 1]) !== 0 && Math.sign(xs[i]) !== Math.sign(xs[i - 1]))
        flips += 1;
    }
    expect(flips).toBeGreaterThanOrEqual(3);
    // 衰减: 前 1/3 段最大摆幅 > 末 1/3 段最大摆幅 × 2(渐渐收住)
    const third = Math.floor(xs.length / 3);
    const amp = (arr: number[]) => Math.max(...arr.map(Math.abs));
    expect(amp(xs.slice(0, third))).toBeGreaterThan(amp(xs.slice(-third)) * 2);
  });

  it("质量加权: 约束修正主要移动轻绳点, 重尾少动(invMass 比例)", () => {
    const rope = makeRope();
    // 人为把尾端拉远 40px 制造拉伸, 步进一次极短(无重力干扰): 尾端被拉回的位移应远小于邻点
    const tail = rope.pts[POINTS - 1];
    const neighbor = rope.pts[POINTS - 2];
    const tailBefore = { x: tail.x, y: tail.y - 40 };
    tail.y -= 40;
    tail.py = tail.y; // 无初速
    const nBefore = { x: neighbor.x, y: neighbor.y };
    stepRope(rope, OPTS.substepDt, { ...OPTS, gravity: 0 });
    const tailMoved = Math.hypot(tail.x - tailBefore.x, tail.y - tailBefore.y);
    const nMoved = Math.hypot(neighbor.x - nBefore.x, neighbor.y - nBefore.y);
    expect(nMoved).toBeGreaterThan(tailMoved * 3); // 轻点让位远多于重物
  });
});
