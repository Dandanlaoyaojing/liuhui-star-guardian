import type {
  M01BaseColor,
  M01CandidateFragmentDef,
  M01FilterDef,
  M01FlashlightDef,
  M01MemoryGearConfig,
  M01OverlapEvidenceDef,
  M01Shape,
  M01StandardPieceDef,
  M01SlotDef
} from "../levels/stage1/M01MemoryGearController.ts";
import {
  formatM01ColorLabel,
  formatM01GreyboxText,
  formatM01ShapeLabel,
  type M01GreyboxTextOverrides
} from "./M01GreyboxText.ts";
import {
  resolveM01StandardPieceBlendOverlays,
  type M01StandardPieceBlendPlacement
} from "./M01StandardPieceBlend.ts";
import { resolveM01ConfigWithCurrentTargetEvidence } from "./M01TargetPatternGenerator.ts";

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
  sourcePosition?: M01GreyboxPoint;
  size: M01GreyboxSize;
  colorToken: string;
  shapeToken: M01Shape;
  tags: string[];
  fragmentSnapPositions?: Record<string, M01GreyboxPoint>;
  magnetPolygon?: M01GreyboxPoint[];
}

export interface M01GreyboxPieceSnapZone {
  id: string;
  expectedFragmentId?: string;
  standardPieceId?: string;
  shapeToken: M01Shape;
  position: M01GreyboxPoint;
  size: M01GreyboxSize;
  rotation: number;
  layer: number;
  tags: string[];
}

export interface M01GreyboxLayout {
  canvas: M01GreyboxSize;
  statusText: string;
  evidenceSnapEnabled: boolean;
  gear: M01GreyboxTokenNode;
  board: M01GreyboxTokenNode;
  targetPieceSlots: M01GreyboxPieceSnapZone[];
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

interface M01EvidenceNodeBuildOptions {
  synthesizeLegacyGeneratedOverlap?: boolean;
}

const CANVAS: M01GreyboxSize = { width: 960, height: 640 };
const MIN_EVIDENCE_FRAGMENT_SNAP_DISTANCE = 34;
export const M01_STANDARD_PIECE_DISPLAY_SIZE: M01GreyboxSize = { width: 56, height: 56 };
export const M01_TARGET_REFERENCE_DISPLAY_SIZE: M01GreyboxSize = { width: 196, height: 170.32 };
export const M01_TARGET_REFERENCE_PIECE_SLOT_SIZE: M01GreyboxSize = M01_STANDARD_PIECE_DISPLAY_SIZE;
const REFERENCE_PATTERN_CENTER: M01GreyboxPoint = { x: -360, y: 120 };
const REFERENCE_PATTERN_SCALE = 0.4;
const EVIDENCE_WORK_AREA_CENTER: M01GreyboxPoint = { x: -60, y: 0 };
const EVIDENCE_WORK_AREA_SCALE = 0.85;

export function buildM01GreyboxLayout(
  config: M01MemoryGearConfig,
  options: M01GreyboxLayoutOptions = {}
): M01GreyboxLayout {
  const resolvedConfig = resolveM01ConfigWithCurrentTargetEvidence(config);
  const filters = (resolvedConfig.filters ?? []).map((filter) =>
    buildFilterNode(filter, resolvedConfig, options.text)
  );
  const slots = (resolvedConfig.slots ?? []).map((slot) => buildSlotNode(slot, options.text));
  const evidenceSnapEnabled = shouldEnableEvidenceSnap(resolvedConfig);
  const evidenceBuildOptions = { synthesizeLegacyGeneratedOverlap: evidenceSnapEnabled };
  const evidence = buildEvidenceWorkNodes(resolvedConfig.evidence ?? [], options.text, evidenceBuildOptions);
  const referenceEvidence = buildReferenceEvidenceNodes(resolvedConfig.evidence ?? [], options.text, evidenceBuildOptions);
  const layout = {
    canvas: CANVAS,
    statusText: formatM01GreyboxText("initialInstruction", {}, options.text),
    evidenceSnapEnabled,
    gear: buildGearNode(resolvedConfig),
    board: buildBoardNode(),
    targetPieceSlots: buildTargetPieceSnapZones(resolvedConfig),
    flashlights: (resolvedConfig.flashlights ?? []).map((flashlight) =>
      buildFlashlightNode(flashlight, options.text)
    ),
    fragments: resolvedConfig.fragments.map((fragment) => buildFragmentNode(fragment, options.text)),
    evidence,
    ...(referenceEvidence.length > 0 ? { referencePattern: buildReferencePatternNode(referenceEvidence) } : {}),
    referenceEvidence,
    ...(filters.length > 0 ? { filters } : {}),
    ...(slots.length > 0 ? { slots } : {})
  };

  return layout as M01GreyboxLayout;
}

function shouldEnableEvidenceSnap(config: M01MemoryGearConfig): boolean {
  return config.targetPattern?.locked !== false;
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
    tags: ["reference_evidence", "complete_pattern", "target_pattern", "standard_piece_geometry"]
  };
}

