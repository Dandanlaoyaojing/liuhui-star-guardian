import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import {
  buildRealInputPlan,
  localPointToPagePoint
} from "./m01-preview-smoke-helpers.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(rootDir, "assets/resources/configs/stage1/m01-memory-gear.json");
const playwrightCacheDir = resolve(homedir(), "Library/Caches/ms-playwright");
const browserCandidates = [
  process.env.M01_SMOKE_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  resolve(
    playwrightCacheDir,
    "chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell"
  ),
  resolve(playwrightCacheDir, "chromium-1208/chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium")
].filter(Boolean);
const sceneUrl =
  process.env.M01_PREVIEW_URL ??
  "http://127.0.0.1:7456/?scene=a2135734-fc11-4a0e-926d-40bc2301a752";
const chromePath = browserCandidates.find((candidate) => existsSync(candidate));
const screenshotDir = resolve(rootDir, "temp");
const requireBrowserInput = process.argv.includes("--require-browser-input");
const captureCleanQa = process.argv.includes("--capture-clean-qa");
const enableArtPreview = process.argv.includes("--enable-art-preview");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeRotation(rotation) {
  return ((rotation % 360) + 360) % 360;
}

function rotationDistance(left, right) {
  const delta = Math.abs(normalizeRotation(left) - normalizeRotation(right));
  return Math.min(delta, 360 - delta);
}

async function readConfig() {
  return JSON.parse(await readFile(configPath, "utf8"));
}

async function hidePreviewChrome(page) {
  await page.addStyleTag({
    content: `
      .toolbar,
      .preview-toolbar,
      .preview-debug,
      .debug-panel,
      .stats,
      [class*="toolbar"],
      [class*="debug"],
      [class*="stats"] {
        display: none !important;
        visibility: hidden !important;
      }
      body {
        margin: 0 !important;
        overflow: hidden !important;
        background: #f6f0e5 !important;
      }
    `
  });
  await page.evaluate(() => {
    window.cc?.debug?.setDisplayStats?.(false);
    window.cc?.profiler?.hideStats?.();
  });
}

async function captureCleanQaScreenshot(page, { artPreview = false } = {}) {
  await hidePreviewChrome(page);
  const cleanQaScreenshotPath = resolve(
    screenshotDir,
    artPreview ? "m01-art-preview-clean-qa.png" : "m01-preview-clean-qa.png"
  );
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  await canvas.screenshot({ path: cleanQaScreenshotPath });
  return cleanQaScreenshotPath;
}

async function assertNoPrematureToolCard(page) {
  const hasToolCard = await page.evaluate(() => {
    const cc = window.cc;
    const scene = cc && cc.director ? cc.director.getScene() : undefined;
    function findNode(node, name) {
      if (!node) {
        return undefined;
      }
      if (node.name === name) {
        return node;
      }
      for (const child of node.children ?? []) {
        const found = findNode(child, name);
        if (found) {
          return found;
        }
      }
      return undefined;
    }

    return Boolean(findNode(scene, "M01ToolCardPreview")?.active);
  });

  assert(hasToolCard === false, "ToolCard preview should stay hidden before completion.");
}

async function enableArtPreviewMode(page) {
  const artPreviewState = await page.evaluate(async () => {
    const cc = window.cc;
    const scene = cc && cc.director ? cc.director.getScene() : undefined;
    function findNode(node, name) {
      if (!node) {
        return undefined;
      }
      if (node.name === name) {
        return node;
      }
      for (const child of node.children ?? []) {
        const found = findNode(child, name);
        if (found) {
          return found;
        }
      }
      return undefined;
    }
    function flattenNames(node, names = []) {
      if (!node) {
        return names;
      }
      names.push(node.name);
      for (const child of node.children ?? []) {
        flattenNames(child, names);
      }
      return names;
    }
    const root = findNode(scene, "M01GreyboxRoot");
    const bootstrap = root?.components?.find(
      (component) => component.constructor?.name === "M01GreyboxBootstrap"
    );
    if (!bootstrap?.layout || !bootstrap?.renderGreybox || !bootstrap?.syncVisualState) {
      throw new Error("M01GreyboxBootstrap cannot re-render art preview mode.");
    }

    bootstrap.enableArtPreview = true;
    bootstrap.greyboxRoot?.destroy?.();
    bootstrap.toolCardRoot = null;
    bootstrap.hintButtonRoot = null;
    bootstrap.feedbackLabel = null;
    bootstrap.greyboxNodes?.clear?.();
    bootstrap.tokenPositions?.clear?.();
    bootstrap.artPreviewFallbackUnderlayIds?.clear?.();
    bootstrap.renderGreybox(bootstrap.layout);
    bootstrap.syncVisualState();
    await new Promise((resolve) => setTimeout(resolve, 700));

    const names = flattenNames(scene);
    const staticArtNames = names.filter((name) => name.startsWith("M01StaticArt_"));
    const targetOverlapEvidenceNodes = names.filter((name) =>
      name.startsWith("M01TargetOverlapEvidence_current_manual_target_")
    );
    return {
      enabled: bootstrap.enableArtPreview === true,
      artSpriteCount: names.filter((name) => name.startsWith("M01ArtSprite_")).length,
      staticArtCount: staticArtNames.length,
      hasOldTargetReferenceCard: names.includes("M01StaticArt_targetReferenceCard"),
      hasSingleFlashlightTool: names.includes("M01StaticArt_singleFlashlightTool"),
      hasFragmentFloor: names.includes("M01StaticArt_fragmentFloor"),
      targetOverlapEvidenceNodes,
      expectedTargetOverlapEvidenceCount: bootstrap.layout.evidence.filter(
        (evidence) => (evidence.magnetPolygon?.length ?? 0) >= 3
      ).length
    };
  });

  assert(artPreviewState.enabled, "Expected M01 art preview toggle to be enabled.");
  assert(
    artPreviewState.artSpriteCount > 0,
    "Expected art preview mode to render token-level art sprites."
  );
  assert(
    artPreviewState.hasOldTargetReferenceCard === false,
    "Expected art preview mode to omit the old target reference card from the platform."
  );
  assert(
    artPreviewState.hasSingleFlashlightTool,
    "Expected art preview mode to render the single three-button flashlight tool."
  );
  assert(
    artPreviewState.hasFragmentFloor === false,
    "Expected art preview mode to omit the floor platform surface."
  );
  assert(
    artPreviewState.targetOverlapEvidenceNodes.length ===
      artPreviewState.expectedTargetOverlapEvidenceCount,
    `Expected art preview mode to render target overlap evidence nodes; found ${artPreviewState.targetOverlapEvidenceNodes.join(", ")}.`
  );
  return artPreviewState;
}

