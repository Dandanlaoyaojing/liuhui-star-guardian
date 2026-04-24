export interface FilterState {
  readonly availableTags: readonly string[];
  readonly activeTag?: string;
}

export interface FilterableFragment {
  readonly id: string;
  readonly tags: readonly string[];
  readonly placed?: boolean;
}

export type FragmentPresentation = "normal" | "highlighted" | "dimmed" | "disabled";

export interface FragmentFilterState {
  readonly fragmentId: string;
  readonly visible: boolean;
  readonly eligible: boolean;
  readonly draggable: boolean;
  readonly highlighted: boolean;
  readonly dimmed: boolean;
  readonly disabled: boolean;
  readonly presentation: FragmentPresentation;
}

export type FragmentFilterMap = Record<string, FragmentFilterState>;

export function createFilterState(availableTags: readonly string[]): FilterState {
  return {
    availableTags: [...availableTags]
  };
}

export function setActiveFilter(state: FilterState, activeTag: string): FilterState {
  if (!state.availableTags.includes(activeTag)) {
    throw new Error(`Unknown filter tag: ${activeTag}`);
  }

  return {
    availableTags: state.availableTags,
    activeTag
  };
}

export function clearActiveFilter(state: FilterState): FilterState {
  return {
    availableTags: state.availableTags
  };
}

export function evaluateFragmentFilterState(
  fragment: FilterableFragment,
  state: FilterState
): FragmentFilterState {
  if (fragment.placed) {
    return {
      fragmentId: fragment.id,
      visible: true,
      eligible: false,
      draggable: false,
      highlighted: false,
      dimmed: false,
      disabled: true,
      presentation: "disabled"
    };
  }

  if (!state.activeTag) {
    return {
      fragmentId: fragment.id,
      visible: true,
      eligible: false,
      draggable: false,
      highlighted: false,
      dimmed: false,
      disabled: true,
      presentation: "normal"
    };
  }

  const matchesActiveFilter = fragment.tags.includes(state.activeTag);

  return {
    fragmentId: fragment.id,
    visible: true,
    eligible: matchesActiveFilter,
    draggable: matchesActiveFilter,
    highlighted: matchesActiveFilter,
    dimmed: !matchesActiveFilter,
    disabled: !matchesActiveFilter,
    presentation: matchesActiveFilter ? "highlighted" : "dimmed"
  };
}

export function evaluateFragments(
  fragments: readonly FilterableFragment[],
  state: FilterState
): FragmentFilterMap {
  return fragments.reduce<FragmentFilterMap>((views, fragment) => {
    views[fragment.id] = evaluateFragmentFilterState(fragment, state);
    return views;
  }, {});
}