function buildGearNode(config: M01MemoryGearConfig): M01GreyboxTokenNode {
  const position = readPosition(findEntityPosition(config, "entity_memory_gear"), { x: 0, y: 0 });

  return {
    id: "entity_memory_gear",
    controllerId: "entity_memory_gear",
    kind: "gear",
    label: config.name,
    position,
    size: { width: 430, height: 430 },
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
    position: { x: -60, y: 0 },
    size: { width: 430, height: 430 },
    colorToken: "neutral",
    shapeToken: "board",
    tags: ["board", "assembly_board", "bottom_light"]
  };
}

function buildTargetPieceSnapZones(config: M01MemoryGearConfig): M01GreyboxPieceSnapZone[] {
  if (!config.targetPattern || !config.standardPieces) {
    return [];
  }

  const standardPiecesById = new Map(
    config.standardPieces.map((standardPiece) => [standardPiece.id, standardPiece])
  );

  return config.targetPattern.pieces
    .map((piece): M01GreyboxPieceSnapZone | undefined => {
      const standardPiece = standardPiecesById.get(piece.standardPieceId);
      if (!standardPiece) {
        return undefined;
      }

      return targetPieceSnapZoneFromManifest(piece, standardPiece);
    })
    .filter((slot): slot is M01GreyboxPieceSnapZone => slot !== undefined)
    .sort((a, b) => a.layer - b.layer);
}

function targetPieceSnapZoneFromManifest(
  piece: {
    id: string;
    fragmentId?: string;
    standardPieceId: string;
    position: M01GreyboxPoint;
    rotation?: number;
    layer?: number;
  },
  standardPiece: M01StandardPieceDef
): M01GreyboxPieceSnapZone {
  return {
    id: piece.id,
    expectedFragmentId: piece.fragmentId,
    standardPieceId: piece.standardPieceId,
    shapeToken: standardPiece.shape,
    position: piece.position,
    size: standardPiece.size,
    rotation: piece.rotation ?? 0,
    layer: piece.layer ?? 0,
    tags: [
      "target_piece",
      "manual_standard_piece_manifest",
      `standard-piece:${piece.standardPieceId}`,
      `shape:${standardPiece.shape}`
    ]
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
    position: positionForFlashlightButton(flashlight.color),
    size: { width: 10, height: 10 },
    colorToken: flashlight.color,
    shapeToken: "flashlight",
    tags: ["flashlight", flashlight.color]
  };
}

