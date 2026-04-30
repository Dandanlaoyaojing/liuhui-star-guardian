import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  buildM01GreyboxArtPreviewPlan,
  buildM01GreyboxRuntimeTransparentPlan,
  buildM01GreyboxStaticArtPlan,
  buildM01GreyboxTokenArtPlan,
  getM01GreyboxArtSlice,
  getM01GreyboxArtPreviewResource,
  getM01GreyboxRuntimeSpriteResourceForToken,
  getM01GreyboxRuntimeTransparentResource,
  M01_GREYBOX_ART_ASSET_ROOT,
  M01_GREYBOX_ART_PREVIEW_RESOURCES,
  M01_GREYBOX_ART_SLICES,
  M01_GREYBOX_RUNTIME_FILTER_RESOURCES,
  M01_GREYBOX_RUNTIME_FRAGMENT_RESOURCES,
  M01_GREYBOX_RUNTIME_TRANSPARENT_RESOURCES
} from "../../assets/scripts/cocos/M01GreyboxArt.ts";
import { buildM01GreyboxLayout } from "../../assets/scripts/cocos/M01GreyboxLayout.ts";
import { m01LegacySortConfig as config } from "./m01LegacySortConfig.ts";

const projectRoot = process.cwd();

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
      expect(readFileSync(join(projectRoot, resource!.file))).toEqual(
        readFileSync(join(projectRoot, slice.file))
      );
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
      "yellow_hexagon"
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
      id: "red_circle",
      role: "fragment_token",
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/fragments/m01-fragment-red-circle/spriteFrame"
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
      displaySize: { width: 300, height: 281 },
      resourcesLoadPath:
        "art/stage1-m01/runtime-transparent/m01-gear-star-slice-transparent/spriteFrame"
    });

    expect(plan.tokens.find((token) => token.controllerId === "fragment_red_circle_1")).toMatchObject({
      controllerId: "fragment_red_circle_1",
      resourcesLoadPath:
        "art/stage1-m01/runtime-sprites/fragments/m01-fragment-red-circle/spriteFrame",
      interactive: false
    });
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
});