export function buildWrongCandidate(config) {
  const pairs = Object.fromEntries(
    config.evidence.map((evidence) => [evidence.id, [...evidence.solution.fragmentIds]])
  );
  if (pairs.evidence_purple_upper_left) {
    pairs.evidence_purple_upper_left = [
      "fragment_circle_red_1",
      "fragment_triangle_yellow_2"
    ];
  } else {
    const firstEvidence = config.evidence[0];
    const firstPair = pairs[firstEvidence.id];
    const firstPairShapes = firstEvidence.shapeTags.map((tag) => tag.replace("shape:", ""));
    const replacementPair = findWrongShapeCompatiblePair(
      config.fragments ?? [],
      firstPairShapes,
      firstPair
    );
    pairs[firstEvidence.id] = replacementPair;
  }
  return pairs;
}

function findWrongShapeCompatiblePair(fragments, shapeTokens, solutionPair) {
  for (let firstIndex = 0; firstIndex < fragments.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < fragments.length; secondIndex += 1) {
      const pair = [fragments[firstIndex], fragments[secondIndex]];
      const pairIds = pair.map((fragment) => fragment.id);
      if (sameUnorderedPair(pairIds, solutionPair)) {
        continue;
      }
      if (pairMatchesShapeTokens(pair, shapeTokens)) {
        return pairIds;
      }
    }
  }

  throw new Error("Need a shape-compatible decoy pair to build a wrong candidate.");
}

function pairMatchesShapeTokens(pair, shapeTokens) {
  const availableShapes = pair.map((fragment) => fragment.shape ?? fragment.edgeShape);
  return shapeTokens.every((shape) => {
    const index = availableShapes.indexOf(shape);
    if (index === -1) {
      return false;
    }
    availableShapes.splice(index, 1);
    return true;
  });
}

function sameUnorderedPair(left, right) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

async function snapshotRuntime(page) {
  return page.evaluate(() => {
    const cc = window.cc;
    const scene = cc && cc.director ? cc.director.getScene() : undefined;
    function findNode(node, name) {
      if (!node) {
        return undefined;
      }
      if (node.name === name) {
        return node;
      }
      for (const child of node.children ?? []) {
        const found = findNode(child, name);
        if (found) {
          return found;
        }
      }
      return undefined;
    }
    function flattenNames(node, names = []) {
      if (!node) {
        return names;
      }
      names.push(node.name);
      for (const child of node.children ?? []) {
        flattenNames(child, names);
      }
      return names;
    }
    const root = findNode(scene, "M01GreyboxRoot");
    const bootstrap = root?.components?.find(
      (component) => component.constructor?.name === "M01GreyboxBootstrap"
    );
    const statusNode = findNode(scene, "M01StatusLabel");
    const statusLabel = statusNode ? statusNode.getComponent(cc.Label)?.string : undefined;
    return {
      sceneName: scene?.name,
      nodeNames: flattenNames(scene),
      statusLabel,
      hasBootstrap: Boolean(bootstrap),
      bootstrapKeys: bootstrap ? Object.keys(bootstrap) : []
    };
  });
}

