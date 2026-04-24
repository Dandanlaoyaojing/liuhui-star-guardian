import type { Point2 } from "./DragHandler.ts";

export interface SnapEntity {
  readonly id: string;
  readonly tags: readonly string[];
}

export interface TagCriteria {
  readonly all?: readonly string[];
  readonly any?: readonly string[];
  readonly none?: readonly string[];
}

export interface SnapBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SnapZone {
  readonly id: string;
  readonly criteria: TagCriteria;
  readonly bounds: SnapBounds;
  readonly snapPosition?: Point2;
}

export type SnapRejectReason =
  | "missing_required_tags"
  | "missing_any_tag"
  | "forbidden_tags";

export interface SnapMatchResult {
  readonly accepted: boolean;
  readonly reason?: SnapRejectReason;
  readonly missingTags?: readonly string[];
  readonly anyTags?: readonly string[];
  readonly forbiddenTags?: readonly string[];
}

export type DropResult =
  | {
      readonly type: "accepted";
      readonly entityId: string;
      readonly zoneId: string;
      readonly snapPosition: Point2;
    }
  | {
      readonly type: "rejected";
      readonly entityId: string;
      readonly zoneId: string;
      readonly reason: SnapRejectReason;
      readonly missingTags?: readonly string[];
      readonly anyTags?: readonly string[];
      readonly forbiddenTags?: readonly string[];
    }
  | {
      readonly type: "missed";
      readonly entityId: string;
      readonly reason: "no_zone";
    };

export function canSnapToZone(entity: SnapEntity, zone: SnapZone): SnapMatchResult {
  const tags = new Set(entity.tags);
  const missingTags = (zone.criteria.all ?? []).filter((tag) => !tags.has(tag));
  if (missingTags.length > 0) {
    return {
      accepted: false,
      reason: "missing_required_tags",
      missingTags
    };
  }

  const anyTags = zone.criteria.any ?? [];
  if (anyTags.length > 0 && !anyTags.some((tag) => tags.has(tag))) {
    return {
      accepted: false,
      reason: "missing_any_tag",
      anyTags
    };
  }

  const forbiddenTags = (zone.criteria.none ?? []).filter((tag) => tags.has(tag));
  if (forbiddenTags.length > 0) {
    return {
      accepted: false,
      reason: "forbidden_tags",
      forbiddenTags
    };
  }

  return {
    accepted: true
  };
}

export function resolveDropResult(
  entity: SnapEntity,
  zones: readonly SnapZone[],
  dropPosition: Point2
): DropResult {
  const targetZone = zones.find((zone) => containsPoint(zone.bounds, dropPosition));
  if (!targetZone) {
    return {
      type: "missed",
      entityId: entity.id,
      reason: "no_zone"
    };
  }

  const match = canSnapToZone(entity, targetZone);
  if (!match.accepted) {
    const reason = match.reason ?? "missing_required_tags";

    return {
      type: "rejected",
      entityId: entity.id,
      zoneId: targetZone.id,
      reason,
      missingTags: match.missingTags,
      anyTags: match.anyTags,
      forbiddenTags: match.forbiddenTags
    };
  }

  return {
    type: "accepted",
    entityId: entity.id,
    zoneId: targetZone.id,
    snapPosition: targetZone.snapPosition ?? { x: targetZone.bounds.x, y: targetZone.bounds.y }
  };
}

export function containsPoint(bounds: SnapBounds, point: Point2): boolean {
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;

  return (
    point.x >= bounds.x - halfWidth &&
    point.x <= bounds.x + halfWidth &&
    point.y >= bounds.y - halfHeight &&
    point.y <= bounds.y + halfHeight
  );
}
