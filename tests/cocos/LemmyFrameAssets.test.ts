import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Guard test for the startle / crouch frame-sequence assets.
//
// Cocos `resources.loadDir(dir, SpriteFrame)` only returns frames whose PNG has a
// sibling `.png.meta` import record; a missing/orphan meta silently drops a frame and
// breaks playback. These assets were committed as a baseline in fc42934. This test is a
// GUARD (expected to pass), not a red-first TDD step. If a count changes intentionally,
// update FRAME_ACTIONS below to match.

const LEMMY_FRAME_ROOT = join(
  process.cwd(),
  "assets/resources/art/characters/lemmy"
);

const FRAME_ACTIONS = [
  { action: "startle", frameCount: 23 },
  { action: "crouch", frameCount: 24 }
] as const;

describe("Lemmy frame-sequence assets (startle / crouch)", () => {
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