async function runFailureValidation(page, wrongPairs) {
  return page.evaluate(async ({ stagedPairs }) => {
    const cc = window.cc;
    const scene = cc.director.getScene();
    function findNode(node, name) {
      if (node.name === name) {
        return node;
      }
      for (const child of node.children ?? []) {
        const found = findNode(child, name);
        if (found) {
          return found;
        }
      }
      return undefined;
    }
    const root = findNode(scene, "M01GreyboxRoot");
    const bootstrap = root.components.find(
      (component) => component.constructor?.name === "M01GreyboxBootstrap"
    );
    if (!bootstrap?.session) {
      throw new Error("M01GreyboxBootstrap session is unavailable in preview runtime.");
    }

    for (const [evidenceId, fragmentIds] of Object.entries(stagedPairs)) {
      bootstrap.session.submitEvidencePair(evidenceId, fragmentIds);
    }
    const validation = bootstrap.session.validateCandidateStructure();
    bootstrap.syncVisualState();
    bootstrap.scheduleValidationLightReset?.(
      validation.validationLightSeconds,
      validation.completed
    );

    const stagedFragmentId = Object.values(stagedPairs)[0][0];
    const duringFlash = bootstrap.session.getFragmentView(stagedFragmentId);
    const statusDuringNode = findNode(scene, "M01StatusLabel");
    const statusDuringFlash = statusDuringNode
      ? statusDuringNode.getComponent(cc.Label)?.string
      : undefined;
    await new Promise((resolve) => setTimeout(resolve, 2200));
    bootstrap.syncVisualState();
    const afterFlash = bootstrap.session.getFragmentView(stagedFragmentId);
    const statusAfterNode = findNode(scene, "M01StatusLabel");
    const statusAfterFlash = statusAfterNode
      ? statusAfterNode.getComponent(cc.Label)?.string
      : undefined;

    return {
      validation,
      stagedFragmentId,
      duringFlash,
      afterFlash,
      statusDuringFlash,
      statusAfterFlash
    };
  }, { stagedPairs: wrongPairs });
}

