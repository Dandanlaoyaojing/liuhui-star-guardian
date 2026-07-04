import { containsPoint, resolveDropResult, type SnapZone } from "../interaction/SnapZone.ts";
import type {
  M01GreyboxLayout,
  M01GreyboxPieceSnapZone,
  M01GreyboxPoint,
  M01GreyboxTokenNode
} from "./M01GreyboxLayout.ts";

const EVIDENCE_MAGNET_CONTOUR_TOLERANCE = 2;
const TARGET_PIECE_SNAP_ROTATION_TOLERANCE = 1;
// 目标槽判定框比拼片本体每边多放宽的总量(px): 落点略偏也能吸/贴, 减少"差几px没吸、片落走"。
const TARGET_PIECE_DROP_ZONE_MARGIN = 20;

export type M01GreyboxDropAction =
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
      // 形状+落点都命中目标槽、只差旋转没对准 → 自由落下但带此标记, 让 UI 提示"再转一下"而非静默。
      rotationHint?: boolean;
    }
  | {
      // 形状+落点命中目标槽但旋转没对准 → 【贴在槽位不掉】(Kinematic 保持玩家当前朝向),
      // 提示原地转一下; 转对了再由旋转结算走 snap_fragment_to_target_piece 落定验证。
      // 取代旧的"旋转不对就自由落下"—— 那会让玩家以为放上了、其实片悄悄落走(再拼永远差几片)。
      type: "stick_fragment_to_slot";
      fragmentId: string;
      position: M01GreyboxPoint;
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

type M01TargetPieceSlotDropResult = M01GreyboxDropAction | undefined;

export function resolveM01GreyboxDrop(
  layout: M01GreyboxLayout,
  token: M01GreyboxTokenNode,
  dropPosition: M01GreyboxPoint,
  options: M01GreyboxDropOptions = {}
): M01GreyboxDropAction {
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
    if (pieceSlotHit) {
      return pieceSlotHit; // snap_fragment_to_target_piece 或 stick_fragment_to_slot(角度没对贴槽不掉)
    }
    return {
      type: "place_fragment_freely",
      fragmentId: token.controllerId,
      position: dropPosition
    };
  }

  const pieceSlotHit = resolveTargetPieceSlotDrop(layout, token, dropPosition, options);
  if (pieceSlotHit) {
    return pieceSlotHit; // snap_fragment_to_target_piece 或 stick_fragment_to_slot
  }

  const hitEvidence = layout.evidence
    .map((evidence) => ({ evidence, zone: buildEvidenceDropZone(evidence) }))
    .filter(({ evidence, zone }) =>
      containsPoint(zone.bounds, dropPosition) && containsEvidenceMagnetContour(evidence, dropPosition)
    );

  const tokenTags = new Set(token.tags);
  const shapeCompatibleHits = hitEvidence.filter(({ evidence }) =>
    evidenceTagMatchScore(evidence, tokenTags) > 0 &&
    isEvidenceTrialFitRotationCompatible(layout, evidence, token, options)
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
    .filter((slot) => tokenTags.has(`shape:${slot.shapeToken}`))
    .filter((slot) => containsPoint(buildTargetPieceDropZone(slot).bounds, dropPosition));

  if (compatibleSlots.length === 0) {
    return undefined;
  }

  // 槽矩形可能互相重叠(当前两个三角槽就有交叠): 先取"玩家瞄准的"最近槽, 再对它判旋转。
  // 不能先筛旋转再取最近 —— 那样最近槽角度不对时会静默吸到较远的角度兼容槽:
  // 拼片被放到玩家没瞄准的位置(它自己的验证位姿永远差一步→底光永不亮), 也吞掉了"该转一下"的提示。
  const nearestSlot = compatibleSlots
    .slice()
    .sort((a, b) => distanceSquared(a.position, dropPosition) - distanceSquared(b.position, dropPosition))[0];

  if (!isTargetPieceRotationCompatible(options.rotation, nearestSlot.rotation, nearestSlot.shapeToken)) {
    // 落点命中槽但角度没对 → 贴在槽位不掉(保持玩家朝向), 原地转对了再落定。不再自由落下(片会悄悄掉走)。
    return {
      type: "stick_fragment_to_slot",
      fragmentId: token.controllerId,
      position: nearestSlot.position
    };
  }

  return {
    type: "snap_fragment_to_target_piece",
    fragmentId: token.controllerId,
    pieceSlotId: nearestSlot.id,
    position: nearestSlot.position,
    rotation: nearestSlot.rotation
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
      // 判定框比拼片本体略放宽(每边 +TARGET_PIECE_DROP_ZONE_MARGIN/2): 落点稍偏也能吸/贴住,
      // 少一点"看着放上了其实差几px没吸、片悄悄落走"。仍取最近槽, 重叠槽不会误吸远处。
      x: slot.position.x,
      y: slot.position.y,
      width: slot.size.width + TARGET_PIECE_DROP_ZONE_MARGIN,
      height: slot.size.height + TARGET_PIECE_DROP_ZONE_MARGIN
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

// 形状的旋转对称周期(度): 转过这个角度看起来完全重合。正多边形是多轴对称的 ——
// 圆=0(任意角都重合); 三角形=120(3轴); 方形=90(4轴); 六边形=60(6轴)。判角度时按周期取模:
// 玩家转到任一"看起来一样"的朝向都算对齐, 不存在"270°"这种独立目标角。未知形状=无对称, 须精确。
function shapeRotationSymmetryDegrees(shape: string | undefined): number {
  switch (shape) {
    case "circle":
      return 0;
    case "triangle":
      return 120;
    case "square":
      return 90;
    case "hexagon":
      return 60;
    default:
      return 360;
  }
}

function isTargetPieceRotationCompatible(
  rotation: number | undefined,
  targetRotation: number,
  shape: string | undefined
): boolean {
  if (rotation === undefined) {
    return true;
  }
  const period = shapeRotationSymmetryDegrees(shape);
  if (period === 0) {
    return true; // 圆: 任意朝向都重合
  }
  const raw = rotationDistanceDegrees(rotation, targetRotation) % period;
  const reduced = Math.min(raw, period - raw); // 到最近对称重合朝向的角距
  return reduced <= TARGET_PIECE_SNAP_ROTATION_TOLERANCE;
}

// 弱磁吸的旋转门槛(spec §630 形状决定能不能试拼 / §606 弱磁吸不代表答案正确):
// 判定按"该片是不是【当前这个证据】的真解生成片"分流(不是"该片是不是任何地方的真解片"):
// - 是本证据生成片 → 按它自己的生成朝向判(它在本证据里就该是这个朝向; 放宽到"任一同形状
//   生成片朝向"会接受两片互换朝向, 弱磁吸不矫正旋转、staging 只记 id → 底光会在视觉朝向错时点亮)。
// - 不是本证据生成片(诱饵, 或属于**别的**证据的真解片) → 一律按本证据同形状生成片的朝向判。
//   之前只要该片在某处有目标槽就走自己槽角度: 属于别处证据的真解片被按它别处的角度放行,
//   规则和诱饵不一致、也向玩家泄露"这片是别处真解"(codex P2); 诱饵曾整体免检任意角可吸(玩家实测)。
// 证据生成片 id = fragmentSnapPositions 的键(Layout 构建时按 solution.fragmentIds 写入)。
function isEvidenceTrialFitRotationCompatible(
  layout: M01GreyboxLayout,
  evidence: M01GreyboxTokenNode,
  token: M01GreyboxTokenNode,
  options: M01GreyboxDropOptions
): boolean {
  const generatorIds = Object.keys(evidence.fragmentSnapPositions ?? {});
  if (generatorIds.length === 0) {
    return true; // legacy 证据不带生成片信息 → 不加旋转门槛
  }

  if (generatorIds.includes(token.controllerId)) {
    const ownSlot = layout.targetPieceSlots.find(
      (slot) => slot.expectedFragmentId === token.controllerId
    );
    if (ownSlot) {
      return isTargetPieceRotationCompatible(options.rotation, ownSlot.rotation, ownSlot.shapeToken);
    }
  }

  const tokenTags = new Set(token.tags);
  const sameShapeGeneratorSlots = layout.targetPieceSlots.filter(
    (slot) =>
      slot.expectedFragmentId !== undefined &&
      generatorIds.includes(slot.expectedFragmentId) &&
      tokenTags.has(`shape:${slot.shapeToken}`)
  );
  if (sameShapeGeneratorSlots.length === 0) {
    return true; // 生成片没有同形状目标槽可查(数据缺口) → 兜底放行, 形状匹配已由 tag 分数把关
  }

  return sameShapeGeneratorSlots.some((slot) =>
    isTargetPieceRotationCompatible(options.rotation, slot.rotation, slot.shapeToken)
  );
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
