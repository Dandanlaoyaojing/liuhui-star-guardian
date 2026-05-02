import type {
  M01CandidateFragmentDef,
  M01FilterDef,
  M01FlashlightDef,
  M01MemoryGearConfig,
  M01OverlapEvidenceDef,
  M01Shape,
  M01SlotDef
} from "../levels/stage1/M01MemoryGearController.ts";
import {
  formatM01ColorLabel,
  formatM01GreyboxText,
  formatM01ShapeLabel,
  type M01GreyboxTextOverrides
} from "./M01GreyboxText.ts";

export type M01GreyboxNodeKind =
  | "gear"
  | "board"
  | "flashlight"
  | "filter"
  | "fragment"
  | "evidence"
  | "reference_pattern"
  | "slot"
  | "label";

export interface M01GreyboxPoint {
  x: number;
  y: number;
}

export interface M01GreyboxSize {
  width: number;
  height: number;
}

export interface M01GreyboxTokenNode {
  id: string;
  controllerId: string;
  kind: M01GreyboxNodeKind;
  label: string;
  position: M01GreyboxPoint;
  size: M01GreyboxSize;
  colorToken: string;
  shapeToken: M01Shape;
  tags: string[];
  fragmentSnapPositions?: Record<string, M01GreyboxPoint>;
}

export interface M01GreyboxLayout {
  canvas: M01GreyboxSize;
  statusText: string;
  gear: M01GreyboxTokenNode;
  board: M01GreyboxTokenNode;
  flashlights: M01GreyboxTokenNode[];
  filters?: M01GreyboxTokenNode[];
  fragments: M01GreyboxTokenNode[];
  evidence: M01GreyboxTokenNode[];
  referencePattern?: M01GreyboxTokenNode;
  referenceEvidence: M01GreyboxTokenNode[];
  slots?: M01GreyboxTokenNode[];
}

export interface M01GreyboxLayoutOptions {
  text?: M01GreyboxTextOverrides;
}

const CANVAS: M01GreyboxSize = { width: 960, height: 640 };
const MIN_EVIDENCE_FRAGMENT_SNAP_DISTANCE = 34;
const REFERENCE_PATTERN_CENTER: M01GreyboxPoint = { x: 340, y: 72 };
const REFERENCE_PATTERN_SCALE = 0.58;

export function buildM01GreyboxLayout(
  config: M01MemoryGearConfig,
  options: M01GreyboxLayoutOptions = {}
): M01GreyboxLayout {
  const filters = (config.filters ?? []).map((filter) =>
    buildFilterNode(filter, config, options.text)
  );
  const slots = (config.slots ?? []).map((slot) => buildSlotNode(slot, options.text));
  const evidence = (config.evidence ?? []).map((item) => buildEvidenceNode(item, options.text));
  const referenceEvidence = buildReferenceEvidenceNodes(config.evidence ?? [], options.text);
  const layout = {
    canvas: CANVAS,
    statusText: formatM01GreyboxText("initialInstruction", {}, options.text),
    gear: buildGearNode(config),
    board: buildBoardNode(),
    flashlights: (config.flashlights ?? []).map((flashlight) =>
      buildFlashlightNode(flashlight, options.text)
    ),
    fragments: config.fragments.map((fragment) => buildFragmentNode(fragment, options.text)),
    evidence,
    ...(referenceEvidence.length > 0 ? { referencePattern: buildReferencePatternNode(referenceEvidence) } : {}),
    referenceEvidence,
    ...(filters.length > 0 ? { filters } : {}),
    ...(slots.length > 0 ? { slots } : {})
  };

  return layout as M01GreyboxLayout;
}

