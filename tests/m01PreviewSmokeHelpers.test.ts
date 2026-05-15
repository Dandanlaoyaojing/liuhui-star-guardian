import { describe, expect, it } from "vitest";

import m01Config from "../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };

describe("buildRealInputPlan", () => {
  it("includes every evidence pair needed to complete M01 and the expected ToolCard title", async () => {
    // @ts-expect-error The smoke helper is a repo-local Node ESM script without a TS declaration.
    const { buildRealInputPlan } = await import("../scripts/m01-preview-smoke-helpers.mjs");
    const plan = buildRealInputPlan(m01Config);

    expect(plan.completionEvidence).toEqual(
      expect.arrayContaining(
        m01Config.evidence.map((evidence) =>
          expect.objectContaining({
            evidenceId: evidence.id,
            fragmentIds: evidence.solution.fragmentIds
          })
        )
      )
    );
    expect(
      plan.completionEvidence.every(
        (evidence: { evidencePosition: { x: number; y: number } }) =>
          Math.abs(evidence.evidencePosition.x) <= 150 &&
          Math.abs(evidence.evidencePosition.y) <= 150
      )
    ).toBe(true);
    expect(Math.abs(plan.stageEvidence.evidencePosition.x)).toBeLessThanOrEqual(150);
    expect(Math.abs(plan.stageEvidence.evidencePosition.y)).toBeLessThanOrEqual(150);
    expect(plan.flashlightPosition).toEqual({ x: 359, y: 53 });
    expect(plan.flashlightBeamTargetPosition).toEqual({ x: 332, y: -138 });
    expect(plan.revealFragmentIds).toEqual(m01Config.fragments.map((fragment) => fragment.id));
    expect(plan.expectedObservedColorsByFragment).toMatchObject({
      fragment_circle_blue_1: "purple",
      fragment_circle_yellow_1: "orange",
      fragment_circle_red_2: "red",
      fragment_triangle_blue_1: "purple",
      fragment_triangle_yellow_1: "orange",
      fragment_triangle_yellow_2: "orange",
      fragment_hexagon_blue_1: "purple",
      fragment_hexagon_yellow_1: "orange",
      fragment_hexagon_red_2: "red"
    });
    expect(plan).not.toHaveProperty("heldFlashlightPosition");
    expect(plan.flashlightBeamAnchorPosition).toEqual({ x: 360, y: 110 });
    expect(plan.expectedToolCardTitle).toBe(m01Config.toolCard.front.toolName);
  });

  it("checks every fixed flashlight color against its expected art-backed reveal colors", async () => {
    // @ts-expect-error The smoke helper is a repo-local Node ESM script without a TS declaration.
    const { buildRealInputPlan } = await import("../scripts/m01-preview-smoke-helpers.mjs");
    const plan = buildRealInputPlan(m01Config);

    expect(
      plan.flashlightChecks.map(
        (check: {
          flashlightId: string;
          buttonPosition: { x: number; y: number };
          expectedObservedColorsByFragment: Record<string, string>;
        }) => ({
          flashlightId: check.flashlightId,
          buttonPosition: check.buttonPosition,
          expectedObservedColorsByFragment: check.expectedObservedColorsByFragment
        })
      )
    ).toEqual([
      {
        flashlightId: "flashlight_yellow",
        buttonPosition: { x: 360, y: 42 },
        expectedObservedColorsByFragment: {
          fragment_circle_blue_1: "green",
          fragment_circle_yellow_1: "yellow",
          fragment_circle_red_2: "orange",
          fragment_triangle_blue_1: "green",
          fragment_triangle_yellow_1: "yellow",
          fragment_triangle_yellow_2: "yellow",
          fragment_hexagon_blue_1: "green",
          fragment_hexagon_yellow_1: "yellow",
          fragment_hexagon_red_2: "orange"
        }
      },
      {
        flashlightId: "flashlight_blue",
        buttonPosition: { x: 358, y: 30 },
        expectedObservedColorsByFragment: {
          fragment_circle_blue_1: "blue",
          fragment_circle_yellow_1: "green",
          fragment_circle_red_2: "purple",
          fragment_triangle_blue_1: "blue",
          fragment_triangle_yellow_1: "green",
          fragment_triangle_yellow_2: "green",
          fragment_hexagon_blue_1: "blue",
          fragment_hexagon_yellow_1: "green",
          fragment_hexagon_red_2: "purple"
        }
      },
      {
        flashlightId: "flashlight_red",
        buttonPosition: { x: 359, y: 53 },
        expectedObservedColorsByFragment: {
          fragment_circle_blue_1: "purple",
          fragment_circle_yellow_1: "orange",
          fragment_circle_red_2: "red",
          fragment_triangle_blue_1: "purple",
          fragment_triangle_yellow_1: "orange",
          fragment_triangle_yellow_2: "orange",
          fragment_hexagon_blue_1: "purple",
          fragment_hexagon_yellow_1: "orange",
          fragment_hexagon_red_2: "red"
        }
      }
    ]);
  });

  it("drives locked target completion by placing each exact target piece once", async () => {
    // @ts-expect-error The smoke helper is a repo-local Node ESM script without a TS declaration.
    const { buildRealInputPlan } = await import("../scripts/m01-preview-smoke-helpers.mjs");
    const plan = buildRealInputPlan(m01Config);

    expect(plan.completionTargetPieces).toEqual(
      m01Config.targetPattern.pieces.map((piece) => ({
        fragmentId: piece.fragmentId,
        targetPosition: piece.position,
        targetRotation: piece.rotation ?? 0
      }))
    );
    expect(plan.stageEvidence.targetPieces).toEqual(
      plan.completionTargetPieces.filter((piece: { fragmentId: string }) =>
        plan.stageEvidence.fragmentIds.includes(piece.fragmentId)
      )
    );
  });

  it("uses a decoy fragment for free-placement smoke so staged solution pieces stay at their start positions", async () => {
    // @ts-expect-error The smoke helper is a repo-local Node ESM script without a TS declaration.
    const { buildRealInputPlan } = await import("../scripts/m01-preview-smoke-helpers.mjs");
    const plan = buildRealInputPlan(m01Config);
    const solutionFragmentIds = new Set(
      m01Config.evidence.flatMap((evidence) => evidence.solution.fragmentIds)
    );

    expect(solutionFragmentIds.has(plan.freePlacement.fragmentId)).toBe(false);
    expect(plan.stageEvidence.fragmentIds).not.toContain(plan.freePlacement.fragmentId);
  });

  it("builds a complete wrong candidate with a shape-compatible replacement pair", async () => {
    // @ts-expect-error The smoke script is a repo-local Node ESM script without a TS declaration.
    const { buildWrongCandidate } = await import("../scripts/m01-preview-smoke.mjs");
    const wrongPairs = buildWrongCandidate(m01Config);
    const firstEvidence = m01Config.evidence[0];

    expect(Object.keys(wrongPairs).sort()).toEqual(m01Config.evidence.map((evidence) => evidence.id).sort());
    expect(wrongPairs[firstEvidence.id]).not.toEqual(firstEvidence.solution.fragmentIds);
    expect(wrongPairs[firstEvidence.id]).toHaveLength(2);
    expect(wrongPairs[firstEvidence.id].some((fragmentId: string) => fragmentId.includes("_circle_")))
      .toBe(true);
    expect(wrongPairs[firstEvidence.id].some((fragmentId: string) => fragmentId.includes("_hexagon_")))
      .toBe(true);
  }, 15000);
});
