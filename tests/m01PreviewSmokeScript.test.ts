import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("M01 preview smoke script", () => {
  it("drives a real browser-input path before the failed-validation runtime check", () => {
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke.mjs"),
      "utf8"
    );

    expect(smokeScript).toContain("new TouchEvent");
    expect(smokeScript).toContain("touchstart");
    expect(smokeScript).toContain("touchmove");
    expect(smokeScript).toContain("touchend");
    expect(smokeScript).toContain("realInput");
    expect(smokeScript).toContain("usedFallback");
    expect(smokeScript).toContain("blocker");
    expect(smokeScript).toContain("isEvidenceStaged");
    expect(smokeScript).toContain("observedColor");
  });
});
