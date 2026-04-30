import type { ProgressStore } from "../../core/ProgressStore.ts";
import type { PuzzleConfig } from "../../core/PuzzleConfig.ts";
import { createToolCard, type ToolCard, type ToolCardDraft } from "../../core/ToolCard.ts";

export type M01Color = string;
export type M01Shape = string;
export type M01BaseColor = "red" | "yellow" | "blue";
export type M01BlendColor = M01BaseColor | "orange" | "green" | "purple";

export function blendM01PigmentColors(
  a: M01BaseColor,
  b: M01BaseColor
): M01BlendColor {
  if (a === b) {
    return a;
  }

  const key = [a, b].sort().join("+");
  const blends: Record<string, M01BlendColor> = {
    "blue+red": "purple",
    "blue+yellow": "green",
    "red+yellow": "orange"
  };

  return blends[key];
}

export function revealM01FragmentColor(
  fragment: { hiddenColor: M01BaseColor },
  flashlightColor: M01BaseColor
): M01BlendColor {
  return blendM01PigmentColors(fragment.hiddenColor, flashlightColor);
}

export interface M01FilterDef {
  id: string;
  color: M01Color;
  label?: string;
  entityId?: string;
}

export interface M01FragmentDef {
  id: string;
  color: M01Color;
  shape: M01Shape;
  sprite?: string;
  tags?: string[];
  position?: { x: number; y: number };
}

export interface M01FlashlightDef {
  id: string;
  color: M01BaseColor;
  label?: string;
  position?: { x: number; y: number };
}

export interface M01CandidateFragmentDef {
  id: string;
  hiddenColor: M01BaseColor;
  edgeShape: string;
  tags?: string[];
  position?: { x: number; y: number };
  color?: M01Color;
  shape?: M01Shape;
  sprite?: string;
}

export interface M01OverlapEvidenceDef {
  id: string;
  targetShape: string;
  targetBlendColor: Exclude<M01BlendColor, M01BaseColor>;
  position: { x: number; y: number };
  tolerance: number;
  shapeTags: string[];
  solution: {
    fragmentIds: [string, string];
  };
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
  colors: M01BaseColor[];
  blendColors: Exclude<M01BlendColor, M01BaseColor>[];
  flashlights: M01FlashlightDef[];
  fragments: M01CandidateFragmentDef[];
  evidence: M01OverlapEvidenceDef[];
  dimensions?: string[];
  shapes?: M01Shape[];
  tuning?: {
    greyboxFragmentCount: number;
    targetFragmentCount: number;
    note?: string;
  };
  filters?: M01FilterDef[];
  slots?: M01SlotDef[];
  goal: {
    type: "overlap_evidence_reconstructed";
    params: {
      candidateFragments: "config_defined";
      recommendedCandidateRange: [12, 16];
      requiredFragments: "solution_defined";
      evidenceCount: [4, 6];
      maxLayersPerEvidence: 2;
      validationLightSeconds: 2;
      baseColors: M01BaseColor[];
      blendColors: Exclude<M01BlendColor, M01BaseColor>[];
    };
  };
  toolCard: ToolCardDraft;
  entities?: unknown[];
  repairSequence?: unknown;
}

export interface M01FragmentState extends M01CandidateFragmentDef {
  sorted: boolean;
  slotId: string | null;
  hiddenColorVisible: boolean;
}

export type M01BottomLightState = "off" | "flash_then_off" | "steady_on";

export interface M01CompletionState {
  completed: boolean;
  sortedCount: number;
  totalFragments: number;
  reconstructedEvidenceCount: number;
  totalEvidenceCount: number;
  usedFragmentCount: number;
  bottomLight: M01BottomLightState;
}

export type M01RevealResult =
  | {
      accepted: true;
      fragmentId: string;
      flashlightColor: M01BaseColor;
      revealedColor: M01BlendColor;
    }
  | {
      accepted: false;
      reason: "invalid_fragment";
      fragmentId: string;
    };

export type M01EvidenceStageResult =
  | {
      accepted: true;
      evidenceId: string;
      fragmentIds: [string, string];
      colorRevealed: false;
    }
  | {
      accepted: false;
      reason: "invalid_evidence" | "invalid_fragment" | "wrong_shape";
      evidenceId: string;
      fragmentIds: string[];
    };

