import {
  blendM01PigmentColors,
  type M01BaseColor,
  type M01BlendColor
} from "../levels/stage1/M01MemoryGearController.ts";

export interface M01StandardPieceBlendPoint {
  x: number;
  y: number;
}

export interface M01StandardPieceBlendPlacement {
  id: string;
  shapeToken: string;
  colorToken: string;
  position: M01StandardPieceBlendPoint;
  size: { width: number; height: number };
  rotation?: number;
}

export interface M01StandardPieceBlendOverlay {
  id: string;
  sourceIds: [string, string];
  colorToken: M01BlendColor;
  points: M01StandardPieceBlendPoint[];
}

const CIRCLE_SEGMENTS = 72;
const MIN_VISIBLE_OVERLAP_AREA = 8;

export function resolveM01StandardPieceBlendOverlays(
  pieces: M01StandardPieceBlendPlacement[]
): M01StandardPieceBlendOverlay[] {
  const overlays: M01StandardPieceBlendOverlay[] = [];

  for (let firstIndex = 0; firstIndex < pieces.length; firstIndex += 1) {
    const first = pieces[firstIndex];
    if (!isM01BaseColor(first.colorToken)) {
      continue;
    }

    for (let secondIndex = firstIndex + 1; secondIndex < pieces.length; secondIndex += 1) {
      const second = pieces[secondIndex];
      if (!isM01BaseColor(second.colorToken)) {
        continue;
      }

      const points = clipPolygon(
        buildM01StandardPiecePolygon(first),
        buildM01StandardPiecePolygon(second)
      );
      if (points.length < 3 || polygonArea(points) < MIN_VISIBLE_OVERLAP_AREA) {
        continue;
      }

      overlays.push({
        id: `blend_${first.id}_${second.id}`,
        sourceIds: [first.id, second.id],
        colorToken: blendM01PigmentColors(first.colorToken, second.colorToken),
        points
      });
    }
  }

  return overlays;
}

export function buildM01StandardPiecePolygon(
  piece: M01StandardPieceBlendPlacement
): M01StandardPieceBlendPoint[] {
  const localPoints = buildLocalStandardPiecePolygon(piece.shapeToken, piece.size);
  const rotation = ((piece.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return localPoints.map((point) => ({
    x: piece.position.x + point.x * cos - point.y * sin,
    y: piece.position.y + point.x * sin + point.y * cos
  }));
}

function buildLocalStandardPiecePolygon(
  shapeToken: string,
  size: { width: number; height: number }
): M01StandardPieceBlendPoint[] {
  if (shapeToken === "triangle") {
    const sideLength = Math.min(size.width, (size.height * 2) / Math.sqrt(3));
    const halfSide = sideLength / 2;
    const triangleHeight = (sideLength * Math.sqrt(3)) / 2;

    return [
      { x: 0, y: triangleHeight / 2 },
      { x: -halfSide, y: -triangleHeight / 2 },
      { x: halfSide, y: -triangleHeight / 2 }
    ];
  }

  if (shapeToken === "hexagon") {
    const radius = Math.min(size.width / 2, size.height / Math.sqrt(3));
    const halfRadius = radius / 2;
    const halfHeight = (Math.sqrt(3) * radius) / 2;

    return [
      { x: -radius, y: 0 },
      { x: -halfRadius, y: halfHeight },
      { x: halfRadius, y: halfHeight },
      { x: radius, y: 0 },
      { x: halfRadius, y: -halfHeight },
      { x: -halfRadius, y: -halfHeight }
    ];
  }

  const radius = Math.min(size.width, size.height) / 2;
  return Array.from({ length: CIRCLE_SEGMENTS }, (_, index) => {
    const angle = (Math.PI * 2 * index) / CIRCLE_SEGMENTS;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    };
  });
}

function clipPolygon(
  subject: M01StandardPieceBlendPoint[],
  clip: M01StandardPieceBlendPoint[]
): M01StandardPieceBlendPoint[] {
  const orientation = polygonOrientation(clip);
  let output = subject;

  for (let index = 0; index < clip.length; index += 1) {
    const start = clip[index];
    const end = clip[(index + 1) % clip.length];
    const input = output;
    output = [];
    if (input.length === 0) {
      break;
    }

    let previous = input[input.length - 1];
    for (const current of input) {
      const currentInside = isInside(current, start, end, orientation);
      const previousInside = isInside(previous, start, end, orientation);

      if (currentInside) {
        if (!previousInside) {
          output.push(intersection(previous, current, start, end));
        }
        output.push(current);
      } else if (previousInside) {
        output.push(intersection(previous, current, start, end));
      }

      previous = current;
    }
  }

  return output;
}

function polygonArea(points: M01StandardPieceBlendPoint[]): number {
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2
  );
}

function polygonOrientation(points: M01StandardPieceBlendPoint[]): number {
  const signedArea = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);

  return signedArea >= 0 ? 1 : -1;
}

function isInside(
  point: M01StandardPieceBlendPoint,
  start: M01StandardPieceBlendPoint,
  end: M01StandardPieceBlendPoint,
  orientation: number
): boolean {
  const cross = (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x);
  return orientation * cross >= -0.0001;
}

function intersection(
  firstStart: M01StandardPieceBlendPoint,
  firstEnd: M01StandardPieceBlendPoint,
  secondStart: M01StandardPieceBlendPoint,
  secondEnd: M01StandardPieceBlendPoint
): M01StandardPieceBlendPoint {
  const firstDx = firstEnd.x - firstStart.x;
  const firstDy = firstEnd.y - firstStart.y;
  const secondDx = secondEnd.x - secondStart.x;
  const secondDy = secondEnd.y - secondStart.y;
  const denominator = firstDx * secondDy - firstDy * secondDx;

  if (Math.abs(denominator) < 0.0001) {
    return firstEnd;
  }

  const ratio =
    ((secondStart.x - firstStart.x) * secondDy - (secondStart.y - firstStart.y) * secondDx) /
    denominator;

  return {
    x: firstStart.x + firstDx * ratio,
    y: firstStart.y + firstDy * ratio
  };
}

function isM01BaseColor(colorToken: string): colorToken is M01BaseColor {
  return colorToken === "red" || colorToken === "yellow" || colorToken === "blue";
}