async function runRealInputPath(page, realInputPlan) {
  const snapshotInteractionState = async (step) =>
    page.evaluate(({ realInputPlan, step }) => {
      const cc = window.cc;
      const scene = cc && cc.director ? cc.director.getScene() : undefined;
      function findNode(node, name) {
        if (!node) {
          return undefined;
        }
        if (node.name === name) {
          return node;
        }
        for (const child of node.children ?? []) {
          const found = findNode(child, name);
          if (found) {
            return found;
          }
        }
        return undefined;
      }
      const root = findNode(scene, "M01GreyboxRoot");
      const bootstrap = root?.components?.find(
        (component) => component.constructor?.name === "M01GreyboxBootstrap"
      );
      const session = bootstrap?.session;
      const tokenPositions = bootstrap?.tokenPositions;
      const tokenRotations = bootstrap?.tokenRotations;
      const statusNode = findNode(scene, "M01StatusLabel");
      return {
        step,
        activeFlashlightId: bootstrap?.activeFlashlightId,
        activeFlashlightColor: bootstrap?.activeFlashlightColor,
        heldFlashlightId: bootstrap?.heldFlashlightId,
        heldFragmentId: bootstrap?.heldFragmentId,
        flashlightPosition: tokenPositions
          ? tokenPositions.get(realInputPlan.flashlightId)
          : undefined,
        beamAnchor: bootstrap?.flashlightBeamAnchor,
        beamTarget: bootstrap?.flashlightBeamTarget,
        flashlightBeamLit: bootstrap?.flashlightBeamLit,
        observedColor: session
          ? session.getFragmentView(realInputPlan.revealFragmentId).observedColor
          : undefined,
        freePlacementPosition: tokenPositions
          ? tokenPositions.get(realInputPlan.freePlacement.fragmentId)
          : undefined,
        stageFragmentPositions: Object.fromEntries(
          realInputPlan.stageEvidence.fragmentIds.map((fragmentId) => [
            fragmentId,
            tokenPositions ? tokenPositions.get(fragmentId) : undefined
          ])
        ),
        stageFragmentRotations: Object.fromEntries(
          realInputPlan.stageEvidence.fragmentIds.map((fragmentId) => [
            fragmentId,
            tokenRotations ? tokenRotations.get(fragmentId) : undefined
          ])
        ),
        isEvidenceStaged: session
          ? session.isEvidenceStaged(realInputPlan.stageEvidence.evidenceId)
          : undefined,
        status: statusNode ? statusNode.getComponent(cc.Label)?.string : undefined
      };
    }, { realInputPlan, step });

  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  const canvasBox = await canvas.boundingBox();
  assert(canvasBox, "Preview canvas is unavailable for real-input smoke.");
  const toPagePoint = (localPoint) =>
    localPointToPagePoint(canvasBox, realInputPlan.canvasSize, localPoint);
  const debugSteps = [];
  const moveMouseToLocalPoint = async (localPoint, options = {}) => {
    const pagePoint = toPagePoint(localPoint);
    await page.mouse.move(pagePoint.x, pagePoint.y, options);
    return pagePoint;
  };
  const dragLocalPoint = async (fromLocalPoint, toLocalPoint) => {
    await moveMouseToLocalPoint(fromLocalPoint);
    await page.mouse.down();
    await page.waitForTimeout(24);
    await moveMouseToLocalPoint(toLocalPoint, { steps: 10 });
    await page.waitForTimeout(40);
    await page.mouse.up();
    await page.waitForTimeout(180);
  };
  const clickLocalPoint = async (localPoint) => {
    await moveMouseToLocalPoint(localPoint);
    await page.mouse.down();
    await page.waitForTimeout(24);
    await page.mouse.up();
    await page.waitForTimeout(120);
  };
  const runHeldFlashlightRevealPath = async () => {
    await clickLocalPoint(realInputPlan.flashlightPosition);
    debugSteps.push(await snapshotInteractionState("after_flashlight_picker_open"));
    await clickLocalPoint(realInputPlan.flashlightPickerRedPosition);
    debugSteps.push(await snapshotInteractionState("after_flashlight_picker_select"));
    await moveMouseToLocalPoint(realInputPlan.heldFlashlightPosition, { steps: 8 });
    await page.waitForTimeout(80);
    debugSteps.push(await snapshotInteractionState("after_held_flashlight_move"));
    await moveMouseToLocalPoint(realInputPlan.revealFragmentPosition, { steps: 10 });
    await page.waitForTimeout(80);
    await page.waitForTimeout(140);
    debugSteps.push(await snapshotInteractionState("after_held_flashlight_shine"));
  };
  await runHeldFlashlightRevealPath();

  await dragLocalPoint(
    realInputPlan.freePlacement.fragmentPosition,
    realInputPlan.freePlacement.dropPosition
  );
  debugSteps.push(await snapshotInteractionState("after_free_fragment_drag"));

  const runtimeFragmentPositions = await page.evaluate(() => {
    const cc = window.cc;
    const scene = cc && cc.director ? cc.director.getScene() : undefined;
    function findNode(node, name) {
      if (!node) {
        return undefined;
      }
      if (node.name === name) {
        return node;
      }
      for (const child of node.children ?? []) {
        const found = findNode(child, name);
        if (found) {
          return found;
        }
      }
      return undefined;
    }
    const root = findNode(scene, "M01GreyboxRoot");
    const bootstrap = root?.components?.find(
      (component) => component.constructor?.name === "M01GreyboxBootstrap"
    );
    if (!bootstrap?.layout?.fragments) {
      throw new Error("M01GreyboxBootstrap layout is unavailable in preview runtime.");
    }
    return Object.fromEntries(
      bootstrap.layout.fragments.map((fragment) => [fragment.controllerId, fragment.position])
    );
  });

  for (const fragmentId of realInputPlan.stageEvidence.fragmentIds) {
    const fragmentPosition = runtimeFragmentPositions[fragmentId];
    assert(fragmentPosition, `Missing fragment layout position for real-input step: ${fragmentId}`);
    const targetPiece = realInputPlan.stageEvidence.targetPieces?.find(
      (piece) => piece.fragmentId === fragmentId
    );
    await dragLocalPoint(
      fragmentPosition,
      targetPiece?.targetPosition ?? realInputPlan.stageEvidence.evidencePosition
    );
    debugSteps.push(await snapshotInteractionState(`after_stage_drag:${fragmentId}`));
  }

  return page.evaluate(({ realInputPlan }) => {
    const cc = window.cc;
    const scene = cc && cc.director ? cc.director.getScene() : undefined;
    function findNode(node, name) {
      if (!node) {
        return undefined;
      }
      if (node.name === name) {
        return node;
      }
      for (const child of node.children ?? []) {
        const found = findNode(child, name);
        if (found) {
          return found;
        }
      }
      return undefined;
    }
    const root = findNode(scene, "M01GreyboxRoot");
    const bootstrap = root?.components?.find(
      (component) => component.constructor?.name === "M01GreyboxBootstrap"
    );
    if (!bootstrap?.session) {
      throw new Error("M01GreyboxBootstrap session is unavailable in preview runtime.");
    }
    const tokenPositions = bootstrap.tokenPositions;
    const tokenRotations = bootstrap.tokenRotations;

    const freePosition = tokenPositions ? tokenPositions.get(realInputPlan.freePlacement.fragmentId) : undefined;
    const stageFragmentPositions = Object.fromEntries(
      realInputPlan.stageEvidence.fragmentIds.map((fragmentId) => [
        fragmentId,
        tokenPositions ? tokenPositions.get(fragmentId) : undefined
      ])
    );
    const stageFragmentRotations = Object.fromEntries(
      realInputPlan.stageEvidence.fragmentIds.map((fragmentId) => [
        fragmentId,
        tokenRotations ? tokenRotations.get(fragmentId) : undefined
      ])
    );

    return {
      activeFlashlightId: bootstrap.activeFlashlightId,
      activeFlashlightColor: bootstrap.activeFlashlightColor,
      heldFlashlightId: bootstrap.heldFlashlightId,
      heldFragmentId: bootstrap.heldFragmentId,
      flashlightPosition: tokenPositions ? tokenPositions.get(realInputPlan.flashlightId) : undefined,
      beamAnchor: bootstrap.flashlightBeamAnchor,
      beamTarget: bootstrap.flashlightBeamTarget,
      flashlightBeamLit: bootstrap.flashlightBeamLit,
      observedColor:
        bootstrap.session.getFragmentView(realInputPlan.revealFragmentId).observedColor,
      freePlacement: {
        fragmentId: realInputPlan.freePlacement.fragmentId,
        position: freePosition
      },
      stagedEvidenceId: realInputPlan.stageEvidence.evidenceId,
      isEvidenceStaged: bootstrap.session.isEvidenceStaged(realInputPlan.stageEvidence.evidenceId),
      areAllEvidenceStaged: bootstrap.session.areAllEvidenceStaged(),
      stageFragmentPositions,
      stageFragmentRotations
    };
  }, { realInputPlan }).then((result) => ({ ...result, debugSteps }));
}

