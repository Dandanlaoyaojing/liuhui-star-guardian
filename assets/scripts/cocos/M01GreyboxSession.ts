import type { ToolCard } from "../core/ToolCard.ts";
import {
  M01MemoryGearController,
  type M01CompletionState,
  type M01MemoryGearConfig
} from "../levels/stage1/M01MemoryGearController.ts";
import { formatM01GreyboxText, type M01GreyboxTextOverrides } from "./M01GreyboxText.ts";

export interface M01GreyboxSessionOptions {
  now?: () => number;
  text?: M01GreyboxTextOverrides;
}

export type M01GreyboxFilterPresentation = "normal" | "active" | "hinted";
export type M01GreyboxFragmentPresentation =
  | "normal"
  | "highlighted"
  | "dimmed"
  | "selected"
  | "hinted"
  | "placed";
export type M01GreyboxSlotPresentation = "normal" | "hinted" | "error";
export type M01GreyboxRepairPresentation = "normal" | "repaired";

export interface M01GreyboxFilterView {
  filterId: string;
  active: boolean;
  hinted: boolean;
  presentation: M01GreyboxFilterPresentation;
}

export interface M01GreyboxFragmentView {
  fragmentId: string;
  selected: boolean;
  placed: boolean;
  hinted: boolean;
  interactive: boolean;
  slotId?: string;
  presentation: M01GreyboxFragmentPresentation;
}

export interface M01GreyboxSlotView {
  slotId: string;
  hinted: boolean;
  error: boolean;
  presentation: M01GreyboxSlotPresentation;
}

export interface M01GreyboxRepairView {
  repaired: boolean;
  presentation: M01GreyboxRepairPresentation;
}

export interface M01GreyboxHint {
  level: 1 | 2 | 3;
  text: string;
  targetIds: string[];
}

export interface M01GreyboxFeedback {
  kind: "success" | "error";
  message: string;
  targetIds: string[];
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
  private readonly config: M01MemoryGearConfig;
  private readonly text: M01GreyboxTextOverrides;
  private selectedFragmentId: string | undefined;
  private lastToolCard: ToolCard | undefined;
  private lastHint: M01GreyboxHint | undefined;
  private lastFeedback: M01GreyboxFeedback | undefined;

