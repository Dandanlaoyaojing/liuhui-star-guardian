import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

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

async function main() {
  const config = await readConfig();
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