export type M01CandidateValidationResult =
  | {
      accepted: true;
      bottomLight: "steady_on";
      validationLightSeconds: null;
      completed: true;
      reconstructedEvidenceIds: string[];
    }
  | {
      accepted: false;
      reason: "incomplete_candidate" | "wrong_blend_color" | "wrong_fragment_set";
      bottomLight: "flash_then_off";
      validationLightSeconds: 2;
      completed: false;
      revealedEvidence: Array<{
        evidenceId: string;
        actualBlendColor: M01BlendColor;
        expectedBlendColor: M01BlendColor;
      }>;
    };

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
  private readonly evidenceById = new Map<string, M01OverlapEvidenceDef>();
  private readonly reconstructedEvidenceIds = new Set<string>();
  private readonly stagedEvidencePairs = new Map<string, [string, string]>();
  private activeFilter: M01FilterDef | null = null;
  private unlockedToolCard: ToolCard | null = null;
  private repairCompleted = false;
  private bottomLight: M01BottomLightState = "off";

  private constructor(
    config: M01MemoryGearConfig,
    private readonly options: M01ControllerOptions = {}
  ) {
    this.config = config;

    for (const filter of config.filters ?? []) {
      this.assertUnique(this.filtersById, filter.id, "filter");
      this.filtersById.set(filter.id, filter);
      this.filtersByColor.set(filter.color, filter);
    }

    for (const slot of config.slots ?? []) {
      this.assertUnique(this.slotsById, slot.id, "slot");
      this.slotsById.set(slot.id, slot);
    }

    for (const fragment of config.fragments) {
      this.assertUnique(this.fragmentsById, fragment.id, "fragment");
      this.fragmentsById.set(fragment.id, {
        ...fragment,
        sorted: false,
        slotId: null,
        hiddenColorVisible: false
      });
    }

    for (const evidence of config.evidence ?? []) {
      this.assertUnique(this.evidenceById, evidence.id, "evidence");
      this.evidenceById.set(evidence.id, evidence);
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

  revealFragmentWithFlashlight(
    fragmentId: string,
    flashlightColor: M01BaseColor
  ): M01RevealResult {
    const fragment = this.fragmentsById.get(fragmentId);
    if (!fragment) {
      return {
        accepted: false,
        reason: "invalid_fragment",
        fragmentId
      };
    }

    return {
      accepted: true,
      fragmentId,
      flashlightColor,
      revealedColor: revealM01FragmentColor(fragment, flashlightColor)
    };
  }

  stageEvidencePair(evidenceId: string, fragmentIds: string[]): M01EvidenceStageResult {
    const evidence = this.evidenceById.get(evidenceId);
    if (!evidence) {
      return {
        accepted: false,
        reason: "invalid_evidence",
        evidenceId,
        fragmentIds: [...fragmentIds]
      };
    }

    if (fragmentIds.length !== 2) {
      return {
        accepted: false,
        reason: "wrong_shape",
        evidenceId,
        fragmentIds: [...fragmentIds]
      };
    }

    const fragments = fragmentIds.map((fragmentId) => this.fragmentsById.get(fragmentId));
    if (fragments.some((fragment) => fragment === undefined)) {
      return {
        accepted: false,
        reason: "invalid_fragment",
        evidenceId,
        fragmentIds: [...fragmentIds]
      };
    }

    const pair = [fragmentIds[0], fragmentIds[1]] as [string, string];
    if (!this.pairMatchesEvidenceShape(evidence, fragments as [M01FragmentState, M01FragmentState])) {
      return {
        accepted: false,
        reason: "wrong_shape",
        evidenceId,
        fragmentIds: pair
      };
    }

    this.stagedEvidencePairs.set(evidenceId, pair);

    return {
      accepted: true,
      evidenceId,
      fragmentIds: pair,
      colorRevealed: false
    };
  }

  validateCandidateStructure(): M01CandidateValidationResult {
    const evidenceDefs = this.getEvidenceDefs();
    if (
      evidenceDefs.length === 0 ||
      evidenceDefs.some((evidence) => !this.stagedEvidencePairs.has(evidence.id))
    ) {
      return this.rejectCandidateStructure("incomplete_candidate", []);
    }

    const revealedEvidence = evidenceDefs.map((evidence) => {
      const pair = this.stagedEvidencePairs.get(evidence.id);
      const fragments = pair?.map((fragmentId) => this.fragmentsById.get(fragmentId)) ?? [];
      const [first, second] = fragments as [M01FragmentState | undefined, M01FragmentState | undefined];
      const actualBlendColor =
        first && second ? blendM01PigmentColors(first.hiddenColor, second.hiddenColor) : "red";

      return {
        evidenceId: evidence.id,
        actualBlendColor,
        expectedBlendColor: evidence.targetBlendColor
      };
    });

    if (
      revealedEvidence.some(
        (evidence) => evidence.actualBlendColor !== evidence.expectedBlendColor
      )
    ) {
      return this.rejectCandidateStructure("wrong_blend_color", revealedEvidence);
    }

    if (!this.stagedFragmentSetMatchesSolution()) {
      return this.rejectCandidateStructure("wrong_fragment_set", revealedEvidence);
    }

    this.bottomLight = "steady_on";
    for (const evidence of evidenceDefs) {
      this.reconstructedEvidenceIds.add(evidence.id);
    }

    return {
      accepted: true,
      bottomLight: "steady_on",
      validationLightSeconds: null,
      completed: true,
      reconstructedEvidenceIds: evidenceDefs.map((evidence) => evidence.id)
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
    const evidenceDefs = this.getEvidenceDefs();
    const completed =
      evidenceDefs.length > 0
        ? this.reconstructedEvidenceIds.size === evidenceDefs.length
        : sortedCount === fragments.length;

    return {
      completed,
      sortedCount,
      totalFragments: fragments.length,
      reconstructedEvidenceCount: this.reconstructedEvidenceIds.size,
      totalEvidenceCount: evidenceDefs.length,
      usedFragmentCount: this.getSolutionFragmentIds().size,
      bottomLight: this.bottomLight
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

  private slotAcceptsFragment(slot: M01SlotDef, fragment: M01FragmentState): boolean {
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

  private getEvidenceDefs(): M01OverlapEvidenceDef[] {
    return [...this.evidenceById.values()];
  }

  private getSolutionFragmentIds(): Set<string> {
    return new Set(
      this.getEvidenceDefs().flatMap((evidence) => evidence.solution.fragmentIds)
    );
  }

  private pairMatchesEvidenceShape(
    evidence: M01OverlapEvidenceDef,
    fragments: [M01FragmentState, M01FragmentState]
  ): boolean {
    const availableShapeTags = fragments.flatMap((fragment) => [
      fragment.edgeShape,
      ...(fragment.tags ?? [])
    ]);

    return evidence.shapeTags.every((tag) => {
      const index = availableShapeTags.indexOf(tag);
      if (index === -1) {
        return false;
      }

      availableShapeTags.splice(index, 1);
      return true;
    });
  }

  private stagedFragmentSetMatchesSolution(): boolean {
    const expectedFragmentIds = this.getSolutionFragmentIds();
    const actualFragmentIds = new Set(
      [...this.stagedEvidencePairs.values()].flatMap((fragmentIds) => fragmentIds)
    );

    if (actualFragmentIds.size !== expectedFragmentIds.size) {
      return false;
    }

    for (const fragmentId of expectedFragmentIds) {
      if (!actualFragmentIds.has(fragmentId)) {
        return false;
      }
    }

    return true;
  }

  private rejectCandidateStructure(
    reason: "incomplete_candidate" | "wrong_blend_color" | "wrong_fragment_set",
    revealedEvidence: Array<{
      evidenceId: string;
      actualBlendColor: M01BlendColor;
      expectedBlendColor: M01BlendColor;
    }>
  ): M01CandidateValidationResult {
    this.bottomLight = "flash_then_off";

    return {
      accepted: false,
      reason,
      bottomLight: "flash_then_off",
      validationLightSeconds: 2,
      completed: false,
      revealedEvidence
    };
  }

  private assertUnique<T>(map: Map<string, T>, id: string, label: string): void {
    if (map.has(id)) {
      throw new Error(`Duplicate M01 ${label} id: ${id}`);
    }
  }
}
