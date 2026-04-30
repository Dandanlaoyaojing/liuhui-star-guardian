import type { M01GreyboxLayout, M01GreyboxTokenNode } from "./M01GreyboxLayout.ts";

export type M01GreyboxArtSliceId =
  | "gearStar"
  | "nineSlotTray"
  | "memoryFragments"
  | "colorFilters"
  | "toolCardThumbnail";

export type M01GreyboxArtRole =
  | "repair_object"
  | "classification_target"
  | "draggable_fragments"
  | "filter_affordances"
  | "toolcard_basis";

export type M01GreyboxArtRuntimeStatus = "paper_backed_candidate" | "transparent_candidate";
export type M01GreyboxRuntimeFragmentId =
  | "red_circle"
  | "red_triangle"
  | "red_hexagon"
  | "blue_circle"
  | "blue_triangle"
  | "blue_hexagon"
  | "yellow_circle"
  | "yellow_triangle"
  | "yellow_hexagon";
export type M01GreyboxRuntimeFilterId = "red" | "blue" | "yellow";
export type M01GreyboxRuntimeSpriteId =
  | M01GreyboxRuntimeFragmentId
  | M01GreyboxRuntimeFilterId
  | "gearStar";
export type M01GreyboxRuntimeSpriteRole =
  | "fragment_token"
  | "filter_token"
  | "repair_object_token";

export interface M01GreyboxArtSlice {
  id: M01GreyboxArtSliceId;
  role: M01GreyboxArtRole;
  file: string;
  assetDatabaseUrl: `db://${string}`;
  resourcesLoadPath: null;
  sourceSheet: string;
  runtimeStatus: M01GreyboxArtRuntimeStatus;
  minPixelSize: {
    width: number;
    height: number;
  };
}

export interface M01GreyboxArtPreviewResource {
  id: M01GreyboxArtSliceId;
  role: M01GreyboxArtRole;
  file: string;
  assetDatabaseUrl: `db://${string}`;
  resourcesLoadPath: `${string}/spriteFrame`;
}

export interface M01GreyboxRuntimeTransparentResource {
  id: M01GreyboxArtSliceId;
  role: M01GreyboxArtRole;
  file: string;
  sourceFile: string;
  assetDatabaseUrl: `db://${string}`;
  resourcesLoadPath: `${string}/spriteFrame`;
  runtimeStatus: "transparent_candidate";
}

export interface M01GreyboxRuntimeSpriteResource {
  id: M01GreyboxRuntimeSpriteId;
  role: M01GreyboxRuntimeSpriteRole;
  file: string;
  sourceFile: string;
  assetDatabaseUrl: `db://${string}`;
  resourcesLoadPath: `${string}/spriteFrame`;
  runtimeStatus: "isolated_candidate";
  displaySize?: {
    width: number;
    height: number;
  };
}

export interface M01GreyboxArtPreviewLayer {
  id: M01GreyboxArtSliceId;
  role: M01GreyboxArtRole;
  resourcesLoadPath: `${string}/spriteFrame`;
  interactive: false;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
}

export interface M01GreyboxArtPreviewPlan {
  enabledByDefault: false;
  layers: M01GreyboxArtPreviewLayer[];
}

export interface M01GreyboxTokenArtLayer {
  controllerId: string;
  resourceId: M01GreyboxRuntimeSpriteId;
  role: M01GreyboxRuntimeSpriteRole;
  resourcesLoadPath: `${string}/spriteFrame`;
  interactive: false;
}

export interface M01GreyboxTokenArtPlan {
  enabledByDefault: false;
  tokens: M01GreyboxTokenArtLayer[];
}

export const M01_GREYBOX_ART_ASSET_ROOT = "assets/art/stage1-m01";
export const M01_GREYBOX_ART_RESOURCE_ROOT = "assets/resources/art/stage1-m01";
export const M01_GREYBOX_RUNTIME_TRANSPARENT_ROOT =
  "assets/resources/art/stage1-m01/runtime-transparent";
export const M01_GREYBOX_RUNTIME_SPRITE_ROOT =
  "assets/resources/art/stage1-m01/runtime-sprites";
export const M01_GREYBOX_ART_SOURCE_SHEET =
  "docs/design/generated-m01-art-slices/m01-runtime-sprite-sheet-candidate-v2.png";

