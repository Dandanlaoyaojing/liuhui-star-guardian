import type { ProgressStore } from "../../core/ProgressStore.ts";
import type { PuzzleConfig } from "../../core/PuzzleConfig.ts";
import { createToolCard, type ToolCard, type ToolCardDraft } from "../../core/ToolCard.ts";

export type M01Color = string;
export type M01Shape = string;

export interface M01FilterDef {
  id: string;
  color: M01Color;
}

export interface M01FragmentDef {
  id: string;
  color: M01Color;
  shape: M01Shape;
  sprite?: string;
  tags?: string[];
  position?: { x: number; y: number };
}

export interface M01SlotDef {
  id: string;
  accepts: {
    color: M01Color;
    shape: M01Shape;
  };
  capacity?: number;
  tags?: string[];
  position?: { x: number; y: number };
}

export interface M01MemoryGearConfig extends PuzzleConfig {
  description?: string;
  dimensions?: string[];
  colors?: M01Color[];
  shapes?: M01Shape[];
  tuning?: {
    greyboxFragmentCount: number;
    targetFragmentCount: number;
    note?: string;
  };
  filters: M01FilterDef[];
  fragments: M01FragmentDef[];
  slots: M01SlotDef[];
  goal: {
    type: "all_sorted";
    params: {
      dimensions: ["color", "shape"];
      colors: M01Color[];
      shapes: M01Shape[];
    };
  };
  toolCard: ToolCardDraft;
  entities?: unknown[];
  repairSequence?: unknown;
}

export interface M01FragmentState extends M01FragmentDef {
  sorted: boolean;
  slotId: string | null;
}

export interface M01CompletionState {
  completed: boolean;
  sortedCount: number;
  totalFragments: number;
}

export type M01PlacementRejectReason =
  | "invalid_fragment"
  | "invalid_slot"
  | "inactive_filter"
  | "wrong_slot"
  | "slot_full"
  | "already_sorted";

export type M01PlacementResult =
  | {
      accepted: true;
      fragmentId: string;
      slotId: string;
      sortedCount: number;
      completed: boolean;
    }
  | {
      accepted: false;
      reason: M01PlacementRejectReason;
      fragmentId: string;
      slotId: string;
    };

export type M01FilterInsertResult =
  | {
      accepted: true;
      filterId: string;
      color: M01Color;
    }
  | {
      accepted: false;
      reason: "invalid_filter";
      filterId: string;
    };

export interface M01ControllerOptions {
  progressStore?: ProgressStore;
  now?: () => number;
}

export type M01CompletionResult =
  | {
      completed: true;
      newlyUnlocked: boolean;
      toolCard: ToolCard;
    }
  | {
      completed: false;
      reason: "not_complete";
    };

export class M01MemoryGearController {
  private readonly config: M01MemoryGearConfig;
  private readonly filtersById = new Map<string, M01FilterDef>();
  private readonly filtersByColor = new Map<M01Color, M01FilterDef>();
  private readonly slotsById = new Map<string, M01SlotDef>();
  private readonly fragmentsById = new Map<string, M01FragmentState>();
  private activeFilter: M01FilterDef | null = null;
  private unlockedToolCard: ToolCard | null = null;
  private repairCompleted = false;

  private constructor(
    config: M01MemoryGearConfig,
    private readonly options: M01ControllerOptions = {}
  ) {
    this.config = config;

    for (const filter of config.filters) {
      this.assertUnique(this.filtersById, filter.id, "filter");
      this.filtersById.set(filter.id, filter);
      this.filtersByColor.set(filter.color, filter);
    }

    for (const slot of config.slots) {
      this.assertUnique(this.slotsById, slot.id, "slot");
      this.slotsById.set(slot.id, slot);
    }

    for (const fragment of config.fragments) {
      this.assertUnique(this.fragmentsById, fragment.id, "fragment");
      this.fragmentsById.set(fragment.id, {
        ...fragment,
        sorted: false,
        slotId: null
      });
    }
  }

  static fromConfig(
    config: M01MemoryGearConfig,
    options: M01ControllerOptions = {}
  ): M01MemoryGearController {
    return new M01MemoryGearController(config, options);
  }

  insertFilter(filterIdOrColor: string): M01FilterInsertResult {
    const filter =
      this.filtersById.get(filterIdOrColor) ??
      this.filtersByColor.get(filterIdOrColor as M01Color);

    if (!filter) {
      return {
        accepted: false,
        reason: "invalid_filter",
        filterId: filterIdOrColor
      };
    }

    this.activeFilter = filter;
    return {
      accepted: true,
      filterId: filter.id,
      color: filter.color
    };
  }

