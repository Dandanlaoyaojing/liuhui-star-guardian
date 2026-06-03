import { describe, it, expect } from "vitest";
import { aspectContentSize, spriteFrameSize } from "../../assets/scripts/cocos/M01SpriteAspect.ts";

describe("aspectContentSize - 防止贴图变形", () => {
  it("锁高度: 宽度按贴图真实宽高比算, 不沿用写死的框宽", () => {
    // 绳子: 贴图 204×550(瘦长 0.37), 旧写死框 18×220(0.08 → 被拉伸78%)
    const r = aspectContentSize(204, 550, 18, 220, "height");
    expect(r.height).toBe(220); // 锁高度
    // 宽度应 = 220 × (204/550) ≈ 81.6, 而不是写死的 18
    expect(r.width).toBeCloseTo(220 * (204 / 550), 1);
    // 关键: 输出宽高比 == 贴图宽高比(不变形)
    expect(r.width / r.height).toBeCloseTo(204 / 550, 3);
  });

  it("方形贴图(莱米/齿轮)锁高度后仍是方形", () => {
    const r = aspectContentSize(750, 750, 300, 281, "height");
    expect(r.width / r.height).toBeCloseTo(1, 3); // 1:1 不被 300/281 拉成 1.07
    expect(r.height).toBe(281);
  });

  it("锁宽度模式: 高度按比例算", () => {
    const r = aspectContentSize(204, 550, 100, 999, "width");
    expect(r.width).toBe(100);
    expect(r.width / r.height).toBeCloseTo(204 / 550, 3);
  });

  it("contain 模式: 贴图完整放进框内不超框(letterbox)", () => {
    const r = aspectContentSize(204, 550, 280, 190, "contain");
    expect(r.width).toBeLessThanOrEqual(280 + 0.01);
    expect(r.height).toBeLessThanOrEqual(190 + 0.01);
    expect(r.width / r.height).toBeCloseTo(204 / 550, 3); // 仍不变形
  });

  it("贴图尺寸非法(0)时回退到写死框, 不崩", () => {
    expect(aspectContentSize(0, 0, 280, 190)).toEqual({ width: 280, height: 190 });
  });
});

describe("spriteFrameSize - 取贴图真实尺寸", () => {
  it("优先 getOriginalSize", () => {
    const fake = { getOriginalSize: () => ({ width: 204, height: 550 }) } as never;
    expect(spriteFrameSize(fake)).toEqual({ width: 204, height: 550 });
  });
  it("无 getOriginalSize 时回退 rect", () => {
    const fake = { rect: { width: 100, height: 200 } } as never;
    expect(spriteFrameSize(fake)).toEqual({ width: 100, height: 200 });
  });
  it("两者都无返回 0(由调用方回退写死框)", () => {
    expect(spriteFrameSize({} as never)).toEqual({ width: 0, height: 0 });
  });
});
