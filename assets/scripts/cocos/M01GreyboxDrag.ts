import { containsPoint, resolveDropResult, type SnapZone } from "../interaction/SnapZone.ts";
import type {
  M01GreyboxLayout,
  M01GreyboxPieceSnapZone,
  M01GreyboxPoint,
  M01GreyboxTokenNode
} from "./M01GreyboxLayout.ts";

const EVIDENCE_MAGNET_CONTOUR_TOLERANCE = 2;
const TARGET_PIECE_SNAP_ROTATION_TOLERANCE = 1;

export type M01GreyboxDropAction =
  | {
      type: "select_flashlight";
      flashlightId: string;
    }
  | {
      type: "weak_snap_fragment";
      fragmentId: string;
      evidenceId: string;
    }
  | {
      type: "snap_fragment_to_target_piece";
      fragmentId: string;
      pieceSlotId: string;
      position: M01GreyboxPoint;
      rotation: number;
    }
  | {
      type: "place_fragment_freely";
      fragmentId: string;
      position?: M01GreyboxPoint;
    }
  | {
      type: "activate_filter";
      filterId: string;
    }
  | {
      type: "place_fragment";
      fragmentId: string;
      slotId: string;
    }
  | {
      type: "return_to_origin";
      reason: "no_zone" | "wrong_token_kind";
    };

export interface M01GreyboxDropOptions {
  rotation?: number;
}

type M01TargetPieceSlotDropResult = M01GreyboxDropAction | "rotation_mismatch" | undefined;

export function resolveM01GreyboxDrop(
  layout: M01GreyboxLayout,
  token: M01GreyboxTokenNode,
  dropPosition: M01GreyboxPoint,
  options: M01GreyboxDropOptions = {}
): M01GreyboxDropAction {
  if (token.kind === "flashlight") {
    return { type: "select_flashlight", flashlightId: token.controllerId };
  }

  if (token.kind === "filter") {
    const result = resolveDropResult(toSnapEntity(token), [buildFilterDropZone(layout)], dropPosition);

    return result.type === "accepted"
      ? { type: "activate_filter", filterId: token.controllerId }
      : { type: "return_to_origin", reason: result.type === "missed" ? "no_zone" : "wrong_token_kind" };
  }

  if (token.kind === "fragment") {
    if (layout.evidence.length > 0) {
      return resolveEvidenceFragmentDrop(layout, token, dropPosition, options);
    }

    const result = resolveFragmentDrop(layout, token, dropPosition);

    return result.type === "accepted"
      ? { type: "place_fragment", fragmentId: token.controllerId, slotId: result.zoneId }
      : { type: "return_to_origin", reason: result.type === "missed" ? "no_zone" : "wrong_token_kind" };
  }

  return {
    type: "return_to_origin",
    reason: "wrong_token_kind"
  };
}

function resolveEvidenceFragmentDrop(
  layout: M01GreyboxLayout,
  token: M01GreyboxTokenNode,
  dropPosition: M01GreyboxPoint,
  options: M01GreyboxDropOptions
): M01GreyboxDropAction {
  if (!layout.evidenceSnapEnabled) {
    const pieceSlotHit = resolveTargetPieceSlotDrop(layout, token, dropPosition, options);
    return pieceSlotHit && pieceSlotHit !== "rotation_mismatch" ? pieceSlotHit : {
      type: "place_fragment_freely",
      fragmentId: token.controllerId,
      position: dropPosition
    };
  }

  const pieceSlotHit = resolveTargetPieceSlotDrop(layout, token, dropPosition, options);
  if (pieceSlotHit && pieceSlotHit !== "rotation_mismatch") {
    return pieceSlotHit;
  }
  if (pieceSlotHit === "rotation_mismatch") {
    return { type: "place_fragment_freely", fragmentId: token.controllerId, position: dropPosition };
  }

  const hitEvidence = layout.evidence
    .map((evidence) => ({ evidence, zone: buildEvidenceDropZone(evidence) }))
    .filter(({ evidence, zone }) =>
      containsPoint(zone.bounds, dropPosition) && containsEvidenceMagnetContour(evidence, dropPosition)
    );

  const tokenTags = new Set(token.tags);
  const shapeCompatibleHits = hitEvidence.filter(({ evidence }) =>
    evidenceTagMatchScore(evidence, tokenTags) > 0 &&
    isExpectedTargetFragmentRotationCompatible(layout, token, options)
  );

  if (shapeCompatibleHits.length > 0) {
    const bestHit = shapeCompatibleHits.slice().sort((a, b) => {
      const matchDelta =
        evidenceTagMatchScore(b.evidence, tokenTags) - evidenceTagMatchScore(a.evidence, tokenTags);
      if (matchDelta !== 0) {
        return matchDelta;
      }

      return distanceSquared(a.evidence.position, dropPosition) - distanceSquared(b.evidence.position, dropPosition);
    })[0];

    return {
      type: "weak_snap_fragment",
      fragmentId: token.controllerId,
      evidenceId: bestHit.evidence.controllerId
    };
  }

  return { type: "place_fragment_freely", fragmentId: token.controllerId, position: dropPosition };
}

