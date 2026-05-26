import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  buildM01GreyboxArtPreviewPlan,
  buildM01GreyboxRuntimeTransparentPlan,
  buildM01GreyboxStaticArtPlan,
  buildM01GreyboxTargetOverlapEvidencePlan,
  buildM01GreyboxTokenArtPlan,
  getM01GreyboxArtSlice,
  getM01GreyboxArtPreviewResource,
  getM01GreyboxRuntimeLightEdgeResourceForToken,
  getM01GreyboxRuntimeLightMaskResourceForToken,
  getM01GreyboxRuntimeSpriteResourceForToken,
  getM01GreyboxTargetReferenceCardResource,
  getM01GreyboxToolCardFrameResource,
  getM01GreyboxRuntimeTransparentResource,
  M01_GREYBOX_ART_ASSET_ROOT,
  M01_GREYBOX_ART_PREVIEW_RESOURCES,
  M01_GREYBOX_FINAL_DIRECT_FRAGMENT_SOURCE_ROOT,
  M01_GREYBOX_ART_SOURCE_SHEET,
  M01_GREYBOX_ART_SLICES,
  M01_GREYBOX_RUNTIME_EVIDENCE_RESOURCES,
  M01_GREYBOX_RUNTIME_FLASHLIGHT_RESOURCES,
  M01_GREYBOX_RUNTIME_FILTER_RESOURCES,
  M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES,
  M01_GREYBOX_RUNTIME_LIGHT_EDGE_FRAGMENT_RESOURCES,
  M01_GREYBOX_RUNTIME_LIGHT_MASK_FRAGMENT_RESOURCES,
  M01_GREYBOX_RUNTIME_SURFACE_RESOURCES,
  M01_GREYBOX_RUNTIME_TRANSPARENT_RESOURCES
} from "../../assets/scripts/cocos/M01GreyboxArt.ts";
import {
  buildM01GreyboxLayout,
  type M01GreyboxLayout
} from "../../assets/scripts/cocos/M01GreyboxLayout.ts";
import type { M01MemoryGearConfig } from "../../assets/scripts/levels/stage1/M01MemoryGearController.ts";
import realM01ConfigJson from "../../assets/resources/configs/stage1/m01-memory-gear.json" with { type: "json" };
import { m01LegacySortConfig as config } from "./m01LegacySortConfig.ts";

const projectRoot = process.cwd();
const realM01Config = realM01ConfigJson as unknown as M01MemoryGearConfig;

function readPngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(join(projectRoot, path));

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}

function readSpriteFrameUserData(metaPath: string): Record<string, unknown> {
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
    subMetas?: Record<string, { importer?: string; userData?: Record<string, unknown> }>;
  };
  const spriteFrame = Object.values(meta.subMetas ?? {}).find(
    (entry) => entry.importer === "sprite-frame"
  );
  if (!spriteFrame?.userData) {
    throw new Error(`Missing sprite-frame userData in ${metaPath}`);
  }

  return spriteFrame.userData;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(projectRoot, path), "utf8")) as unknown;
}

function readPngRgba(path: string): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const bytes = readFileSync(join(projectRoot, path));
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const idatChunks: Buffer[] = [];

  expect(bitDepth).toBe(8);
  expect(colorType).toBe(6);

  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IDAT") {
      idatChunks.push(data);
    }
    if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4;
  const output = new Uint8Array(width * height * 4);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= 4 ? output[y * stride + x - 4] : 0;
      const up = y > 0 ? output[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? output[(y - 1) * stride + x - 4] : 0;
      const value =
        filter === 0
          ? raw
          : filter === 1
            ? raw + left
            : filter === 2
              ? raw + up
              : filter === 3
                ? raw + Math.floor((left + up) / 2)
                : raw + paethPredictor(left, up, upLeft);

      output[y * stride + x] = value & 0xff;
    }
    sourceOffset += stride;
  }

  return { width, height, data: output };
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDelta = Math.abs(estimate - left);
  const upDelta = Math.abs(estimate - up);
  const upLeftDelta = Math.abs(estimate - upLeft);

  if (leftDelta <= upDelta && leftDelta <= upLeftDelta) {
    return left;
  }
  return upDelta <= upLeftDelta ? up : upLeft;
}

function alphaAt(image: { width: number; data: Uint8Array }, x: number, y: number): number {
  return image.data[(y * image.width + x) * 4 + 3];
}

function expectVisuallyTransparentCorners(image: { width: number; height: number; data: Uint8Array }): void {
  expect(alphaAt(image, 0, 0)).toBeLessThanOrEqual(2);
  expect(alphaAt(image, image.width - 1, 0)).toBeLessThanOrEqual(2);
  expect(alphaAt(image, 0, image.height - 1)).toBeLessThanOrEqual(2);
  expect(alphaAt(image, image.width - 1, image.height - 1)).toBeLessThanOrEqual(2);
}

function countOpaquePixels(image: { data: Uint8Array }): number {
  let count = 0;
  for (let offset = 3; offset < image.data.length; offset += 4) {
    if (image.data[offset] >= 16) {
      count += 1;
    }
  }
  return count;
}

function opaqueBounds(image: { width: number; height: number; data: Uint8Array }): {
  width: number;
  height: number;
} {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (alphaAt(image, x, y) < 24) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function translucentOuterEdgeRatio(image: {
  width: number;
  height: number;
  data: Uint8Array;
}): number {
  let boundary = 0;
  let translucent = 0;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const alpha = alphaAt(image, x, y);
      if (alpha < 16) {
        continue;
      }

      const touchesTransparentOutside = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 }
      ].some((point) => {
        if (point.x < 0 || point.y < 0 || point.x >= image.width || point.y >= image.height) {
          return true;
        }
        return alphaAt(image, point.x, point.y) < 16;
      });

      if (!touchesTransparentOutside) {
        continue;
      }

      boundary += 1;
      if (alpha < 220) {
        translucent += 1;
      }
    }
  }

  return translucent / boundary;
}

