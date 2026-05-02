import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("M01 preview refresh helper", () => {
  it("exposes a repo-local refresh command and prefers MCP refresh before restart fallback", () => {
    const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));

    expect(packageJson.scripts["smoke:m01-preview-refresh"]).toBe(
      "node scripts/m01-preview-refresh.mjs --json"
    );

    const result = spawnSync(
      process.execPath,
      [join(projectRoot, "scripts/m01-preview-refresh.mjs"), "--dry-run", "--json"],
      {
        cwd: projectRoot,
        encoding: "utf8"
      }
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const output = JSON.parse(result.stdout);
    expect(output.symptoms).toContain("missing fragment_circle_* nodes in smoke output");
    expect(output.symptoms).toContain("missing evidence_* nodes in smoke output");
    expect(output.steps.map((step: { label: string }) => step.label)).toEqual([
      "refresh_assets:scripts",
      "refresh_assets:stage1-config",
      "soft_reload_scene"
    ]);
    expect(output.restartFallback).toContain("Only restart Cocos Creator");
    expect(output.restartFallback).toContain("after the MCP refresh path fails");
    expect(output.nextStep).toBe("Rerun npm run smoke:m01-preview after refresh completes.");
  });

  it("reports an unavailable MCP server with a concrete fallback hint", () => {
    const result = spawnSync(
      process.execPath,
      [join(projectRoot, "scripts/m01-preview-refresh.mjs")],
      {
        cwd: projectRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          M01_COCOS_MCP_URL: "http://127.0.0.1:1"
        }
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("M01 preview refresh could not reach the local MCP server");
    expect(result.stderr).toContain("Only restart Cocos Creator after the MCP refresh path fails");
  });
});
