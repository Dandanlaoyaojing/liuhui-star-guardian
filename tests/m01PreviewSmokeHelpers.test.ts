import { describe, expect, it } from "vitest";

import m01Config from "../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };

describe("buildRealInputPlan", () => {
  it("includes every evidence pair needed to complete M01 and the expected ToolCard title", async () => {
    // @ts-expect-error The smoke helper is a repo-local Node ESM script without a TS declaration.
    const { buildRealInputPlan } = await import("../scripts/m01-preview-smoke-helpers.mjs");
    const plan = buildRealInputPlan(m01Config);

    expect(plan.completionEvidence).toEqual(
      m01Config.evidence.map((evidence) => ({
        evidenceId: evidence.id,
        evidencePosition: evidence.position,
        fragmentIds: evidence.solution.fragmentIds
      }))
    );
    expect(plan.expectedToolCardTitle).toBe(m01Config.toolCard.front.toolName);
  });
});