function positionForFlashlightButton(color: M01FlashlightDef["color"]): M01GreyboxPoint {
  const positions: Record<M01FlashlightDef["color"], M01GreyboxPoint> = {
    red: { x: 359, y: 53 },
    yellow: { x: 360, y: 42 },
    blue: { x: 358, y: 30 }
  };

  return positions[color];
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
  const colorToken = fragment.hiddenColor ?? fragment.color ?? "hidden";
  const shapeToken = fragment.shape ?? fragment.edgeShape;
  const color = formatM01ColorLabel(colorToken, text);
  const shape = formatM01ShapeLabel(shapeToken, text);

  return {
    id: fragment.id,
    controllerId: fragment.id,
    kind: "fragment",
    label: formatM01GreyboxText("tokenLabel", { color, shape }, text),
    position: readPosition(fragment.position, { x: 0, y: 0 }),
    size: M01_STANDARD_PIECE_DISPLAY_SIZE,
    colorToken,
    shapeToken,
    tags: ["candidate_fragment", ...(fragment.tags ?? [])]
  };
}

function buildEvidenceNode(
  evidence: M01OverlapEvidenceDef,
  text: M01GreyboxTextOverrides = {},
  options: M01EvidenceNodeBuildOptions = {}
): M01GreyboxTokenNode {
  return buildEvidenceNodeAt(
    evidence,
    readPosition(evidence.position, { x: 0, y: 0 }),
    text,
    1,
    options
  );
}

function buildEvidenceNodeAt(
  evidence: M01OverlapEvidenceDef,
  position: M01GreyboxPoint,
  text: M01GreyboxTextOverrides = {},
  sizeScale = 1,
  options: M01EvidenceNodeBuildOptions = {}
): M01GreyboxTokenNode {
  const color = formatM01ColorLabel(evidence.targetBlendColor, text);
  const shape = formatM01ShapeLabel(evidence.targetShape, text);
  const size = Math.max(evidence.tolerance * 2 * sizeScale, 52);
  const sourceShapeTags = (evidence.generatedOverlap?.sourceShapes ?? []).map(
    (sourceShape) => `source-shape:${sourceShape}`
  );
  const magnetPolygon = buildGeneratedOverlapMagnetPolygon(evidence, sizeScale, options);

  return {
    id: evidence.id,
    controllerId: evidence.id,
    kind: "evidence",
    label: formatM01GreyboxText("tokenLabel", { color, shape }, text),
    position,
    sourcePosition: readPosition(evidence.position, { x: 0, y: 0 }),
    size: { width: size, height: size },
    colorToken: evidence.targetBlendColor,
    shapeToken: evidence.targetShape,
    tags: ["overlap_evidence", "snap_zone", ...sourceShapeTags, ...evidence.shapeTags],
    fragmentSnapPositions: buildEvidenceFragmentSnapPositions(evidence, position),
    ...(magnetPolygon && magnetPolygon.length >= 3 ? { magnetPolygon } : {})
  };
}

function buildGeneratedOverlapMagnetPolygon(
  evidence: M01OverlapEvidenceDef,
  sizeScale: number,
  options: M01EvidenceNodeBuildOptions
): M01GreyboxPoint[] | undefined {
  if (!options.synthesizeLegacyGeneratedOverlap) {
    return undefined;
  }

  const explicitOutline = evidence.generatedOverlap?.outline?.map((point) => ({
    x: point.x * sizeScale,
    y: point.y * sizeScale
  }));
  if (explicitOutline && explicitOutline.length >= 3) {
    return explicitOutline;
  }

  return synthesizeGeneratedOverlapMagnetPolygon(evidence, sizeScale);
}