  private constructor(config: M01MemoryGearConfig, options: M01GreyboxSessionOptions = {}) {
    this.config = config;
    this.controller = M01MemoryGearController.fromConfig(config, options);
    this.text = options.text ?? {};
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
        status: this.format("unknownFilter", { filterId: result.filterId })
      };
    }

    this.lastHint = undefined;
    this.lastFeedback = undefined;

    return {
      accepted: true,
      status: this.format("filterActivated", { color: result.color })
    };
  }

  selectFragment(fragmentId: string): M01GreyboxSelectResult {
    const fragment = this.controller.getFragmentState(fragmentId);
    if (!fragment) {
      this.selectedFragmentId = undefined;
      return {
        accepted: false,
        reason: "invalid_fragment",
        status: this.format("unknownFragment", { fragmentId })
      };
    }

    if (!this.controller.isFragmentDraggable(fragmentId)) {
      this.selectedFragmentId = undefined;
      this.lastFeedback = {
        kind: "error",
        message: this.format("wrongPlacementFeedback"),
        targetIds: [fragmentId]
      };
      return {
        accepted: false,
        reason: "inactive_filter",
        status: this.format("inactiveFragment", { fragmentId })
      };
    }

    this.selectedFragmentId = fragmentId;
    this.lastFeedback = undefined;
    return {
      accepted: true,
      selectedFragmentId: fragmentId,
      status: this.format("fragmentSelected", {
        color: fragment.color ?? fragment.hiddenColor,
        shape: fragment.shape ?? fragment.edgeShape
      })
    };
  }

  placeSelectedFragment(slotId: string): M01GreyboxPlaceResult {
    const selectedFragmentId = this.selectedFragmentId;
    const before = this.controller.getCompletionState();

    if (!selectedFragmentId) {
      this.lastFeedback = {
        kind: "error",
        message: this.format("noSelectionFeedback"),
        targetIds: []
      };
      return {
        accepted: false,
        reason: "no_selection",
        sortedCount: before.sortedCount,
        completed: false,
        status: this.format("selectFragmentFirst")
      };
    }

    const result = this.controller.placeFragmentInSlot(selectedFragmentId, slotId);
    if (!result.accepted) {
      this.lastFeedback = {
        kind: "error",
        message: this.format("wrongPlacementFeedback"),
        targetIds: [selectedFragmentId, slotId]
      };
      return {
        accepted: false,
        reason: result.reason,
        selectedFragmentId,
        sortedCount: before.sortedCount,
        completed: false,
        status: this.format("placeRejected", {
          fragmentId: selectedFragmentId,
          reason: result.reason
        })
      };
    }

    this.selectedFragmentId = undefined;

    if (result.completed) {
      const completion = this.controller.completeRepairAndUnlockToolCard();
      if (completion.completed) {
        this.lastToolCard = completion.toolCard;
      }
    }

    this.lastHint = undefined;
    this.lastFeedback = {
      kind: "success",
      message: this.format("correctPlacementFeedback"),
      targetIds: [result.slotId]
    };

    return {
      accepted: true,
      selectedFragmentId: undefined,
      sortedCount: result.sortedCount,
      completed: result.completed,
      status: result.completed
        ? this.format("repairCompleted")
        : this.format("sortedCount", { sortedCount: result.sortedCount })
    };
  }

  requestHint(): M01GreyboxHint {
    const activeFilter = this.controller.getActiveFilter();
    let hint: M01GreyboxHint;

    if (!activeFilter) {
      hint = {
        level: 1,
        text: this.format("hintNoFilter"),
        targetIds: (this.config.filters ?? []).map((filter) => filter.id)
      };
    } else if (!this.selectedFragmentId) {
      hint = {
        level: 2,
        text: this.format("hintActiveFilter"),
        targetIds: this.controller.getDraggableFragmentIds()
      };
    } else {
      hint = {
        level: 3,
        text: this.format("hintSelectedFragment"),
        targetIds: this.findTargetSlotIds(this.selectedFragmentId)
      };
    }

    this.lastHint = hint;
    this.lastFeedback = undefined;
    return hint;
  }

  getSelectedFragmentId(): string | undefined {
    return this.selectedFragmentId;
  }

  getFilterView(filterId: string): M01GreyboxFilterView {
    const activeFilter = this.controller.getActiveFilter();
    const active = activeFilter?.id === filterId;
    const hinted = !active && this.lastHint?.targetIds.includes(filterId) === true;

    return {
      filterId,
      active,
      hinted,
      presentation: active ? "active" : hinted ? "hinted" : "normal"
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
        hinted: false,
        interactive: false,
        presentation: "normal"
      };
    }

    if (fragment.sorted) {
      return {
        fragmentId,
        selected: false,
        placed: true,
        hinted: false,
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
        hinted: false,
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
        hinted: false,
        interactive: false,
        presentation: "normal"
      };
    }

    const interactive = this.controller.isFragmentDraggable(fragmentId);
    const hinted = interactive && this.lastHint?.targetIds.includes(fragmentId) === true;

    return {
      fragmentId,
      selected: false,
      placed: false,
      hinted,
      interactive,
      presentation: hinted ? "hinted" : interactive ? "highlighted" : "dimmed"
    };
  }

  getSlotView(slotId: string): M01GreyboxSlotView {
    const error = this.lastFeedback?.kind === "error" && this.lastFeedback.targetIds.includes(slotId);
    const hinted = !error && this.lastHint?.targetIds.includes(slotId) === true;

    return {
      slotId,
      hinted,
      error,
      presentation: error ? "error" : hinted ? "hinted" : "normal"
    };
  }

  getRepairView(): M01GreyboxRepairView {
    const repaired = this.controller.hasCompletedRepair();

    return {
      repaired,
      presentation: repaired ? "repaired" : "normal"
    };
  }

  getCompletionState(): M01CompletionState {
    return this.controller.getCompletionState();
  }

  getLastFeedback(): M01GreyboxFeedback | undefined {
    return this.lastFeedback ? { ...this.lastFeedback, targetIds: [...this.lastFeedback.targetIds] } : undefined;
  }

  getLastToolCard(): ToolCard | undefined {
    return this.lastToolCard;
  }

  private findTargetSlotIds(fragmentId: string): string[] {
    const fragment = this.controller.getFragmentState(fragmentId);
    if (!fragment) {
      return [];
    }

    const slot = (this.config.slots ?? []).find((candidate) => {
      return candidate.accepts.color === fragment.color && candidate.accepts.shape === fragment.shape;
    });

    return slot ? [slot.id] : [];
  }

  private format(
    key: Parameters<typeof formatM01GreyboxText>[0],
    params: Record<string, string | number> = {}
  ): string {
    return formatM01GreyboxText(key, params, this.text);
  }
}
