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
  getM01GreyboxRuntimeSpriteResourceForToken,
  getM01GreyboxTargetReferenceCardResource,
  getM01GreyboxToolCardFrameResource,
  getM01GreyboxRuntimeTransparentResource,
  M01_GREYBOX_ART_ASSET_ROOT,
  M01_GREYBOX_ART_PREVIEW_RESOURCES,
  M01_GREYBOX_FRAGMENT_REFERENCE_STYLE_SOURCE_SHEET,
  M01_GREYBOX_HIDDEN_FRAGMENT_DIRECT_SOURCE_IMAGE,
  M01_GREYBOX_ART_SOURCE_SHEET,
  M01_GREYBOX_ART_SLICES,
  M01_GREYBOX_RUNTIME_EVIDENCE_RESOURCES,
  M01_GREYBOX_RUNTIME_FLASHLIGHT_RESOURCES,
  M01_GREYBOX_RUNTIME_FILTER_RESOURCES,
  M01_GREYBOX_RUNTIME_FRAGMENT_RESOURCES,
  M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES,
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

function readPngRgbOrRgba(path: string): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const bytes = readFileSync(join(projectRoot, path));
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const channels = colorType === 6 ? 4 : 3;
  const idatChunks: Buffer[] = [];

  expect(bitDepth).toBe(8);
  expect(colorType === 2 || colorType === 6).toBe(true);

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
  const sourceStride = width * channels;
  const outputStride = width * 4;
  const unfiltered = new Uint8Array(width * height * channels);
  const output = new Uint8Array(width * height * 4);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    for (let x = 0; x < sourceStride; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= channels ? unfiltered[y * sourceStride + x - channels] : 0;
      const up = y > 0 ? unfiltered[(y - 1) * sourceStride + x] : 0;
      const upLeft =
        y > 0 && x >= channels ? unfiltered[(y - 1) * sourceStride + x - channels] : 0;
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

      unfiltered[y * sourceStride + x] = value & 0xff;
    }
    sourceOffset += sourceStride;

    for (let x = 0; x < width; x += 1) {
      const sourcePixel = y * sourceStride + x * channels;
      const outputPixel = y * outputStride + x * 4;
      output[outputPixel] = unfiltered[sourcePixel];
      output[outputPixel + 1] = unfiltered[sourcePixel + 1];
      output[outputPixel + 2] = unfiltered[sourcePixel + 2];
      output[outputPixel + 3] = channels === 4 ? unfiltered[sourcePixel + 3] : 255;
    }
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

function brightWarmOuterEdgeRatio(image: {
  width: number;
  height: number;
  data: Uint8Array;
}): number {
  let brightWarm = 0;
  let boundary = 0;

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
      if (r > 215 && g > 195 && b > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 90) {
        brightWarm += 1;
      }
    }
  }

  return brightWarm / boundary;
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

const directHiddenCropBoxes = {
  circle: { x: 459, y: 448, size: 332 },
  triangle: { x: 84, y: 434, size: 334 },
  hexagon: { x: 852, y: 446, size: 338 }
} as const;

type DirectHiddenShape = keyof typeof directHiddenCropBoxes;

function buildDirectHiddenCropSprite(
  source: { width: number; height: number; data: Uint8Array },
  shape: DirectHiddenShape
): { width: number; height: number; data: Uint8Array } {
  const size = 112;
  const crop = directHiddenCropBoxes[shape];
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = crop.x + ((x + 0.5) / size) * crop.size;
      const sy = crop.y + ((y + 0.5) / size) * crop.size;
      const sampled = sampleBilinear(source, sx, sy);
      const offset = (y * size + x) * 4;
      data[offset] = sampled[0];
      data[offset + 1] = sampled[1];
      data[offset + 2] = sampled[2];
      data[offset + 3] = 255;
    }
  }

  const outlineBarrier = dilateMask(buildDarkOutlineMask(data, size, size), size, size, 1);
  const background = floodFillBackground(outlineBarrier, size, size);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset + 3] = background[offset / 4] ? 0 : 255;
  }
  trimLightPaperHalo(data, size, size, 8);

  return { width: size, height: size, data };
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

function readPixel(
  image: { width: number; data: Uint8Array },
  x: number,
  y: number
): [number, number, number] {
  const offset = (y * image.width + x) * 4;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
}

function mixSample(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t)
  ];
}

