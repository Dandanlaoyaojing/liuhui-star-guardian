const DEFAULT_MCP_BASE_URL = process.env.M01_COCOS_MCP_URL ?? "http://127.0.0.1:3000";
const DEFAULT_SMOKE_COMMAND = "npm run smoke:m01-preview";
const REFRESH_REQUEST_TIMEOUT_MS = 2000;
const STALE_PREVIEW_SYMPTOMS = [
  "missing fragment_circle_* nodes in smoke output",
  "missing evidence_* nodes in smoke output",
  "preview runtime returns stale bundle or missing scene nodes"
];

function buildRefreshSteps(baseUrl = DEFAULT_MCP_BASE_URL) {
  return [
    {
      label: "refresh_assets:scripts",
      url: `${baseUrl}/api/project/refresh_assets`,
      body: { folder: "db://assets/scripts" }
    },
    {
      label: "refresh_assets:stage1-config",
      url: `${baseUrl}/api/project/refresh_assets`,
      body: { folder: "db://assets/resources/configs/stage1" }
    },
    {
      label: "soft_reload_scene",
      url: `${baseUrl}/api/sceneAdvanced/soft_reload_scene`,
      body: {}
    }
  ];
}

function buildRefreshWorkflow(baseUrl = DEFAULT_MCP_BASE_URL) {
  return {
    baseUrl,
    symptoms: [...STALE_PREVIEW_SYMPTOMS],
    steps: buildRefreshSteps(baseUrl),
    restartFallback:
      "Only restart Cocos Creator after the MCP refresh path fails or the local MCP server is unavailable.",
    nextStep: `Rerun ${DEFAULT_SMOKE_COMMAND} after refresh completes.`
  };
}

async function postJson(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REFRESH_REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`request_failed:${reason}`);
  }

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: text
  };
}

async function runRefreshWorkflow(workflow) {
  const results = [];
  for (const step of workflow.steps) {
    let response;
    try {
      response = await postJson(step.url, step.body);
    } catch (error) {
      const reason = error instanceof Error ? error.message.replace(/^request_failed:/, "") : String(error);
      throw new Error(
        `M01 preview refresh could not reach the local MCP server at ${workflow.baseUrl} while running ${step.label}: ${reason}. ${workflow.restartFallback}`
      );
    }
    results.push({
      label: step.label,
      url: step.url,
      status: response.status,
      ok: response.ok,
      body: response.body
    });
    if (!response.ok) {
      throw new Error(
        `Refresh step ${step.label} failed with status ${response.status}. ${workflow.restartFallback}`
      );
    }
  }
  return {
    ...workflow,
    executed: true,
    results
  };
}

function formatTextWorkflow(workflow) {
  const lines = [
    `M01 preview refresh workflow via ${workflow.baseUrl}`,
    "",
    "Use this helper when:",
    ...workflow.symptoms.map((symptom) => `- ${symptom}`),
    "",
    "Refresh order:",
    ...workflow.steps.map((step) => `- ${step.label}: POST ${step.url}`),
    "",
    workflow.restartFallback,
    workflow.nextStep
  ];

  if (workflow.results?.length) {
    lines.push("", "Results:");
    for (const result of workflow.results) {
      lines.push(`- ${result.label}: ${result.status} ${result.ok ? "ok" : "failed"}`);
    }
  }

  return lines.join("\n");
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    json: argv.includes("--json")
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const workflow = buildRefreshWorkflow();

  if (options.dryRun) {
    const output = options.json
      ? JSON.stringify(workflow, null, 2)
      : formatTextWorkflow(workflow);
    process.stdout.write(`${output}\n`);
    return;
  }

  const executedWorkflow = await runRefreshWorkflow(workflow);
  const output = options.json
    ? JSON.stringify(executedWorkflow, null, 2)
    : formatTextWorkflow(executedWorkflow);
  process.stdout.write(`${output}\n`);
}

const isEntrypoint = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isEntrypoint) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

export { buildRefreshSteps, buildRefreshWorkflow, runRefreshWorkflow };