  selectActiveFilter(filterIdOrColor: string): M01FilterInsertResult {
    return this.insertFilter(filterIdOrColor);
  }

  getActiveFilter(): M01FilterDef | null {
    return this.activeFilter ? { ...this.activeFilter } : null;
  }

  getDraggableFragmentIds(): string[] {
    return this.getFragments()
      .filter((fragment) => this.isFragmentDraggable(fragment.id))
      .map((fragment) => fragment.id);
  }

  isFragmentDraggable(fragmentId: string): boolean {
    const fragment = this.fragmentsById.get(fragmentId);
    if (!fragment || !this.activeFilter || fragment.sorted) {
      return false;
    }

    return fragment.color === this.activeFilter.color;
  }

  placeFragmentInSlot(fragmentId: string, slotId: string): M01PlacementResult {
    const fragment = this.fragmentsById.get(fragmentId);
    if (!fragment) {
      return { accepted: false, reason: "invalid_fragment", fragmentId, slotId };
    }

    const slot = this.slotsById.get(slotId);
    if (!slot) {
      return { accepted: false, reason: "invalid_slot", fragmentId, slotId };
    }

    if (fragment.sorted) {
      return { accepted: false, reason: "already_sorted", fragmentId, slotId };
    }

    if (!this.isFragmentDraggable(fragmentId)) {
      return { accepted: false, reason: "inactive_filter", fragmentId, slotId };
    }

    if (!this.slotAcceptsFragment(slot, fragment)) {
      return { accepted: false, reason: "wrong_slot", fragmentId, slotId };
    }

    if (this.isSlotFull(slot)) {
      return { accepted: false, reason: "slot_full", fragmentId, slotId };
    }

    fragment.slotId = slot.id;
    fragment.sorted = true;

    return {
      accepted: true,
      fragmentId,
      slotId,
      sortedCount: this.getCompletionState().sortedCount,
      completed: this.isComplete()
    };
  }

  getFragmentState(fragmentId: string): M01FragmentState | null {
    const fragment = this.fragmentsById.get(fragmentId);
    return fragment ? { ...fragment } : null;
  }

  getFragments(): M01FragmentState[] {
    return [...this.fragmentsById.values()].map((fragment) => ({ ...fragment }));
  }

  getCompletionState(): M01CompletionState {
    const fragments = [...this.fragmentsById.values()];
    const sortedCount = fragments.filter((fragment) => fragment.sorted).length;

    return {
      completed: sortedCount === fragments.length,
      sortedCount,
      totalFragments: fragments.length
    };
  }

  isComplete(): boolean {
    return this.getCompletionState().completed;
  }

  getToolCardUnlock(): { levelId: string; toolCard: ToolCard } | null {
    if (!this.isComplete()) {
      return null;
    }

    const toolCard = this.unlockedToolCard ?? this.createUnlockedToolCard();

    return {
      levelId: this.config.id,
      toolCard
    };
  }

  completeRepairAndUnlockToolCard(): M01CompletionResult {
    if (!this.isComplete()) {
      return {
        completed: false,
        reason: "not_complete"
      };
    }

    if (this.unlockedToolCard) {
      return {
        completed: true,
        newlyUnlocked: false,
        toolCard: this.unlockedToolCard
      };
    }

    const toolCard = this.createUnlockedToolCard();
    this.unlockedToolCard = toolCard;
    this.repairCompleted = true;
    this.options.progressStore?.markPuzzleCompleted(this.config.id, toolCard.unlockedAt);
    this.options.progressStore?.unlockToolCard(toolCard);

    return {
      completed: true,
      newlyUnlocked: true,
      toolCard
    };
  }

  hasCompletedRepair(): boolean {
    return this.repairCompleted;
  }

  private createUnlockedToolCard(): ToolCard {
    return createToolCard(this.config.toolCard, this.options.now?.());
  }

  private slotAcceptsFragment(slot: M01SlotDef, fragment: M01FragmentDef): boolean {
    return slot.accepts.color === fragment.color && slot.accepts.shape === fragment.shape;
  }

  private isSlotFull(slot: M01SlotDef): boolean {
    if (slot.capacity === undefined) {
      return false;
    }

    const placedCount = [...this.fragmentsById.values()].filter(
      (fragment) => fragment.slotId === slot.id
    ).length;

    return placedCount >= slot.capacity;
  }

  private assertUnique<T>(map: Map<string, T>, id: string, label: string): void {
    if (map.has(id)) {
      throw new Error(`Duplicate M01 ${label} id: ${id}`);
    }
  }
}
