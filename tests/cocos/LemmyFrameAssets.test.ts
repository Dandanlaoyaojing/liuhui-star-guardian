import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEMMY_FRAME_ACTIONS } from "../../assets/scripts/cocos/LemmyActorContract.ts";

// Guard test for the Lemmy frame-sequence assets (all 5 actions).
//
// Cocos `resources.loadDir(dir, SpriteFrame)` only returns frames whose PNG has a
// sibling `.png.meta` import record; a missing/orphan meta silently drops a frame and
// breaks playback. Counts below are the 2026-06-05 re-extraction (more frames + 512²,
// commit 8506b21). This test is a GUARD (expected to pass), not a red-first TDD step.
// If a count changes intentionally, update FRAME_ACTIONS below to match.

const LEMMY_FRAME_ROOT = join(
  process.cwd(),
  "assets/resources/art/characters/lemmy"
);

const FRAME_ACTIONS = [
  { action: "idle", frameCount: 24 },
  { action: "walk", frameCount: 48 },
  { action: "reach", frameCount: 36 },
  { action: "startle", frameCount: 29 },
  { action: "crouch", frameCount: 40 },
  // 耳后贴系列 (2026-06-08): 单周期循环 + 统一缩放对齐 idle 躯干宽; headbutt 跳跃模式保留腾空。
  { action: "earsback", frameCount: 40 },
  { action: "idleback", frameCount: 48 },
  { action: "walkback", frameCount: 28 },
  { action: "earsup", frameCount: 38 },
  { action: "headbutt", frameCount: 124 }
] as const;

describe("Lemmy frame-sequence assets (idle / walk / reach / startle / crouch / 耳后贴系列)", () => {
  for (const { action, frameCount } of FRAME_ACTIONS) {
    describe(action, () => {
      // >99 帧的动作用 3 位补零, 否则 loadDir 的字符串排序会把 "100" 排到 "99" 前面 → 帧乱序。
      const pad = Math.max(2, String(frameCount - 1).length);
      const files = readdirSync(join(LEMMY_FRAME_ROOT, action));
      const framePattern = new RegExp(`^${action}-(\\d{${pad}})\\.png$`);
      const frames = files.filter((name) => framePattern.test(name)).sort();

      it(`has exactly ${frameCount} frames`, () => {
        expect(frames).toHaveLength(frameCount);
      });

      it("numbers frames contiguously from 0 (zero-padded, sort-stable)", () => {
        frames.forEach((name, index) => {
          expect(name).toBe(`${action}-${String(index).padStart(pad, "0")}.png`);
        });
      });

      it("gives every frame PNG a sibling .png.meta (Cocos import record)", () => {
        for (const frame of frames) {
          expect(files).toContain(`${frame}.meta`);
        }
      });

      it("has no orphan .png.meta without a matching PNG", () => {
        const orphanMetas = files
          .filter((name) => new RegExp(`^${action}-\\d{${pad}}\\.png\\.meta$`).test(name))
          .filter((meta) => !files.includes(meta.replace(/\.meta$/, "")));
        expect(orphanMetas).toEqual([]);
      });
    });
  }
});

// Cross-file guard: every frame-indexed beat (reach apex → reach_contact; jump apex →
// headbutt_contact — both drive M01's basket nudge / spill impulse) must point at a real frame of
// the on-disk sequence. If a sequence is re-extracted shorter than its beat, this fails loudly —
// otherwise the beat fires late (runtime-clamped to the last frame) and silently degrades the intro.
describe("Lemmy frame-action events stay within their loaded frame count", () => {
  for (const [action, spec] of Object.entries(LEMMY_FRAME_ACTIONS)) {
    const events = spec.events ?? [];
    if (events.length === 0) continue;
    it(`${action}: each event frameIndex indexes a real on-disk frame`, () => {
      const frames = readdirSync(join(LEMMY_FRAME_ROOT, action)).filter((name) =>
        new RegExp(`^${action}-\\d{2,3}\\.png$`).test(name)
      );
      for (const event of events) {
        expect(event.frameIndex).toBeLessThan(frames.length);
        expect(event.frameIndex).toBeGreaterThanOrEqual(1); // frame 0 events never fire
      }
    });
  }
});
