import { describe, it, expect } from "vitest";
import { cutsceneFrameIndex } from "../../assets/scripts/cocos/M01CutsceneTiming.ts";

describe("cutsceneFrameIndex", () => {
  const FPS = 24;
  const N = 344;

  it("starts on frame 0 at t=0", () => {
    expect(cutsceneFrameIndex(0, FPS, N)).toBe(0);
  });

  it("advances by elapsed×fps (frame-rate independent)", () => {
    expect(cutsceneFrameIndex(1000, FPS, N)).toBe(24); // 1s × 24fps
    expect(cutsceneFrameIndex(500, FPS, N)).toBe(12);
    // 同一经过时长, 与调用频率无关 —— 只看累计 ms。
    expect(cutsceneFrameIndex(41.67, FPS, N)).toBe(1); // ~1/24 s → 第 1 帧
    expect(cutsceneFrameIndex(41, FPS, N)).toBe(0); // 略早于第 1 帧边界
  });

  it("clamps to last frame past the end (holds, never overruns the array)", () => {
    expect(cutsceneFrameIndex(999999, FPS, N)).toBe(N - 1);
    expect(cutsceneFrameIndex((N / FPS) * 1000, FPS, N)).toBe(N - 1);
  });

  it("clamps negative/zero-count to a safe index", () => {
    expect(cutsceneFrameIndex(-100, FPS, N)).toBe(0);
    expect(cutsceneFrameIndex(1000, FPS, 0)).toBe(0);
  });
});
