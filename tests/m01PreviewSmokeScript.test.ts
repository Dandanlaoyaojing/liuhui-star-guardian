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
    expect(smokeScript).toContain("m01_reference_complete_pattern");
    expect(smokeScript).toContain("isEvidenceStaged");
    expect(smokeScript).toContain("partial-overlap poses instead of one pile");
    expect(smokeScript).toContain("observedColor");
  });

  it("keeps preview smoke useful while the M01 target manifest is unlocked for manual composition", () => {
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke.mjs"),
      "utf8"
    );

    expect(smokeScript).toContain("manualTargetCompositionMode");
    expect(smokeScript).toContain("config.targetPattern?.locked === false");
    expect(smokeScript).toContain("m01-preview-manual-composition-smoke.png");
    expect(smokeScript).toContain("manualTargetCompositionMode || browserInputAttempt.isEvidenceStaged");
    expect(smokeScript).toContain("if (!manualTargetCompositionMode) {");
  });

  it("drives the flashlight as a fixed floodlight that reveals every candidate at once", () => {
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke.mjs"),
      "utf8"
    );
    const smokeHelpers = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke-helpers.mjs"),
      "utf8"
    );

    expect(smokeScript).toContain("runFixedFlashlightFloodlightPath");
    expect(smokeScript).toContain("observedColorsByFragment");
    expect(smokeScript).toContain("artSpriteNamesByFragment");
    expect(smokeScript).toContain("artSpriteColorByFragment");
    expect(smokeScript).toContain("artSpriteColorAlphaByFragment");
    expect(smokeScript).toContain("graphicsFillAlphaByFragment");
    expect(smokeScript).toContain("M01ArtSprite_hidden_circle");
    expect(smokeScript).toContain("Expected texture-backed observed tint");
    expect(smokeScript).toContain("observedArtSpriteTintIsTranslucent");
    expect(smokeScript).toContain("OBSERVED_ART_SPRITE_TINT_COLORS");
    expect(smokeScript).toContain("observedArtSpriteTintColorsMatch");
    expect(smokeScript).toContain("Expected texture-backed observed tint colors to stay separated");
    expect(smokeScript).toContain("Expected art-preview reveal graphics underlay to stay transparent");
    expect(smokeScript).toContain("flashlightBeamTargetPosition");
    expect(smokeScript).toContain("observedColorsAreCleared");
    expect(smokeScript).toContain("hiddenArtSpriteNamesMatch");
    expect(smokeScript).toContain("Expected fragment movement to turn off the fixed floodlight");
    expect(smokeScript).toContain("Expected fragment movement to clear observed colors");
    expect(smokeScript).not.toContain("runHeldFlashlightRevealPath");
    expect(smokeHelpers).toContain("revealFragmentIds");
    expect(smokeHelpers).toContain("expectedObservedColorsByFragment");
    expect(smokeHelpers).not.toContain("heldFlashlightPosition");
  });

  it("asserts the successful completion path reaches steady_on and the ToolCard preview", () => {
    const smokeScript = readFileSync(
      join(projectRoot, "scripts/m01-preview-smoke.mjs"),
      "utf8"
    );

    expect(smokeScript).toContain("completionEvidence");
    expect(smokeScript).toContain("targetPieceRotations");
    expect(smokeScript).toContain("targetRotation");
    expect(smokeScript).toContain("rotationDistance");
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
    expect(smokeScript).toContain("assertNoPrematureToolCard");
    expect(smokeScript).toContain("ToolCard preview should stay hidden before completion");
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
    expect(smokeScript).toContain("hasOldTargetReferenceCard");
    expect(smokeScript).toContain("platformEvidenceNodes");
    expect(smokeScript).toContain("M01Token_current_manual_target_");
    expect(smokeScript).toContain("targetOverlapEvidenceNodes");
    expect(smokeScript).toContain("M01TargetOverlapEvidence_current_manual_target_");
    expect(smokeScript).toContain("hasSingleFlashlightTool");
    expect(smokeScript).toContain("hasFragmentFloor");
    expect(smokeScript).toContain("M01StaticArt_targetReferenceCard");
    expect(smokeScript).toContain("M01StaticArt_singleFlashlightTool");
    expect(smokeScript).toContain("M01StaticArt_fragmentFloor");
    expect(smokeScript).toContain("completionArtPreview");
    expect(smokeScript).toContain("after_fixed_flashlight_floodlight");
    expect(smokeScript).toContain("flashlightCycleTapPosition");
    expect(smokeScript).toContain("check.tapPosition");
    expect(smokeScript).toContain("flashlightBeamAnchorPosition");
    expect(smokeScript).toContain("Expected fixed flashlight art tap to cycle through");
    expect(smokeScript).not.toContain("after_flashlight_picker_open");
  });
});
