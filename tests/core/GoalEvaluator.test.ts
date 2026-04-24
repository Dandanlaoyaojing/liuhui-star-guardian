import { describe, expect, it } from "vitest";

import {
  evaluateAllSorted,
  type AllSortedGoalParams,
  type SortableEntityState,
  type SortSlotState
} from "../../assets/scripts/core/GoalEvaluator.ts";

const goal: AllSortedGoalParams = {
  dimensions: ["color", "shape"],
  colors: ["red", "blue"],
  shapes: ["circle", "triangle"]
};

const slots: SortSlotState[] = [
  { id: "slot_red_circle", accepts: { color: "red", shape: "circle" } },
  { id: "slot_red_triangle", accepts: { color: "red", shape: "triangle" } },
  { id: "slot_blue_circle", accepts: { color: "blue", shape: "circle" } },
  { id: "slot_blue_triangle", accepts: { color: "blue", shape: "triangle" } }
];

describe("evaluateAllSorted", () => {
  it("succeeds when every fragment is placed in the slot matching color and shape", () => {
    const entities: SortableEntityState[] = [
      {
        id: "fragment_1",
        attributes: { color: "red", shape: "circle" },
        placedInSlotId: "slot_red_circle"
      },
      {
        id: "fragment_2",
        attributes: { color: "blue", shape: "triangle" },
        placedInSlotId: "slot_blue_triangle"
      }
    ];

    const result = evaluateAllSorted(goal, { entities, slots });

    expect(result.success).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("rejects a fragment placed in a slot with the wrong color or shape", () => {
    const entities: SortableEntityState[] = [
      {
        id: "fragment_1",
        attributes: { color: "red", shape: "circle" },
        placedInSlotId: "slot_blue_circle"
      }
    ];

    const result = evaluateAllSorted(goal, { entities, slots });

    expect(result.success).toBe(false);
    expect(result.failures).toContain("fragment_1 is in slot_blue_circle, which does not match color=red");
  });

  it("rejects a fragment with a missing placement", () => {
    const entities: SortableEntityState[] = [
      {
        id: "fragment_1",
        attributes: { color: "red", shape: "circle" },
        placedInSlotId: null
      }
    ];

    const result = evaluateAllSorted(goal, { entities, slots });

    expect(result.success).toBe(false);
    expect(result.failures).toContain("fragment_1 is not placed");
  });

  it("rejects missing or unsupported color and shape dimensions", () => {
    const entities: SortableEntityState[] = [
      {
        id: "fragment_1",
        attributes: { color: "green" },
        placedInSlotId: "slot_red_circle"
      }
    ];

    const result = evaluateAllSorted(goal, { entities, slots });

    expect(result.success).toBe(false);
    expect(result.failures).toContain("fragment_1 has unsupported color=green");
    expect(result.failures).toContain("fragment_1 is missing shape");
  });
});