function averageAbsoluteDifference(
  a: { data: Uint8Array },
  b: { data: Uint8Array }
): number {
  expect(a.data).toHaveLength(b.data.length);
  let total = 0;
  for (let index = 0; index < a.data.length; index += 1) {
    total += Math.abs(a.data[index] - b.data[index]);
  }
  return total / a.data.length;
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

  it("declares isolated fragment and filter runtime sprites for token-level presentation", () => {
    expect(M01_GREYBOX_RUNTIME_FRAGMENT_RESOURCES.map((resource) => resource.id)).toEqual([
      "red_circle",
      "red_triangle",
      "red_hexagon",
      "blue_circle",
      "blue_triangle",
      "blue_hexagon",
      "yellow_circle",
      "yellow_triangle",
      "yellow_hexagon",
      "purple_circle",
      "purple_triangle",
      "purple_hexagon",
      "orange_circle",
      "orange_triangle",
      "orange_hexagon",
      "green_circle",
      "green_triangle",
      "green_hexagon"
    ]);
    expect(M01_GREYBOX_RUNTIME_FILTER_RESOURCES.map((resource) => resource.id)).toEqual([
      "red",
      "blue",
      "yellow"
    ]);

    for (const resource of [
      ...M01_GREYBOX_RUNTIME_FRAGMENT_RESOURCES,
      ...M01_GREYBOX_RUNTIME_FILTER_RESOURCES
    ]) {
      expect(resource.file).toMatch(
        /^assets\/resources\/art\/stage1-m01\/runtime-sprites\/(fragments|filters)\/m01-.+\.png$/
      );
      expect(resource.resourcesLoadPath).toMatch(
        /^art\/stage1-m01\/runtime-sprites\/(fragments|filters)\/m01-.+\/spriteFrame$/
      );
      expect(existsSync(join(projectRoot, resource.file))).toBe(true);
      expect(existsSync(join(projectRoot, `${resource.file}.meta`))).toBe(true);

      const image = readPngRgba(resource.file);
      expect(alphaAt(image, 0, 0)).toBe(0);
      expect(alphaAt(image, image.width - 1, 0)).toBe(0);
      expect(alphaAt(image, 0, image.height - 1)).toBe(0);
      expect(alphaAt(image, image.width - 1, image.height - 1)).toBe(0);
      expect(countOpaquePixels(image)).toBeGreaterThan(image.width * image.height * 0.12);
    }
  });

  it("declares shape-only hidden fragment sprites and overlap evidence marker sprites for real M01", () => {
    expect(M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES.map((resource) => resource.id)).toEqual([
      "hidden_circle",
      "hidden_triangle",
      "hidden_hexagon"
    ]);
    expect(M01_GREYBOX_RUNTIME_EVIDENCE_RESOURCES.map((resource) => resource.id)).toEqual([
      "evidence_purple_circle_triangle",
      "evidence_green_triangle_hexagon",
      "evidence_orange_hexagon_hexagon",
      "evidence_purple_hexagon_circle"
    ]);

    for (const resource of [
      ...M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES,
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
      expect(alphaAt(image, 0, 0)).toBe(0);
      expect(alphaAt(image, image.width - 1, 0)).toBe(0);
      expect(alphaAt(image, 0, image.height - 1)).toBe(0);
      expect(alphaAt(image, image.width - 1, image.height - 1)).toBe(0);
      expect(countOpaquePixels(image)).toBeGreaterThan(image.width * image.height * 0.08);
    }
  });

  it("keeps standard piece sprites in a low-saturation watercolor material range", () => {
    for (const resource of M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES) {
      const image = readPngRgba(resource.file);
      const color = summarizeOpaqueColor(image);

      expect(color.averageLuminance).toBeGreaterThan(100);
      expect(color.averageLuminance).toBeLessThan(215);
      expect(color.averageChannelSpread).toBeLessThan(45);
      expect(resource.sourceFile).toBe(M01_GREYBOX_HIDDEN_FRAGMENT_DIRECT_SOURCE_IMAGE);
    }

    const coloredSprites = M01_GREYBOX_RUNTIME_FRAGMENT_RESOURCES.map((resource) => ({
      resource,
      color: summarizeOpaqueColor(readPngRgba(resource.file))
    }));
    for (const { resource, color } of coloredSprites) {
      expect(color.averageLuminance).toBeGreaterThan(70);
      expect(color.averageLuminance).toBeLessThan(205);
      expect(color.averageChannelSpread).toBeGreaterThan(14);
      expect(color.averageChannelSpread).toBeLessThan(112);
      expect(resource.sourceFile).toBe(M01_GREYBOX_FRAGMENT_REFERENCE_STYLE_SOURCE_SHEET);
    }

    const red = coloredSprites.filter(({ resource }) => resource.id.startsWith("red_"));
    const yellow = coloredSprites.filter(({ resource }) => resource.id.startsWith("yellow_"));
    const blue = coloredSprites.filter(({ resource }) => resource.id.startsWith("blue_"));
    const purple = coloredSprites.filter(({ resource }) => resource.id.startsWith("purple_"));
    const orange = coloredSprites.filter(({ resource }) => resource.id.startsWith("orange_"));
    const green = coloredSprites.filter(({ resource }) => resource.id.startsWith("green_"));

    expect(red.every(({ color }) => color.averageRed > color.averageBlue + 28)).toBe(true);
    expect(yellow.every(({ color }) => color.averageRed > color.averageBlue + 35)).toBe(true);
    expect(yellow.every(({ color }) => color.averageGreen > color.averageBlue + 22)).toBe(true);
    expect(blue.every(({ color }) => color.averageBlue > color.averageRed)).toBe(true);
    expect(blue.every(({ color }) => color.averageGreen > color.averageRed + 6)).toBe(true);
    expect(purple.every(({ color }) => color.averageRed > color.averageGreen + 7)).toBe(true);
    expect(orange.every(({ color }) => color.averageRed > color.averageGreen + 20)).toBe(true);
    expect(orange.every(({ color }) => color.averageGreen > color.averageBlue + 20)).toBe(true);
    expect(green.every(({ color }) => color.averageGreen > color.averageBlue + 20)).toBe(true);
  });

  it("cuts default grey hidden standard pieces directly from the approved grey source image", () => {
    const source = readPngRgbOrRgba(M01_GREYBOX_HIDDEN_FRAGMENT_DIRECT_SOURCE_IMAGE);

    for (const resource of M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES) {
      const shape = resource.id.replace("hidden_", "") as DirectHiddenShape;
      const runtime = readPngRgba(resource.file);
      const expected = buildDirectHiddenCropSprite(source, shape);

      expect(averageAbsoluteDifference(runtime, expected)).toBeLessThan(1);
    }
  });

  it("keeps standard piece artwork large enough to visually match target geometry", () => {
    for (const resource of [
      ...M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES,
      ...M01_GREYBOX_RUNTIME_FRAGMENT_RESOURCES
    ]) {
      const image = readPngRgba(resource.file);
      const bounds = opaqueBounds(image);

      expect(bounds.width / image.width).toBeGreaterThan(0.88);
      expect(bounds.height / image.height).toBeGreaterThan(0.88);
    }
  });

  it("does not draw pale white rims around colored standard pieces", () => {
    for (const resource of M01_GREYBOX_RUNTIME_FRAGMENT_RESOURCES) {
      const image = readPngRgba(resource.file);

      expect(brightWarmOuterEdgeRatio(image)).toBeLessThan(0.035);
    }
  });

  it("keeps standard piece outer contours opaque so they meet target geometry", () => {
    for (const resource of [
      ...M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES,
      ...M01_GREYBOX_RUNTIME_FRAGMENT_RESOURCES
    ]) {
      const image = readPngRgba(resource.file);

      expect(translucentOuterEdgeRatio(image)).toBeLessThan(0.05);
    }
  });

  it("clips paper outside the approved grey hidden piece outlines", () => {
    for (const resource of M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES) {
      const image = readPngRgba(resource.file);

      expect(lightNeutralOuterEdgeRatio(image)).toBeLessThan(0.35);
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
    expect(getM01GreyboxRuntimeSpriteResourceForToken(redCircle, "red")).toMatchObject({
      id: "red_circle",
      role: "fragment_token",
      resourcesLoadPath: "art/stage1-m01/runtime-sprites/fragments/m01-fragment-red-circle/spriteFrame"
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
    expect(getM01GreyboxRuntimeSpriteResourceForToken(layout.fragments[0], "red")).toMatchObject({
      id: "red_circle",
      resourcesLoadPath: "art/stage1-m01/runtime-sprites/fragments/m01-fragment-red-circle/spriteFrame"
    });
    expect(firstEvidence).toBeUndefined();
    expect(greenTriangleEvidence).toBeUndefined();
    expect(redFlashlight).toBeUndefined();

    expect(plan.tokens.find((token) => token.controllerId === layout.fragments[0]?.controllerId)).toMatchObject({
      controllerId: "fragment_circle_red_1",
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
        position: { x: 420, y: 72 },
        size: { width: 58, height: 128 },
        rotationDegrees: 168
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
        position: { x: -34.5, y: -15.62 },
        outline: realM01Config.evidence[0].generatedOverlap?.outline
      },
      {
        evidenceId: "current_manual_target_orange_circle_hexagon_1",
        colorToken: "orange",
        position: { x: -15.76, y: -51.53 },
        outline: realM01Config.evidence[1].generatedOverlap?.outline
      },
      {
        evidenceId: "current_manual_target_orange_circle_triangle_1",
        colorToken: "orange",
        position: { x: 16.96, y: 3.93 },
        outline: realM01Config.evidence[2].generatedOverlap?.outline
      },
      {
        evidenceId: "current_manual_target_purple_circle_hexagon_1",
        colorToken: "purple",
        position: { x: -17.5, y: 8.35 },
        outline: realM01Config.evidence[3].generatedOverlap?.outline
      },
      {
        evidenceId: "current_manual_target_green_triangle_triangle_1",
        colorToken: "green",
        position: { x: 34.87, y: -24.12 },
        outline: realM01Config.evidence[4].generatedOverlap?.outline
      },
      {
        evidenceId: "current_manual_target_purple_triangle_hexagon_1",
        colorToken: "purple",
        position: { x: 10.5, y: -47.33 },
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
