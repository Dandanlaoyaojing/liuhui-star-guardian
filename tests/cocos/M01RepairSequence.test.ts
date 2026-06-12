import { describe, expect, it } from "vitest";

import {
  buildRepairTimeline,
  spiralOutTargets,
  type RepairStepConfig
} from "../../assets/scripts/cocos/M01RepairSequence.ts";

// spec §5.2 修复动画: 齿轮转动 → 碎片以漩涡状【喷出】→ 化为持续星光(镜头拉远本轮省略)。
const STEPS: RepairStepConfig[] = [
  { type: "entity_animate", params: { entityId: "entity_memory_gear", animation: "turn", turns: 2 }, duration: 2.5, delay: 0 },
  { type: "fragments_spiral_out", params: { radius: 320, turnsDeg: 540 }, duration: 1.6, delay: 0.6 },
  { type: "starlight", params: { pulses: 3 }, duration: 2.0, delay: 2.2 }
];

describe("M01RepairSequence (纯时序编排)", () => {
  it("buildRepairTimeline: delay+duration → 绝对时间窗, 总时长 = 最晚结束", () => {
    const tl = buildRepairTimeline(STEPS);
    expect(tl.segments).toHaveLength(3);
    expect(tl.segments[0]).toMatchObject({ type: "entity_animate", start: 0, end: 2.5 });
    expect(tl.segments[1]).toMatchObject({ type: "fragments_spiral_out", start: 0.6, end: 2.2 });
    expect(tl.segments[2]).toMatchObject({ type: "starlight", start: 2.2, end: 4.2 });
    expect(tl.total).toBeCloseTo(4.2, 5);
    // 原 config 的 params 原样带过(cc 胶水按 type 消费)
    expect(tl.segments[0].params.entityId).toBe("entity_memory_gear");
  });

  it("空/缺省字段稳健: 无 delay 视为 0, 无 duration 视为 0, 空表总时长 0", () => {
    const tl = buildRepairTimeline([{ type: "starlight", params: {} } as RepairStepConfig]);
    expect(tl.segments[0]).toMatchObject({ start: 0, end: 0 });
    expect(buildRepairTimeline([]).total).toBe(0);
  });

  it("spiralOutTargets: 确定性(同输入同输出)、每片角度错开、半径全到终半径、途中旋转角=turnsDeg", () => {
    const a = spiralOutTargets(9, { x: 100, y: -50 }, { radius: 320, turnsDeg: 540 });
    const b = spiralOutTargets(9, { x: 100, y: -50 }, { radius: 320, turnsDeg: 540 });
    expect(a).toEqual(b); // 确定性(无 RNG → 帧率/重放无关)
    expect(a).toHaveLength(9);
    const angles = new Set(a.map((t) => Math.round(t.angleDeg)));
    expect(angles.size).toBe(9); // 9 路角度互不相同(漩涡均匀喷出, 不叠成一柱)
    for (const t of a) {
      expect(Math.hypot(t.x - 100, t.y + 50)).toBeCloseTo(320, 5); // 终点都在终半径圆上
      expect(t.spinDeg).toBe(540); // 途中自旋角来自 config
    }
    // 角度覆盖整圈(最大相邻间隔 < 2×均匀间隔 → 没有大缺口)
    const sorted = a.map((t) => ((t.angleDeg % 360) + 360) % 360).sort((x, y) => x - y);
    let maxGap = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      const next = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 360;
      maxGap = Math.max(maxGap, next - sorted[i]);
    }
    expect(maxGap).toBeLessThan((360 / 9) * 2);
  });
});