function artSliceFile(filename: string): string {
  return `${M01_GREYBOX_ART_ASSET_ROOT}/${filename}`;
}

function artResourceFile(filename: string): string {
  return `${M01_GREYBOX_ART_RESOURCE_ROOT}/${filename}`;
}

function resourceLoadPath(filename: string): `${string}/spriteFrame` {
  return `art/stage1-m01/${filename.replace(/\.png$/, "")}/spriteFrame`;
}

function transparentResourceLoadPath(filename: string): `${string}/spriteFrame` {
  return `art/stage1-m01/runtime-transparent/${filename.replace(/\.png$/, "")}/spriteFrame`;
}

function runtimeSpriteResourceLoadPath(
  folder: "fragments" | "filters",
  filename: string
): `${string}/spriteFrame` {
  return `art/stage1-m01/runtime-sprites/${folder}/${filename.replace(/\.png$/, "")}/spriteFrame`;
}

function editorOnlyArtSlice(
  filename: string,
  detail: Omit<M01GreyboxArtSlice, "file" | "assetDatabaseUrl" | "resourcesLoadPath" | "sourceSheet" | "runtimeStatus">
): M01GreyboxArtSlice {
  const file = artSliceFile(filename);

  return {
    ...detail,
    file,
    assetDatabaseUrl: `db://${file}`,
    resourcesLoadPath: null,
    sourceSheet: M01_GREYBOX_ART_SOURCE_SHEET,
    runtimeStatus: "paper_backed_candidate"
  };
}

function previewResourceForSlice(slice: M01GreyboxArtSlice): M01GreyboxArtPreviewResource {
  const filename = slice.file.split("/").at(-1) ?? slice.file;
  const file = artResourceFile(filename);

  return {
    id: slice.id,
    role: slice.role,
    file,
    assetDatabaseUrl: `db://${file}`,
    resourcesLoadPath: resourceLoadPath(filename)
  };
}

function transparentRuntimeResourceForPreview(
  resource: M01GreyboxArtPreviewResource
): M01GreyboxRuntimeTransparentResource {
  const filename = resource.file.split("/").at(-1) ?? resource.file;
  const transparentFilename = filename.replace(/\.png$/, "-transparent.png");
  const file = `${M01_GREYBOX_RUNTIME_TRANSPARENT_ROOT}/${transparentFilename}`;

  return {
    id: resource.id,
    role: resource.role,
    file,
    sourceFile: resource.file,
    assetDatabaseUrl: `db://${file}`,
    resourcesLoadPath: transparentResourceLoadPath(transparentFilename),
    runtimeStatus: "transparent_candidate"
  };
}

function runtimeFragmentResource(
  id: M01GreyboxRuntimeFragmentId,
  filename: string
): M01GreyboxRuntimeSpriteResource {
  const file = `${M01_GREYBOX_RUNTIME_SPRITE_ROOT}/fragments/${filename}`;

  return {
    id,
    role: "fragment_token",
    file,
    sourceFile: `${M01_GREYBOX_RUNTIME_TRANSPARENT_ROOT}/m01-memory-fragments-slice-transparent.png`,
    assetDatabaseUrl: `db://${file}`,
    resourcesLoadPath: runtimeSpriteResourceLoadPath("fragments", filename),
    runtimeStatus: "isolated_candidate"
  };
}

function runtimeFilterResource(
  id: M01GreyboxRuntimeFilterId,
  filename: string
): M01GreyboxRuntimeSpriteResource {
  const file = `${M01_GREYBOX_RUNTIME_SPRITE_ROOT}/filters/${filename}`;

  return {
    id,
    role: "filter_token",
    file,
    sourceFile: `${M01_GREYBOX_RUNTIME_TRANSPARENT_ROOT}/m01-color-filters-slice-transparent.png`,
    assetDatabaseUrl: `db://${file}`,
    resourcesLoadPath: runtimeSpriteResourceLoadPath("filters", filename),
    runtimeStatus: "isolated_candidate"
  };
}