function resolveTargetPieceSlotDrop(
  layout: M01GreyboxLayout,
  token: M01GreyboxTokenNode,
  dropPosition: M01GreyboxPoint,
  options: M01GreyboxDropOptions
): M01TargetPieceSlotDropResult {
  const tokenTags = new Set(token.tags);
  const compatibleSlots = layout.targetPieceSlots
    .filter((slot) => !slot.expectedFragmentId || slot.expectedFragmentId === token.controllerId)
    .filter((slot) => tokenTags.has(`shape:${slot.shapeToken}`))
    .filter((slot) => containsPoint(buildTargetPieceDropZone(slot).bounds, dropPosition));

  if (compatibleSlots.length === 0) {
    return undefined;
  }

  const rotationCompatibleSlots = compatibleSlots.filter((slot) =>
    isTargetPieceRotationCompatible(options.rotation, slot.rotation)
  );

  if (rotationCompatibleSlots.length === 0) {
    return "rotation_mismatch";
  }

  const bestSlot = rotationCompatibleSlots
    .slice()
    .sort((a, b) => distanceSquared(a.position, dropPosition) - distanceSquared(b.position, dropPosition))[0];

  return {
    type: "snap_fragment_to_target_piece",
    fragmentId: token.controllerId,
    pieceSlotId: bestSlot.id,
    position: bestSlot.position,
    rotation: bestSlot.rotation
  };
}

function resolveFragmentDrop(
  layout: M01GreyboxLayout,
  token: M01GreyboxTokenNode,
  dropPosition: M01GreyboxPoint
): ReturnType<typeof resolveDropResult> {
  const hitSlots = (layout.slots ?? [])
    .map((slot) => ({ slot, zone: buildSlotDropZone(slot) }))
    .filter(({ zone }) => containsPoint(zone.bounds, dropPosition));

  if (hitSlots.length === 0) {
    return resolveDropResult(toSnapEntity(token), [], dropPosition);
  }

  const tokenTags = new Set(token.tags);
  const bestHit = hitSlots.slice().sort((a, b) => {
    const matchDelta = slotTagMatchScore(b.slot, tokenTags) - slotTagMatchScore(a.slot, tokenTags);
    if (matchDelta !== 0) {
      return matchDelta;
    }

    return distanceSquared(a.slot.position, dropPosition) - distanceSquared(b.slot.position, dropPosition);
  })[0];

  return resolveDropResult(toSnapEntity(token), [bestHit.zone], dropPosition);
}

function buildTargetPieceDropZone(slot: M01GreyboxPieceSnapZone): SnapZone {
  return {
    id: slot.id,
    criteria: { all: ["fragment", `shape:${slot.shapeToken}`] },
    bounds: {
      x: slot.position.x,
      y: slot.position.y,
      width: slot.size.width,
      height: slot.size.height
    },
    snapPosition: slot.position
  };
}

