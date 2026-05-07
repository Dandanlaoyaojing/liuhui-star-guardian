import type {
  M01BlendColor,
  M01CandidateFragmentDef,
  M01MemoryGearConfig,
  M01OverlapEvidenceDef,
  M01Shape
} from "../levels/stage1/M01MemoryGearController.ts";
import {
  buildM01StandardPiecePolygon,
  resolveM01StandardPieceBlendOverlays,
  type M01StandardPieceBlendPlacement,
  type M01StandardPieceBlendPoint
} from "./M01StandardPieceBlend.ts";

export interface M01ManualTargetPiecePlacement {
  fragmentId: string;
  position: M01StandardPieceBlendPoint;
  rotation?: number;
}

export interface M01TargetPatternGeneratorOptions {
  idPrefix?: string;
  minOverlapArea?: number;
}

const DEFAULT_STANDARD_PIECE_SIZE = { width: 56, height: 56 };
const DEFAULT_MIN_OVERLAP_AREA = 30;
export const M01_CURRENT_MANUAL_TARGET_EVIDENCE_ID_PREFIX = "current_manual_target";

export function deriveM01TargetEvidenceFromTargetPattern(
  config: M01MemoryGearConfig,
  options: M01TargetPatternGeneratorOptions = {}
): M01OverlapEvidenceDef[] {
  const placements = (config.targetPattern?.pieces ?? [])
    .map((piece): M01ManualTargetPiecePlacement | undefined => {
      if (!piece.fragmentId) {
        return undefined;
      }

      return {
        fragmentId: piece.fragmentId,
        position: piece.position,
        rotation: piece.rotation ?? 0
      };
    })
    .filter((placement): placement is M01ManualTargetPiecePlacement => placement !== undefined);

  return deriveM01TargetEvidenceFromPlacements(config, placements, {
    idPrefix: M01_CURRENT_MANUAL_TARGET_EVIDENCE_ID_PREFIX,
    ...options
  });
}

export function resolveM01TargetEvidenceFromConfig(
  config: M01MemoryGearConfig
): M01OverlapEvidenceDef[] {
  if (config.targetPattern?.locked && (config.targetPattern.pieces ?? []).some((piece) => piece.fragmentId)) {
    return deriveM01TargetEvidenceFromTargetPattern(config);
  }

  return config.evidence ?? [];
}

export function resolveM01ConfigWithCurrentTargetEvidence(
  config: M01MemoryGearConfig
): M01MemoryGearConfig {
  const evidence = resolveM01TargetEvidenceFromConfig(config);
  if (evidence === config.evidence) {
    return config;
  }

  return {
    ...config,
    evidence
  };
}

export function deriveM01TargetEvidenceFromPlacements(
  config: M01MemoryGearConfig,
  placements: M01ManualTargetPiecePlacement[],
  options: M01TargetPatternGeneratorOptions = {}
): M01OverlapEvidenceDef[] {
  const fragmentsById = new Map(config.fragments.map((fragment) => [fragment.id, fragment]));
  const standardSizeByShape = new Map(
    (config.standardPieces ?? []).map((piece) => [piece.shape, piece.size])
  );
  const blendPlacements = placements
    .map((placement): M01StandardPieceBlendPlacement | undefined => {
      const fragment = fragmentsById.get(placement.fragmentId);
      if (!fragment) {
        return undefined;
      }

      const shapeToken = fragment.shape ?? fragment.edgeShape;
      return {
        id: placement.fragmentId,
        shapeToken,
        colorToken: fragment.hiddenColor,
        position: placement.position,
        size: standardSizeByShape.get(shapeToken) ?? DEFAULT_STANDARD_PIECE_SIZE,
        rotation: placement.rotation ?? 0
      };
    })
    .filter((placement): placement is M01StandardPieceBlendPlacement => placement !== undefined);

  const minOverlapArea = options.minOverlapArea ?? DEFAULT_MIN_OVERLAP_AREA;
  const fragmentShapeById = new Map(
    config.fragments.map((fragment) => [fragment.id, fragment.shape ?? fragment.edgeShape])
  );
  const placementById = new Map(blendPlacements.map((placement) => [placement.id, placement]));
  const overlayCountsBySignature = new Map<string, number>();

  return resolveM01StandardPieceBlendOverlays(blendPlacements)
    .filter((overlay) => polygonArea(overlay.points) >= minOverlapArea)
    .flatMap((overlay) => {
      if (!isM01TargetBlendColor(overlay.colorToken)) {
        return [];
      }

      const [firstId, secondId] = overlay.sourceIds;
      const firstPlacement = placementById.get(firstId);
      const secondPlacement = placementById.get(secondId);
      const sourceShapes = [
        fragmentShapeById.get(firstId) ?? "circle",
        fragmentShapeById.get(secondId) ?? "circle"
      ] as [M01Shape, M01Shape];
      const bounds = boundsForPoints(overlay.points);
      const position = {
        x: roundPointCoordinate((bounds.minX + bounds.maxX) / 2),
        y: roundPointCoordinate((bounds.minY + bounds.maxY) / 2)
      };
      const signature = `${overlay.colorToken}_${sourceShapes.join("_")}`;
      const nextCount = (overlayCountsBySignature.get(signature) ?? 0) + 1;
      overlayCountsBySignature.set(signature, nextCount);

      const evidence = {
        id: `${options.idPrefix ?? "target_overlap"}_${signature}_${nextCount}`,
        targetShape: "generated_overlap",
        targetBlendColor: overlay.colorToken,
        position,
        tolerance: Math.max(18, Math.ceil(Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2)),
        shapeTags: sourceShapes.map((shape) => `shape:${shape}`),
        generatedOverlap: {
          areaRatio: roundRatio(
            polygonArea(overlay.points) /
              Math.min(
                polygonArea(buildM01StandardPiecePolygon(firstPlacement!)),
                polygonArea(buildM01StandardPiecePolygon(secondPlacement!))
              )
          ),
          offset: {
            x: roundPointCoordinate((secondPlacement?.position.x ?? 0) - (firstPlacement?.position.x ?? 0)),
            y: roundPointCoordinate((secondPlacement?.position.y ?? 0) - (firstPlacement?.position.y ?? 0))
          },
          rotation: roundPointCoordinate(
            ((firstPlacement?.rotation ?? 0) + (secondPlacement?.rotation ?? 0)) / 2
          ),
          sourceShapes,
          outline: overlay.points.map((point) => ({
            x: roundPointCoordinate(point.x - position.x),
            y: roundPointCoordinate(point.y - position.y)
          }))
        },
        solution: {
          fragmentIds: [firstId, secondId]
        }
      } satisfies M01OverlapEvidenceDef;
      return [evidence];
    });
}

function isM01TargetBlendColor(
  colorToken: M01BlendColor
): colorToken is Exclude<M01BlendColor, "red" | "yellow" | "blue"> {
  return colorToken === "orange" || colorToken === "green" || colorToken === "purple";
}

function boundsForPoints(points: M01StandardPieceBlendPoint[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
}

function polygonArea(points: M01StandardPieceBlendPoint[]): number {
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function roundPointCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}
