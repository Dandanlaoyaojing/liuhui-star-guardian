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
    expect(bootstrap).toContain("M01ToolCardPreview");
    expect(bootstrap).toContain("renderToolCardPreview");
  });

  it("does not leave the completion feedback label underneath the ToolCard preview", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain('this.setFeedback("");');
    expect(bootstrap).toContain("this.renderToolCardPreview(this.greyboxRoot, card)");
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

  it("renders M01 overlap evidence with blend colors and local evidence shapes", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("purple: [");
    expect(bootstrap).toContain("green: [");
    expect(bootstrap).toContain("orange: [");
    expect(bootstrap).toContain('token.shapeToken === "arc_lens"');
    expect(bootstrap).toContain('token.shapeToken === "notch_lens"');
    expect(bootstrap).toContain('token.shapeToken === "crescent_overlap"');
    expect(bootstrap).toContain('token.shapeToken === "branch_lens"');
    expect(bootstrap).toContain("drawArcLens");
    expect(bootstrap).toContain("drawNotchLens");
    expect(bootstrap).toContain("drawCrescentOverlap");
    expect(bootstrap).toContain("drawBranchLens");
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
    expect(bootstrap).toContain("heldFragmentId");
    expect(bootstrap).toContain("handleFragmentClick");
    expect(bootstrap).toContain("placeHeldFragmentAt");
    expect(bootstrap).toContain("tryHandleTokenClick");
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