function buildFilterDropZone(layout: M01GreyboxLayout): SnapZone {
  return {
    id: layout.gear.controllerId,
    criteria: { all: ["filter"] },
    bounds: {
      x: layout.gear.position.x,
      y: layout.gear.position.y,
      width: layout.gear.size.width,
      height: layout.gear.size.height
    },
    snapPosition: layout.gear.position
  };
}

function buildEvidenceDropZone(evidence: M01GreyboxTokenNode): SnapZone {
  return {
    id: evidence.controllerId,
    criteria: { all: ["fragment"] },
    bounds: {
      x: evidence.position.x,
      y: evidence.position.y,
      width: evidence.size.width,
      height: evidence.size.height
    },
    snapPosition: evidence.position
  };
}

function buildSlotDropZone(slot: M01GreyboxTokenNode): SnapZone {
  return {
    id: slot.controllerId,
    criteria: { all: ["fragment"] },
    bounds: {
      x: slot.position.x,
      y: slot.position.y,
      width: slot.size.width,
      height: slot.size.height
    },
    snapPosition: slot.position
  };
}

function toSnapEntity(token: M01GreyboxTokenNode): { id: string; tags: string[] } {
  return {
    id: token.controllerId,
    tags: [token.kind, ...token.tags]
  };
}

function slotTagMatchScore(slot: M01GreyboxTokenNode, tokenTags: Set<string>): number {
  return slot.tags.filter((tag) => tokenTags.has(tag)).length;
}

function evidenceTagMatchScore(evidence: M01GreyboxTokenNode, tokenTags: Set<string>): number {
  return evidence.tags.filter((tag) => tag !== "overlap_evidence" && tokenTags.has(tag)).length;
}

function isTargetPieceRotationCompatible(rotation: number | undefined, targetRotation: number): boolean {
  return (
    rotation === undefined ||
    rotationDistanceDegrees(rotation, targetRotation) <= TARGET_PIECE_SNAP_ROTATION_TOLERANCE
  );
}

function isExpectedTargetFragmentRotationCompatible(
  layout: M01GreyboxLayout,
  token: M01GreyboxTokenNode,
  options: M01GreyboxDropOptions
): boolean {
  const targetSlot = layout.targetPieceSlots.find((slot) => slot.expectedFragmentId === token.controllerId);
  return !targetSlot || isTargetPieceRotationCompatible(options.rotation, targetSlot.rotation);
}

function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

function rotationDistanceDegrees(left: number, right: number): number {
  const delta = Math.abs(normalizeRotation(left) - normalizeRotation(right));
  return Math.min(delta, 360 - delta);
}

function containsEvidenceMagnetContour(
  evidence: M01GreyboxTokenNode,
  dropPosition: M01GreyboxPoint
): boolean {
  if (!evidence.magnetPolygon || evidence.magnetPolygon.length < 3) {
    return true;
  }

  const localPoint = {
    x: dropPosition.x - evidence.position.x,
    y: dropPosition.y - evidence.position.y
  };

  return (
    containsLocalPolygonPoint(evidence.magnetPolygon, localPoint) ||
    distanceToPolygonSquared(evidence.magnetPolygon, localPoint) <=
      EVIDENCE_MAGNET_CONTOUR_TOLERANCE * EVIDENCE_MAGNET_CONTOUR_TOLERANCE
  );
}

function containsLocalPolygonPoint(
  polygon: M01GreyboxPoint[],
  point: M01GreyboxPoint
): boolean {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function distanceToPolygonSquared(
  polygon: M01GreyboxPoint[],
  point: M01GreyboxPoint
): number {
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    closest = Math.min(
      closest,
      distanceToSegmentSquared(point, polygon[previousIndex], polygon[index])
    );
  }

  return closest;
}

function distanceToSegmentSquared(
  point: M01GreyboxPoint,
  start: M01GreyboxPoint,
  end: M01GreyboxPoint
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return distanceSquared(point, start);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
  );
  return distanceSquared(point, {
    x: start.x + t * dx,
    y: start.y + t * dy
  });
}

function distanceSquared(a: M01GreyboxPoint, b: M01GreyboxPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return dx * dx + dy * dy;
}