function lightNeutralOuterEdgeRatio(image: {
  width: number;
  height: number;
  data: Uint8Array;
}): number {
  let boundary = 0;
  let lightNeutral = 0;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      if (image.data[offset + 3] < 24) {
        continue;
      }

      const touchesTransparentOutside = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 }
      ].some((point) => {
        if (point.x < 0 || point.y < 0 || point.x >= image.width || point.y >= image.height) {
          return true;
        }
        return alphaAt(image, point.x, point.y) < 16;
      });

      if (!touchesTransparentOutside) {
        continue;
      }

      boundary += 1;
      const r = image.data[offset];
      const g = image.data[offset + 1];
      const b = image.data[offset + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (luminance > 120 && spread < 80) {
        lightNeutral += 1;
      }
    }
  }

  return lightNeutral / boundary;
}

function outerContourAverageLuminance(image: {
  width: number;
  height: number;
  data: Uint8Array;
}): number {
  let contourPixels = 0;
  let luminanceSum = 0;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      if (image.data[offset + 3] < 24) {
        continue;
      }
      if (nearestTransparentDistance(image.data, image.width, image.height, x, y, 3) > 3) {
        continue;
      }

      const r = image.data[offset];
      const g = image.data[offset + 1];
      const b = image.data[offset + 2];
      luminanceSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      contourPixels += 1;
    }
  }

  return luminanceSum / contourPixels;
}

const directHiddenCropBoxes = {
  circle: { x: 459, y: 448, size: 332 },
  triangle: { x: 84, y: 434, size: 334 },
  hexagon: { x: 852, y: 446, size: 338 }
} as const;

type DirectHiddenShape = keyof typeof directHiddenCropBoxes;

const finalSheetColumns = {
  triangle: 0,
  circle: 1,
  hexagon: 2
} as const;

const finalSheetColumnCenters = {
  triangle: 0.25,
  circle: 0.5,
  hexagon: 0.75
} as const;

const finalRgbRows = {
  red: 0,
  yellow: 1,
  blue: 2
} as const;

const finalColorPatternRows = {
  orange: 1,
  purple: 2,
  green: 3
} as const;

type RuntimeFragmentShape = keyof typeof finalSheetColumns;
function expectedRuntimeShapeAspect(shape: RuntimeFragmentShape): number {
  if (shape === "circle") {
    return 1;
  }

  return 2 / Math.sqrt(3);
}

function expectedCurrentRuntimeShapeAspectRange(shape: RuntimeFragmentShape): {
  min: number;
  max: number;
} {
  if (shape === "circle") {
    return { min: 0.98, max: 1.03 };
  }
  // Canonical equilateral / regular hexagon aspect is 2/√3 ≈ 1.155.
  // Stroke AA shifts the opaque bbox slightly; allow a band around the
  // canonical ratio.
  if (shape === "triangle") {
    return { min: 1.04, max: 1.18 };
  }

  return { min: 1.09, max: 1.18 };
}

function thickenDirectPieceOutline(data: Uint8Array, width: number, height: number): void {
  const ink = [7, 7, 6];
  const radius = 6.2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 24) {
        continue;
      }

      const distance = nearestTransparentDistance(data, width, height, x, y, Math.ceil(radius));
      if (distance > radius) {
        continue;
      }

      const fade = Math.pow((radius - distance) / radius, 0.78);
      const strength = Math.max(0, Math.min(fade * 0.88, 0.9));
      data[offset] = Math.round(data[offset] * (1 - strength) + ink[0] * strength);
      data[offset + 1] = Math.round(data[offset + 1] * (1 - strength) + ink[1] * strength);
      data[offset + 2] = Math.round(data[offset + 2] * (1 - strength) + ink[2] * strength);
    }
  }
}

function nearestTransparentDistance(
  data: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number
): number {
  let nearest = Infinity;
  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) {
        nearest = Math.min(nearest, Math.hypot(xx - x, yy - y));
        continue;
      }
      if (data[(yy * width + xx) * 4 + 3] >= 24) {
        continue;
      }
      nearest = Math.min(nearest, Math.hypot(xx - x, yy - y));
    }
  }
  return nearest;
}

function shapeFromRuntimeFragmentResourceId(resourceId: string): RuntimeFragmentShape {
  if (resourceId.endsWith("_circle")) {
    return "circle";
  }
  if (resourceId.endsWith("_triangle")) {
    return "triangle";
  }
  if (resourceId.endsWith("_hexagon")) {
    return "hexagon";
  }

  throw new Error(`Unable to read runtime fragment shape: ${resourceId}`);
}

function sourceOpaqueBounds(image: { width: number; height: number; data: Uint8Array }): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (alphaAt(image, x, y) < 24) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function finalSheetShapeMaskLimit(shape: RuntimeFragmentShape): number {
  return shape === "triangle" ? 3 : -0.5;
}

function isFinalSheetOutlineSample(sample: [number, number, number, number]): boolean {
  const luminance = 0.2126 * sample[0] + 0.7152 * sample[1] + 0.0722 * sample[2];
  const spread = Math.max(sample[0], sample[1], sample[2]) - Math.min(sample[0], sample[1], sample[2]);

  return luminance < 85 || (luminance < 112 && spread < 48);
}

function findFinalSheetPieceBounds(
  source: { width: number; height: number; data: Uint8Array },
  shape: RuntimeFragmentShape,
  columnIndex: number,
  rowIndex: number,
  rowCount: number
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  void columnIndex;
  const expectedCenterX = source.width * finalSheetColumnCenters[shape];
  const expectedCenterY = (rowIndex + 0.55) * (source.height / rowCount);
  const searchRadius = 155;
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;

  for (
    let y = Math.max(0, Math.floor(expectedCenterY - searchRadius));
    y < Math.min(source.height, Math.ceil(expectedCenterY + searchRadius));
    y += 1
  ) {
    for (
      let x = Math.max(0, Math.floor(expectedCenterX - searchRadius));
      x < Math.min(source.width, Math.ceil(expectedCenterX + searchRadius));
      x += 1
    ) {
      if (!isFinalSheetOutlinePixel(source, x, y)) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    const fallbackSize = Math.min(source.width / 4.8, (source.height / rowCount) * 0.72);
    return {
      minX: expectedCenterX - fallbackSize / 2,
      minY: expectedCenterY - fallbackSize / 2,
      maxX: expectedCenterX + fallbackSize / 2,
      maxY: expectedCenterY + fallbackSize / 2,
      width: fallbackSize,
      height: fallbackSize
    };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function isFinalSheetOutlinePixel(
  image: { width: number; data: Uint8Array },
  x: number,
  y: number
): boolean {
  const offset = (y * image.width + x) * 4;
  const r = image.data[offset];
  const g = image.data[offset + 1];
  const b = image.data[offset + 2];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);

  return luminance < 70 || (luminance < 105 && spread < 40);
}

function addCocosTrimGuard(data: Uint8Array, width: number, height: number): void {
  for (const [x, y] of [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1]
  ]) {
    data[(y * width + x) * 4 + 3] = 2;
  }
}

function buildDarkOutlineMask(data: Uint8Array, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (luminance < 98 || (luminance < 122 && spread < 54)) {
        mask[y * width + x] = 1;
      }
    }
  }

  return mask;
}

