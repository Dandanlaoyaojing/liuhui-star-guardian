import { describe, expect, it } from "vitest";
import {
  clearActiveFilter,
  createFilterState,
  evaluateFragmentFilterState,
  evaluateFragments,
  setActiveFilter,
  type FilterableFragment
} from "../../assets/scripts/interaction/FilterSystem.ts";

describe("FilterSystem", () => {
  const fragments: FilterableFragment[] = [
    {
      id: "fragment-red-circle-1",
      tags: ["fragment", "color:red", "shape:circle"]
    },
    {
      id: "fragment-blue-circle-1",
      tags: ["fragment", "color:blue", "shape:circle"]
    },
    {
      id: "fragment-yellow-hexagon-1",
      tags: ["fragment", "color:yellow", "shape:hexagon"],
      placed: true
    }
  ];

  it("creates and changes active filter state immutably", () => {
    const empty = createFilterState(["color:red", "color:blue", "color:yellow"]);
    const red = setActiveFilter(empty, "color:red");
    const cleared = clearActiveFilter(red);

    expect(empty.activeTag).toBeUndefined();
    expect(red).toEqual({
      availableTags: ["color:red", "color:blue", "color:yellow"],
      activeTag: "color:red"
    });
    expect(cleared).toEqual({
      availableTags: ["color:red", "color:blue", "color:yellow"]
    });
  });

  it("highlights matching fragments and dims nonmatching fragments for M01 tags", () => {
    const state = setActiveFilter(
      createFilterState(["color:red", "color:blue", "color:yellow"]),
      "color:red"
    );

    expect(evaluateFragmentFilterState(fragments[0], state)).toEqual({
      fragmentId: "fragment-red-circle-1",
      visible: true,
      eligible: true,
      draggable: true,
      highlighted: true,
      dimmed: false,
      disabled: false,
      presentation: "highlighted"
    });

    expect(evaluateFragmentFilterState(fragments[1], state)).toMatchObject({
      fragmentId: "fragment-blue-circle-1",
      visible: true,
      eligible: false,
      draggable: false,
      highlighted: false,
      dimmed: true,
      disabled: true,
      presentation: "dimmed"
    });
  });

  it("keeps placed fragments disabled even when their tags match", () => {
    const state = setActiveFilter(
      createFilterState(["color:red", "color:blue", "color:yellow"]),
      "color:yellow"
    );

    expect(evaluateFragmentFilterState(fragments[2], state)).toEqual({
      fragmentId: "fragment-yellow-hexagon-1",
      visible: true,
      eligible: false,
      draggable: false,
      highlighted: false,
      dimmed: false,
      disabled: true,
      presentation: "disabled"
    });
  });

  it("returns a stable view map for all fragments", () => {
    const state = setActiveFilter(
      createFilterState(["color:red", "color:blue", "color:yellow"]),
      "color:blue"
    );

    expect(evaluateFragments(fragments, state)).toEqual({
      "fragment-red-circle-1": expect.objectContaining({
        presentation: "dimmed",
        eligible: false
      }),
      "fragment-blue-circle-1": expect.objectContaining({
        presentation: "highlighted",
        eligible: true
      }),
      "fragment-yellow-hexagon-1": expect.objectContaining({
        presentation: "disabled",
        eligible: false
      })
    });
  });
});
