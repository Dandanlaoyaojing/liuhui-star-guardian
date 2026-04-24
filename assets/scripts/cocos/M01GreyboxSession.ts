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
        status: `未知过滤器：${result.filterId}`
      };
    }

    return {
      accepted: true,
      status: `已启用 ${result.color} 过滤器。请选择同色碎片。`
    };
  }

  selectFragment(fragmentId: string): M01GreyboxSelectResult {
    const fragment = this.controller.getFragmentState(fragmentId);
    if (!fragment) {
      this.selectedFragmentId = undefined;
      return {
        accepted: false,
        reason: "invalid_fragment",
        status: `未知碎片：${fragmentId}`
      };
    }

    if (!this.controller.isFragmentDraggable(fragmentId)) {
      this.selectedFragmentId = undefined;
      return {
        accepted: false,
        reason: "inactive_filter",
        status: `碎片 ${fragmentId} 不属于当前过滤器。`
      };
    }

    this.selectedFragmentId = fragmentId;
    return {
      accepted: true,
      selectedFragmentId: fragmentId,
      status: `已选择 ${fragment.color} ${fragment.shape}。请选择匹配槽位。`
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
        status: "请先选择一个高亮碎片。"
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
        status: `无法放置 ${selectedFragmentId}：${result.reason}`
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
        ? "M01 已修复，认知工具卡已解锁。"
        : `已归位 ${result.sortedCount} 个碎片。`
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