function synthesizeGeneratedOverlapMagnetPolygon(
  evidence: M01OverlapEvidenceDef,
  sizeScale: number
): M01GreyboxPoint[] | undefined {
  if (evidence.targetShape !== "generated_overlap") {
    return undefined;
  }

  const sourceShapes = evidence.generatedOverlap?.sourceShapes;
  const [firstFragmentId, secondFragmentId] = evidence.solution.fragmentIds;
  const pigmentPair = pigmentPairForTargetBlendColor(evidence.targetBlendColor);
  if (!sourceShapes || sourceShapes.length < 2 || !firstFragmentId || !secondFragmentId || !pigmentPair) {
    return undefined;
  }

  const offset = normalizeEvidenceSnapOffset(evidence.generatedOverlap?.offset);
  const rotation = evidence.generatedOverlap?.rotation ?? 0;
  const placements: M01StandardPieceBlendPlacement[] = [
    {
      id: firstFragmentId,
      shapeToken: sourceShapes[0],
      colorToken: pigmentPair[0],
      position: { x: -offset.x / 2, y: -offset.y / 2 },
      size: M01_STANDARD_PIECE_DISPLAY_SIZE,
      rotation
    },
    {
      id: secondFragmentId,
      shapeToken: sourceShapes[1],
      colorToken: pigmentPair[1],
      position: { x: offset.x / 2, y: offset.y / 2 },
      size: M01_STANDARD_PIECE_DISPLAY_SIZE,
      rotation
    }
  ];
  const overlay = resolveM01StandardPieceBlendOverlays(placements).find(
    (candidate) => candidate.colorToken === evidence.targetBlendColor
  );
  if (!overlay || overlay.points.length < 3) {
    return undefined;
  }

  const bounds = boundsForGeneratedOverlapPoints(overlay.points);
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };

  return overlay.points.map((point) => ({
    x: (point.x - center.x) * sizeScale,
    y: (point.y - center.y) * sizeScale
  }));
}

function boundsForGeneratedOverlapPoints(points: M01GreyboxPoint[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  return points.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      maxX: Math.max(current.maxX, point.x),
      minY: Math.min(current.minY, point.y),
      maxY: Math.max(current.maxY, point.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
}

function pigmentPairForTargetBlendColor(colorToken: string): [M01BaseColor, M01BaseColor] | undefined {
  if (colorToken === "orange") {
    return ["red", "yellow"];
  }
  if (colorToken === "green") {
    return ["yellow", "blue"];
  }
  if (colorToken === "purple") {
    return ["red", "blue"];
  }

  return undefined;
}

function buildEvidenceWorkNodes(
  evidenceItems: M01OverlapEvidenceDef[],
  text: M01GreyboxTextOverrides = {},
  options: M01EvidenceNodeBuildOptions = {}
): M01GreyboxTokenNode[] {
  if (evidenceItems.length === 0) {
    return [];
  }

  const sourcePositions = evidenceItems.map((evidence) =>
    readPosition(evidence.position, { x: 0, y: 0 })
  );
  const sourceCenter = centerOfPoints(sourcePositions);

  return evidenceItems.map((evidence, index) => {
    const source = sourcePositions[index];
    return buildEvidenceNodeAt(
      evidence,
      {
        x: EVIDENCE_WORK_AREA_CENTER.x + (source.x - sourceCenter.x) * EVIDENCE_WORK_AREA_SCALE,
        y: EVIDENCE_WORK_AREA_CENTER.y + (source.y - sourceCenter.y) * EVIDENCE_WORK_AREA_SCALE
      },
      text,
      1,
      options
    );
  });
}

function buildReferenceEvidenceNodes(
  evidenceItems: M01OverlapEvidenceDef[],
  text: M01GreyboxTextOverrides = {},
  options: M01EvidenceNodeBuildOptions = {}
): M01GreyboxTokenNode[] {
  if (evidenceItems.length === 0) {
    return [];
  }

  const evidenceNodes = evidenceItems.map((evidence) => buildEvidenceNode(evidence, text, options));
  const sourceCenter = centerOfPoints(evidenceNodes.map((evidence) => evidence.position));

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
    magnetPolygon: token.magnetPolygon?.map((point) => ({
      x: point.x * REFERENCE_PATTERN_SCALE,
      y: point.y * REFERENCE_PATTERN_SCALE
    })),
    fragmentSnapPositions: undefined
  }));
}

function centerOfPoints(points: M01GreyboxPoint[]): M01GreyboxPoint {
  const bounds = points.reduce(
    (current, evidence) => ({
      minX: Math.min(current.minX, evidence.x),
      maxX: Math.max(current.maxX, evidence.x),
      minY: Math.min(current.minY, evidence.y),
      maxY: Math.max(current.maxY, evidence.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };
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
