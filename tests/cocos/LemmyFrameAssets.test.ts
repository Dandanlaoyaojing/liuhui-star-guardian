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
  { action: "crouch", frameCount: 40 }
] as const;

describe("Lemmy frame-sequence assets (idle / walk / reach / startle / crouch)", () => {
  for (const { action, frameCount } of FRAME_ACTIONS) {
    describe(action, () => {
      const files = readdirSync(join(LEMMY_FRAME_ROOT, action));
      const framePattern = new RegExp(`^${action}-(\\d{2})\\.png$`);
      const frames = files.filter((name) => framePattern.test(name)).sort();

      it(`has exactly ${frameCount} frames`, () => {
        expect(frames).toHaveLength(frameCount);
      });

      it("numbers frames contiguously from 00", () => {
        frames.forEach((name, index) => {
          expect(name).toBe(`${action}-${String(index).padStart(2, "0")}.png`);
        });
      });

      it("gives every frame PNG a sibling .png.meta (Cocos import record)", () => {
        for (const frame of frames) {
          expect(files).toContain(`${frame}.meta`);
        }
      });

      it("has no orphan .png.meta without a matching PNG", () => {
        const orphanMetas = files
          .filter((name) => new RegExp(`^${action}-\\d{2}\\.png\\.meta$`).test(name))
          .filter((meta) => !files.includes(meta.replace(/\.meta$/, "")));
        expect(orphanMetas).toEqual([]);
      });
    });
  }
});

// Cross-file guard: a frame-indexed beat (reach apex → reach_contact, which triggers the
// M01 basket spill) must point at a real frame of the on-disk sequence. If reach is ever
// re-extracted shorter than the configured apex, this fails loudly — otherwise the beat
// would fire late (runtime-clamped to the last frame) and silently degrade the intro.
describe("Lemmy frame-action events stay within their loaded frame count", () => {
  it("reach_contact's frameIndex is a valid index into the on-disk reach frames", () => {
    const reachFrames = readdirSync(join(LEMMY_FRAME_ROOT, "reach")).filter((name) =>
      /^reach-\d{2}\.png$/.test(name)
    );
    const events = LEMMY_FRAME_ACTIONS.reach.events ?? [];
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.frameIndex).toBeLessThan(reachFrames.length);
      expect(event.frameIndex).toBeGreaterThanOrEqual(1); // frame 0 events never fire
    }
  });
});