function buildReferencePatternNode(
  referenceEvidence: M01GreyboxTokenNode[]
): M01GreyboxTokenNode {
  const bounds = referenceEvidence.reduce(
    (current, evidence) => ({
      minX: Math.min(current.minX, evidence.position.x - evidence.size.width / 2),
      maxX: Math.max(current.maxX, evidence.position.x + evidence.size.width / 2),
      minY: Math.min(current.minY, evidence.position.y - evidence.size.height / 2),
      maxY: Math.max(current.maxY, evidence.position.y + evidence.size.height / 2)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );

  return {
    id: "m01_reference_complete_pattern",
    controllerId: "m01_reference_complete_pattern",
    kind: "reference_pattern",
    label: "目标完整图案",
    position: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    },
    size: {
      width: bounds.maxX - bounds.minX + 34,
      height: bounds.maxY - bounds.minY + 34
    },
    colorToken: "neutral",
    shapeToken: "reference_pattern",
    tags: ["reference_evidence", "complete_pattern", "target_pattern"]
  };
}

function buildGearNode(config: M01MemoryGearConfig): M01GreyboxTokenNode {
  const gear = config.entities?.find((entity) => {
    if (!isRecord(entity)) {
      return false;
    }

    return entity.id === "entity_memory_gear";
  });
  const position = readPosition(isRecord(gear) ? gear.position : undefined, { x: 0, y: 0 });

  return {
    id: "entity_memory_gear",
    controllerId: "entity_memory_gear",
    kind: "gear",
    label: config.name,
    position,
    size: { width: 300, height: 300 },
    colorToken: "neutral",
    shapeToken: "gear",
    tags: ["gear", "repair_target"]
  };
}

function buildBoardNode(): M01GreyboxTokenNode {
  return {
    id: "m01_overlap_board",
    controllerId: "m01_overlap_board",
    kind: "board",
    label: "拼接盘",
    position: { x: 0, y: 0 },
    size: { width: 320, height: 320 },
    colorToken: "neutral",
    shapeToken: "board",
    tags: ["board", "assembly_board", "bottom_light"]
  };
}

function buildFlashlightNode(
  flashlight: M01FlashlightDef,
  text: M01GreyboxTextOverrides = {}
): M01GreyboxTokenNode {
  const color = formatM01ColorLabel(flashlight.color, text);

  return {
    id: flashlight.id,
    controllerId: flashlight.id,
    kind: "flashlight",
    label: flashlight.label ?? `${color}手电`,
    position: readPosition(flashlight.position, { x: -420, y: 0 }),
    size: { width: 76, height: 44 },
    colorToken: flashlight.color,
    shapeToken: "flashlight",
    tags: ["flashlight", flashlight.color]
  };
}

function buildFilterNode(
  filter: M01FilterDef,
  config: M01MemoryGearConfig,
  text: M01GreyboxTextOverrides = {}
): M01GreyboxTokenNode {
  const fallbackY = filter.color === "red" ? 160 : filter.color === "blue" ? 80 : 0;
  const entityPosition = findEntityPosition(config, filter.entityId ?? `entity_${filter.id}`);
  const color = formatM01ColorLabel(filter.color, text);

  return {
    id: filter.id,
    controllerId: filter.id,
    kind: "filter",
    label:
      text.filterLabel !== undefined
        ? formatM01GreyboxText("filterLabel", { color }, text)
        : filter.label ?? formatM01GreyboxText("filterLabel", { color }, text),
    position: readPosition(entityPosition, { x: -420, y: fallbackY }),
    size: { width: 76, height: 44 },
    colorToken: filter.color,
    shapeToken: "filter",
    tags: ["filter", filter.color]
  };
}

function buildFragmentNode(
  fragment: M01CandidateFragmentDef,
  text: M01GreyboxTextOverrides = {}
): M01GreyboxTokenNode {
  const colorToken = fragment.hiddenColor ? "hidden" : (fragment.color ?? "hidden");
  const shapeToken = fragment.shape ?? fragment.edgeShape;
  const color = formatM01ColorLabel(colorToken, text);
  const shape = formatM01ShapeLabel(shapeToken, text);

  return {
    id: fragment.id,
    controllerId: fragment.id,
    kind: "fragment",
    label: formatM01GreyboxText("tokenLabel", { color, shape }, text),
    position: readPosition(fragment.position, { x: 0, y: 0 }),
    size: { width: 48, height: 48 },
    colorToken,
    shapeToken,
    tags: ["candidate_fragment", ...(fragment.tags ?? [])]
  };
}

function buildEvidenceNode(
  evidence: M01OverlapEvidenceDef,
  text: M01GreyboxTextOverrides = {}
): M01GreyboxTokenNode {
  const color = formatM01ColorLabel(evidence.targetBlendColor, text);
  const shape = formatM01ShapeLabel(evidence.targetShape, text);
  const size = Math.max(evidence.tolerance * 2, 52);
  const position = readPosition(evidence.position, { x: 0, y: 0 });
  const sourceShapeTags = (evidence.generatedOverlap?.sourceShapes ?? []).map(
    (sourceShape) => `source-shape:${sourceShape}`
  );

  return {
    id: evidence.id,
    controllerId: evidence.id,
    kind: "evidence",
    label: formatM01GreyboxText("tokenLabel", { color, shape }, text),
    position,
    size: { width: size, height: size },
    colorToken: evidence.targetBlendColor,
    shapeToken: evidence.targetShape,
    tags: ["overlap_evidence", "snap_zone", ...sourceShapeTags, ...evidence.shapeTags],
    fragmentSnapPositions: buildEvidenceFragmentSnapPositions(evidence, position)
  };
}

function buildReferenceEvidenceNodes(
  evidenceItems: M01OverlapEvidenceDef[],
  text: M01GreyboxTextOverrides = {}
): M01GreyboxTokenNode[] {
  if (evidenceItems.length === 0) {
    return [];
  }

  const evidenceNodes = evidenceItems.map((evidence) => buildEvidenceNode(evidence, text));
  const bounds = evidenceNodes.reduce(
    (current, evidence) => ({
      minX: Math.min(current.minX, evidence.position.x),
      maxX: Math.max(current.maxX, evidence.position.x),
      minY: Math.min(current.minY, evidence.position.y),
      maxY: Math.max(current.maxY, evidence.position.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
  const sourceCenter = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };

  return evidenceNodes.map((token) => ({
    ...token,
    position: {
      x: REFERENCE_PATTERN_CENTER.x + (token.position.x - sourceCenter.x) * REFERENCE_PATTERN_SCALE,
      y: REFERENCE_PATTERN_CENTER.y + (token.position.y - sourceCenter.y) * REFERENCE_PATTERN_SCALE
    },
    size: {
      width: token.size.width * REFERENCE_PATTERN_SCALE,
      height: token.size.height * REFERENCE_PATTERN_SCALE
    },
    tags: token.tags.filter((tag) => tag !== "snap_zone").concat("reference_evidence", "complete_pattern"),
    fragmentSnapPositions: undefined
  }));
}

export function resolveM01EvidenceFragmentSnapPosition(
  evidence: M01GreyboxTokenNode,
  fragmentId: string
): M01GreyboxPoint {
  return evidence.fragmentSnapPositions?.[fragmentId] ?? evidence.position;
}

function buildEvidenceFragmentSnapPositions(
  evidence: M01OverlapEvidenceDef,
  evidencePosition: M01GreyboxPoint
): Record<string, M01GreyboxPoint> {
  const [firstFragmentId, secondFragmentId] = evidence.solution.fragmentIds;
  const offset = normalizeEvidenceSnapOffset(evidence.generatedOverlap?.offset);

  return {
    [firstFragmentId]: {
      x: evidencePosition.x - offset.x / 2,
      y: evidencePosition.y - offset.y / 2
    },
    [secondFragmentId]: {
      x: evidencePosition.x + offset.x / 2,
      y: evidencePosition.y + offset.y / 2
    }
  };
}

function normalizeEvidenceSnapOffset(
  offset: M01GreyboxPoint | undefined
): M01GreyboxPoint {
  const rawOffset = offset ?? { x: MIN_EVIDENCE_FRAGMENT_SNAP_DISTANCE, y: 0 };
  const length = Math.hypot(rawOffset.x, rawOffset.y);

  if (length === 0) {
    return { x: MIN_EVIDENCE_FRAGMENT_SNAP_DISTANCE, y: 0 };
  }

  const scale = Math.max(1, MIN_EVIDENCE_FRAGMENT_SNAP_DISTANCE / length);
  return {
    x: rawOffset.x * scale,
    y: rawOffset.y * scale
  };
}

function buildSlotNode(slot: M01SlotDef, text: M01GreyboxTextOverrides = {}): M01GreyboxTokenNode {
  const color = formatM01ColorLabel(slot.accepts.color, text);
  const shape = formatM01ShapeLabel(slot.accepts.shape, text);

  return {
    id: slot.id,
    controllerId: slot.id,
    kind: "slot",
    label: formatM01GreyboxText("tokenLabel", { color, shape }, text),
    position: readPosition(slot.position, { x: 0, y: 0 }),
    size: { width: 52, height: 52 },
    colorToken: slot.accepts.color,
    shapeToken: slot.accepts.shape,
    tags: [...(slot.tags ?? [])]
  };
}

function readPosition(value: unknown, fallback: M01GreyboxPoint): M01GreyboxPoint {
  if (!isRecord(value) || typeof value.x !== "number" || typeof value.y !== "number") {
    return fallback;
  }

  return {
    x: value.x,
    y: value.y
  };
}

function findEntityPosition(config: M01MemoryGearConfig, entityId: string): unknown {
  const entities = config.entities ?? config.scene.entities;
  const entity = entities?.find((candidate) => {
    return isRecord(candidate) && candidate.id === entityId;
  });

  return isRecord(entity) ? entity.position : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
