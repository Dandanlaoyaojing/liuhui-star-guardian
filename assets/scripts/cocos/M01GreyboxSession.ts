import type { ToolCard } from "../core/ToolCard.ts";
import {
  M01MemoryGearController,
  type M01CompletionState,
  type M01MemoryGearConfig
} from "../levels/stage1/M01MemoryGearController.ts";

export interface M01GreyboxSessionOptions {
  now?: () => number;
}

export type M01GreyboxFilterPresentation = "normal" | "active";
export type M01GreyboxFragmentPresentation =
  | "normal"
  | "highlighted"
  | "dimmed"
  | "selected"
  | "placed";

export interface M01GreyboxFilterView {
  filterId: string;
  active: boolean;
  presentation: M01GreyboxFilterPresentation;
}

export interface M01GreyboxFragmentView {
  fragmentId: string;
  selected: boolean;
  placed: boolean;
  interactive: boolean;
  slotId?: string;
  presentation: M01GreyboxFragmentPresentation;
}

export type M01GreyboxSelectResult =
  | {
      accepted: true;
      selectedFragmentId: string;
      status: string;
    }
  | {
      accepted: false;
      reason: "invalid_fragment" | "inactive_filter";
      selectedFragmentId?: string;
      status: string;
    };

export type M01GreyboxPlaceResult =
  | {
      accepted: true;
      selectedFragmentId: undefined;
      sortedCount: number;
      completed: boolean;
      status: string;
    }
  | {
      accepted: false;
      reason:
        | "no_selection"
        | "invalid_fragment"
        | "invalid_slot"
        | "inactive_filter"
        | "wrong_slot"
        | "slot_full"
        | "already_sorted";
      selectedFragmentId?: string;
      sortedCount: number;
      completed: false;
      status: string;
    };

export class M01GreyboxSession {
  private readonly controller: M01MemoryGearController;
  private selectedFragmentId: string | undefined;
  private lastToolCard: ToolCard | undefined;

  private constructor(config: M01MemoryGearConfig, options: M01GreyboxSessionOptions = {}) {
    this.controller = M01MemoryGearController.fromConfig(config, options);
  }

  static fromConfig(
    config: M01MemoryGearConfig,
    options: M01GreyboxSessionOptions = {}
  ): M01GreyboxSession {
    return new M01GreyboxSession(config, options);
  }

  activateFilter(filterIdOrColor: string): { accepted: boolean; status: string } {
    const result = this.controller.insertFilter(filterIdOrColor);
    this.selectedFragmentId = undefined;

    if (!result.accepted) {
      return {
        accepted: false,
        status: `Unknown filter: ${result.filterId}`
      };
    }

    return {
      accepted: true,
      status: `Active filter: ${result.color}. Select a matching fragment.`
    };
  }

  selectFragment(fragmentId: string): M01GreyboxSelectResult {
    const fragment = this.controller.getFragmentState(fragmentId);
    if (!fragment) {
      this.selectedFragmentId = undefined;
      return {
        accepted: false,
        reason: "invalid_fragment",
        status: `Unknown fragment: ${fragmentId}`
      };
    }

    if (!this.controller.isFragmentDraggable(fragmentId)) {
      this.selectedFragmentId = undefined;
      return {
        accepted: false,
        reason: "inactive_filter",
        status: `Fragment ${fragmentId} is not active for the current filter.`
      };
    }

    this.selectedFragmentId = fragmentId;
    return {
      accepted: true,
      selectedFragmentId: fragmentId,
      status: `Selected ${fragment.color} ${fragment.shape}. Choose a matching slot.`
    };
  }

  placeSelectedFragment(slotId: string): M01GreyboxPlaceResult {
    const selectedFragmentId = this.selectedFragmentId;
    const before = this.controller.getCompletionState();

    if (!selectedFragmentId) {
      return {
        accepted: false,
        reason: "no_selection",
        sortedCount: before.sortedCount,
        completed: false,
        status: "Select an active fragment first."
      };
    }

    const result = this.controller.placeFragmentInSlot(selectedFragmentId, slotId);
    if (!result.accepted) {
      return {
        accepted: false,
        reason: result.reason,
        selectedFragmentId,
        sortedCount: before.sortedCount,
        completed: false,
        status: `Rejected ${selectedFragmentId}: ${result.reason}`
      };
    }

    this.selectedFragmentId = undefined;

    if (result.completed) {
      const completion = this.controller.completeRepairAndUnlockToolCard();
      if (completion.completed) {
        this.lastToolCard = completion.toolCard;
      }
    }

    return {
      accepted: true,
      selectedFragmentId: undefined,
      sortedCount: result.sortedCount,
      completed: result.completed,
      status: result.completed
        ? "M01 repaired. ToolCard unlocked."
        : `Sorted ${result.sortedCount} fragments.`
    };
  }

  getSelectedFragmentId(): string | undefined {
    return this.selectedFragmentId;
  }

  getFilterView(filterId: string): M01GreyboxFilterView {
    const activeFilter = this.controller.getActiveFilter();
    const active = activeFilter?.id === filterId;

    return {
      filterId,
      active,
      presentation: active ? "active" : "normal"
    };
  }

  getFragmentView(fragmentId: string): M01GreyboxFragmentView {
    const fragment = this.controller.getFragmentState(fragmentId);
    const selected = this.selectedFragmentId === fragmentId;

    if (!fragment) {
      return {
        fragmentId,
        selected: false,
        placed: false,
        interactive: false,
        presentation: "normal"
      };
    }

    if (fragment.sorted) {
      return {
        fragmentId,
        selected: false,
        placed: true,
        interactive: false,
        slotId: fragment.slotId ?? undefined,
        presentation: "placed"
      };
    }

    if (selected) {
      return {
        fragmentId,
        selected: true,
        placed: false,
        interactive: true,
        presentation: "selected"
      };
    }

    const activeFilter = this.controller.getActiveFilter();
    if (!activeFilter) {
      return {
        fragmentId,
        selected: false,
        placed: false,
        interactive: false,
        presentation: "normal"
      };
    }

    const interactive = this.controller.isFragmentDraggable(fragmentId);

    return {
      fragmentId,
      selected: false,
      placed: false,
      interactive,
      presentation: interactive ? "highlighted" : "dimmed"
    };
  }

  getCompletionState(): M01CompletionState {
    return this.controller.getCompletionState();
  }

  getLastToolCard(): ToolCard | undefined {
    return this.lastToolCard;
  }
}