async function runCompletionInputPath(page, realInputPlan) {
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  const canvasBox = await canvas.boundingBox();
  assert(canvasBox, "Preview canvas is unavailable for completion smoke.");
  const toPagePoint = (localPoint) =>
    localPointToPagePoint(canvasBox, realInputPlan.canvasSize, localPoint);
  const moveMouseToLocalPoint = async (localPoint, options = {}) => {
    const pagePoint = toPagePoint(localPoint);
    await page.mouse.move(pagePoint.x, pagePoint.y, options);
  };
  const dragLocalPoint = async (fromLocalPoint, toLocalPoint) => {
    await moveMouseToLocalPoint(fromLocalPoint);
    await page.mouse.down();
    await page.waitForTimeout(24);
    await moveMouseToLocalPoint(toLocalPoint, { steps: 10 });
    await page.waitForTimeout(40);
    await page.mouse.up();
    await page.waitForTimeout(120);
  };
  const clickLocalPoint = async (localPoint) => {
    await moveMouseToLocalPoint(localPoint);
    await page.mouse.down();
    await page.waitForTimeout(24);
    await page.mouse.up();
    await page.waitForTimeout(120);
  };
  const currentFragmentPosition = async (fragmentId) =>
    page.evaluate((fragmentId) => {
      const cc = window.cc;
      const scene = cc && cc.director ? cc.director.getScene() : undefined;
      function findNode(node, name) {
        if (!node) {
          return undefined;
        }
        if (node.name === name) {
          return node;
        }
        for (const child of node.children ?? []) {
          const found = findNode(child, name);
          if (found) {
            return found;
          }
        }
        return undefined;
      }
      const root = findNode(scene, "M01GreyboxRoot");
      const bootstrap = root?.components?.find(
        (component) => component.constructor?.name === "M01GreyboxBootstrap"
      );
      const tokenPositions = bootstrap?.tokenPositions;
      const position = tokenPositions ? tokenPositions.get(fragmentId) : undefined;
      if (!position) {
        throw new Error(`Missing token position for completion fragment: ${fragmentId}`);
      }
      return position;
    }, fragmentId);

  await clickLocalPoint(realInputPlan.flashlightPosition);
  await clickLocalPoint(realInputPlan.flashlightPickerRedPosition);
  if (realInputPlan.completionTargetPieces.length > 0) {
    for (const targetPiece of realInputPlan.completionTargetPieces) {
      await dragLocalPoint(
        await currentFragmentPosition(targetPiece.fragmentId),
        targetPiece.targetPosition
      );
    }
  } else for (const evidence of realInputPlan.completionEvidence) {
    for (const fragmentId of evidence.fragmentIds) {
      await dragLocalPoint(await currentFragmentPosition(fragmentId), evidence.evidencePosition);
    }
  }

  await page.waitForTimeout(300);
  return page.evaluate(({ realInputPlan }) => {
    const cc = window.cc;
    const scene = cc && cc.director ? cc.director.getScene() : undefined;
    function findNode(node, name) {
      if (!node) {
        return undefined;
      }
      if (node.name === name) {
        return node;
      }
      for (const child of node.children ?? []) {
        const found = findNode(child, name);
        if (found) {
          return found;
        }
      }
      return undefined;
    }
    const root = findNode(scene, "M01GreyboxRoot");
    const bootstrap = root?.components?.find(
      (component) => component.constructor?.name === "M01GreyboxBootstrap"
    );
    if (!bootstrap?.session) {
      throw new Error("M01GreyboxBootstrap session is unavailable for completion smoke.");
    }
    const titleNode = findNode(scene, "M01ToolCardTitle");
    const title = titleNode ? titleNode.getComponent(cc.Label)?.string : undefined;
    const hintButton = findNode(scene, "M01HintButton");
    return {
      evidenceCount: realInputPlan.completionEvidence.length,
      activeFlashlightId: bootstrap.activeFlashlightId,
      flashlightBeamTarget: bootstrap.flashlightBeamTarget,
      areAllEvidenceStaged: bootstrap.session.areAllEvidenceStaged(),
      completionState: bootstrap.session.getCompletionState(),
      hintButtonVisible: hintButton?.active ?? false,
      toolCardTitle: title,
      status: findNode(scene, "M01StatusLabel")?.getComponent(cc.Label)?.string,
      targetPieceRotations: Object.fromEntries(
        realInputPlan.completionTargetPieces.map((piece) => [
          piece.fragmentId,
          bootstrap.tokenRotations ? bootstrap.tokenRotations.get(piece.fragmentId) : undefined
        ])
      )
    };
  }, { realInputPlan });
}

