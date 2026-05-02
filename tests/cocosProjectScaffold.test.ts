import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(projectRoot, path), "utf8")) as unknown;
}

function readText(path: string): string {
  return readFileSync(join(projectRoot, path), "utf8");
}

describe("Cocos Creator project scaffold", () => {
  it("has the Cocos Creator 3.x project metadata that lets the editor identify the repo", () => {
    expect(existsSync(join(projectRoot, ".creator/default-meta.json"))).toBe(true);
    expect(existsSync(join(projectRoot, "settings/v2/packages/engine.json"))).toBe(true);
    expect(existsSync(join(projectRoot, "profiles/v2/packages/scene.json"))).toBe(true);
  });

  it("keeps the project in 2D mode with the modules needed by the M01 prototype", () => {
    const sceneProfile = readJson("profiles/v2/packages/scene.json") as {
      "gizmos-infos"?: { is2D?: boolean };
    };
    const engineSettings = readJson("settings/v2/packages/engine.json") as {
      modules?: { configs?: { defaultConfig?: { includeModules?: string[] } } };
    };

    expect(sceneProfile["gizmos-infos"]?.is2D).toBe(true);
    expect(engineSettings.modules?.configs?.defaultConfig?.includeModules).toEqual(
      expect.arrayContaining(["2d", "ui", "tween", "audio", "dragon-bones"])
    );
  });

  it("keeps TypeScript checks independent from Creator's generated temp folder", () => {
    const rootTsconfig = readText("tsconfig.json");
    const testTsconfig = readText("tsconfig.test.json");
    const packageJson = readJson("package.json") as { name?: string; scripts?: Record<string, string> };

    expect(packageJson.name).toBe("liuhui-star-guardian");
    expect(packageJson.scripts?.typecheck).toBe("tsc -p tsconfig.test.json --noEmit");
    expect(rootTsconfig).not.toContain("./temp/tsconfig.cocos.json");
    expect(testTsconfig).not.toContain("./temp/tsconfig.cocos.json");
    expect(testTsconfig).toContain('"assets/scripts/**/*.ts"');
  });

  it("does not use import attributes in Creator runtime scripts", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).not.toContain(" with { type:");
  });

  it("keeps the runtime fallback status label inside the 960px canvas", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const positionMatch = bootstrap.match(/labelNode\.setPosition\((-?\d+),\s*(-?\d+),\s*0\)/);
    const sizeMatch = bootstrap.match(/transform\.setContentSize\((\d+),\s*(\d+)\)/);

    expect(positionMatch).not.toBeNull();
    expect(sizeMatch).not.toBeNull();

    const x = Number(positionMatch?.[1]);
    const width = Number(sizeMatch?.[1]);

    expect(x - width / 2).toBeGreaterThanOrEqual(-480);
    expect(x + width / 2).toBeLessThanOrEqual(480);
  });

  it("renders an M01 ToolCard preview after completion", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("buildToolCardPreview");
    expect(bootstrap).toContain("getM01GreyboxToolCardFrameResource");
    expect(bootstrap).toContain("M01ToolCardPreview");
    expect(bootstrap).toContain("M01ToolCardPreviewArtFrame");
    expect(bootstrap).toContain("renderToolCardPreview");
  });

  it("does not leave the completion feedback label underneath the ToolCard preview", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain('this.setFeedback("");');
    expect(bootstrap).toContain("this.renderToolCardPreview(this.greyboxRoot, card)");
  });

  it("clears transient M01 tools when the completion ToolCard appears", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("private hintButtonRoot: Node | null = null");
    expect(bootstrap).toContain("this.hintButtonRoot = this.addHintButton(this.greyboxRoot)");
    expect(bootstrap).toContain("this.activeFlashlightId = undefined");
    expect(bootstrap).toContain("this.activeFlashlightColor = undefined");
    expect(bootstrap).toContain("this.flashlightBeamTarget = undefined");
    expect(bootstrap).toContain("this.drawFlashlightBeam();");
    expect(bootstrap).toContain("this.hintButtonRoot.active = false");
  });

  it("wires the M01 greybox runtime to drag sessions and drop resolution", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("beginDragSession");
    expect(bootstrap).toContain("moveDragSession");
    expect(bootstrap).toContain("endDragSession");
    expect(bootstrap).toContain("resolveM01GreyboxDrop");
    expect(bootstrap).toContain("touch-start");
    expect(bootstrap).toContain("touch-move");
    expect(bootstrap).toContain("touch-end");
    expect(bootstrap).not.toContain("\"mouse-down\"");
    expect(bootstrap).toContain("Input.EventType.MOUSE_MOVE");
    expect(bootstrap).toContain("Input.EventType.MOUSE_UP");
    expect(bootstrap).toContain("Input.EventType.TOUCH_MOVE");
    expect(bootstrap).toContain("Input.EventType.TOUCH_END");
    expect(bootstrap).toContain("Input.EventType.TOUCH_CANCEL");
  });

  it("wires M01 flashlight and evidence actions in the Cocos bootstrap", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("layout.board");
    expect(bootstrap).toContain("layout.flashlights");
    expect(bootstrap).toContain("layout.evidence");
    expect(bootstrap).toContain("select_flashlight");
    expect(bootstrap).toContain("weak_snap_fragment");
    expect(bootstrap).toContain("place_fragment_freely");
    expect(bootstrap).toContain("selectFlashlight");
    expect(bootstrap).toContain("revealFragment");
    expect(bootstrap).toContain("pickFragment");
    expect(bootstrap).toContain("placeHeldFragment");
    expect(bootstrap).toContain("weakSnapFragmentToEvidence");
    expect(bootstrap).toContain("submitEvidencePair");
    expect(bootstrap).toContain("validateCandidateStructure");
    expect(bootstrap).toContain("validationLightSeconds");
  });

  it("keeps M01 overlap evidence staging inside the greybox instead of adding a validation button", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("weakSnappedFragmentsByEvidence");
    expect(bootstrap).toContain("trySubmitWeakSnappedEvidencePair");
    expect(bootstrap).toContain("tryValidateCompleteEvidenceCandidate");
    expect(bootstrap).not.toContain("M01ValidateButton");
  });

  it("renders M01 overlap evidence as a colored reference diagram", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("layout.referenceEvidence");
    expect(bootstrap).toContain("layout.evidence");
    expect(bootstrap).toContain("purple: [");
    expect(bootstrap).toContain("green: [");
    expect(bootstrap).toContain("orange: [");
    expect(bootstrap).toContain('token.shapeToken === "triangle"');
    expect(bootstrap).toContain('token.shapeToken === "hexagon"');
    expect(bootstrap).not.toContain('token.shapeToken === "arc_lens"');
    expect(bootstrap).not.toContain('token.shapeToken === "notch_lens"');
    expect(bootstrap).not.toContain('token.shapeToken === "crescent_overlap"');
    expect(bootstrap).not.toContain('token.shapeToken === "branch_lens"');
  });

  it("renders M01 candidate fragments as hidden-color fixed-shape grey pieces", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain('token.shapeToken === "triangle"');
    expect(bootstrap).toContain('token.shapeToken === "hexagon"');
    expect(bootstrap).not.toContain('token.shapeToken === "arc_hook"');
    expect(bootstrap).not.toContain('token.shapeToken === "arc_socket"');
    expect(bootstrap).not.toContain('token.shapeToken === "notch_hook"');
    expect(bootstrap).not.toContain('token.shapeToken === "notch_socket"');
    expect(bootstrap).not.toContain('token.shapeToken === "crescent_left"');
    expect(bootstrap).not.toContain('token.shapeToken === "crescent_right"');
    expect(bootstrap).not.toContain('token.shapeToken === "branch_left"');
    expect(bootstrap).not.toContain('token.shapeToken === "branch_right"');
    expect(bootstrap).toContain('hidden: [');
  });

  it("lets the M01 flashlight beam roam with the pointer over the fragment pool", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("flashlightBeamTarget");
    expect(bootstrap).toContain("flashlightBeamReach");
    expect(bootstrap).toContain("setFlashlightBeamReach");
    expect(bootstrap).toContain("moveFlashlightBeamWithPointer");
    expect(bootstrap).toContain("scanFlashlightBeamAtTarget");
    expect(bootstrap).toContain("this.scanFlashlightBeamAtTarget(this.flashlightBeamTarget)");
    expect(bootstrap).toContain("getFlashlightBeamTarget");
    expect(bootstrap).toContain("getFlashlightBeamReach");
    expect(bootstrap).toContain("if (this.flashlightBeamTarget)");
    expect(bootstrap).toContain("this.layout.fragments");
    expect(bootstrap).not.toContain("const target = this.layout.board.position");
  });

  it("treats M01 flashlights as held tools instead of fixed emitters", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("heldFlashlightId");
    expect(bootstrap).toContain("handleFlashlightClick");
    expect(bootstrap).toContain("moveHeldFlashlightWithPointer");
    expect(bootstrap).toContain("beginFlashlightBeamGesture");
    expect(bootstrap).toContain("updateFlashlightBeamGesture");
    expect(bootstrap).toContain("flashlightBeamAnchor");
    expect(bootstrap).toContain("flashlightBeamLit");
    expect(bootstrap).toContain('token.kind === "flashlight"');
    expect(bootstrap).toContain("if (this.flashlightBeamLit) {\n        this.releaseHeldFlashlightAfterBeamGesture();");
    expect(bootstrap).toContain("if (selected.accepted) {\n        this.releaseHeldFlashlightAfterBeamGesture();");
    expect(bootstrap).toContain("Input.EventType.MOUSE_DOWN");
    expect(bootstrap).toContain("Input.EventType.TOUCH_START");
  });

  it("suspends held flashlight follow and beam state when a fragment press begins", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("private suspendHeldFlashlightInteraction(): void");
    expect(bootstrap).toContain("private releaseHeldFlashlightAfterBeamGesture(): void");
    expect(bootstrap).toContain('if (hitToken?.kind === "fragment") {');
    expect(bootstrap).toContain("this.suspendHeldFlashlightInteraction();");
    expect(bootstrap).toContain("if (this.flashlightBeamGesturePointerId !== undefined) {\n      this.releaseHeldFlashlightAfterBeamGesture();");
    expect(bootstrap).toContain("this.flashlightBeamGesturePointerId = undefined;");
    expect(bootstrap).toContain("this.flashlightBeamLit = false;");
    expect(bootstrap).toContain("this.flashlightBeamAnchor = undefined;");
    expect(bootstrap).toContain("this.flashlightBeamTarget = undefined;");
    expect(bootstrap).toContain("this.drawFlashlightBeam();");
  });

  it("lets player input adjust the M01 flashlight beam reach", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("Input.EventType.MOUSE_WHEEL");
    expect(bootstrap).toContain("adjustFlashlightBeamReach");
    expect(bootstrap).toContain("event.getScrollY?.()");
  });

  it("highlights M01 flashlight and evidence hint targets in the bootstrap", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("hintedTargetIds");
    expect(bootstrap).toContain("this.hintedTargetIds = new Set(hint.targetIds)");
    expect(bootstrap).toContain('entry.token.kind === "flashlight"');
    expect(bootstrap).toContain('entry.token.kind === "evidence"');
  });

  it("supports M01 click-pick and click-place alongside drag placement", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("CLICK_DRAG_THRESHOLD");
    expect(bootstrap).toContain("FRAGMENT_INPUT_HIT_SIZE");
    expect(bootstrap).toContain("heldFragmentId");
    expect(bootstrap).toContain("heldPointerId");
    expect(bootstrap).toContain("moveHeldFragmentWithPointer");
    expect(bootstrap).toContain("handleFragmentClick");
    expect(bootstrap).toContain("placeHeldFragmentAt");
    expect(bootstrap).toContain("placeHeldFragmentAtPosition");
    expect(bootstrap).toContain("this.heldFragmentId && this.heldFragmentId !== token.controllerId");
    expect(bootstrap).toContain("tryHandleTokenClick");
    expect(bootstrap).toContain("if (!this.dragState.active) {\n      this.clearActiveDrag();");
    expect(bootstrap).toContain("this.heldPointerId !== this.pointerIdForEvent(event)");
    expect(bootstrap).toContain("this.tokenPositions.set(heldFragmentId, position)");
    expect(bootstrap).toContain('token.kind === "fragment" ? FRAGMENT_INPUT_HIT_SIZE : token.size.width');
    expect(bootstrap).toContain('token.kind === "fragment" ? FRAGMENT_INPUT_HIT_SIZE : token.size.height');
  });

  it("keeps fragment drags alive when mouse move and mouse up finish outside the token node", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("private pointerIdForActiveDragEvent(event: M01GreyboxPointerEvent): string | number");
    expect(bootstrap).toContain('if (pointerId === "mouse" && this.dragState.active) {');
    expect(bootstrap).toContain("pointerId: this.pointerIdForActiveDragEvent(event)");
  });

  it("renders M01 flashlight beam, validation bottom light, and sketch hint note", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("M01FlashlightBeam");
    expect(bootstrap).toContain("M01BottomLight");
    expect(bootstrap).toContain("M01BottomLightNote");
    expect(bootstrap).toContain("drawFlashlightBeam");
    expect(bootstrap).toContain("drawBottomLight");
    expect(bootstrap).toContain("drawBottomLightHintNote");
    expect(bootstrap).toContain("colorForBeam");
    expect(bootstrap).toContain("colorForBottomLightFill");
    expect(bootstrap).toContain('bottomLight === "steady_on"');
    expect(bootstrap).toContain('bottomLight === "flash_then_off"');
    expect(bootstrap).toContain("validationLightResetTimeout");
    expect(bootstrap).toContain("scheduleValidationLightReset");
    expect(bootstrap).toContain("clearValidationLightReset");
    expect(bootstrap).toContain("validation.validationLightSeconds");
    expect(bootstrap).toContain("setTimeout(() =>");
    expect(bootstrap).toContain("clearTimeout(this.validationLightResetTimeout)");
  });

  it("clips the visible M01 flashlight beam to the fragment floor", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("drawFlashlightBeam");
    expect(bootstrap).toContain("FRAGMENT_FLOOR");
    expect(bootstrap).toContain("clipFlashlightBeamToFragmentFloor");
  });

  it("uses M01 overlap-evidence copy instead of old filter-slot sorter wording", () => {
    const text = readText("assets/scripts/cocos/M01GreyboxText.ts");

    expect(text).toContain("三色手电");
    expect(text).toContain("局部交叠证据");
    expect(text).toContain("关系");
    expect(text).not.toContain("把颜色过滤器拖到齿轮上");
    expect(text).not.toContain("每个收纳槽同时看颜色和形状");
    expect(text).not.toContain("被过滤器照亮的碎片");
  });

  it("keeps the M01 art preview path optional and non-authoritative", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("@property({ type: Boolean })");
    expect(bootstrap).toContain("enableArtPreview = false");
    expect(bootstrap).toContain("buildM01GreyboxStaticArtPlan");
    expect(bootstrap).toContain("getM01GreyboxToolCardFrameResource");
    expect(bootstrap).toContain("getM01GreyboxRuntimeSpriteResourceForToken");
    expect(bootstrap).toContain("SpriteFrame");
    expect(bootstrap).toContain("sprite.sizeMode = Sprite.SizeMode.CUSTOM");
    expect(bootstrap).toContain("resources.load(layer.resourcesLoadPath");
    expect(bootstrap).toContain("resources.load(resource.resourcesLoadPath");
    expect(bootstrap).toContain("M01ArtSprite_");
    expect(bootstrap).toContain("M01StaticArt_");
    expect(bootstrap).toContain("resource.displaySize ?? token.size");
    expect(bootstrap).not.toContain("buildM01GreyboxRuntimeTransparentPlan");
    expect(bootstrap).not.toContain("resources.load(slice.file");
  });

  it("syncs token-level art sprites with greybox presentation state", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("artSprite: Sprite | null");
    expect(bootstrap).toContain("private syncArtSpriteState");
    expect(bootstrap).toContain("this.syncArtSpriteState(entry.artSprite");
    expect(bootstrap).toContain("sprite.color = colorForArtSprite(presentation)");
    expect(bootstrap).toContain('dimmed: new Color(255, 255, 255, 56)');
    expect(bootstrap).toContain('placed: new Color(255, 255, 255, 0)');
  });

  it("uses observed flashlight blend colors when redrawing M01 fragments", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("view.observedColor");
    expect(bootstrap).toContain("colorTokenOverride");
    expect(bootstrap).toContain("colorForToken(colorTokenOverride ?? token.colorToken");
    expect(bootstrap).toContain("ObservedResetScheduler");
    expect(bootstrap).toContain("observedColorResetScheduler");
    expect(bootstrap).toContain("this.observedColorResetScheduler.schedule");
    expect(bootstrap).toContain("scheduleObservedColorReset");
    expect(bootstrap).toContain("clearObservedColorReset");
    expect(bootstrap).toContain("M01_OBSERVED_REVEAL_MS");
  });

  it("uses failed-validation flash colors when redrawing staged M01 fragments", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("view.validationColor");
    expect(bootstrap).toContain("view.validationColor ?? view.observedColor");
  });

  it("keeps greybox graphics subdued when art preview is enabled", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("applyTokenGraphicsState");
    expect(bootstrap).toContain("colorForArtPreviewUnderlay");
    expect(bootstrap).toContain("lineWidthForArtPreview");
    expect(bootstrap).toContain("this.enableArtPreview");
    expect(bootstrap).toContain("Math.min(lineWidth, token.kind === \"slot\" ? 2 : 1)");
    expect(bootstrap).toContain("return withAlpha(color, Math.min(color.a, 36));");
  });

  it("lets art preview hide ordinary slot and gear greybox underlays by default", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("showArtPreviewDebugUnderlay = false");
    expect(bootstrap).toContain("shouldRenderArtPreviewUnderlay");
    expect(bootstrap).toContain("this.showArtPreviewDebugUnderlay");
    expect(bootstrap).toContain('token.kind !== "slot" && token.kind !== "gear"');
    expect(bootstrap).toContain('presentation !== "normal" && presentation !== "repaired"');
    expect(bootstrap).toContain("new Color(0, 0, 0, 0)");
  });

  it("restores art preview underlays as a fallback when required art fails to load", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("artPreviewFallbackUnderlayIds");
    expect(bootstrap).toContain("markArtPreviewUnderlayFallback(token.controllerId)");
    expect(bootstrap).toContain("markStaticArtPreviewUnderlayFallback(layer.id)");
    expect(bootstrap).toContain("this.artPreviewFallbackUnderlayIds.has(token.controllerId)");
    expect(bootstrap).toContain("(this.layout.slots ?? []).map((slot) => slot.controllerId)");
    expect(bootstrap).toContain('layerId === "nineSlotTray"');
    expect(bootstrap).toContain("this.syncVisualState()");
  });

  it("has a committed M01 greybox scene that binds the bootstrap script", () => {
    const scenePath = "assets/scenes/M01Greybox.scene";
    const sceneMetaPath = "assets/scenes/M01Greybox.scene.meta";
    const scene = readText(scenePath);
    const sceneJson = JSON.parse(scene) as Array<Record<string, unknown>>;
    const rootNode = sceneJson.find((entry) => entry._id === "m01GreyboxRoot") as
      | { _components?: Array<{ __id__?: number }> }
      | undefined;
    const bootstrapComponentId = rootNode?._components?.[0]?.__id__;
    const bootstrapComponent =
      typeof bootstrapComponentId === "number" ? sceneJson[bootstrapComponentId] : undefined;

    expect(existsSync(join(projectRoot, scenePath))).toBe(true);
    expect(existsSync(join(projectRoot, sceneMetaPath))).toBe(true);
    expect(scene).toContain("M01Greybox");
    expect(scene).toContain("M01GreyboxRoot");
    expect(scene).not.toContain("MissingScript");
    expect(rootNode?._components).toHaveLength(1);
    expect(bootstrapComponent?.statusLabel).toBeNull();
  });
});