function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const output = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let active = false;
      for (let yy = -radius; yy <= radius && !active; yy += 1) {
        for (let xx = -radius; xx <= radius; xx += 1) {
          const px = x + xx;
          const py = y + yy;
          if (px < 0 || py < 0 || px >= width || py >= height) {
            continue;
          }
          if (mask[py * width + px]) {
            active = true;
            break;
          }
        }
      }
      output[y * width + x] = active ? 1 : 0;
    }
  }

  return output;
}

function floodFillBackground(barrier: Uint8Array, width: number, height: number): Uint8Array {
  const background = new Uint8Array(width * height);
  const stack: Array<[number, number]> = [];
  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    const index = y * width + x;
    if (background[index] || barrier[index]) {
      return;
    }
    background[index] = 1;
    stack.push([x, y]);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  return background;
}

function trimLightPaperHalo(
  data: Uint8Array,
  width: number,
  height: number,
  maxPasses: number
): void {
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const remove: number[] = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] < 16 || !touchesTransparent(data, width, height, x, y)) {
          continue;
        }
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const spread = Math.max(r, g, b) - Math.min(r, g, b);
        if (luminance > 120 && spread < 80) {
          remove.push(offset);
        }
      }
    }

    if (remove.length === 0) {
      return;
    }
    for (const offset of remove) {
      data[offset + 3] = 0;
    }
  }
}

function touchesTransparent(
  data: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number
): boolean {
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1]
  ].some(([px, py]) => {
    if (px < 0 || py < 0 || px >= width || py >= height) {
      return true;
    }
    return data[(py * width + px) * 4 + 3] < 16;
  });
}

function sampleBilinear(
  image: { width: number; height: number; data: Uint8Array },
  x: number,
  y: number
): [number, number, number] {
  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(image.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(image.height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - y0;
  const top = mixSample(readPixel(image, x0, y0), readPixel(image, x1, y0), tx);
  const bottom = mixSample(readPixel(image, x0, y1), readPixel(image, x1, y1), tx);

  return mixSample(top, bottom, ty);
}

function sampleRgbaBilinear(
  image: { width: number; height: number; data: Uint8Array },
  x: number,
  y: number
): [number, number, number, number] {
  if (x < 0 || y < 0 || x > image.width - 1 || y > image.height - 1) {
    return [0, 0, 0, 0];
  }

  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(image.width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(image.height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - y0;
  const top = mixRgbaSample(readRgbaPixel(image, x0, y0), readRgbaPixel(image, x1, y0), tx);
  const bottom = mixRgbaSample(readRgbaPixel(image, x0, y1), readRgbaPixel(image, x1, y1), tx);

  return mixRgbaSample(top, bottom, ty);
}

function shapeSignedDistance(shape: RuntimeFragmentShape, x: number, y: number): number {
  if (shape === "circle") {
    return Math.hypot(x - 56, y - 56) - 52;
  }

  if (shape === "triangle") {
    return polygonSignedDistance(
      [
        [56, 2],
        [110, 108],
        [2, 108]
      ],
      x,
      y
    );
  }

  return polygonSignedDistance(
    [
      [56, 1],
      [108, 29],
      [108, 83],
      [56, 111],
      [4, 83],
      [4, 29]
    ],
    x,
    y
  );
}

function polygonSignedDistance(points: Array<[number, number]>, x: number, y: number): number {
  let inside = false;
  let minDistance = Infinity;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [xi, yi] = points[index];
    const [xj, yj] = points[previous];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }

    const distance = pointSegmentDistance(x, y, xi, yi, xj, yj);
    minDistance = Math.min(minDistance, distance);
  }
  return inside ? -minDistance : minDistance;
}

function pointSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function readPixel(
  image: { width: number; data: Uint8Array },
  x: number,
  y: number
): [number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
}

function readRgbaPixel(
  image: { width: number; data: Uint8Array },
  x: number,
  y: number
): [number, number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [
    image.data[offset],
    image.data[offset + 1],
    image.data[offset + 2],
    image.data[offset + 3]
  ];
}

function mixSample(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t)
  ];
}

function mixRgbaSample(
  a: [number, number, number, number],
  b: [number, number, number, number],
  t: number
): [number, number, number, number] {
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
    Math.round(a[3] * (1 - t) + b[3] * t)
  ];
}