async function runRuntimeEquivalentInputPath(page, realInputPlan) {
  return page.evaluate(({ realInputPlan }) => {
    const cc = window.cc;
    const scene = cc && cc.director ? cc.director.getScene() : undefined;
    function findNode(node, name) {
      if (!node) {
        return undefined;
      }
      if (node.name === name) {
        return node;
      }
      for (const child of node.children ?? []) {
        const found = findNode(child, name);
        if (found) {
          return found;
        }
      }
      return undefined;
    }
    const root = findNode(scene, "M01GreyboxRoot");
    const bootstrap = root?.components?.find(
      (component) => component.constructor?.name === "M01GreyboxBootstrap"
    );
    if (!bootstrap?.session || !bootstrap?.greyboxNodes) {
      throw new Error("M01GreyboxBootstrap runtime state is unavailable for fallback smoke.");
    }
    const tokenPositions = bootstrap.tokenPositions;

    const flashlightEntry = bootstrap.greyboxNodes.get(realInputPlan.flashlightId);
    if (!flashlightEntry) {
      throw new Error(`Missing flashlight token for fallback smoke: ${realInputPlan.flashlightId}`);
    }
    bootstrap.handleTokenDrop(
      flashlightEntry.node,
      flashlightEntry.token,
      realInputPlan.flashlightPosition
    );
    flashlightEntry.node.setPosition(
      realInputPlan.heldFlashlightPosition.x,
      realInputPlan.heldFlashlightPosition.y,
      0
    );
    tokenPositions?.set(realInputPlan.flashlightId, realInputPlan.heldFlashlightPosition);
    bootstrap.heldFlashlightId = realInputPlan.flashlightId;
    bootstrap.flashlightBeamAnchor = realInputPlan.heldFlashlightPosition;
    bootstrap.flashlightBeamTarget = realInputPlan.revealFragmentPosition;
    bootstrap.flashlightBeamLit = true;
    bootstrap.session.revealFragment(realInputPlan.revealFragmentId);
    bootstrap.syncVisualState();

    const freeEntry = bootstrap.greyboxNodes.get(realInputPlan.freePlacement.fragmentId);
    if (!freeEntry) {
      throw new Error(
        `Missing fragment token for fallback smoke: ${realInputPlan.freePlacement.fragmentId}`
      );
    }
    bootstrap.session.pickFragment(realInputPlan.freePlacement.fragmentId);
    bootstrap.handleTokenDrop(
      freeEntry.node,
      freeEntry.token,
      realInputPlan.freePlacement.dropPosition
    );

    for (const fragmentId of realInputPlan.stageEvidence.fragmentIds) {
      const entry = bootstrap.greyboxNodes.get(fragmentId);
      if (!entry) {
        throw new Error(`Missing staged fragment token for fallback smoke: ${fragmentId}`);
      }
      bootstrap.session.pickFragment(fragmentId);
      bootstrap.handleTokenDrop(
        entry.node,
        entry.token,
        realInputPlan.stageEvidence.evidencePosition
      );
    }

    const freePosition = tokenPositions ? tokenPositions.get(realInputPlan.freePlacement.fragmentId) : undefined;
    const stageFragmentPositions = Object.fromEntries(
      realInputPlan.stageEvidence.fragmentIds.map((fragmentId) => [
        fragmentId,
        tokenPositions ? tokenPositions.get(fragmentId) : undefined
      ])
    );

    return {
      activeFlashlightId: bootstrap.activeFlashlightId,
      activeFlashlightColor: bootstrap.activeFlashlightColor,
      heldFlashlightId: bootstrap.heldFlashlightId,
      heldFragmentId: bootstrap.heldFragmentId,
      flashlightPosition: tokenPositions ? tokenPositions.get(realInputPlan.flashlightId) : undefined,
      beamAnchor: bootstrap.flashlightBeamAnchor,
      beamTarget: bootstrap.flashlightBeamTarget,
      flashlightBeamLit: bootstrap.flashlightBeamLit,
      observedColor:
        bootstrap.session.getFragmentView(realInputPlan.revealFragmentId).observedColor,
      freePlacement: {
        fragmentId: realInputPlan.freePlacement.fragmentId,
        position: freePosition
      },
      stagedEvidenceId: realInputPlan.stageEvidence.evidenceId,
      isEvidenceStaged: bootstrap.session.isEvidenceStaged(realInputPlan.stageEvidence.evidenceId),
      areAllEvidenceStaged: bootstrap.session.areAllEvidenceStaged(),
      stageFragmentPositions
    };
  }, { realInputPlan });
}

