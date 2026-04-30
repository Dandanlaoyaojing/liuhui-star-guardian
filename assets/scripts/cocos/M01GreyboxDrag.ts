import { containsPoint, resolveDropResult, type SnapZone } from "../interaction/SnapZone.ts";
import type { M01GreyboxLayout, M01GreyboxPoint, M01GreyboxTokenNode } from "./M01GreyboxLayout.ts";

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

export function resolveM01GreyboxDrop(
  layout: M01GreyboxLayout,
  token: M01GreyboxTokenNode,
  dropPosition: M01GreyboxPoint
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
      return resolveEvidenceFragmentDrop(layout, token, dropPosition);
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
  dropPosition: M01GreyboxPoint
): M01GreyboxDropAction {
  const hitEvidence = layout.evidence
    .map((evidence) => ({ evidence, zone: buildEvidenceDropZone(evidence) }))
    .filter(({ zone }) => containsPoint(zone.bounds, dropPosition));

  if (hitEvidence.length === 0) {
    return { type: "place_fragment_freely", fragmentId: token.controllerId, position: dropPosition };
  }

  const tokenTags = new Set(token.tags);
  const shapeCompatibleHits = hitEvidence.filter(({ evidence }) =>
    evidenceTagMatchScore(evidence, tokenTags) > 0
  );

  if (shapeCompatibleHits.length === 0) {
    return { type: "place_fragment_freely", fragmentId: token.controllerId, position: dropPosition };
  }

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

function resolveFragmentDrop(
  layout: M01GreyboxLayout,
  token: M01GreyboxTokenNode,
  dropPosition: M01GreyboxPoint
): ReturnType<typeof resolveDropResult> {
  const hitSlots = layout.slots
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

function distanceSquared(a: M01GreyboxPoint, b: M01GreyboxPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;

  return dx * dx + dy * dy;
}