function runtimeGearResource(): M01GreyboxRuntimeSpriteResource {
  const filename = "m01-gear-star-slice-transparent.png";
  const file = `${M01_GREYBOX_RUNTIME_TRANSPARENT_ROOT}/${filename}`;

  return {
    id: "gearStar",
    role: "repair_object_token",
    file,
    sourceFile: `${M01_GREYBOX_ART_RESOURCE_ROOT}/m01-gear-star-slice.png`,
    assetDatabaseUrl: `db://${file}`,
    resourcesLoadPath: transparentResourceLoadPath(filename),
    runtimeStatus: "isolated_candidate",
    displaySize: { width: 300, height: 281 }
  };
}

// These imported art candidates live outside assets/resources, so they are editor/import
// catalog entries only. Runtime loading must use scene references, UUID-backed references,
// or a later resources/atlas strategy instead of resources.load(file).
export const M01_GREYBOX_ART_SLICES: M01GreyboxArtSlice[] = [
  editorOnlyArtSlice("m01-gear-star-slice.png", {
    id: "gearStar",
    role: "repair_object",
    minPixelSize: { width: 480, height: 480 }
  }),
  editorOnlyArtSlice("m01-nine-slot-tray-slice.png", {
    id: "nineSlotTray",
    role: "classification_target",
    minPixelSize: { width: 330, height: 330 }
  }),
  editorOnlyArtSlice("m01-memory-fragments-slice.png", {
    id: "memoryFragments",
    role: "draggable_fragments",
    minPixelSize: { width: 320, height: 300 }
  }),
  editorOnlyArtSlice("m01-color-filters-slice.png", {
    id: "colorFilters",
    role: "filter_affordances",
    minPixelSize: { width: 300, height: 250 }
  }),
  editorOnlyArtSlice("m01-toolcard-thumbnail-slice.png", {
    id: "toolCardThumbnail",
    role: "toolcard_basis",
    minPixelSize: { width: 440, height: 280 }
  })
];

export const M01_GREYBOX_ART_PREVIEW_RESOURCES: M01GreyboxArtPreviewResource[] =
  M01_GREYBOX_ART_SLICES.map((slice) => previewResourceForSlice(slice));

export const M01_GREYBOX_RUNTIME_TRANSPARENT_RESOURCES: M01GreyboxRuntimeTransparentResource[] =
  M01_GREYBOX_ART_PREVIEW_RESOURCES.map((resource) =>
    transparentRuntimeResourceForPreview(resource)
  );

export const M01_GREYBOX_RUNTIME_FRAGMENT_RESOURCES: M01GreyboxRuntimeSpriteResource[] = [
  runtimeFragmentResource("red_circle", "m01-fragment-red-circle.png"),
  runtimeFragmentResource("red_triangle", "m01-fragment-red-triangle.png"),
  runtimeFragmentResource("red_hexagon", "m01-fragment-red-hexagon.png"),
  runtimeFragmentResource("blue_circle", "m01-fragment-blue-circle.png"),
  runtimeFragmentResource("blue_triangle", "m01-fragment-blue-triangle.png"),
  runtimeFragmentResource("blue_hexagon", "m01-fragment-blue-hexagon.png"),
  runtimeFragmentResource("yellow_circle", "m01-fragment-yellow-circle.png"),
  runtimeFragmentResource("yellow_triangle", "m01-fragment-yellow-triangle.png"),
  runtimeFragmentResource("yellow_hexagon", "m01-fragment-yellow-hexagon.png")
];

export const M01_GREYBOX_RUNTIME_FILTER_RESOURCES: M01GreyboxRuntimeSpriteResource[] = [
  runtimeFilterResource("red", "m01-filter-red.png"),
  runtimeFilterResource("blue", "m01-filter-blue.png"),
  runtimeFilterResource("yellow", "m01-filter-yellow.png")
];

export const M01_GREYBOX_RUNTIME_OBJECT_RESOURCES: M01GreyboxRuntimeSpriteResource[] = [
  runtimeGearResource()
];

export function getM01GreyboxArtSlice(id: M01GreyboxArtSliceId): M01GreyboxArtSlice | undefined {
  return M01_GREYBOX_ART_SLICES.find((slice) => slice.id === id);
}

export function getM01GreyboxArtPreviewResource(
  id: M01GreyboxArtSliceId
): M01GreyboxArtPreviewResource | undefined {
  return M01_GREYBOX_ART_PREVIEW_RESOURCES.find((resource) => resource.id === id);
}

