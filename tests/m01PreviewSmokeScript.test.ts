import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("M01 preview smoke script", () => {
  it("exposes a strict browser-input smoke entrypoint", () => {
    const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke.mjs"),
      "utf8"
    );

    expect(packageJson.scripts["smoke:m01-preview:input"]).toBe(
      "node scripts/m01-preview-smoke.mjs --require-browser-input"
    );
    expect(smokeScript).toContain("requireBrowserInput");
    expect(smokeScript).toContain("Browser-input smoke required");
  });

  it("drives a real browser-input path before the failed-validation runtime check", () => {
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke.mjs"),
      "utf8"
    );

    expect(smokeScript).toContain("page.mouse.move");
    expect(smokeScript).toContain("page.mouse.down");
    expect(smokeScript).toContain("page.mouse.up");
    expect(smokeScript).not.toContain("new TouchEvent");
    expect(smokeScript).toContain("realInput");
    expect(smokeScript).toContain("usedFallback");
    expect(smokeScript).toContain("blocker");
    expect(smokeScript).toContain("isEvidenceStaged");
    expect(smokeScript).toContain("partial-overlap poses instead of one pile");
    expect(smokeScript).toContain("observedColor");
  });

  it("drives the flashlight as a held tool before revealing fragments", () => {
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke.mjs"),
      "utf8"
    );
    const smokeHelpers = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke-helpers.mjs"),
      "utf8"
    );

    expect(smokeScript).toContain("runHeldFlashlightRevealPath");
    expect(smokeScript).toContain("heldFlashlightId");
    expect(smokeScript).toContain("flashlightPosition");
    expect(smokeScript).toContain("beamTarget");
    expect(smokeHelpers).toContain("heldFlashlightPosition");
  });

  it("asserts the successful completion path reaches steady_on and the ToolCard preview", () => {
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke.mjs"),
      "utf8"
    );

    expect(smokeScript).toContain("completionEvidence");
    expect(smokeScript).toContain("expectedToolCardTitle");
    expect(smokeScript).toContain('bottomLight === "steady_on"');
    expect(smokeScript).toContain("M01ToolCardTitle");
    expect(smokeScript).toContain("flashlightBeamTarget");
    expect(smokeScript).toContain("hintButtonVisible");
    expect(smokeScript).toContain("completion");
  });

  it("supports clean QA captures with preview chrome hidden", () => {
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke.mjs"),
      "utf8"
    );

    expect(smokeScript).toContain("--capture-clean-qa");
    expect(smokeScript).toContain("m01-preview-clean-qa.png");
    expect(smokeScript).toContain("hidePreviewChrome");
  });

  it("can temporarily enable art-preview mode for visual QA without changing the default toggle", () => {
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke.mjs"),
      "utf8"
    );

    expect(smokeScript).toContain("--enable-art-preview");
    expect(smokeScript).toContain("enableArtPreviewMode");
    expect(smokeScript).toContain("bootstrap.enableArtPreview = true");
    expect(smokeScript).toContain("m01-art-preview-clean-qa.png");
    expect(smokeScript).toContain("M01StaticArt_fragmentFloor");
  });
});
