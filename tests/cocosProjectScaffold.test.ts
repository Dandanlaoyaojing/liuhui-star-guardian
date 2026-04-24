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
});