export function getM01GreyboxRuntimeTransparentResource(
  id: M01GreyboxArtSliceId
): M01GreyboxRuntimeTransparentResource | undefined {
  return M01_GREYBOX_RUNTIME_TRANSPARENT_RESOURCES.find((resource) => resource.id === id);
}

export function getM01GreyboxRuntimeSpriteResourceForToken(
  token: M01GreyboxTokenNode
): M01GreyboxRuntimeSpriteResource | undefined {
  if (token.kind === "fragment") {
    return M01_GREYBOX_RUNTIME_FRAGMENT_RESOURCES.find(
      (resource) => resource.id === `${token.colorToken}_${token.shapeToken}`
    );
  }

  if (token.kind === "filter") {
    return M01_GREYBOX_RUNTIME_FILTER_RESOURCES.find(
      (resource) => resource.id === token.colorToken
    );
  }

  if (token.kind === "gear") {
    return M01_GREYBOX_RUNTIME_OBJECT_RESOURCES.find((resource) => resource.id === "gearStar");
  }

  return undefined;
}

export function buildM01GreyboxArtPreviewPlan(): M01GreyboxArtPreviewPlan {
  const placements: Record<
    M01GreyboxArtSliceId,
    { position: { x: number; y: number }; size: { width: number; height: number } }
  > = {
    gearStar: { position: { x: -230, y: 42 }, size: { width: 300, height: 281 } },
    nineSlotTray: { position: { x: 0, y: 42 }, size: { width: 156, height: 166 } },
    memoryFragments: { position: { x: 286, y: 72 }, size: { width: 212, height: 199 } },
    colorFilters: { position: { x: -356, y: -146 }, size: { width: 184, height: 188 } },
    toolCardThumbnail: { position: { x: 248, y: -178 }, size: { width: 265, height: 189 } }
  };

  return {
    enabledByDefault: false,
    layers: M01_GREYBOX_ART_PREVIEW_RESOURCES.map((resource) => ({
      id: resource.id,
      role: resource.role,
      resourcesLoadPath: resource.resourcesLoadPath,
      interactive: false,
      ...placements[resource.id]
    }))
  };
}

export function buildM01GreyboxRuntimeTransparentPlan(): M01GreyboxArtPreviewPlan {
  const previewPlan = buildM01GreyboxArtPreviewPlan();

  return {
    enabledByDefault: false,
    layers: previewPlan.layers.map((previewLayer) => {
      const resource = getM01GreyboxRuntimeTransparentResource(previewLayer.id);
      if (!resource) {
        return previewLayer;
      }

      return {
        ...previewLayer,
        resourcesLoadPath: resource.resourcesLoadPath
      };
    })
  };
}

export function buildM01GreyboxStaticArtPlan(
  layout?: M01GreyboxLayout
): M01GreyboxArtPreviewPlan {
  if (layout && layout.evidence.length > 0) {
    return {
      enabledByDefault: false,
      layers: []
    };
  }

  const tray = getM01GreyboxRuntimeTransparentResource("nineSlotTray");

  return {
    enabledByDefault: false,
    layers: tray
      ? [
          {
            id: "nineSlotTray",
            role: "classification_target",
            resourcesLoadPath: tray.resourcesLoadPath,
            interactive: false,
            position: { x: 0, y: 42 },
            size: { width: 156, height: 166 }
          }
        ]
      : []
  };
}

export function buildM01GreyboxTokenArtPlan(layout: M01GreyboxLayout): M01GreyboxTokenArtPlan {
  const tokens = [layout.gear, ...layout.fragments, ...(layout.filters ?? [])]
    .map((token): M01GreyboxTokenArtLayer | undefined => {
      const resource = getM01GreyboxRuntimeSpriteResourceForToken(token);
      if (!resource) {
        return undefined;
      }

      return {
        controllerId: token.controllerId,
        resourceId: resource.id,
        role: resource.role,
        resourcesLoadPath: resource.resourcesLoadPath,
        interactive: false
      };
    })
    .filter((token): token is M01GreyboxTokenArtLayer => token !== undefined);

  return {
    enabledByDefault: false,
    tokens
  };
}
