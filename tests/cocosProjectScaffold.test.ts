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

type SvgPoint = { x: number; y: number };
type SvgPiece = { id: string; kind: "circle" | "triangle" | "hexagon"; x: number; y: number };

function parseM01TargetPieces(svg: string): SvgPiece[] {
  const standardPiecesMatch = svg.match(/<g id="standard-pieces"[.\s\S]*?<\/g>/);
  if (!standardPiecesMatch) {
    return [];
  }

  return [...standardPiecesMatch[0].matchAll(/<use href="#std-(circle|triangle|hexagon)" transform="translate\(([-0-9.]+) ([-0-9.]+)\)" \/>/g)].map(
    (match, index) => {
      return {
        id: `${match[1]}_${index}`,
        kind: match[1] as SvgPiece["kind"],
        x: Number(match[2]),
        y: Number(match[3])
      };
    }
  );
}

function m01SvgPiecePolygon(piece: SvgPiece): SvgPoint[] {
  const radius = 48;
  const halfHeight = 41.569;

  if (piece.kind === "circle") {
    return Array.from({ length: 96 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 96;
      return {
        x: piece.x + Math.cos(angle) * radius,
        y: piece.y + Math.sin(angle) * radius
      };
    });
  }

  if (piece.kind === "triangle") {
    return [
      { x: piece.x, y: piece.y - halfHeight },
      { x: piece.x - radius, y: piece.y + halfHeight },
      { x: piece.x + radius, y: piece.y + halfHeight }
    ];
  }

  return [
    { x: piece.x - radius, y: piece.y },
    { x: piece.x - radius / 2, y: piece.y - halfHeight },
    { x: piece.x + radius / 2, y: piece.y - halfHeight },
    { x: piece.x + radius, y: piece.y },
    { x: piece.x + radius / 2, y: piece.y + halfHeight },
    { x: piece.x - radius / 2, y: piece.y + halfHeight }
  ];
}

