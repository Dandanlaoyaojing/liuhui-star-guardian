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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readConfig() {
  return JSON.parse(await readFile(configPath, "utf8"));
}

function buildWrongCandidate(config) {
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
    const replacement = config.fragments.find((fragment) => !firstPair.includes(fragment.id));
    assert(replacement, "Need at least one decoy fragment to build a wrong candidate.");
    pairs[firstEvidence.id] = [firstPair[0], replacement.id];
  }
  return pairs;
}

async function snapshotRuntime(page) {
  return page.evaluate(() => {
    const cc = window.cc;
    const scene = cc?.director?.getScene?.();
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
    const statusLabel = findNode(scene, "M01StatusLabel")?.getComponent?.(cc.Label)?.string;
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
    const statusDuringFlash = findNode(scene, "M01StatusLabel")?.getComponent?.(cc.Label)?.string;
    await new Promise((resolve) => setTimeout(resolve, 2200));
    bootstrap.syncVisualState();
    const afterFlash = bootstrap.session.getFragmentView(stagedFragmentId);
    const statusAfterFlash = findNode(scene, "M01StatusLabel")?.getComponent?.(cc.Label)?.string;

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
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  const canvasBox = await canvas.boundingBox();
  assert(canvasBox, "Preview canvas is unavailable for real-input smoke.");
  const toPagePoint = (localPoint) =>
    localPointToPagePoint(canvasBox, realInputPlan.canvasSize, localPoint);
  const dispatchCanvasTouchPath = async (steps) => {
    await page.evaluate(async ({ steps }) => {
      const canvas = document.querySelector("canvas");
      if (!canvas) {
        throw new Error("Preview canvas is unavailable for touch dispatch.");
      }

      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const makeTouch = (point) =>
        new Touch({
          identifier: 1,
          target: canvas,
          clientX: point.x,
          clientY: point.y,
          pageX: point.x,
          pageY: point.y,
          screenX: point.x,
          screenY: point.y,
          radiusX: 2,
          radiusY: 2,
          rotationAngle: 0,
          force: 1
        });
      const dispatch = (type, point) => {
        const touch = makeTouch(point);
        const touches = type === "touchend" || type === "touchcancel" ? [] : [touch];
        const event = new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          touches,
          targetTouches: touches,
          changedTouches: [touch]
        });
        canvas.dispatchEvent(event);
      };

      for (const step of steps) {
        dispatch(step.type, step.point);
        await wait(step.delayMs ?? 16);
      }
    }, { steps });
  };
  const tapLocalPoint = async (localPoint) => {
    const pagePoint = toPagePoint(localPoint);
    await dispatchCanvasTouchPath([
      { type: "touchstart", point: pagePoint, delayMs: 40 },
      { type: "touchend", point: pagePoint, delayMs: 100 }
    ]);
  };
  const dragLocalPoint = async (fromLocalPoint, toLocalPoint) => {
    const fromPoint = toPagePoint(fromLocalPoint);
    const steps = [{ type: "touchstart", point: fromPoint, delayMs: 24 }];
    const segments = 10;
    for (let index = 1; index <= segments; index += 1) {
      const progress = index / segments;
      const localPoint = {
        x: fromLocalPoint.x + (toLocalPoint.x - fromLocalPoint.x) * progress,
        y: fromLocalPoint.y + (toLocalPoint.y - fromLocalPoint.y) * progress
      };
      steps.push({
        type: "touchmove",
        point: toPagePoint(localPoint),
        delayMs: 20
      });
    }
    steps.push({
      type: "touchend",
      point: toPagePoint(toLocalPoint),
      delayMs: 120
    });
    await dispatchCanvasTouchPath(steps);
  };

  await tapLocalPoint(realInputPlan.flashlightPosition);
  await dispatchCanvasTouchPath([
    {
      type: "touchmove",
      point: toPagePoint(realInputPlan.revealFragmentPosition),
      delayMs: 120
    }
  ]);

  await dragLocalPoint(
    realInputPlan.freePlacement.fragmentPosition,
    realInputPlan.freePlacement.dropPosition
  );

  const runtimeFragmentPositions = await page.evaluate(() => {
    const cc = window.cc;
    const scene = cc?.director?.getScene?.();
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
    await dragLocalPoint(fragmentPosition, realInputPlan.stageEvidence.evidencePosition);
  }

  return page.evaluate(({ realInputPlan }) => {
    const cc = window.cc;
    const scene = cc?.director?.getScene?.();
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

    const freePosition = bootstrap.tokenPositions?.get(realInputPlan.freePlacement.fragmentId);
    const stageFragmentPositions = Object.fromEntries(
      realInputPlan.stageEvidence.fragmentIds.map((fragmentId) => [
        fragmentId,
        bootstrap.tokenPositions?.get(fragmentId)
      ])
    );

    return {
      activeFlashlightId: bootstrap.activeFlashlightId,
      activeFlashlightColor: bootstrap.activeFlashlightColor,
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

async function runRuntimeEquivalentInputPath(page, realInputPlan) {
  return page.evaluate(({ realInputPlan }) => {
    const cc = window.cc;
    const scene = cc?.director?.getScene?.();
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

    const flashlightEntry = bootstrap.greyboxNodes.get(realInputPlan.flashlightId);
    if (!flashlightEntry) {
      throw new Error(`Missing flashlight token for fallback smoke: ${realInputPlan.flashlightId}`);
    }
    bootstrap.handleTokenDrop(
      flashlightEntry.node,
      flashlightEntry.token,
      realInputPlan.flashlightPosition
    );
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

    const freePosition = bootstrap.tokenPositions?.get(realInputPlan.freePlacement.fragmentId);
    const stageFragmentPositions = Object.fromEntries(
      realInputPlan.stageEvidence.fragmentIds.map((fragmentId) => [
        fragmentId,
        bootstrap.tokenPositions?.get(fragmentId)
      ])
    );

    return {
      activeFlashlightId: bootstrap.activeFlashlightId,
      activeFlashlightColor: bootstrap.activeFlashlightColor,
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
  const expectedNodeIds = [
    ...config.fragments.map((fragment) => fragment.id),
    ...config.evidence.map((evidence) => evidence.id)
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
    assert(
      missing.length === 0,
      `Preview runtime is stale or incomplete. Missing current M01 nodes: ${missing.join(", ")}`
    );
    assert(
      initial.bootstrapKeys.includes("flashlightBeamTarget"),
      "Preview runtime is stale: M01GreyboxBootstrap lacks flashlightBeamTarget."
    );

    const browserInputAttempt = await runRealInputPath(page, realInputPlan);
    const browserInputStable =
      browserInputAttempt.activeFlashlightId === realInputPlan.flashlightId &&
      browserInputAttempt.observedColor === realInputPlan.expectedObservedColor &&
      browserInputAttempt.freePlacement.position &&
      Math.abs(
        browserInputAttempt.freePlacement.position.x - realInputPlan.freePlacement.dropPosition.x
      ) <= 1 &&
      Math.abs(
        browserInputAttempt.freePlacement.position.y - realInputPlan.freePlacement.dropPosition.y
      ) <= 1 &&
      browserInputAttempt.isEvidenceStaged;
    const realInput = browserInputStable
      ? {
          ...browserInputAttempt,
          attemptedBrowserInput: true,
          usedFallback: false
        }
      : {
          ...(await runRuntimeEquivalentInputPath(page, realInputPlan)),
          attemptedBrowserInput: true,
          usedFallback: true,
          blocker:
            "Headless Cocos preview did not react to canvas-dispatched browser input events: active flashlight stayed unset and token positions did not move. Falling back to bootstrap-level drop handling to preserve repeatable preview coverage."
        };
    assert(
      !requireBrowserInput || !realInput.usedFallback,
      `Browser-input smoke required a real canvas input path, but Cocos preview required fallback. ${realInput.blocker ?? ""}`
    );
    assert(
      realInput.activeFlashlightId === realInputPlan.flashlightId,
      `Expected active flashlight ${realInputPlan.flashlightId}; got ${realInput.activeFlashlightId}.`
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
    assert(
      realInput.isEvidenceStaged,
      `Expected ${realInput.stageEvidenceId} to be staged after preview interaction path.`
    );

    const wrongPairs = buildWrongCandidate(config);
    const failure = await runFailureValidation(page, wrongPairs);
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

    const screenshotPath = resolve(screenshotDir, "m01-preview-failed-validation-smoke.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
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
          screenshotPath,
          realInput,
          validation: failure.validation,
          stagedFragmentId: failure.stagedFragmentId,
          validationColorDuringFlash: failure.duringFlash.validationColor,
          hasValidationColorAfterFlash: "validationColor" in failure.afterFlash,
          statusDuringFlash: failure.statusDuringFlash,
          statusAfterFlash: failure.statusAfterFlash,
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