function summarizeOpaqueColor(image: { data: Uint8Array }): {
  averageLuminance: number;
  averageChannelSpread: number;
  averageRed: number;
  averageGreen: number;
  averageBlue: number;
} {
  let luminance = 0;
  let channelSpread = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] < 24) {
      continue;
    }

    const r = image.data[offset];
    const g = image.data[offset + 1];
    const b = image.data[offset + 2];

    luminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    channelSpread += Math.max(r, g, b) - Math.min(r, g, b);
    red += r;
    green += g;
    blue += b;
    count += 1;
  }

  return {
    averageLuminance: luminance / count,
    averageChannelSpread: channelSpread / count,
    averageRed: red / count,
    averageGreen: green / count,
    averageBlue: blue / count
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("M01 greybox art slices", () => {
  it("declares the first accepted runtime candidate set outside generated review docs", () => {
    expect(M01_GREYBOX_ART_ASSET_ROOT).toBe("assets/art/stage1-m01");
    expect(M01_GREYBOX_ART_SLICES.map((slice) => slice.id)).toEqual([
      "gearStar",
      "nineSlotTray",
      "memoryFragments",
      "colorFilters",
      "toolCardThumbnail"
    ]);

    for (const slice of M01_GREYBOX_ART_SLICES) {
      expect(slice.file).toMatch(/^assets\/art\/stage1-m01\/m01-.+\.png$/);
      expect(slice.assetDatabaseUrl).toBe(`db://${slice.file}`);
      expect(slice.resourcesLoadPath).toBeNull();
      expect(slice.sourceSheet).toBe(
        "docs/design/generated-m01-art-slices/m01-runtime-sprite-sheet-candidate-v2.png"
      );
      expect(slice.runtimeStatus).toBe("paper_backed_candidate");
    }
  });

  it("keeps every declared runtime candidate present and large enough for gameplay review", () => {
    for (const slice of M01_GREYBOX_ART_SLICES) {
      expect(existsSync(join(projectRoot, slice.file))).toBe(true);
      expect(existsSync(join(projectRoot, `${slice.file}.meta`))).toBe(true);

      const size = readPngSize(slice.file);
      expect(size.width).toBeGreaterThanOrEqual(slice.minPixelSize.width);
      expect(size.height).toBeGreaterThanOrEqual(slice.minPixelSize.height);

      const meta = readJson(`${slice.file}.meta`);
      expect(meta).toMatchObject({
        importer: "image",
        imported: true
      });
      expect(isRecord(meta) && isRecord(meta.subMetas) && isRecord(meta.subMetas.f9941)).toBe(
        true
      );
      expect(isRecord(meta) && isRecord(meta.subMetas) && isRecord(meta.subMetas["6c48a"])).toBe(
        true
      );
    }
  });

  it("looks up individual slices by gameplay role", () => {
    expect(getM01GreyboxArtSlice("gearStar")?.role).toBe("repair_object");
    expect(getM01GreyboxArtSlice("nineSlotTray")?.role).toBe("classification_target");
    expect(getM01GreyboxArtSlice("memoryFragments")?.role).toBe("draggable_fragments");
    expect(getM01GreyboxArtSlice("colorFilters")?.role).toBe("filter_affordances");
    expect(getM01GreyboxArtSlice("toolCardThumbnail")?.role).toBe("toolcard_basis");
  });

  it("declares resource-backed art preview copies for dynamic Cocos loading", () => {
    expect(M01_GREYBOX_ART_PREVIEW_RESOURCES.map((resource) => resource.id)).toEqual(
      M01_GREYBOX_ART_SLICES.map((slice) => slice.id)
    );

    for (const resource of M01_GREYBOX_ART_PREVIEW_RESOURCES) {
      expect(resource.file).toMatch(/^assets\/resources\/art\/stage1-m01\/m01-.+\.png$/);
      expect(resource.assetDatabaseUrl).toBe(`db://${resource.file}`);
      expect(resource.resourcesLoadPath).toMatch(/^art\/stage1-m01\/m01-.+\/spriteFrame$/);
      expect(existsSync(join(projectRoot, resource.file))).toBe(true);
      expect(existsSync(join(projectRoot, `${resource.file}.meta`))).toBe(true);

      const meta = readJson(`${resource.file}.meta`);
      expect(meta).toMatchObject({
        importer: "image",
        imported: true
      });
      expect(isRecord(meta) && isRecord(meta.subMetas) && isRecord(meta.subMetas.f9941)).toBe(
        true
      );
    }

    expect(getM01GreyboxArtPreviewResource("gearStar")?.resourcesLoadPath).toBe(
      "art/stage1-m01/m01-gear-star-slice/spriteFrame"
    );
  });

  it("keeps resource preview copies byte-identical to the accepted source assets", () => {
    for (const slice of M01_GREYBOX_ART_SLICES) {
      const resource = getM01GreyboxArtPreviewResource(slice.id);

      expect(resource).toBeDefined();
      const resourceBytes = readFileSync(join(projectRoot, resource!.file));
      const sourceBytes = readFileSync(join(projectRoot, slice.file));
      expect(resourceBytes.equals(sourceBytes)).toBe(true);
    }
  });

  it("builds a non-interactive art preview plan that preserves greybox hit targets", () => {
    const plan = buildM01GreyboxArtPreviewPlan();

    expect(plan.enabledByDefault).toBe(false);
    expect(plan.layers.map((layer) => layer.id)).toEqual([
      "gearStar",
      "nineSlotTray",
      "memoryFragments",
      "colorFilters",
      "toolCardThumbnail"
    ]);

    for (const layer of plan.layers) {
      expect(layer.interactive).toBe(false);
      expect(layer.resourcesLoadPath).toMatch(/^art\/stage1-m01\/m01-.+\/spriteFrame$/);
      expect(layer.size.width).toBeGreaterThan(0);
      expect(layer.size.height).toBeGreaterThan(0);
    }

    expect(plan.layers.find((layer) => layer.id === "gearStar")).toMatchObject({
      position: { x: -230, y: 42 },
      size: { width: 300, height: 281 }
    });
    expect(plan.layers.find((layer) => layer.id === "nineSlotTray")).toMatchObject({
      position: { x: 0, y: 42 },
      size: { width: 156, height: 166 }
    });
  });

  it("declares transparent runtime candidates separately from paper-backed preview art", () => {
    expect(M01_GREYBOX_RUNTIME_TRANSPARENT_RESOURCES.map((resource) => resource.id)).toEqual(
      M01_GREYBOX_ART_PREVIEW_RESOURCES.map((resource) => resource.id)
    );

    for (const resource of M01_GREYBOX_RUNTIME_TRANSPARENT_RESOURCES) {
      expect(resource.file).toMatch(
        /^assets\/resources\/art\/stage1-m01\/runtime-transparent\/m01-.+-transparent\.png$/
      );
      expect(resource.sourceFile).toMatch(/^assets\/resources\/art\/stage1-m01\/m01-.+\.png$/);
      expect(resource.assetDatabaseUrl).toBe(`db://${resource.file}`);
      expect(resource.resourcesLoadPath).toMatch(
        /^art\/stage1-m01\/runtime-transparent\/m01-.+-transparent\/spriteFrame$/
      );
      expect(resource.runtimeStatus).toBe("transparent_candidate");
      expect(existsSync(join(projectRoot, resource.file))).toBe(true);
      expect(existsSync(join(projectRoot, `${resource.file}.meta`))).toBe(true);

      const image = readPngRgba(resource.file);
      expect(alphaAt(image, 0, 0)).toBe(0);
      expect(alphaAt(image, image.width - 1, 0)).toBe(0);
      expect(alphaAt(image, 0, image.height - 1)).toBe(0);
      expect(alphaAt(image, image.width - 1, image.height - 1)).toBe(0);
      expect(countOpaquePixels(image)).toBeGreaterThan(image.width * image.height * 0.05);
    }

    expect(getM01GreyboxRuntimeTransparentResource("gearStar")?.resourcesLoadPath).toBe(
      "art/stage1-m01/runtime-transparent/m01-gear-star-slice-transparent/spriteFrame"
    );
  });

  it("builds a non-interactive transparent runtime plan for art-enabled Cocos review", () => {
    const previewPlan = buildM01GreyboxArtPreviewPlan();
    const runtimePlan = buildM01GreyboxRuntimeTransparentPlan();

    expect(runtimePlan.enabledByDefault).toBe(false);
    expect(runtimePlan.layers.map((layer) => layer.id)).toEqual(
      previewPlan.layers.map((layer) => layer.id)
    );

    for (const layer of runtimePlan.layers) {
      expect(layer.interactive).toBe(false);
      expect(layer.resourcesLoadPath).toMatch(
        /^art\/stage1-m01\/runtime-transparent\/m01-.+-transparent\/spriteFrame$/
      );
    }

    const previewGear = previewPlan.layers.find((layer) => layer.id === "gearStar")!;
    expect(runtimePlan.layers.find((layer) => layer.id === "gearStar")).toMatchObject({
      position: previewGear.position,
      size: previewGear.size,
      interactive: false
    });
  });

  it("declares filter runtime sprites for token-level presentation", () => {
    expect(M01_GREYBOX_RUNTIME_FILTER_RESOURCES.map((resource) => resource.id)).toEqual([
      "red",
      "blue",
      "yellow"
    ]);

    for (const resource of M01_GREYBOX_RUNTIME_FILTER_RESOURCES) {
      expect(resource.file).toMatch(
        /^assets\/resources\/art\/stage1-m01\/runtime-sprites\/(fragments|filters)\/m01-.+\.png$/
      );
      expect(resource.resourcesLoadPath).toMatch(
        /^art\/stage1-m01\/runtime-sprites\/(fragments|filters)\/m01-.+\/spriteFrame$/
      );
      expect(existsSync(join(projectRoot, resource.file))).toBe(true);
      expect(existsSync(join(projectRoot, `${resource.file}.meta`))).toBe(true);

      const image = readPngRgba(resource.file);
      expectVisuallyTransparentCorners(image);
      expect(countOpaquePixels(image)).toBeGreaterThan(image.width * image.height * 0.12);
    }
  });

  it("declares shape-only hidden fragment sprites and overlap evidence marker sprites for real M01", () => {
    expect(M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES.map((resource) => resource.id)).toEqual([
      "hidden_circle",
      "hidden_triangle",
      "hidden_hexagon"
    ]);
    expect(M01_GREYBOX_RUNTIME_LIGHT_MASK_FRAGMENT_RESOURCES.map((resource) => resource.id)).toEqual([
      "light_mask_circle",
      "light_mask_triangle",
      "light_mask_hexagon"
    ]);
    expect(M01_GREYBOX_RUNTIME_LIGHT_EDGE_FRAGMENT_RESOURCES.map((resource) => resource.id)).toEqual([
      "light_edge_circle",
      "light_edge_triangle",
      "light_edge_hexagon"
    ]);
    expect(M01_GREYBOX_RUNTIME_EVIDENCE_RESOURCES.map((resource) => resource.id)).toEqual([
      "evidence_purple_circle_triangle",
      "evidence_green_triangle_hexagon",
      "evidence_orange_hexagon_hexagon",
      "evidence_purple_hexagon_circle"
    ]);

    for (const resource of [
      ...M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES,
      ...M01_GREYBOX_RUNTIME_LIGHT_EDGE_FRAGMENT_RESOURCES,
      ...M01_GREYBOX_RUNTIME_LIGHT_MASK_FRAGMENT_RESOURCES,
      ...M01_GREYBOX_RUNTIME_EVIDENCE_RESOURCES
    ]) {
      expect(
        resource.file
      ).toMatch(
        /^assets\/resources\/art\/stage1-m01\/runtime-sprites\/(hidden-fragments|evidence-markers)\/m01-.+\.png$/
      );
      expect(resource.resourcesLoadPath).toMatch(
        /^art\/stage1-m01\/runtime-sprites\/(hidden-fragments|evidence-markers)\/m01-.+\/spriteFrame$/
      );
      expect(existsSync(join(projectRoot, resource.file))).toBe(true);
      expect(existsSync(join(projectRoot, `${resource.file}.meta`))).toBe(true);

      const image = readPngRgba(resource.file);
      expectVisuallyTransparentCorners(image);
      expect(countOpaquePixels(image)).toBeGreaterThan(image.width * image.height * 0.08);
    }
  });

  it("maps lit fragment tokens onto white light-mask sprites instead of grey hidden sprites", () => {
    const layout = buildM01GreyboxLayout(realM01Config);
    const circle = layout.fragments.find(
      (fragment) => fragment.controllerId === "fragment_circle_blue_1"
    )!;
    const mask = getM01GreyboxRuntimeLightMaskResourceForToken(circle);
    const edge = getM01GreyboxRuntimeLightEdgeResourceForToken(circle);

    expect(mask).toMatchObject({
      id: "light_mask_circle",
      role: "fragment_token",
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/hidden-fragments/m01-fragment-light-mask-circle/spriteFrame"
    });
    expect(mask?.file).toBe(
      "assets/resources/art/stage1-m01/runtime-sprites/hidden-fragments/m01-fragment-light-mask-circle.png"
    );
    expect(edge).toMatchObject({
      id: "light_edge_circle",
      role: "fragment_token",
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/hidden-fragments/m01-fragment-light-edge-circle/spriteFrame"
    });
  });

  it("keeps lit fragment light-mask fills translucent without tinting the hand-drawn edges", () => {
    for (const resource of M01_GREYBOX_RUNTIME_LIGHT_MASK_FRAGMENT_RESOURCES) {
      const image = readPngRgba(resource.file);
      const fillAlphas: number[] = [];

      for (let offset = 0; offset < image.data.length; offset += 4) {
        const r = image.data[offset];
        const g = image.data[offset + 1];
        const b = image.data[offset + 2];
        const a = image.data[offset + 3];
        if (r > 240 && g > 240 && b > 240 && a > 0) {
          fillAlphas.push(a);
        }
      }

      fillAlphas.sort((left, right) => left - right);
      expect(fillAlphas.length).toBeGreaterThan(image.width * image.height * 0.35);
      expect(fillAlphas[Math.floor(fillAlphas.length * 0.5)]).toBeGreaterThanOrEqual(120);
      expect(fillAlphas[Math.floor(fillAlphas.length * 0.5)]).toBeLessThanOrEqual(190);
    }
  });

  it("keeps lit fragment edges in an untinted overlay matching the grey hidden artwork", () => {
    for (const edgeResource of M01_GREYBOX_RUNTIME_LIGHT_EDGE_FRAGMENT_RESOURCES) {
      const hiddenResource = M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES.find(
        (resource) =>
          resource.id === edgeResource.id.replace("light_edge_", "hidden_")
      )!;
      const edge = readPngRgba(edgeResource.file);
      const hidden = readPngRgba(hiddenResource.file);
      let edgePixelCount = 0;
      let mismatchedEdgePixelCount = 0;

      for (let offset = 0; offset < edge.data.length; offset += 4) {
        if (edge.data[offset + 3] <= 24) {
          continue;
        }

        edgePixelCount += 1;
        if (
          edge.data[offset] !== hidden.data[offset] ||
          edge.data[offset + 1] !== hidden.data[offset + 1] ||
          edge.data[offset + 2] !== hidden.data[offset + 2] ||
          edge.data[offset + 3] !== hidden.data[offset + 3]
        ) {
          mismatchedEdgePixelCount += 1;
        }
      }

      expect(edgePixelCount).toBeGreaterThan(edge.width * edge.height * 0.07);
      expect(mismatchedEdgePixelCount).toBe(0);
    }
  });

  it("keeps standard piece sprites in a low-saturation watercolor material range", () => {
    for (const resource of M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES) {
      const image = readPngRgba(resource.file);
      const color = summarizeOpaqueColor(image);

      expect(color.averageLuminance).toBeGreaterThan(100);
      expect(color.averageLuminance).toBeLessThan(215);
      expect(color.averageChannelSpread).toBeLessThan(45);
      expect(resource.sourceFile).toBe(
        `${M01_GREYBOX_FINAL_DIRECT_FRAGMENT_SOURCE_ROOT}/m01-final-fragment-${resource.id.replace("_", "-")}.png`
      );
    }

  });

  it("keeps standard piece sprites connected to prepared transparent source slices", () => {
    for (const resource of M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES) {
      const source = readPngRgba(resource.sourceFile);
      const runtime = readPngRgba(resource.file);

      expect(source.width).toBeGreaterThan(90);
      expect(source.height).toBeGreaterThan(90);
      // Hidden circle uses a 120×120 canvas (60×60 sprite contentSize) so the
      // canonical-radius outline AA does not clip at canvas edges; the other
      // shapes keep the 112×112 canonical canvas.
      const expectedSize = resource.id === "hidden_circle" ? 120 : 112;
      expect(runtime.width).toBe(expectedSize);
      expect(runtime.height).toBe(expectedSize);
      expectVisuallyTransparentCorners(runtime);
      expect(countOpaquePixels(runtime)).toBeGreaterThan(runtime.width * runtime.height * 0.45);
    }
  });

  it("keeps current hand-painted standard piece artwork proportional to target geometry", () => {
    for (const resource of M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES) {
      const image = readPngRgba(resource.file);
      const bounds = opaqueBounds(image);
      const shape = shapeFromRuntimeFragmentResourceId(resource.id);
      const aspect = bounds.width / bounds.height;
      const expectedRange = expectedCurrentRuntimeShapeAspectRange(shape);

      expect(aspect).toBeGreaterThanOrEqual(expectedRange.min);
      expect(aspect).toBeLessThanOrEqual(expectedRange.max);
    }
  });

  it("keeps standard piece sprite frames close to their canonical canvas", () => {
    for (const resource of M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES) {
      const userData = readSpriteFrameUserData(join(projectRoot, `${resource.file}.meta`));
      // Circle uses 120×120 to give canonical-radius outline AA breathing room;
      // triangle and hexagon stay on the 112×112 canonical canvas.
      const expectedSize = resource.id === "hidden_circle" ? 120 : 112;

      expect(userData).toMatchObject({
        trimX: 0,
        width: expectedSize,
        rawWidth: expectedSize,
        rawHeight: expectedSize
      });
      expect(userData.trimY).toEqual(expect.any(Number));
      expect(userData.trimY as number).toBeGreaterThanOrEqual(0);
      expect(userData.trimY as number).toBeLessThanOrEqual(5);
      expect(userData.height as number).toBeGreaterThanOrEqual(102);
      expect(userData.height as number).toBeLessThanOrEqual(expectedSize);
    }
  });

  it("keeps standard piece artwork large enough to visually match target geometry", () => {
    for (const resource of M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES) {
      const image = readPngRgba(resource.file);
      const bounds = opaqueBounds(image);
      const shape = shapeFromRuntimeFragmentResourceId(resource.id);
      const minHeightRatio = shape === "circle" ? 0.88 : 0.84;

      expect(bounds.width / image.width).toBeGreaterThan(0.88);
      expect(bounds.height / image.height).toBeGreaterThan(minHeightRatio);
    }
  });

  it("keeps standard piece outer contours intentionally translucent", () => {
    for (const resource of M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES) {
      const image = readPngRgba(resource.file);

      expect(translucentOuterEdgeRatio(image)).toBeGreaterThan(0.6);
    }
  });

  it("keeps standard piece outer contours in the graphite watercolor luminance band", () => {
    for (const resource of M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES) {
      const image = readPngRgba(resource.file);

      expect(outerContourAverageLuminance(image)).toBeGreaterThan(95);
      expect(outerContourAverageLuminance(image)).toBeLessThan(170);
    }
  });

  it("keeps grey hidden piece outer edges neutral and parchment-like", () => {
    for (const resource of M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES) {
      const image = readPngRgba(resource.file);

      expect(lightNeutralOuterEdgeRatio(image)).toBeGreaterThan(0.85);
    }
  });

  it("declares flashlight token sprites and overlap surface resources for the current M01 art inventory", () => {
    expect(M01_GREYBOX_RUNTIME_FLASHLIGHT_RESOURCES.map((resource) => resource.id)).toEqual([
      "flashlight_red",
      "flashlight_yellow",
      "flashlight_blue"
    ]);
    expect(M01_GREYBOX_RUNTIME_SURFACE_RESOURCES.map((resource) => resource.id)).toEqual([
      "fragment_floor",
      "target_reference_card",
      "single_flashlight_tool",
      "toolcard_frame"
    ]);

    for (const resource of [
      ...M01_GREYBOX_RUNTIME_FLASHLIGHT_RESOURCES,
      ...M01_GREYBOX_RUNTIME_SURFACE_RESOURCES
    ]) {
      expect(
        resource.file
      ).toMatch(
        /^assets\/resources\/art\/stage1-m01\/runtime-sprites\/(flashlights|surfaces)\/m01-.+\.png$/
      );
      expect(resource.resourcesLoadPath).toMatch(
        /^art\/stage1-m01\/runtime-sprites\/(flashlights|surfaces)\/m01-.+\/spriteFrame$/
      );
      expect(existsSync(join(projectRoot, resource.file))).toBe(true);
      expect(existsSync(join(projectRoot, `${resource.file}.meta`))).toBe(true);

      if (resource.id === "target_reference_card") {
        continue;
      }

      const image = readPngRgba(resource.file);
      expect(alphaAt(image, 0, 0)).toBe(0);
      expect(alphaAt(image, image.width - 1, 0)).toBe(0);
      expect(alphaAt(image, 0, image.height - 1)).toBe(0);
      expect(alphaAt(image, image.width - 1, image.height - 1)).toBe(0);
      expect(countOpaquePixels(image)).toBeGreaterThan(image.width * image.height * 0.05);
    }

    expect(getM01GreyboxToolCardFrameResource()).toMatchObject({
      id: "toolcard_frame",
      role: "toolcard_frame_surface",
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/surfaces/m01-toolcard-preview-frame/spriteFrame"
    });
    expect(getM01GreyboxTargetReferenceCardResource()).toMatchObject({
      id: "target_reference_card",
      role: "target_reference_surface",
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/surfaces/m01-target-reference-card/spriteFrame"
    });
    expect(
      M01_GREYBOX_RUNTIME_SURFACE_RESOURCES.find(
        (resource) => resource.id === "single_flashlight_tool"
      )
    ).toMatchObject({
      id: "single_flashlight_tool",
      role: "flashlight_tool_surface",
      sourceFile:
        "docs/design/generated-m01-art-slices/m01-single-flashlight-tool-runtime-fixed.png"
    });
  });

  it("maps greybox fragment and filter tokens onto isolated runtime sprite resources", () => {
    const layout = buildM01GreyboxLayout(config);
    const plan = buildM01GreyboxTokenArtPlan(layout);

    expect(plan.enabledByDefault).toBe(false);
    expect(plan.tokens).toHaveLength(layout.fragments.length + (layout.filters ?? []).length + 1);

    const redCircle = layout.fragments.find(
      (fragment) => fragment.controllerId === "fragment_red_circle_1"
    )!;
    const redCircleArt = getM01GreyboxRuntimeSpriteResourceForToken(redCircle);
    expect(redCircleArt).toMatchObject({
      id: "hidden_circle",
      role: "fragment_token",
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/hidden-fragments/m01-fragment-hidden-circle/spriteFrame"
    });
    const redFilter = (layout.filters ?? []).find((filter) => filter.controllerId === "filter_red")!;
    const redFilterArt = getM01GreyboxRuntimeSpriteResourceForToken(redFilter);
    expect(redFilterArt).toMatchObject({
      id: "red",
      role: "filter_token",
      resourcesLoadPath: "art/stage1-m01/runtime-sprites/filters/m01-filter-red/spriteFrame"
    });

    const gearArt = getM01GreyboxRuntimeSpriteResourceForToken(layout.gear);
    expect(gearArt).toMatchObject({
      id: "gearStar",
      role: "repair_object_token",
      sourceFile:
        "docs/design/generated-m01-art-slices/m01-overlap-memory-gear-full-outline-rich-color-runtime.png",
      displaySize: { width: 553, height: 553 },
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/surfaces/m01-overlap-memory-gear/spriteFrame"
    });
    expect(gearArt?.displaySize).toBeDefined();
    expect(gearArt!.displaySize!.width / gearArt!.displaySize!.height).toBe(1);

    expect(plan.tokens.find((token) => token.controllerId === "fragment_red_circle_1")).toMatchObject({
      controllerId: "fragment_red_circle_1",
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/hidden-fragments/m01-fragment-hidden-circle/spriteFrame",
      interactive: false
    });
  });

  it("maps real M01 overlap-evidence fragments without drawing hidden evidence snap zones", () => {
    const layout = buildM01GreyboxLayout(realM01Config);
    const plan = buildM01GreyboxTokenArtPlan(layout);

    expect(M01_GREYBOX_ART_SOURCE_SHEET).toContain("candidate-v2");
    expect(plan.enabledByDefault).toBe(false);
    expect(plan.tokens).toHaveLength(layout.fragments.length + 1);
    expect(plan.tokens.some((token) => token.role === "filter_token")).toBe(false);
    expect(plan.tokens.some((token) => token.role === "evidence_marker_token")).toBe(false);

    const redCircle = getM01GreyboxRuntimeSpriteResourceForToken(layout.fragments[0]);
    const blueCircle = getM01GreyboxRuntimeSpriteResourceForToken(layout.fragments[1]);
    const blueTriangle = getM01GreyboxRuntimeSpriteResourceForToken(layout.fragments[4]);
    const blueHexagon = getM01GreyboxRuntimeSpriteResourceForToken(layout.fragments[8]);
    const firstEvidence = getM01GreyboxRuntimeSpriteResourceForToken(layout.evidence[0]);
    const greenTriangleEvidence = getM01GreyboxRuntimeSpriteResourceForToken(layout.evidence[4]);
    const redFlashlight = getM01GreyboxRuntimeSpriteResourceForToken(layout.flashlights[0]);

    expect(redCircle).toMatchObject({
      id: "hidden_circle",
      role: "fragment_token",
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/hidden-fragments/m01-fragment-hidden-circle/spriteFrame"
    });
    expect(blueCircle).toMatchObject({
      id: "hidden_circle",
      role: "fragment_token"
    });
    expect(blueTriangle).toMatchObject({
      id: "hidden_triangle",
      role: "fragment_token",
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/hidden-fragments/m01-fragment-hidden-triangle/spriteFrame"
    });
    expect(blueHexagon).toMatchObject({
      id: "hidden_hexagon",
      role: "fragment_token",
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/hidden-fragments/m01-fragment-hidden-hexagon/spriteFrame"
    });
    expect(firstEvidence).toBeUndefined();
    expect(greenTriangleEvidence).toBeUndefined();
    expect(redFlashlight).toBeUndefined();

    expect(plan.tokens.find((token) => token.controllerId === layout.fragments[0]?.controllerId)).toMatchObject({
      controllerId: "fragment_circle_blue_1",
      resourceId: "hidden_circle",
      role: "fragment_token",
      interactive: false
    });
    expect(plan.tokens.find((token) => token.controllerId === layout.evidence[0]?.controllerId)).toBeUndefined();
    expect(plan.tokens.find((token) => token.controllerId === layout.flashlights[0]?.controllerId)).toBeUndefined();
  });

  it("builds a static gameplay art plan without fragment or filter composite sheets", () => {
    const plan = buildM01GreyboxStaticArtPlan();

    expect(plan.enabledByDefault).toBe(false);
    expect(plan.layers.map((layer) => layer.id)).toEqual(["nineSlotTray"]);
    expect(plan.layers[0]).toMatchObject({
      id: "nineSlotTray",
      role: "classification_target",
      resourcesLoadPath:
        "art/stage1-m01/runtime-transparent/m01-nine-slot-tray-slice-transparent/spriteFrame",
      interactive: false,
      position: { x: 0, y: 42 },
      size: { width: 156, height: 166 }
    });
    expect(plan.layers.map((layer) => layer.id)).not.toContain("memoryFragments");
    expect(plan.layers.map((layer) => layer.id)).not.toContain("colorFilters");
  });

  it("omits the old target reference card from the repair platform", () => {
    const layout = buildM01GreyboxLayout(realM01Config);
    const plan = buildM01GreyboxStaticArtPlan(layout);

    expect(plan.enabledByDefault).toBe(false);
    expect(plan.layers).toEqual([
      {
        id: "singleFlashlightTool",
        role: "flashlight_tool_surface",
        resourcesLoadPath:
          "art/stage1-m01/runtime-sprites/surfaces/m01-single-flashlight-tool/spriteFrame",
        interactive: false,
        position: { x: 360, y: 72 },
        size: { width: 50, height: 128 },
        rotationDegrees: 0
      }
    ]);
    expect(plan.layers.map((layer) => layer.id)).not.toContain("targetReferenceCard");
    expect(getM01GreyboxTargetReferenceCardResource()).toBeDefined();
    expect(plan.layers.map((layer) => layer.id)).not.toContain("fragmentFloor");
  });

  it("renders only true-color target overlap evidence from the current manual outline", () => {
    const layout = buildM01GreyboxLayout(realM01Config);
    const plan = buildM01GreyboxStaticArtPlan(layout);
    const overlapPlan = buildM01GreyboxTargetOverlapEvidencePlan(layout);

    expect(plan.layers.map((layer) => layer.id)).not.toContain("targetReferenceCard");
    expect(realM01Config.targetPattern).toMatchObject({
      locked: true
    });
    expect(realM01Config.targetPattern?.pieces).toHaveLength(6);
    expect(layout.targetPieceSlots).toHaveLength(6);
    expect(overlapPlan.overlaps.map((overlap) => ({
      evidenceId: overlap.evidenceId,
      colorToken: overlap.colorToken,
      position: overlap.position,
      outline: overlap.outline
    }))).toEqual([
      {
        evidenceId: "current_manual_target_green_circle_hexagon_1",
        colorToken: "green",
        position: { x: -94.5, y: -15.62 },
        outline: realM01Config.evidence[0].generatedOverlap?.outline
      },
      {
        evidenceId: "current_manual_target_orange_circle_hexagon_1",
        colorToken: "orange",
        position: { x: -75.76, y: -51.53 },
        outline: realM01Config.evidence[1].generatedOverlap?.outline
      },
      {
        evidenceId: "current_manual_target_orange_circle_triangle_1",
        colorToken: "orange",
        position: { x: -43.04, y: 3.93 },
        outline: realM01Config.evidence[2].generatedOverlap?.outline
      },
      {
        evidenceId: "current_manual_target_purple_circle_hexagon_1",
        colorToken: "purple",
        position: { x: -77.5, y: 8.35 },
        outline: realM01Config.evidence[3].generatedOverlap?.outline
      },
      {
        evidenceId: "current_manual_target_green_triangle_triangle_1",
        colorToken: "green",
        position: { x: -25.13, y: -24.12 },
        outline: realM01Config.evidence[4].generatedOverlap?.outline
      },
      {
        evidenceId: "current_manual_target_purple_triangle_hexagon_1",
        colorToken: "purple",
        position: { x: -49.5, y: -47.33 },
        outline: realM01Config.evidence[5].generatedOverlap?.outline
      }
    ]);
    expect(overlapPlan.overlaps.every((overlap) => overlap.outline.length >= 3)).toBe(true);
  });

  it("keeps target overlap evidence independent from hidden sprite resources", () => {
    const geometryOnlyLayout = {
      evidence: [
        {
          controllerId: "target_overlap_geometry_only",
          colorToken: "green",
          position: { x: 12, y: -8 },
          magnetPolygon: [
            { x: -4, y: -4 },
            { x: 4, y: -4 },
            { x: 0, y: 4 }
          ]
        }
      ]
    } as unknown as M01GreyboxLayout;

    expect(buildM01GreyboxTargetOverlapEvidencePlan(geometryOnlyLayout).overlaps).toEqual([
      {
        id: "target_overlap_target_overlap_geometry_only",
        evidenceId: "target_overlap_geometry_only",
        colorToken: "green",
        interactive: false,
        position: { x: 12, y: -8 },
        outline: [
          { x: -4, y: -4 },
          { x: 4, y: -4 },
          { x: 0, y: 4 }
        ]
      }
    ]);
  });
});