function polygonArea(points: SvgPoint[]): number {
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function polygonOrientation(points: SvgPoint[]): number {
  const signedArea = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  return signedArea >= 0 ? 1 : -1;
}

function clipPolygon(subject: SvgPoint[], clip: SvgPoint[]): SvgPoint[] {
  const orientation = polygonOrientation(clip);
  let output = subject;

  for (let index = 0; index < clip.length; index += 1) {
    const start = clip[index];
    const end = clip[(index + 1) % clip.length];
    const input = output;
    output = [];
    if (input.length === 0) {
      break;
    }

    let previous = input[input.length - 1];
    for (const current of input) {
      const currentInside = isInside(current, start, end, orientation);
      const previousInside = isInside(previous, start, end, orientation);

      if (currentInside) {
        if (!previousInside) {
          output.push(intersection(previous, current, start, end));
        }
        output.push(current);
      } else if (previousInside) {
        output.push(intersection(previous, current, start, end));
      }

      previous = current;
    }
  }

  return output;
}

function isInside(point: SvgPoint, start: SvgPoint, end: SvgPoint, orientation: number): boolean {
  const cross = (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
  return orientation * cross >= -0.0001;
}

function intersection(firstStart: SvgPoint, firstEnd: SvgPoint, secondStart: SvgPoint, secondEnd: SvgPoint): SvgPoint {
  const firstDx = firstEnd.x - firstStart.x;
  const firstDy = firstEnd.y - firstStart.y;
  const secondDx = secondEnd.x - secondStart.x;
  const secondDy = secondEnd.y - secondStart.y;
  const denominator = firstDx * secondDy - firstDy * secondDx;

  if (Math.abs(denominator) < 0.0001) {
    return firstEnd;
  }

  const ratio =
    ((secondStart.x - firstStart.x) * secondDy - (secondStart.y - firstStart.y) * secondDx) /
    denominator;

  return {
    x: firstStart.x + firstDx * ratio,
    y: firstStart.y + firstDy * ratio
  };
}

function overlapArea(first: SvgPiece, second: SvgPiece): number {
  const overlap = clipPolygon(m01SvgPiecePolygon(first), m01SvgPiecePolygon(second));
  return overlap.length >= 3 ? polygonArea(overlap) : 0;
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
    expect(bootstrap).toContain("renderToolCardArtFrame");
  });

  it("does not leave the completion feedback label underneath the ToolCard preview", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain('this.setFeedback("");');
    expect(bootstrap).toContain("this.renderToolCardPreview(this.greyboxRoot, card)");
  });

  it("clears transient M01 tools when the completion ToolCard appears", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const completionBlock = bootstrap.slice(
      bootstrap.indexOf("private renderCompletionToolCardIfAvailable"),
      bootstrap.indexOf("private snapNodeToEvidence")
    );

    expect(bootstrap).toContain("private hintButtonRoot: Node | null = null");
    expect(bootstrap).toContain("this.hintButtonRoot = this.addHintButton(this.greyboxRoot)");
    // 完成时灭灯走统一出口 suspendFlashlightObservation(灯态归 off + 手电体复白 + 收光池 +
    // Session.clearFlashlight), 完成路径不再单独清 Session(Task9 收编, 防双轨漂移)。
    expect(completionBlock).toContain("this.suspendFlashlightObservation();");
    expect(completionBlock).not.toContain("this.session.clearFlashlight();");
    expect(bootstrap).toContain("this.hintButtonRoot.active = false");
  });

  it("renders the M01 hint button with the hand-drawn lightbulb icon instead of text", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const hintButtonBlock = bootstrap.slice(
      bootstrap.indexOf("private addHintButton"),
      bootstrap.indexOf("private renderToolCardPreview")
    );

    expect(existsSync(join(projectRoot, "assets/resources/art/icons/icon-hint.png"))).toBe(true);
    expect(bootstrap).toContain(
      'const M01_HINT_ICON_RESOURCE_PATH = "art/icons/icon-hint/spriteFrame";'
    );
    expect(bootstrap).toContain("const M01_HINT_ICON_DISPLAY_SIZE = { width: 24.5, height: 30 };");
    expect(hintButtonBlock).toContain("this.addHintIcon(buttonNode);");
    expect(hintButtonBlock).not.toContain('this.addButtonLabel(buttonNode, this.formatText("hintButton"))');
    expect(bootstrap).toContain('const iconNode = new Node("M01HintButtonIcon");');
    expect(hintButtonBlock).toContain(
      "transform.setContentSize(M01_HINT_ICON_DISPLAY_SIZE.width, M01_HINT_ICON_DISPLAY_SIZE.height);"
    );
    expect(bootstrap).toContain("resources.load(M01_HINT_ICON_RESOURCE_PATH, SpriteFrame");
    // 灯泡图标必须按裁剪后真实宽高比适配: CUSTOM 模式会把 217×229 内容拉满写死的 24.5×30 框 → 横向压扁约14%。
    // rect-first(同 LemmyActor.fitSpriteToFrame), 取不到再回退 spriteFrameSize; "contain" 保证不超出按钮框。
    expect(hintButtonBlock).toContain("const rect = spriteFrame.rect;");
    expect(hintButtonBlock).toContain("spriteFrameSize(spriteFrame)");
    expect(hintButtonBlock).toContain("aspectContentSize(");
    expect(hintButtonBlock).toContain('"contain"');
    expect(hintButtonBlock).toContain("transform.setContentSize(fitted.width, fitted.height);");
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

  it("wires M01 evidence actions in the Cocos bootstrap", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("layout.board");
    expect(bootstrap).toContain("layout.evidence");
    expect(bootstrap).toContain("weak_snap_fragment");
    expect(bootstrap).toContain("place_fragment_freely");
    expect(bootstrap).toContain("pickFragment");
    expect(bootstrap).toContain("placeHeldFragment");
    expect(bootstrap).toContain("weakSnapFragmentToEvidence");
    expect(bootstrap).toContain("submitEvidencePair");
    expect(bootstrap).toContain("validateCandidateStructure");
    expect(bootstrap).toContain("validationLightSeconds");
  });

  it("keeps both legacy M01 flashlight paths unreachable while preserving the session color model", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const layout = readText("assets/scripts/cocos/M01GreyboxLayout.ts");
    const drag = readText("assets/scripts/cocos/M01GreyboxDrag.ts");
    const art = readText("assets/scripts/cocos/M01GreyboxArt.ts");
    const session = readText("assets/scripts/cocos/M01GreyboxSession.ts");

    // ① 旧「固定光束」路径不可达(整条已删, 后续任务改为莱米手持光束)。
    for (const legacyFixedBeamSymbol of [
      "cycleFixedFlashlight",
      "getNextFixedFlashlightToken",
      "selectFixedFlashlight",
      "activateFixedFlashlightBeam",
      "resolveFixedFlashlightBeamAnchor",
      "FIXED_FLASHLIGHT_BEAM_ANCHOR",
      'layer.id === "singleFlashlightTool"'
    ]) {
      expect(bootstrap, `legacy fixed-beam symbol should be gone: ${legacyFixedBeamSymbol}`).not.toContain(
        legacyFixedBeamSymbol
      );
    }

    // ② 旧「手持指针拖动」路径不可达(指针跟随/拖动瞄准/滚轮射程全删)。
    for (const legacyHeldPointerSymbol of [
      "moveHeldFlashlightWithPointer",
      "moveFlashlightBeamWithPointer",
      "beginFlashlightBeamGesture",
      "updateFlashlightBeamGesture",
      "flashlightBeamTarget",
      "flashlightBeamGesturePointerId",
      "heldFlashlightId",
      "heldFlashlightPointerId",
      "suppressHeldFlashlightFollow",
      "flashlightBeamReach",
      "setFlashlightBeamReach",
      "adjustFlashlightBeamReach",
      "MOUSE_WHEEL",
      "revealAllFragmentsWithActiveFlashlight"
    ]) {
      expect(bootstrap, `legacy held-pointer symbol should be gone: ${legacyHeldPointerSymbol}`).not.toContain(
        legacyHeldPointerSymbol
      );
    }

    // ③ 旧三色按钮 token + drop 选光入口不可达。
    expect(layout).not.toContain("buildFlashlightNode");
    expect(layout).not.toContain("positionForFlashlightButton");
    expect(layout).not.toContain("M01_FLASHLIGHT_ART_BUTTON_HIT_SIZE");
    expect(layout).not.toContain("flashlights");
    expect(drag).not.toContain("select_flashlight");
    expect(bootstrap).not.toContain("select_flashlight");
    expect(art).not.toContain("layout.flashlights");

    // KEEP: Session 的显色/选色模型(读 config.flashlights, 与 layout 按钮无关) + 新"灭"态。
    expect(session).toContain("selectFlashlight(flashlightId: string)");
    expect(session).toContain("clearFlashlight()");
    expect(session).toContain("this.config.flashlights");
    expect(session).toContain("revealFragment(");
  });

  it("syncs the M01 flashlight runtime art from the shared M02 flashlight source", () => {
    const syncScript = readText("scripts/sync-m01-lens-down-flashlight.mjs");

    expect(existsSync(join(projectRoot, "assets/art/stage1-tools/M02-flashlight.png"))).toBe(true);
    expect(syncScript).toContain('"assets/art/stage1-tools/M02-flashlight.png"');
    expect(syncScript).not.toContain("m01-single-flashlight-tool-lens-down-candidate-v1.png");
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
    expect(bootstrap).toContain("layout.referencePattern");
    expect(bootstrap).toContain("drawStandardReferencePattern");
    expect(bootstrap).toContain("STANDARD_REFERENCE_TARGET_PIECES");
    expect(bootstrap).toContain("REFERENCE_STANDARD_PIECE_SIZE = 48");
    expect(bootstrap).toContain("clipConvexPolygon");
    expect(bootstrap).toContain("} else {\n      for (const evidence of layout.referenceEvidence)");
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

  it("renders M01 candidate fragments as own-color fixed-shape pieces", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const layout = readText("assets/scripts/cocos/M01GreyboxLayout.ts");

    expect(bootstrap).toContain('token.shapeToken === "triangle"');
    expect(bootstrap).toContain('token.shapeToken === "hexagon"');
    expect(bootstrap).toContain("Math.sqrt(3)");
    expect(bootstrap).not.toContain("quarterWidth");
    expect(bootstrap).not.toContain('token.shapeToken === "arc_hook"');
    expect(bootstrap).not.toContain('token.shapeToken === "arc_socket"');
    expect(bootstrap).not.toContain('token.shapeToken === "notch_hook"');
    expect(bootstrap).not.toContain('token.shapeToken === "notch_socket"');
    expect(bootstrap).not.toContain('token.shapeToken === "crescent_left"');
    expect(bootstrap).not.toContain('token.shapeToken === "crescent_right"');
    expect(bootstrap).not.toContain('token.shapeToken === "branch_left"');
    expect(bootstrap).not.toContain('token.shapeToken === "branch_right"');
    expect(layout).toContain("fragment.hiddenColor ?? fragment.color ?? \"hidden\"");
    expect(bootstrap).toContain('red: [');
    expect(bootstrap).toContain("blue: [72, 104, 190]");
    expect(bootstrap).toContain('yellow: [');
    expect(bootstrap).not.toContain("return new Color(224, 224, 214, 84)");
  });

  it("renders M01 platform target as true-color overlap shapes only", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("renderTargetOverlapEvidence");
    expect(bootstrap).toContain("M01TargetOverlapEvidence_${overlap.evidenceId}");
    expect(bootstrap).toContain("colorForTargetOverlapEvidence");
    expect(bootstrap).not.toContain("renderTargetStandardPieces");
    expect(bootstrap).not.toContain("M01TargetStandardPiece_${piece.pieceSlotId}");
  });

  it("draws explicit pigment-color overlays where manual target pieces overlap", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("M01ManualTargetBlendOverlay");
    expect(bootstrap).toContain("manualTargetBlendGraphics");
    expect(bootstrap).toContain("resolveM01StandardPieceBlendOverlays");
    expect(bootstrap).toContain("drawManualTargetBlendOverlays");
    expect(bootstrap).toContain("collectManualTargetBlendPieces");
    expect(bootstrap).toContain("colorForManualTargetBlendOverlay");
    expect(bootstrap).toContain("this.drawManualTargetBlendOverlays();");
  });

  it("keeps generated target evidence off the large repair platform", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).not.toContain("shouldRenderGeneratedTargetEvidence");
    expect(bootstrap).not.toContain("colorForGeneratedTargetEvidence");
    expect(bootstrap).toContain("drawPolygon(graphics, token.magnetPolygon)");
  });

  it("exposes a preview-only helper for exporting generated M01 target evidence", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("__m01ManualTargetTools");
    expect(bootstrap).toContain("exposeManualTargetTools");
    expect(bootstrap).toContain("getManualTargetPlacements");
    expect(bootstrap).toContain("deriveManualTargetEvidence");
    expect(bootstrap).toContain("deriveM01TargetEvidenceFromPlacements");
  });

  it("persists manual target draft placements across preview reloads", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const persistence = readText("assets/scripts/cocos/M01ManualTargetPersistence.ts");

    expect(bootstrap).toContain("restoreManualTargetDraft");
    expect(bootstrap).toContain("persistManualTargetDraft");
    expect(bootstrap).toContain("readM01ManualTargetPlacements");
    expect(bootstrap).toContain("writeM01ManualTargetPlacements");
    expect(bootstrap).toContain("getM01ManualTargetStorage");
    expect(bootstrap).toContain("restoreDraft: () => this.restoreManualTargetDraft()");
    expect(bootstrap).toContain("saveDraft: () => this.persistManualTargetDraft()");
    expect(bootstrap).toContain("syncManualTargetDebugExport");
    expect(bootstrap).toContain("update(): void");
    expect(bootstrap).toContain("resolveManualTargetFragmentPosition");
    expect(bootstrap).toContain("entry?.node.position");
    expect(bootstrap).toContain('id = "m01-manual-target-export"');
    expect(bootstrap).toContain('setAttribute("data-placements-json"');
    expect(bootstrap).toContain('setAttribute("data-evidence-json"');
    expect(persistence).toContain("M01_MANUAL_TARGET_STORAGE_KEY");
  });

  it("lets the left target reference thumbnail expand without showing the ToolCard early", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("M01TargetReferenceCircleFrame");
    expect(bootstrap).toContain("toggleTargetReferenceZoom");
    expect(bootstrap).toContain("M01TargetReferenceZoom");
    expect(bootstrap).toContain("M01TargetReferenceZoomCard");
    expect(bootstrap).toContain("getM01GreyboxTargetReferenceCardResource");
    expect(bootstrap).toContain('token.kind === "reference_pattern"');
    expect(bootstrap).not.toContain("M01ToolCardPreviewTitleBeforeCompletion");
  });

  it("keeps M01 target SVG polygons on the same regular standard-piece template", () => {
    const geometryGuide = readText(
      "docs/design/generated-m01-art-slices/m01-target-standard-piece-geometry-guide.svg"
    );
    const artCandidate = readText(
      "docs/design/generated-m01-art-slices/m01-target-standard-piece-art-candidate.svg"
    );

    for (const svg of [geometryGuide, artCandidate]) {
      expect(svg).toContain('<polygon id="std-triangle" points="0,-41.569 -48,41.569 48,41.569" />');
      expect(svg).toContain('<polygon id="std-hexagon" points="-48,0 -24,-41.569 24,-41.569 48,0 24,41.569 -24,41.569" />');
      expect(svg).not.toContain('0,-48 -48,48 48,48');
      expect(svg).not.toContain('-24,-48 24,-48 48,0 24,48 -24,48 -48,0');
    }
  });

  it("keeps M01 target art polish from warping the deterministic geometry", () => {
    const artCandidate = readText(
      "docs/design/generated-m01-art-slices/m01-target-standard-piece-art-candidate.svg"
    );

    expect(artCandidate).toContain('id="paper-tooth"');
    expect(artCandidate).toContain('id="piece-wash-overlays"');
    expect(artCandidate).toContain('id="ink-linework-overlays"');
    expect(artCandidate).not.toContain("feDisplacementMap");
    expect(artCandidate).not.toContain('<g id="standard-pieces" filter=');
    expect(artCandidate).not.toContain('<g id="true-overlap-colors" filter=');
  });

  it("keeps M01 target art as one compact standard-piece pattern", () => {
    const artCandidate = readText(
      "docs/design/generated-m01-art-slices/m01-target-standard-piece-art-candidate.svg"
    );
    const pieces = parseM01TargetPieces(artCandidate);
    const intendedPairs = new Set(["0:1", "0:5", "1:2", "2:3", "2:4", "4:5"]);
    const readableEvidenceOverlap = { min: 380, max: 1500 };

    expect(pieces).toHaveLength(6);
    expect(
      Math.max(...pieces.map((piece) => piece.x)) - Math.min(...pieces.map((piece) => piece.x)),
      "target pattern should read as one compact object, not a loose horizontal chain"
    ).toBeLessThanOrEqual(230);
    expect(
      Math.max(...pieces.map((piece) => piece.y)) - Math.min(...pieces.map((piece) => piece.y)),
      "target pattern should have meaningful vertical structure"
    ).toBeGreaterThanOrEqual(70);

    for (let firstIndex = 0; firstIndex < pieces.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < pieces.length; secondIndex += 1) {
        const area = overlapArea(pieces[firstIndex], pieces[secondIndex]);
        const pairKey = `${firstIndex}:${secondIndex}`;

        if (intendedPairs.has(pairKey)) {
          expect(area, `${pairKey} should be a readable evidence overlap inside the larger pattern`).toBeGreaterThanOrEqual(
            readableEvidenceOverlap.min
          );
          expect(area, `${pairKey} should not become an oversized overlap`).toBeLessThanOrEqual(
            readableEvidenceOverlap.max
          );
        } else {
          expect(area, `${pairKey} should not create a separate uncolored evidence overlap`).toBeLessThan(50);
        }
      }
    }
  });

  it("documents the M01 flashlight art as one tool with three light buttons", () => {
    const artPrompt = readText(
      "docs/design/generated-m01-art-slices/m01-overlap-runtime-art-polish-qa-and-prompt.md"
    );
    const flashlightCandidate = readText(
      "docs/design/generated-m01-art-slices/m01-single-flashlight-with-light-buttons-candidate.svg"
    );
    const flashlightDecals = readText(
      "docs/design/generated-m01-art-slices/m01-flashlight-runtime-decals-candidate.svg"
    );

    expect(artPrompt).toContain("one handheld flashlight tool with three selectable light buttons");
    expect(artPrompt).toContain("cartoon toy-like proportions");
    expect(artPrompt).toContain("small runtime overlay decals for button highlights and lens glow");
    expect(artPrompt).toContain("do not bake the full flashlight beam into an art decal");
    expect(artPrompt).not.toContain("three handheld flashlight tools");
    expect(artPrompt).not.toContain("three physical handheld tools");
    expect(flashlightCandidate).toContain('id="single-flashlight-body"');
    expect(flashlightCandidate).toContain('id="cartoon-toy-silhouette"');
    expect(flashlightCandidate).toContain('id="light-button-red"');
    expect(flashlightCandidate).toContain('id="light-button-yellow"');
    expect(flashlightCandidate).toContain('id="light-button-blue"');
    expect(flashlightCandidate).toContain('fill="#4f6fc8"');
    expect(flashlightCandidate).not.toContain('fill="#78a2b6"');
    expect(flashlightDecals).toContain('id="lens-glow-decal"');
    expect(flashlightDecals).toContain('id="button-highlight-red-decal"');
    expect(flashlightDecals).toContain('id="button-highlight-yellow-decal"');
    expect(flashlightDecals).toContain('id="button-highlight-blue-decal"');
    expect(flashlightDecals).toContain('id="beam-mouth-accent-decal"');
    expect(flashlightDecals).not.toContain('id="full-beam-decal"');
  });

  it("keeps a complete M01 runtime sticker sheet candidate for visual review", () => {
    const stickerSheet = readText(
      "docs/design/generated-m01-art-slices/m01-runtime-sticker-sheet-candidate.svg"
    );

    for (const requiredId of [
      "asset-assembly-plate",
      "asset-target-reference-card",
      "asset-hidden-fragments",
      "asset-single-flashlight",
      "asset-flashlight-decals",
      "asset-fragment-floor",
      "asset-bottom-light-overlays",
      "asset-toolcard-frame"
    ]) {
      expect(stickerSheet).toContain(`id="${requiredId}"`);
    }

    expect(stickerSheet).toContain("m01 runtime sticker sheet candidate");
    expect(stickerSheet).toContain("reference-style-anchor-2026-04-22");
    expect(stickerSheet).toContain("assembly-gear-rim");
    expect(stickerSheet).toContain("paper-tooth");
    expect(stickerSheet).toContain("watercolor-mottle");
    expect(stickerSheet).toContain("ink-jitter-lines");
    expect(stickerSheet).not.toContain('id="full-beam-decal"');
  });

  it("keeps generated watercolor PSD parts styled from the 2026-04-22 reference", () => {
    const sliceDir = "docs/design/generated-m01-art-slices/m01-generated-watercolor-psd-assets";

    for (const requiredPsd of [
      "parts/assembly_gear_empty.psd",
      "parts/target_reference_card.psd",
      "parts/flashlight_single_three_buttons.psd",
      "parts/toolcard_frame_blank.psd",
      "parts/fragment_floor_strip.psd",
      "parts/bottom_light_off_overlay.psd",
      "parts/bottom_light_failed_flash_overlay.psd",
      "parts/bottom_light_steady_on_overlay.psd",
      "parts/flashlight_decal_lens_glow.psd",
      "parts/flashlight_decal_button_red.psd",
      "parts/flashlight_decal_button_yellow.psd",
      "parts/flashlight_decal_button_blue.psd",
      "parts/flashlight_decal_beam_mouth.psd",
      "parts/hidden_fragment_01_circle.psd",
      "parts/hidden_fragment_02_triangle.psd",
      "parts/hidden_fragment_03_hexagon.psd",
      "parts/hidden_fragment_13_circle.psd",
      "source/m01-locked-knot-target-reference-source.psd",
      "source/m01-locked-knot-target-watercolor-paintover-v2.psd",
      "source/m01-locked-knot-target-clue-only-watercolor-imagegen-v1.psd",
      "source/m01-watercolor-generated-source-sheet-v1.psd"
    ]) {
      expect(existsSync(join(projectRoot, sliceDir, requiredPsd))).toBe(true);
    }
    expect(
      existsSync(
        join(
          projectRoot,
          sliceDir,
          "m01-generated-watercolor-parts-contact-sheet-v4-clue-only-target.psd"
        )
      )
    ).toBe(true);

    const manifest = readText(`${sliceDir}/README.md`);
    expect(manifest).toContain("Generated Watercolor PSD Assets");
    expect(manifest).toContain("style reference, not as a crop source");
    expect(manifest).toContain("26 individual PSD part files");
    expect(manifest).toContain("locked knot target structure");
    expect(manifest).toContain("Use this versioned path to avoid stale preview caching.");
    expect(manifest).toContain("Full standard-piece outlines are removed");
    expect(manifest).toContain("hide the full circle / triangle / hexagon outlines");
    expect(manifest).toContain("Do not use image generation to freely redesign or rearrange this target pattern.");
  });

  it("turns the flashlight observation off when a fragment press begins", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const suspendBlock = bootstrap.slice(
      bootstrap.indexOf("private suspendFlashlightObservation"),
      bootstrap.indexOf("private suppressRootClickOnce")
    );

    // 灭灯绑定到【真正抓到拼片】: beginTokenDrag(per-node 命中拼片节点)的 fragment 分支里灭灯,
    // 不再由全局按下的 64px 近邻命中误灭(玩家点地走位、附近恰好有片时也灭)。
    const beginDragBlock = bootstrap.slice(
      bootstrap.indexOf("private beginTokenDrag"),
      bootstrap.indexOf("private moveActivePointerDrag")
    );
    expect(bootstrap).toContain("private suspendFlashlightObservation(): void");
    expect(beginDragBlock).toContain("this.suspendFlashlightObservation();");
    // 点拼片=拾取且手电灭(spec §5.2): 灭灯统一走 Session 的"灭"态。
    expect(suspendBlock).toContain("this.session?.clearFlashlight();");
    expect(suspendBlock).toContain("this.syncVisualState();");
    expect(bootstrap).toContain("Input.EventType.MOUSE_DOWN");
    expect(bootstrap).toContain("Input.EventType.TOUCH_START");
  });

  it("plays the spec §5.2 repair sequence on completion before the tool card (齿轮转→碎片漩涡喷出→星光)", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    // 完成路径: 验证全对 → 修复时序(config repair.steps 经 M01RepairSequence) → 播完才出智慧结晶卡。
    expect(bootstrap).toContain('from "./M01RepairSequence.ts"');
    expect(bootstrap).toContain("this.beginRepairSequenceThenToolCard(validation.completed)");
    expect(bootstrap).toContain("buildRepairTimeline(");
    expect(bootstrap).toContain("spiralOutTargets(");
    // 三段表现都有 cc 落点: 齿轮转 / 喷出(弱磁吸登记的 solution 碎片) / 星光脉冲。
    expect(bootstrap).toContain('type === "entity_animate"');
    expect(bootstrap).toContain('type === "fragments_spiral_out"');
    expect(bootstrap).toContain('type === "starlight"');
    expect(bootstrap).toContain("weakSnappedFragmentsByEvidence.values()");
    // ToolCard 在 timeline.total 之后才出(不抢在动画前)。
    expect(bootstrap).toMatch(/timeline\.total \* 1000\s*\)\s*\);/);
    // 清理: onDestroy 收掉修复动画定时器(防场景销毁后残留回调)。
    expect(bootstrap).toContain("this.clearRepairSequenceTimeouts()");
    // 输入锁(codex P2): 动画窗内 拖拼片/点手电循环/重复验证 全部封住, 防玩家和喷出 tween 打架。
    const repairLockHits = bootstrap.split("this.repairSequencePlaying").length - 1;
    expect(repairLockHits).toBeGreaterThanOrEqual(6); // 字段+置位/复位+三处输入闸
    expect(bootstrap).toMatch(/!\(this\.physicsSettled && this\.flashlightAcquired\) \|\| this\.repairSequencePlaying/);
  });

  it("wires the v4 held-flashlight runtime: Lemmy-anchored coverage, light cycling, double gating", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const intro = readText("assets/scripts/cocos/M01IntroSequence.ts");
    const config = readJson("assets/resources/configs/stage1/m01-memory-gear.json") as {
      flashlightCoverage?: Record<string, unknown>;
    };

    // ① intro 交接: onFlashlightAcquired 闩 flashlightAcquired + 记 beam 锚(莱米节点)与手持手电
    //    节点; onHeldFlashlightTap 转发到 puzzle 侧循环灯色。
    expect(bootstrap).toContain("onFlashlightAcquired: ({ lemmyNode, flashlightNode }) => {");
    expect(bootstrap).toContain("this.flashlightAcquired = true;");
    expect(bootstrap).toContain("this.lemmyAnchorNode = lemmyNode;");
    expect(bootstrap).toContain("this.lemmyFlashlightNode = flashlightNode;");
    expect(bootstrap).toContain("onHeldFlashlightTap: () => this.handleHeldFlashlightTap()");
    // 拾片放宽(只需 physicsSettled)后, 玩家可在捡手电前就拼好完整结构; 验证仍双门控 → 手电到手时
    // 必须补一次验证, 否则预拼好的结构要等下次挪片才触发底光(codex P2 复核发现)。
    const acquireBlock = bootstrap.slice(
      bootstrap.indexOf("onFlashlightAcquired: ({ lemmyNode, flashlightNode }) => {"),
      bootstrap.indexOf("onHeldFlashlightTap: () => this.handleHeldFlashlightTap()")
    );
    expect(acquireBlock).toContain("this.tryValidateCompleteEvidenceCandidate();");

    // ② 点手电循环 红/黄/蓝/灭(cycleLight): 颜色映射 Session.selectFlashlight(flashlight_<color>),
    //    "灭"走 Session.clearFlashlight()。
    expect(bootstrap).toContain("this.activeLightState = cycleLight(this.activeLightState);");
    expect(bootstrap).toContain("? this.session.clearFlashlight()");
    expect(bootstrap).toContain(
      "this.session.selectFlashlight(`flashlight_${this.activeLightState}`)"
    );

    // ③ 覆盖面显色锚莱米: fragmentsInCoverage(排除拼接盘上的) + 进圈持久显色/出圈清显色;
    //    每帧 update 跟随走位 tween, 且不被 manual-target 模式的 early-return 挡住。
    expect(bootstrap).toContain(
      "fragmentsInCoverage(center, coverage.radius, this.collectCoverageCandidates())"
    );
    expect(bootstrap).toContain("this.session.clearObservedFragmentColors();");
    expect(bootstrap).toContain("this.session.revealFragments(covered, { persistent: true });");
    expect(bootstrap).toContain("onTray: onAssemblyBoard");
    const updateBlock = bootstrap.slice(
      bootstrap.indexOf("update(): void"),
      bootstrap.indexOf("selectFilter(")
    );
    expect(updateBlock).toContain("this.syncFlashlightCoverage();");
    expect(updateBlock.indexOf("this.syncFlashlightCoverage();")).toBeLessThan(
      updateBlock.indexOf("evidenceSnapEnabled")
    );

    // ④ 光束只照候选区、不照拼接盘(spec §5.2): 逻辑面 onTray 排除(已放槽/弱吸附在证据/位于盘内)
    //    + 视觉面光池顶边经纯函数钳到盘下缘以下。
    expect(bootstrap).toContain("coveragePoolHalfHeight({");
    expect(bootstrap).toContain("COVERAGE_POOL_BOARD_CLEARANCE");
    expect(bootstrap).toContain("this.isPointInsideManualTargetBoard(position)");
    expect(bootstrap).toContain("this.isFragmentWeakSnappedToEvidence(fragment.controllerId)");

    // ⑤ 门控: 拾片(beginTokenDrag)—— physicsSettled(谜题阶段)后盘上/地上任意位置都可拾(常态);
    //    仅【落定前(顶篮间隙)】用 intro.isFragmentSpilledOut 限制, 只许拾真顶出篮的片, 防"弹回篮内堆上的片"
    //    被误判可拾。必须有 physicsSettled 这一支, 否则放盘上(高于篮底)的片会变不可拾→卡死。
    const beginDragBlock = bootstrap.slice(
      bootstrap.indexOf("private beginTokenDrag"),
      bootstrap.indexOf("private moveActivePointerDrag")
    );
    expect(beginDragBlock).toContain("this.physicsSettled || (this.introSequence?.isFragmentSpilledOut(node)");
    // intro 侧门控真值: 已 reparent 到 root【且】不在篮子【当前】AABB 框内(篮被绳物理摆动, 取 worldPosition;
    // 只判"低于篮底"会误锁玩家挪到盘上、与篮同高的片 → codex P2)。
    expect(intro).toContain("Math.abs(p.x - bc.x) < BASKET_DISPLAY.width / 2");
    expect(intro).toContain("Math.abs(p.y - bc.y) < BASKET_DISPLAY.height / 2");
    expect(intro).toContain("return !insideBasket;");
    expect(beginDragBlock).not.toContain("!(this.physicsSettled && this.flashlightAcquired)");
    const validateBlock = bootstrap.slice(
      bootstrap.indexOf("private tryValidateCompleteEvidenceCandidate"),
      bootstrap.indexOf("private scheduleValidationLightReset")
    );
    expect(validateBlock).toContain("!(this.physicsSettled && this.flashlightAcquired)");

    // ⑥ 灭灯绑定到【真正抓到拼片】: beginTokenDrag(per-node 命中拼片节点)里 suspendFlashlightObservation,
    //    不再由全局 beginActivePointerPress 的 64px 近邻命中误灭(玩家点地走位、附近恰好有片时会误灭)。
    //    手电循环仍走 routeTap(点手持手电 heldFlashlight → cycleLight)。
    expect(bootstrap).toContain('import { routeTap } from "./M01PuzzleInputRouter.ts";');
    expect(bootstrap).toContain('if (action !== "cycleLight") {');
    expect(beginDragBlock).toContain("this.suspendFlashlightObservation();");

    // ⑦ 光池仅 拾起后且灯亮 时显示; 灯灭/拾片立即收池复灰。
    expect(bootstrap).toContain('this.activeLightState === "off"');
    expect(bootstrap).toContain("this.hideCoverageBeam();");
    expect(bootstrap).toContain('new Node("M01LemmyCoverageLightPool")');

    // ⑧ 覆盖半径等玩法数值入 config(puzzle-configs 规则: 每个数值带 _comment 说明)。
    expect(config.flashlightCoverage).toBeDefined();
    const coverage = config.flashlightCoverage as Record<string, unknown>;
    expect(typeof coverage.radius).toBe("number");
    expect(typeof coverage.centerOffsetX).toBe("number");
    expect(typeof coverage.centerOffsetY).toBe("number");
    expect(typeof coverage.radius_comment).toBe("string");
    expect(typeof coverage.centerOffsetX_comment).toBe("string");
    expect(typeof coverage.centerOffsetY_comment).toBe("string");
  });

  it("highlights M01 evidence hint targets in the bootstrap", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("hintedTargetIds");
    expect(bootstrap).toContain("this.hintedTargetIds = new Set(hint.targetIds)");
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
    // 持握时单击=挂起延迟放下(等窗口看是否双击); 真正放下在延迟到时 / 别处放置时结算。
    expect(bootstrap).toContain("this.scheduleHeldFragmentDrop(session.currentPosition);");
    expect(bootstrap).toContain("tryHandleTokenClick");
    expect(bootstrap).toContain("if (!this.dragState.active) {\n      this.clearActiveDrag();");
    expect(bootstrap).toContain("this.heldPointerId !== this.pointerIdForEvent(event)");
    expect(bootstrap).toContain("this.tokenPositions.set(heldFragmentId, position)");
    expect(bootstrap).toContain('token.kind === "fragment" ? FRAGMENT_INPUT_HIT_SIZE : token.size.width');
    expect(bootstrap).toContain('token.kind === "fragment" ? FRAGMENT_INPUT_HIT_SIZE : token.size.height');
  });

  it("holds M01 fragment: single-click drops (deferred), double-click rotates 90° (no on-screen button)", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    // 旋转按钮已删: 字段/创建/节点/标签全不应再出现。
    expect(bootstrap).not.toContain("rotateButtonRoot");
    expect(bootstrap).not.toContain("addRotateButton");
    expect(bootstrap).not.toContain("M01Rotate90Button");
    expect(bootstrap).not.toContain('addButtonLabel(buttonNode, "旋转90°")');

    // 持握时: 第一击挂起延迟放下; 窗口内第二击(pendingDropTimer 已存在)= 双击 → 取消放下、转 90°。
    expect(bootstrap).toContain("private readonly tokenRotations = new Map<string, number>();");
    expect(bootstrap).toContain(
      "this.pendingDropTimer !== undefined && this.pendingDropFragmentId === this.heldFragmentId"
    );
    expect(bootstrap).toContain("this.cancelPendingHeldDrop();\n        this.rotateHeldFragmentClockwise();");
    expect(bootstrap).toContain("}, ROTATE_DOUBLE_CLICK_MS);");
    // 单击放下消歧窗口内冻住拼片(不跟指针), 落点定在点击处。
    expect(bootstrap).toContain("if (this.pendingDropTimer !== undefined) {\n      return;\n    }");
    // 90° 步进逻辑保留(够到 90/180 目标槽)。
    expect(bootstrap).toContain("const nextRotation = (currentRotation + 90) % 360");
    expect(bootstrap).toContain("entry.node.setRotationFromEuler(0, 0, nextRotation)");
    expect(bootstrap).toContain("this.tokenRotations.set(heldFragmentId, nextRotation)");
  });

  it("keeps fragment drags alive when mouse move and mouse up finish outside the token node", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("private pointerIdForActiveDragEvent(event: M01GreyboxPointerEvent): string | number");
    expect(bootstrap).toContain('if (pointerId === "mouse" && this.dragState.active) {');
    expect(bootstrap).toContain("pointerId: this.pointerIdForActiveDragEvent(event)");
  });

  it("renders M01 validation bottom light and sketch hint note without the legacy beam stack", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("M01BottomLight");
    expect(bootstrap).toContain("M01BottomLightNote");
    expect(bootstrap).toContain("drawBottomLight");
    expect(bootstrap).toContain("drawBottomLightHintNote");
    expect(bootstrap).toContain("colorForBottomLightFill");
    expect(bootstrap).toContain('bottomLight === "steady_on"');
    expect(bootstrap).toContain('bottomLight === "flash_then_off"');
    expect(bootstrap).toContain("validationLightResetTimeout");
    expect(bootstrap).toContain("scheduleValidationLightReset");
    expect(bootstrap).toContain("clearValidationLightReset");
    expect(bootstrap).toContain("validation.validationLightSeconds");
    expect(bootstrap).toContain("setTimeout(() =>");
    expect(bootstrap).toContain("clearTimeout(this.validationLightResetTimeout)");
    // 旧固定/指针光束的整套渲染栈已随两条旧路径删除(新莱米锚定光束 + fx_color-filter 显色另建)。
    expect(bootstrap).not.toContain("drawFlashlightBeam");
    expect(bootstrap).not.toContain("SOFT_FLASHLIGHT_BEAM_LAYERS");
    expect(bootstrap).not.toContain("FLASHLIGHT_BEAM_GLOW_STOPS");
    expect(bootstrap).not.toContain("colorForBeam");
    expect(bootstrap).not.toContain("FRAGMENT_FLOOR");
    expect(bootstrap).not.toContain("clipFlashlightBeamToFragmentFloor");
  });

  it("wires the fx_color-filter 手电逐像素显色 shader (材质/uniform/fallback/漂移哨兵)", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const effect = readText("assets/resources/shaders/fx_color-filter.effect");
    const beam = readText("assets/scripts/cocos/M01FlashlightBeam.ts");

    // effect 资源存在
    expect(existsSync(join(projectRoot, "assets/resources/shaders/fx_color-filter.effect"))).toBe(true);
    // 加载/建材质/挂拼片/写 uniform 的接线
    expect(bootstrap).toContain('resources.load("shaders/fx_color-filter", EffectAsset');
    expect(bootstrap).toContain("new Material()");
    expect(bootstrap).toContain("sprite.customMaterial = this.colorFilterMat");
    // 逐拼片材质实例写 uniform(共享原件 setProperty 不一定投递到 2D 渲染实例 → 显色随机)
    expect(bootstrap).toContain("getMaterialInstance(0)");
    expect(bootstrap).toContain("setBeamUniformOnFragments(");
    expect(bootstrap).toContain('"u_beamOrigin"');
    expect(bootstrap).toContain('"u_beamDir"');
    expect(bootstrap).toContain("worldBeamFromGeometry(");
    // fallback + 总开关
    expect(bootstrap).toContain("USE_COLOR_FILTER_SHADER");
    expect(bootstrap).toContain("this.colorFilterAvailable");
    expect(bootstrap).toContain("!this.colorFilterAvailable"); // syncArtSpriteFrame fallback 分支
    expect(bootstrap).toContain("writeBeamOff"); // 过盘/灯灭关光
    // TS↔GLSL↔锥纹理 漂移哨兵: 三方同一衰减(bAcross=1-q², bAlong=pow(1-u,0.8)), 显色质感=光束质感
    expect(beam).toContain("CONE_ALONG_POW = 0.8");
    expect(beam).toContain("1 - q * q");
    expect(effect).toContain("pow(max(0.0, 1.0 - u), 0.8)");
    expect(effect).toContain("1.0 - q * q");
  });

  it("uses valid Cocos Size objects for M01 physics boundary box colliders", () => {
    const boundary = readText("assets/scripts/cocos/M01PhysicsBoundary.ts");

    expect(boundary).toContain("Size");
    expect(boundary).toContain("collider.size = new Size(w, h);");
    expect(boundary).not.toContain("collider.size = new Vec2(w, h);");
  });

  it("spans the M01 physics ground across the full visible ground line", () => {
    const boundary = readText("assets/scripts/cocos/M01PhysicsBoundary.ts");
    const groundBlock = boundary.slice(
      boundary.indexOf('"M01PhysicsGround"'),
      boundary.indexOf('this.spawnEdge(\n      "M01PhysicsLeftWall"')
    );

    expect(boundary).toContain("const GROUND_COLLIDER_WIDTH = GROUND_DISPLAY_WIDTH;");
    expect(groundBlock).toContain('"M01PhysicsGround"');
    expect(groundBlock).toContain("0,");
    expect(groundBlock).toContain("GROUND_COLLIDER_WIDTH");
    expect(groundBlock).not.toContain("FLOOR_BOUNDS");
  });

  it("aligns the M01 visible ground ink with the physical ground surface", () => {
    const boundary = readText("assets/scripts/cocos/M01PhysicsBoundary.ts");

    expect(boundary).toContain("const GROUND_SOURCE_HEIGHT = 66;");
    expect(boundary).toContain("const GROUND_SURFACE_INK_SOURCE_Y = 6;");
    expect(boundary).toContain(
      "const GROUND_SOURCE_TO_DISPLAY_SCALE = GROUND_DISPLAY_HEIGHT / GROUND_SOURCE_HEIGHT;"
    );
    expect(boundary).toContain("const PHYSICS_GROUND_Y = -270;");
    expect(boundary).toContain("PHYSICS_GROUND_Y -");
    expect(boundary).toContain(
      "(GROUND_DISPLAY_HEIGHT / 2 - GROUND_SURFACE_INK_SOURCE_Y * GROUND_SOURCE_TO_DISPLAY_SCALE)"
    );
    expect(boundary).not.toContain("const GROUND_SPRITE_CENTER_Y = -290;");
  });

  it("keeps M01 physics side walls at the screen edges so rolling fragments stay on stage", () => {
    const boundary = readText("assets/scripts/cocos/M01PhysicsBoundary.ts");
    const leftWallBlock = boundary.slice(
      boundary.indexOf('"M01PhysicsLeftWall"'),
      boundary.indexOf('this.spawnEdge(\n      "M01PhysicsRightWall"')
    );
    const rightWallBlock = boundary.slice(
      boundary.indexOf('"M01PhysicsRightWall"'),
      boundary.indexOf("  }\n\n  /**\n   * Render a hand-drawn ink ground line")
    );

    expect(boundary).toContain("const PHYSICS_SCREEN_LEFT_X = -GROUND_DISPLAY_WIDTH / 2;");
    expect(boundary).toContain("const PHYSICS_SCREEN_RIGHT_X = GROUND_DISPLAY_WIDTH / 2;");
    expect(boundary).toContain("const PHYSICS_WALL_MAX_Y = 360;");
    expect(leftWallBlock).toContain("PHYSICS_SCREEN_LEFT_X - WALL_THICKNESS / 2");
    expect(rightWallBlock).toContain("PHYSICS_SCREEN_RIGHT_X + WALL_THICKNESS / 2");
    expect(leftWallBlock).not.toContain("FLOOR_BOUNDS");
    expect(rightWallBlock).not.toContain("FLOOR_BOUNDS");
  });

  it("keeps M01 physics debug visuals out of the playable preview", () => {
    const boundary = readText("assets/scripts/cocos/M01PhysicsBoundary.ts");
    const pile = readText("assets/scripts/cocos/M01PhysicsPile.ts");

    expect(boundary).toContain("const DEBUG_VISUALIZE_WALLS = false;");
    expect(pile).toContain("PhysicsSystem2D.instance.debugDrawFlags = 0;");
    expect(pile).not.toContain("PhysicsSystem2D.instance.debugDrawFlags = 11;");
  });

  it("uses real-time M01 physics cadence and padded fragment colliders to reduce visible pass-through", () => {
    const pile = readText("assets/scripts/cocos/M01PhysicsPile.ts");
    const collider = readText("assets/scripts/cocos/M01PhysicsCollider.ts");

    expect(pile).toContain("const M01_PHYSICS_FIXED_TIME_STEP = 1 / 60;");
    expect(collider).toContain("export const M01_PHYSICS_COLLIDER_VISUAL_PADDING_BY_SHAPE");
    expect(collider).toContain("circle: 4,");
    expect(collider).toContain("triangle: 0,");
    expect(collider).toContain("hexagon: 0");
    expect(collider).toContain("export function resolveM01PhysicsColliderVisualPadding");
    expect(pile).toContain("PhysicsSystem2D.instance.fixedTimeStep = M01_PHYSICS_FIXED_TIME_STEP;");
    expect(pile).toContain("frag.size + resolveM01PhysicsColliderVisualPadding(frag.shape)");
    expect(pile).not.toContain("buildM01PhysicsCollider(frag.shape, frag.size);");
  });

  it("waits for M01 physics fragments to actually settle before unlocking input", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const pile = readText("assets/scripts/cocos/M01PhysicsPile.ts");
    const shim = readText("assets/scripts/cocos/cc-shim.d.ts");

    expect(bootstrap).toContain("settleTimeoutMs: 3600,");
    expect(pile).toContain("const M01_PHYSICS_SETTLE_LINEAR_VELOCITY = 4;");
    expect(pile).toContain("const M01_PHYSICS_SETTLE_ANGULAR_VELOCITY = 6;");
    expect(pile).toContain("const M01_PHYSICS_SETTLE_STABLE_FRAMES = 18;");
    expect(pile).toContain("private allFragmentsAreSettled(): boolean");
    expect(pile).toContain("private finishSettling(): void");
    expect(pile).toContain("this.stableSettleFrames += 1;");
    expect(pile).not.toContain("this.options?.onSettled();\n    }, lastDropDelay + options.settleTimeoutMs);");
    expect(pile).toContain("body.bullet = true;");
    expect(pile).toContain("body.allowSleep = false;");
    expect(pile).toContain("body.allowSleep = true;");
    expect(pile).toContain("body.linearDamping = M01_PHYSICS_LINEAR_DAMPING;");
    expect(pile).toContain("body.angularDamping = M01_PHYSICS_ANGULAR_DAMPING;");
    expect(shim).toContain("allowSleep: boolean;");
    expect(shim).toContain("linearDamping: number;");
    expect(shim).toContain("angularDamping: number;");
    expect(shim).toContain("bullet: boolean;");
  });

  it("starts M01 physics fragments from the top edge as one natural free-fall release", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const pile = readText("assets/scripts/cocos/M01PhysicsPile.ts");

    // Drop origin now comes from the intro sequence's basket-spill callback,
    // so the bootstrap passes the (originX, originY) it receives — not the
    // old hardcoded sky-top values.
    expect(bootstrap).toContain("dropOriginX: originX");
    expect(bootstrap).toContain("dropOriginY: originY");
    expect(bootstrap).toContain("jitterX: 22,");
    // Fragments are hidden until the basket spills, then physics releases
    // them at the basket mouth.
    expect(bootstrap).toContain("f.node.active = false;");
    expect(bootstrap).not.toContain("they reappear one by one");
    expect(bootstrap).not.toContain("interPieceDelayMs:");

    expect(pile).toContain("const M01_PHYSICS_LINEAR_DAMPING = 0.05;");
    expect(pile).toContain("const M01_PHYSICS_FIXED_TIME_STEP = 1 / 60;");
    expect(pile).toContain("const M01_PHYSICS_SETTLE_MAX_Y = 80;");
    expect(pile).toContain("const M01_PHYSICS_SKY_PILE_OFFSETS");
    expect(pile).toContain("{ x: -1, y: -34 }");
    expect(pile).toContain("{ x: 0.31, y: 72 }");
    expect(pile).toContain("private releaseAllPiecesFromSky(order: number[], rng: () => number): void");
    expect(pile).toContain("this.releaseAllPiecesFromSky(order, rng);");
    expect(pile).toContain("pileOffset.x * this.options.jitterX");
    expect(pile).toContain("this.options.dropOriginY + pileOffset.y + driftY");
    expect(pile).not.toContain("const spreadStep =");
    expect(pile).not.toContain("dropOriginX - this.options.jitterX + skyIndex * spreadStep");
    expect(pile).not.toContain("dropIndex * options.interPieceDelayMs");
    expect(pile).not.toContain("private dropOnePiece(");
  });

  it("drives M01 intro Lemmy through the identity-locked LemmyActor", () => {
    const intro = readText("assets/scripts/cocos/M01IntroSequence.ts");

    expect(intro).toContain('import { LemmyActor, isExpectedLemmyActionCancel } from "./LemmyActor.ts";');
    expect(intro).toContain("getM01GreyboxRuntimeLemmyResource");
    expect(intro).toContain('getM01GreyboxRuntimeLemmyResource("lemmy_canonical")?.resourcesLoadPath');
    expect(intro).not.toContain("partResourcePaths");
    expect(intro).not.toContain("lemmy_body");
    expect(intro).toContain("node.addComponent(LemmyActor)");
    // 顶篮 headbutt + 点哪走哪: 收耳→跳起顶篮→倒出, 自由走位经 roamLemmyTo(分段收耳, 取代旧 walkLemmyTo)。
    expect(intro).toContain("roamLemmyTo"); // 点哪走哪
    // 动作名断言不绑接收者(this.lemmyActor vs 局部 actor), 减少重构脆性。
    expect(intro).toContain('playFrameAction("earsback")'); // 收耳
    expect(intro).toContain('playFrameAction("headbutt"'); // 顶篮(帧自带腾空)
    expect(intro).toContain('this.advance("headbuttStarted")');
    expect(intro).toContain('this.advance("headbuttContact")');
    // 可重复顶篮(顶一下出一批、反复顶到全出): 子集释放 + readyToHeadbutt 回环 + 再顶。
    expect(intro).toContain("beginRepeatHeadbutt");
    expect(intro).toContain("HEADBUTT_PIECES_PER_HIT");
    expect(intro).toContain('this.advance("piecesRemain")');
    // 篮子被头从下顶起: 给独立 Verlet 软绳末端(篮子物理点)向上冲量 → 蹦起被绳拉住弹收敛, 竖直不旋转。
    expect(intro).toContain("BASKET_KICK_STRENGTH");
    expect(intro).not.toContain("BASKET_HEADBUTT_JOLT_DEG");
    // 篮子由绳末端物理点驱动(节点位移, 内胆/拼片跟随); 软绳=只拉不推 Verlet。
    expect(intro).toContain("spawnBasketRope");
    // 触发位置判定: 篮下点篮→顶篮; 不在篮下点篮→走近伸手够、【够不着】、篮子纹丝不动(spec §5.2 教学 beat)。
    expect(intro).toContain("isLemmyUnderBasket");
    expect(intro).toContain("LEMMY_HEADBUTT_UNDER_TOLERANCE");
    expect(intro).toContain("beginBasketReachMiss");
    // 够不着(2026-06-16 改): 复用原 reach 伸手(不挂 onEvent → reach_contact 落空、篮子零运动)+ 轻轻摇头。
    expect(intro).toContain('playFrameAction("reach", { facing: "right" })');
    expect(intro).toContain('playFrameAction("headshake"'); // 够不着 → 即梦摇头帧(取代旧引擎 tween)
    expect(intro).not.toContain('playFrameAction("reachmiss")'); // 旧 reachmiss 帧弃用(用户嫌不好看)
    expect(intro).not.toContain("gentleNudgeBasket"); // 旧"够到轻晃"路径已删(篮子只在被顶时受力)
    // 手电掉落砸头(startle)→ 蹲下捡起(crouch)叙事(spec §5.2)。
    expect(intro).toContain("spawnIntroFlashlight");
    expect(intro).toContain('playFrameAction(startleAction)'); // 砸头受惊(收耳→startleback, 立耳→startle)
    expect(intro).toContain('playFrameAction("crouch")'); // 蹲下拾起
    expect(intro).toContain('this.advance("flashlightBonked")');
    expect(intro).toContain('this.advance("crouchDone")');
    // 旧 reach/tip/脚本抛掷流程已移除。
    expect(intro).not.toContain('this.advance("reachContact")');
    expect(intro).not.toContain("BASKET_SPILL_FLING");
    expect(intro).not.toContain("REACH_HOLD_DURATION");
    expect(intro).not.toContain("swapSprite(this.lemmySprite");
    expect(intro).not.toContain('manifestId: "intro_lemmy_reaching"');
  });

  it("renders the real M01 intro fragments visible (solid) in the empty basket during the intro", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const startBlock = bootstrap.slice(
      bootstrap.indexOf("start(): void"),
      bootstrap.indexOf("onDestroy(): void")
    );
    const syncBlock = bootstrap.slice(
      bootstrap.indexOf("private syncVisualState"),
      bootstrap.indexOf("private shouldUseTextureBackedFragmentReveal")
    );

    expect(bootstrap).toContain("private introFragmentsReleased = true;");
    expect(startBlock).toContain("this.introFragmentsReleased = true;");
    expect(startBlock).toContain("this.introFragmentsReleased = false;");
    expect(startBlock).toContain("this.introFragmentsReleased = true;");
    // Empty-basket design: the real fragments sit staged & visible in the basket during the
    // intro (solid "normal" presentation), no longer hidden until spill.
    expect(syncBlock).toContain("const introStaged = !this.introFragmentsReleased;");
    expect(syncBlock).toContain("entry.node.active = !view.placed;");
    expect(syncBlock).not.toContain("this.introFragmentsReleased && !view.placed");
  });

  it("gives freely falling M01 fragments a subtle ground bounce", () => {
    const boundary = readText("assets/scripts/cocos/M01PhysicsBoundary.ts");
    const pile = readText("assets/scripts/cocos/M01PhysicsPile.ts");
    const groundBlock = boundary.slice(
      boundary.indexOf('"M01PhysicsGround"'),
      boundary.indexOf('this.spawnEdge(\n      "M01PhysicsLeftWall"')
    );

    expect(boundary).toContain("const M01_PHYSICS_GROUND_RESTITUTION = 0.12;");
    expect(boundary).toContain("const M01_PHYSICS_WALL_RESTITUTION = 0.05;");
    expect(boundary).toContain("const M01_PHYSICS_GROUND_FRICTION = 0.82;");
    expect(boundary).toContain("const M01_PHYSICS_WALL_FRICTION = 0.25;");
    expect(boundary).toContain("private spawnEdge(name: string, cx: number, cy: number, w: number, h: number, friction: number, restitution: number): void");
    expect(groundBlock).toContain("M01_PHYSICS_GROUND_FRICTION");
    expect(groundBlock).toContain("M01_PHYSICS_GROUND_RESTITUTION");
    expect(boundary).toContain("collider.friction = friction;");
    expect(boundary).toContain("collider.restitution = restitution;");
    expect(pile).toContain("const M01_PHYSICS_FRAGMENT_RESTITUTION = 0.08;");
    expect(pile).toContain("c.restitution = M01_PHYSICS_FRAGMENT_RESTITUTION;");
    expect(pile).not.toContain("c.restitution = 0.02;");
  });

  it("lets round M01 fragments roll out of unstable vertical stacks", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const pile = readText("assets/scripts/cocos/M01PhysicsPile.ts");

    expect(bootstrap).toContain("jitterX: 22,");
    expect(pile).toContain("const M01_PHYSICS_CIRCLE_FRICTION = 0.18;");
    expect(pile).toContain("const M01_PHYSICS_POLYGON_FRICTION = 0.6;");
    expect(pile).toContain("private resolveColliderFriction(shape: M01PhysicsShape): number");
    expect(pile).toContain("c.friction = this.resolveColliderFriction(frag.shape);");
    expect(pile).not.toContain("c.friction = 0.6;");
  });

  it("keeps pointer-controlled M01 fragments out of the physics solver", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("private activeFragmentDragOffset: M01GreyboxPoint | null = null;");
    expect(bootstrap).toContain("this.setFragmentPointerControl(node, true);");
    expect(bootstrap).toContain("this.parkFragmentBodyAtSnap(node);");
    expect(bootstrap).toContain("body.enabled = false;");
    expect(bootstrap).toContain("body.enabled = true;");
    expect(bootstrap).not.toContain("private updateActiveFragmentDragVelocity(): void");
    expect(bootstrap).not.toContain("M01_FRAGMENT_DRAG_MAX_VELOCITY");
    expect(bootstrap).not.toContain("(target.x - currentPos.x) / dt");
    expect(bootstrap).not.toContain("(target.y - currentPos.y) / dt");
  });

  it("preserves M01 fragment grab offset so pickup does not teleport into nearby pieces", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const beginDragBlock = bootstrap.slice(
      bootstrap.indexOf("private beginTokenDrag"),
      bootstrap.indexOf("private moveActivePointerDrag")
    );

    expect(beginDragBlock).toContain("this.activeFragmentDragOffset = {");
    expect(beginDragBlock).toContain("x: node.position.x - position.x");
    expect(beginDragBlock).toContain("y: node.position.y - position.y");
    expect(beginDragBlock).toContain(
      "this.tokenPositions.set(token.controllerId, this.pointFromNodePosition(node.position));"
    );
    expect(bootstrap).toContain("this.resolveActiveFragmentDragTarget(active.currentPosition)");
    expect(bootstrap).toContain("private resolveHeldFragmentPosition(pointerPosition: M01GreyboxPoint)");
    expect(bootstrap).toContain("private pointFromNodePosition");
  });

  it("lifts held M01 fragments out of physics collision while the pointer controls them", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const shim = readText("assets/scripts/cocos/cc-shim.d.ts");

    expect(bootstrap).toContain("CircleCollider2D");
    expect(bootstrap).toContain("PolygonCollider2D");
    expect(bootstrap).toContain("this.setFragmentPointerControl(node, true);");
    expect(bootstrap).toContain("private setFragmentPointerControl(fragmentNode: Node, controlledByPointer: boolean): void");
    expect(bootstrap).toContain("private setFragmentColliderEnabled(fragmentNode: Node, enabled: boolean): void");
    expect(bootstrap).toContain("body.enabled = false;");
    expect(bootstrap).toContain("body.enabled = true;");
    expect(bootstrap).toContain("collider.enabled = enabled;");
    expect(bootstrap).toContain("node.setPosition(target.x, target.y, 0);");
    expect(bootstrap).toContain("this.releaseFragmentBodyToPhysics(node);");
    expect(bootstrap).toContain("this.setFragmentPointerControl(fragmentNode, false);");
    expect(shim).toContain("enabled: boolean;");
  });

  it("releases freely dropped M01 fragments back into dynamic physics instead of parking midair", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const freeDropStart = bootstrap.indexOf('if (action.type === "place_fragment_freely")');
    const freeDropBlock = bootstrap.slice(
      freeDropStart,
      bootstrap.indexOf("this.redrawAndPersistManualTargetDraft();", freeDropStart)
    );
    const releaseBlock = bootstrap.slice(
      bootstrap.indexOf("private releaseFragmentBodyToPhysics"),
      bootstrap.indexOf("private setFragmentPointerControl")
    );

    expect(freeDropBlock).toContain("this.releaseFragmentBodyToPhysics(node);");
    expect(freeDropBlock).not.toContain("this.parkFragmentBodyAtSnap(node);");
    expect(releaseBlock).toContain("this.setFragmentPointerControl(fragmentNode, false);");
    expect(releaseBlock).toContain("body.type = ERigidBody2DType.Dynamic;");
  });

  it("does not draw duplicate greybox fragment geometry over art-preview selected pieces", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const underlayBlock = bootstrap.slice(
      bootstrap.indexOf("function shouldRenderArtPreviewUnderlay"),
      bootstrap.indexOf("function strokeColorForArtPreview")
    );
    const fragmentBlock = underlayBlock.slice(
      underlayBlock.indexOf('if (token.kind === "fragment")'),
      underlayBlock.indexOf('if (token.kind !== "slot"')
    );

    expect(fragmentBlock).toContain("return false;");
    expect(fragmentBlock).not.toContain('presentation !== "normal" && presentation !== "placed"');
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

    expect(bootstrap).toContain("CCBoolean");
    expect(bootstrap).toContain("@property({ type: CCBoolean })");
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
    expect(bootstrap).not.toContain("minimalArtPreview");
    expect(bootstrap).not.toContain("buildM01GreyboxRuntimeTransparentPlan");
    expect(bootstrap).not.toContain("resources.load(slice.file");
  });

  it("ignores stale async art sprite load callbacks after a fragment sprite changes", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("const requestedPath = resource.resourcesLoadPath");
    expect(bootstrap).toContain("this.artSpriteResourcePaths.set(sprite, requestedPath)");
    expect(bootstrap).toContain("this.artSpriteResourcePaths.get(sprite) !== requestedPath");
    expect(bootstrap).toContain("resources.load(requestedPath, SpriteFrame");
  });

  it("keeps light-edge overlay visibility controlled by reveal state, not async loading", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("activateOnLoad?: boolean");
    expect(bootstrap).toContain("const activateOnLoad = options?.activateOnLoad ?? true");
    expect(bootstrap).toContain("if (activateOnLoad) {\n        sprite.node.active = true;\n      }");
    expect(bootstrap).toContain(
      "this.syncArtSpriteFrameToResource(sprite, token, resource, { activateOnLoad: false });"
    );
  });

  it("allows preview links to opt into M01 art-preview mode", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("shouldEnableM01ArtPreviewFromUrl");
    expect(bootstrap).toContain('searchParams.get("m01ArtPreview") === "1"');
    expect(bootstrap).toContain("this.enableArtPreview || shouldEnableM01ArtPreviewFromUrl()");
  });

  it("can rotate and tint static art-preview layers for visual alignment", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const art = readText("assets/scripts/cocos/M01GreyboxArt.ts");

    expect(art).toContain("rotationDegrees?: number");
    expect(art).toContain("tintColor?:");
    expect(bootstrap).toContain("layerNode.setRotationFromEuler(0, 0, layer.rotationDegrees)");
    expect(bootstrap).toContain("sprite.color = new Color");
  });

  it("syncs token-level art sprites with greybox presentation state", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("artSprite: Sprite | null");
    expect(bootstrap).toContain("private syncArtSpriteState");
    expect(bootstrap).toContain("this.syncArtSpriteState(entry.artSprite");
    expect(bootstrap).toContain("sprite.color = colorForArtSprite(presentation, token, colorTokenOverride)");
    expect(bootstrap).toContain('token?.kind === "fragment"');
    expect(bootstrap).toContain('dimmed: new Color(255, 255, 255, 56)');
    expect(bootstrap).toContain('placed: new Color(255, 255, 255, 0)');
  });

  it("uses observed flashlight blend colors when redrawing M01 fragments", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const session = readText("assets/scripts/cocos/M01GreyboxSession.ts");

    expect(bootstrap).toContain("view.observedColor");
    expect(bootstrap).toContain("colorTokenOverride");
    expect(bootstrap).toContain("shouldUseTextureBackedFragmentReveal");
    expect(bootstrap).toContain("textureBackedFragmentReveal ? \"normal\" : presentation");
    expect(bootstrap).toContain("textureBackedFragmentReveal ? undefined : fragmentColorOverride");
    // 观察显色的有效期模型保留在 Session(显色模型 KEEP); bootstrap 端的旧定时刷新随旧路径删除,
    // 由后续覆盖面玩法在莱米移动/换色时重算取代。
    expect(session).toContain("M01_OBSERVED_REVEAL_MS");
    expect(session).toContain("observedFragmentColors");
    expect(bootstrap).not.toContain("ObservedResetScheduler");
    expect(bootstrap).not.toContain("scheduleObservedColorReset");
  });

  it("keeps translucent hidden fragment sprites while tinting observed flashlight colors", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const art = readText("assets/scripts/cocos/M01GreyboxArt.ts");

    expect(bootstrap).toContain("this.syncArtSpriteFrame(sprite, token, colorTokenOverride);");
    expect(bootstrap).toContain("sprite.color = colorForArtSprite(presentation, token, colorTokenOverride)");
    expect(bootstrap).toContain("const OBSERVED_FRAGMENT_TINT_ALPHA = 255;");
    expect(art).toContain("M01_GREYBOX_RUNTIME_LIGHT_MASK_FRAGMENT_RESOURCES");
    expect(art).toContain("m01-fragment-light-mask-circle.png");
    expect(art).toContain("m01-fragment-light-mask-triangle.png");
    expect(art).toContain("m01-fragment-light-mask-hexagon.png");
    expect(art).toContain("M01_GREYBOX_RUNTIME_LIGHT_EDGE_FRAGMENT_RESOURCES");
    expect(art).toContain("m01-fragment-light-edge-circle.png");
    expect(bootstrap).toContain("M01ArtSpriteEdge_");
    expect(bootstrap).toContain("this.syncArtEdgeSpriteState(entry.artEdgeSprite");
    expect(bootstrap).toContain("const M01_BASE_RGB: Record");
    expect(bootstrap).toContain("const M01_BEAM_RGB: Record");
    expect(bootstrap).toContain("function multiplyRgb");
    expect(bootstrap).toContain(
      "const OBSERVED_FRAGMENT_TINT_COLORS: Record<M01BlendColor, [number, number, number]> = {"
    );
    expect(bootstrap).toContain("yellow: multiplyRgb(M01_BASE_RGB.yellow, M01_BEAM_RGB.yellow)");
    expect(bootstrap).toContain("orange: M01_TARGET_BLEND_RGB.orange");
    expect(bootstrap).toContain("blue:   multiplyRgb(M01_BASE_RGB.blue,   M01_BEAM_RGB.blue)");
    expect(bootstrap).toContain("green:  M01_TARGET_BLEND_RGB.green");
    expect(bootstrap).toContain("purple: M01_TARGET_BLEND_RGB.purple");
    expect(bootstrap).toContain("function colorForObservedFragmentTint(colorToken: M01BlendColor): Color");
    expect(bootstrap).toContain("return colorForObservedFragmentTint(colorTokenOverride);");
    expect(bootstrap).toContain(
      "return new Color(r, g, b, OBSERVED_FRAGMENT_TINT_ALPHA);"
    );
    expect(bootstrap).not.toContain(
      "return withAlpha(colorForToken(colorTokenOverride, token.kind, presentation), OBSERVED_FRAGMENT_TINT_ALPHA)"
    );
    expect(bootstrap).not.toContain(
      "getM01GreyboxRuntimeSpriteResourceForToken(token, colorTokenOverride)"
    );
  });

  it("matches observed flashlight blend tint colors to the M01 target evidence palette", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("const M01_TARGET_BLEND_RGB");
    expect(bootstrap).toContain("purple: [167, 140, 166]");
    expect(bootstrap).toContain("green: [136, 166, 138]");
    expect(bootstrap).toContain("orange: [206, 154, 114]");
    expect(bootstrap).toContain("orange: M01_TARGET_BLEND_RGB.orange");
    expect(bootstrap).toContain("green:  M01_TARGET_BLEND_RGB.green");
    expect(bootstrap).toContain("purple: M01_TARGET_BLEND_RGB.purple");
    expect(bootstrap).toContain("colorForTargetBlendRgb(colorToken)");
  });

  it("uses failed-validation flash colors when redrawing staged M01 fragments", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("view.validationColor");
    expect(bootstrap).toContain("validationFlashVisible");
    expect(bootstrap).toContain("validationColor ?? view.observedColor");
    expect(bootstrap).toContain("view.validationColor && !this.validationFlashVisible");
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
    expect(bootstrap).toContain(
      'Boolean(colorTokenOverride) && token.kind !== "evidence" && token.kind !== "fragment"'
    );
    expect(bootstrap).toContain('token.kind === "board"');
    expect(bootstrap).toContain('if (token.kind === "evidence")');
    expect(bootstrap).toContain('if (token.kind === "fragment")');
    expect(bootstrap).toContain('presentation !== "normal" && presentation !== "repaired"');
    expect(bootstrap).toContain("new Color(0, 0, 0, 0)");
  });

  it("uses runtime watercolor sprites for M01 standard pieces in art preview", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("getM01GreyboxRuntimeSpriteResourceForToken(token)");
    expect(bootstrap).not.toContain("getM01GreyboxRuntimeSpriteResourceForToken(token, colorTokenOverride)");
    expect(bootstrap).toContain("validationColor ?? view.observedColor");
    expect(bootstrap).toContain("shouldUseTextureBackedFragmentReveal");
    expect(bootstrap).not.toContain('if (isM01StandardPieceToken(token)) {\n      return null;\n    }');
    expect(bootstrap).toContain('if (token.kind === "fragment")');
    expect(bootstrap).not.toContain('presentation !== "normal" && presentation !== "placed"');
  });

  it("keeps M01 overlap evidence as layout-only snap data plus non-token target display", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const art = readText("assets/scripts/cocos/M01GreyboxArt.ts");

    expect(bootstrap).not.toContain("for (const evidence of layout.evidence) {\n      this.addShapeNode(this.greyboxRoot, evidence);\n    }");
    expect(bootstrap).toContain("buildM01GreyboxTargetOverlapEvidencePlan");
    expect(bootstrap).toContain('if (token.kind === "evidence")');
    expect(bootstrap).toContain("return false");
    expect(bootstrap).toContain('if (token.kind === "evidence") {\n      return null;\n    }');
    expect(art).toContain(".filter((token) => token.kind !== \"evidence\")");
  });

  it("locks the exact M01 hand-composed target export", () => {
    const drag = readText("assets/scripts/cocos/M01GreyboxDrag.ts");
    const layout = readText("assets/scripts/cocos/M01GreyboxLayout.ts");
    const config = JSON.parse(readText("assets/resources/configs/stage1/m01-memory-gear.json")) as {
      targetPattern?: { pieces?: Array<{ fragmentId?: string }>; locked?: boolean; note?: string };
      evidence?: Array<{ id?: string; targetBlendColor?: string; solution?: { fragmentIds?: string[] } }>;
      fragments?: Array<{ id?: string; tags?: string[] }>;
    };

    expect(layout).toContain("targetPieceSlots");
    expect(layout).toContain("targetPattern");
    expect(layout).not.toContain('targetPieceSnapZone("target_piece_circle_left"');
    expect(drag).toContain("resolveTargetPieceSlotDrop");
    expect(drag).toContain("snap_fragment_to_target_piece");
    expect(drag).toContain("slot.expectedFragmentId === token.controllerId");
    expect(drag).toContain("rotation: bestSlot.rotation");
    expect(drag).toContain("shape:${slot.shapeToken}");
    expect(config.targetPattern?.locked).toBe(true);
    expect(config.targetPattern?.pieces).toHaveLength(6);
    expect(config.targetPattern?.note).toContain("2026-05-07 exact manual target export");
    expect(config.evidence).toHaveLength(6);
    expect(config.evidence?.every((evidence) => evidence.id?.startsWith("current_manual_target_")))
      .toBe(true);
    expect(config.evidence?.map((evidence) => evidence.targetBlendColor)).toEqual([
      "green",
      "orange",
      "orange",
      "purple",
      "green",
      "purple"
    ]);
    const solutionFragmentIds = new Set(
      config.evidence?.flatMap((evidence) => evidence.solution?.fragmentIds ?? []) ?? []
    );
    const decoySolutionFragments = (config.fragments ?? []).filter(
      (fragment) => fragment.id && solutionFragmentIds.has(fragment.id) && fragment.tags?.includes("decoy")
    );
    expect(decoySolutionFragments).toEqual([]);
  });

  it("keeps the old M01 target guide art off the repair platform", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");
    const art = readText("assets/scripts/cocos/M01GreyboxArt.ts");
    const layout = readText("assets/scripts/cocos/M01GreyboxLayout.ts");

    expect(layout).toContain("M01_STANDARD_PIECE_DISPLAY_SIZE");
    expect(layout).toContain("M01_TARGET_REFERENCE_PIECE_SLOT_SIZE: M01GreyboxSize = M01_STANDARD_PIECE_DISPLAY_SIZE");
    expect(art).not.toContain("position: layout.gear.position");
    expect(art).not.toContain("size: M01_TARGET_REFERENCE_DISPLAY_SIZE");
    expect(art).not.toContain("spriteSize: M01_TARGET_REFERENCE_DISPLAY_SIZE");
    expect(art).toContain("buildM01GreyboxTargetOverlapEvidencePlan");
    expect(art).not.toContain("getM01GreyboxStandardPieceResourceForShape");
    expect(bootstrap).toContain("renderTargetOverlapEvidence");
    expect(bootstrap).toContain("M01TargetOverlapEvidence_${overlap.evidenceId}");
    expect(art).toContain("target_reference_card");
    expect(bootstrap).toContain('if (token.kind === "evidence") {\n      return null;\n    }');
    expect(bootstrap).not.toContain("addTargetReferenceCircleFrame(layerNode, layer.size)");
  });

  it("flashes failed M01 candidates twice in true fragment colors before returning pieces", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("VALIDATION_FAILURE_FLASH_COUNT = 2");
    expect(bootstrap).toContain("validationFlashVisible");
    expect(bootstrap).toContain("scheduleFailedCandidateReturn");
    expect(bootstrap).toContain("resetWeakSnappedCandidate");
    expect(bootstrap).toContain("this.session.resetCandidateStructure()");
  });

  it("restores art preview underlays as a fallback when required art fails to load", () => {
    const bootstrap = readText("assets/scripts/cocos/M01GreyboxBootstrap.ts");

    expect(bootstrap).toContain("artPreviewFallbackUnderlayIds");
    expect(bootstrap).toContain("markArtPreviewUnderlayFallback(token.controllerId)");
    expect(bootstrap).toContain("markStaticArtPreviewUnderlayFallback(layer.id)");
    expect(bootstrap).toContain("this.artPreviewFallbackUnderlayIds.has(token.controllerId)");
    expect(bootstrap).toContain("(this.layout.slots ?? []).map((slot) => slot.controllerId)");
    expect(bootstrap).toContain('layerId === "nineSlotTray"');
    expect(bootstrap).toContain('layerId === "targetReferenceCard"');
    expect(bootstrap).toContain('!renderUnderlay && token.kind === "reference_pattern"');
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