async function main() {
  const config = await readConfig();
  const realInputPlan = buildRealInputPlan(config);
  const manualTargetCompositionMode = config.targetPattern?.locked === false;
  const expectedNodeIds = [
    ...config.fragments.map((fragment) => fragment.id),
    "m01_reference_complete_pattern"
  ];
  const consoleMessages = [];
  const pageErrors = [];

  assert(
    chromePath,
    "No Chrome/Chromium executable found. Set M01_SMOKE_CHROME_PATH to a local browser binary."
  );

  await mkdir(screenshotDir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(sceneUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(() => window.cc?.director?.getScene?.()?.name === "M01Greybox", {
      timeout: 30_000
    });
    await page.waitForTimeout(3_000);

    const initial = await snapshotRuntime(page);
    assert(initial.hasBootstrap, "M01GreyboxBootstrap was not found in the preview scene.");
    const missing = expectedNodeIds.filter((id) => !initial.nodeNames.includes(id));
    const platformEvidenceNodes = initial.nodeNames.filter((name) =>
      name.startsWith("M01Token_current_manual_target_")
    );
    assert(
      missing.length === 0,
      `Preview runtime is stale or incomplete. Missing current M01 nodes: ${missing.join(", ")}`
    );
    assert(
      platformEvidenceNodes.length === 0,
      `Expected no visible generated evidence nodes on the repair platform; found ${platformEvidenceNodes.join(", ")}.`
    );
    assert(
      initial.bootstrapKeys.includes("flashlightBeamTarget"),
      "Preview runtime is stale: M01GreyboxBootstrap lacks flashlightBeamTarget."
    );
    const artPreview = enableArtPreview ? await enableArtPreviewMode(page) : undefined;

    const browserInputAttempt = await runRealInputPath(page, realInputPlan);
    const heldMoveStep = browserInputAttempt.debugSteps.find(
      (step) => step.step === "after_held_flashlight_move"
    );
    const heldShineStep = browserInputAttempt.debugSteps.find(
      (step) => step.step === "after_held_flashlight_shine"
    );
    const pickerSelectStep = browserInputAttempt.debugSteps.find(
      (step) => step.step === "after_flashlight_picker_select"
    );
    const browserInputStable =
      browserInputAttempt.activeFlashlightId === realInputPlan.flashlightId &&
      pickerSelectStep?.activeFlashlightId === realInputPlan.flashlightId &&
      heldShineStep?.observedColor === realInputPlan.expectedObservedColor &&
      heldMoveStep?.beamTarget &&
      Math.abs(heldMoveStep.beamTarget.x - realInputPlan.heldFlashlightPosition.x) <= 1 &&
      Math.abs(heldMoveStep.beamTarget.y - realInputPlan.heldFlashlightPosition.y) <= 1 &&
      heldShineStep?.beamTarget &&
      Math.abs(heldShineStep.beamTarget.x - realInputPlan.revealFragmentPosition.x) <= 1 &&
      Math.abs(heldShineStep.beamTarget.y - realInputPlan.revealFragmentPosition.y) <= 1 &&
      browserInputAttempt.freePlacement.position &&
      Math.abs(
        browserInputAttempt.freePlacement.position.x - realInputPlan.freePlacement.dropPosition.x
      ) <= 1 &&
      Math.abs(
        browserInputAttempt.freePlacement.position.y - realInputPlan.freePlacement.dropPosition.y
      ) <= 1 &&
      (manualTargetCompositionMode || browserInputAttempt.isEvidenceStaged);
    const realInput = browserInputStable
      ? {
          ...browserInputAttempt,
          observedColor: browserInputAttempt.observedColor ?? heldShineStep?.observedColor,
          attemptedBrowserInput: true,
          usedFallback: false
        }
      : {
          ...(await runRuntimeEquivalentInputPath(page, realInputPlan)),
          attemptedBrowserInput: true,
          usedFallback: true,
          blocker:
            `Headless Cocos preview did not complete the Playwright mouse-driven browser input path. Attempt snapshot: ${JSON.stringify(browserInputAttempt)}. Falling back to bootstrap-level drop handling to preserve repeatable preview coverage.`
        };
    assert(
      !requireBrowserInput || !realInput.usedFallback,
      `Browser-input smoke required a real canvas input path, but Cocos preview required fallback. ${realInput.blocker ?? ""}`
    );
    assert(
      realInput.activeFlashlightId === realInputPlan.flashlightId,
      `Expected active flashlight ${realInputPlan.flashlightId}; got ${realInput.activeFlashlightId}.`
    );
    const realHeldMoveStep = realInput.debugSteps?.find(
      (step) => step.step === "after_held_flashlight_move"
    );
    const realHeldShineStep = realInput.debugSteps?.find(
      (step) => step.step === "after_held_flashlight_shine"
    );
    const realPickerSelectStep = realInput.debugSteps?.find(
      (step) => step.step === "after_flashlight_picker_select"
    );
    assert(
      realPickerSelectStep?.activeFlashlightId === realInputPlan.flashlightId,
      `Expected picker to select ${realInputPlan.flashlightId}; got ${realPickerSelectStep?.activeFlashlightId}.`
    );
    assert(
      realHeldMoveStep?.beamTarget,
      `Expected active flashlight beam to follow pointer before reveal.`
    );
    assert(
      Math.abs(realHeldMoveStep.beamTarget.x - realInputPlan.heldFlashlightPosition.x) <= 1 &&
        Math.abs(realHeldMoveStep.beamTarget.y - realInputPlan.heldFlashlightPosition.y) <= 1,
      `Expected ${realInputPlan.flashlightId} beam to follow pointer to (${realInputPlan.heldFlashlightPosition.x}, ${realInputPlan.heldFlashlightPosition.y}); got (${realHeldMoveStep.beamTarget.x}, ${realHeldMoveStep.beamTarget.y}).`
    );
    assert(
      realHeldShineStep?.beamTarget,
      `Expected held flashlight beam target to be controlled by the gesture endpoint.`
    );
    assert(
      Math.abs(realHeldShineStep.beamTarget.x - realInputPlan.revealFragmentPosition.x) <= 1 &&
        Math.abs(realHeldShineStep.beamTarget.y - realInputPlan.revealFragmentPosition.y) <= 1,
      `Expected beam endpoint to reach (${realInputPlan.revealFragmentPosition.x}, ${realInputPlan.revealFragmentPosition.y}); got (${realHeldShineStep.beamTarget.x}, ${realHeldShineStep.beamTarget.y}).`
    );
    assert(
      realInput.observedColor === realInputPlan.expectedObservedColor,
      `Expected observed color ${realInputPlan.expectedObservedColor}; got ${realInput.observedColor}.`
    );
    assert(
      realInput.freePlacement.position,
      `Expected free placement position for ${realInput.freePlacement.fragmentId}.`
    );
    assert(
      Math.abs(realInput.freePlacement.position.x - realInputPlan.freePlacement.dropPosition.x) <= 1 &&
        Math.abs(realInput.freePlacement.position.y - realInputPlan.freePlacement.dropPosition.y) <= 1,
      `Expected ${realInput.freePlacement.fragmentId} to follow pointer to (${realInputPlan.freePlacement.dropPosition.x}, ${realInputPlan.freePlacement.dropPosition.y}); got (${realInput.freePlacement.position.x}, ${realInput.freePlacement.position.y}).`
    );
    let failure;
    let completion;
    let completionArtPreview;
    let completionScreenshotPath;
    const screenshotPath = resolve(
      screenshotDir,
      manualTargetCompositionMode
        ? "m01-preview-manual-composition-smoke.png"
        : "m01-preview-failed-validation-smoke.png"
    );

    if (!manualTargetCompositionMode) {
      assert(
        realInput.isEvidenceStaged,
        `Expected ${realInput.stageEvidenceId} to be staged after preview interaction path.`
      );
      const [firstStagedFragmentId, secondStagedFragmentId] = realInputPlan.stageEvidence.fragmentIds;
      assert(
        pointDistance(
          realInput.stageFragmentPositions[firstStagedFragmentId],
          realInput.stageFragmentPositions[secondStagedFragmentId]
        ) >= 32,
        `Expected staged fragments ${firstStagedFragmentId} and ${secondStagedFragmentId} to land in partial-overlap poses instead of one pile.`
      );
      for (const targetPiece of realInputPlan.stageEvidence.targetPieces ?? []) {
        const actualRotation = realInput.stageFragmentRotations[targetPiece.fragmentId];
        assert(
          rotationDistance(actualRotation ?? 0, targetPiece.targetRotation) <= 1,
          `Expected staged target piece ${targetPiece.fragmentId} rotation ${targetPiece.targetRotation}; got ${actualRotation}.`
        );
      }

      const wrongPairs = buildWrongCandidate(config);
      failure = await runFailureValidation(page, wrongPairs);
      assert(failure.validation.accepted === false, "Wrong candidate should fail validation.");
      assert(
        failure.validation.bottomLight === "flash_then_off",
        `Expected failed validation bottom light flash; got ${failure.validation.bottomLight}.`
      );
      assert(
        failure.duringFlash.validationColor,
        `Expected ${failure.stagedFragmentId} to expose validationColor during the flash.`
      );
      assert(
        !("validationColor" in failure.afterFlash),
        `Expected ${failure.stagedFragmentId} to return to grey after the flash window.`
      );
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    await assertNoPrematureToolCard(page);
    const cleanQaScreenshotPath = captureCleanQa
      ? await captureCleanQaScreenshot(page, { artPreview: enableArtPreview })
      : undefined;
    if (!manualTargetCompositionMode) {
      await page.goto(sceneUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForFunction(() => window.cc?.director?.getScene?.()?.name === "M01Greybox", {
        timeout: 30_000
      });
      await page.waitForTimeout(3_000);
      completionArtPreview = enableArtPreview ? await enableArtPreviewMode(page) : undefined;
      completion = await runCompletionInputPath(page, realInputPlan);
      assert(
        completion.areAllEvidenceStaged,
        `Expected all evidence pairs to be staged through real browser input. Completion snapshot: ${JSON.stringify(completion)}`
      );
      assert(
        completion.completionState.bottomLight === "steady_on",
        `Expected M01 completion bottom light steady_on; got ${completion.completionState.bottomLight}.`
      );
      assert(completion.completionState.completed, "Expected M01 completion state to be completed.");
      assert(
        completion.activeFlashlightId === undefined,
        `Expected completion to clear the active flashlight beam; got ${completion.activeFlashlightId}.`
      );
      assert(
        completion.flashlightBeamTarget === undefined,
        `Expected completion to clear the flashlight beam target; got ${JSON.stringify(completion.flashlightBeamTarget)}.`
      );
      assert(
        completion.hintButtonVisible === false,
        "Expected completion to hide the hint button."
      );
      assert(
        completion.toolCardTitle === realInputPlan.expectedToolCardTitle,
        `Expected ToolCard title ${realInputPlan.expectedToolCardTitle}; got ${completion.toolCardTitle}.`
      );
      for (const targetPiece of realInputPlan.completionTargetPieces) {
        const actualRotation = completion.targetPieceRotations[targetPiece.fragmentId];
        assert(
          rotationDistance(actualRotation ?? 0, targetPiece.targetRotation) <= 1,
          `Expected completed target piece ${targetPiece.fragmentId} rotation ${targetPiece.targetRotation}; got ${actualRotation}.`
        );
      }
      completionScreenshotPath = resolve(screenshotDir, "m01-preview-completion-smoke.png");
      await page.screenshot({ path: completionScreenshotPath, fullPage: true });
    }
    assert(pageErrors.length === 0, `Preview page errors: ${pageErrors.join(" | ")}`);
    assert(
      consoleMessages.length === 0,
      `Preview console warnings/errors: ${consoleMessages.join(" | ")}`
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          sceneUrl,
          artPreview,
          completionArtPreview,
          screenshotPath,
          completionScreenshotPath,
          cleanQaScreenshotPath,
          realInput,
          completion,
          validation: failure?.validation,
          stagedFragmentId: failure?.stagedFragmentId,
          validationColorDuringFlash: failure?.duringFlash.validationColor,
          hasValidationColorAfterFlash: failure ? "validationColor" in failure.afterFlash : undefined,
          statusDuringFlash: failure?.statusDuringFlash,
          statusAfterFlash: failure?.statusAfterFlash,
          manualTargetCompositionMode,
          consoleMessages,
          pageErrors
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
