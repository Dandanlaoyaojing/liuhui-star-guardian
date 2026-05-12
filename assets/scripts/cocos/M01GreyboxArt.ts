import {
  M01_STANDARD_PIECE_DISPLAY_SIZE,
  type M01GreyboxLayout,
  type M01GreyboxPoint,
  type M01GreyboxTokenNode
} from "./M01GreyboxLayout.ts";
import type { M01BlendColor, M01Shape } from "../levels/stage1/M01MemoryGearController.ts";

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
  | "yellow_hexagon"
  | "purple_circle"
  | "purple_triangle"
  | "purple_hexagon"
  | "orange_circle"
  | "orange_triangle"
  | "orange_hexagon"
  | "green_circle"
  | "green_triangle"
  | "green_hexagon";
export type M01GreyboxRuntimeHiddenFragmentId =
  | "hidden_circle"
  | "hidden_triangle"
  | "hidden_hexagon";
export type M01GreyboxRuntimeEvidenceSpriteId =
  | "evidence_purple_circle_triangle"
  | "evidence_green_triangle_hexagon"
  | "evidence_orange_hexagon_hexagon"
  | "evidence_purple_hexagon_circle";
export type M01GreyboxRuntimeFlashlightId =
  | "flashlight_red"
  | "flashlight_yellow"
  | "flashlight_blue";
export type M01GreyboxRuntimeFilterId = "red" | "blue" | "yellow";
export type M01GreyboxRuntimeSurfaceId =
  | "fragment_floor"
  | "target_reference_card"
  | "single_flashlight_tool"
  | "toolcard_frame";
export type M01GreyboxRuntimeSpriteId =
  | M01GreyboxRuntimeFragmentId
  | M01GreyboxRuntimeHiddenFragmentId
  | M01GreyboxRuntimeEvidenceSpriteId
  | M01GreyboxRuntimeFlashlightId
  | M01GreyboxRuntimeFilterId
  | M01GreyboxRuntimeSurfaceId
  | "gearStar";
export type M01GreyboxRuntimeSpriteRole =
  | "fragment_token"
  | "filter_token"
  | "flashlight_token"
  | "evidence_marker_token"
  | "repair_object_token"
  | "target_reference_surface"
  | "flashlight_tool_surface"
  | "fragment_floor_surface"
  | "toolcard_frame_surface";

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
  id: string;
  role: string;
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
  spriteSize?: {
    width: number;
    height: number;
  };
  rotationDegrees?: number;
  tintColor?: {
    r: number;
    g: number;
    b: number;
    a: number;
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

export interface M01GreyboxTargetStandardPieceLayer {
  id: string;
  pieceSlotId: string;
  standardPieceId?: string;
  shapeToken: M01Shape;
  interactive: false;
  position: M01GreyboxPoint;
  displaySize: {
    width: number;
    height: number;
  };
  rotationDegrees: number;
  layer: number;
}

export interface M01GreyboxTargetStandardPiecePlan {
  enabledByDefault: false;
  pieces: M01GreyboxTargetStandardPieceLayer[];
}

export interface M01GreyboxTargetOverlapEvidenceLayer {
  id: string;
  evidenceId: string;
  colorToken: string;
  interactive: false;
  position: M01GreyboxPoint;
  outline: M01GreyboxPoint[];
}

export interface M01GreyboxTargetOverlapEvidencePlan {
  enabledByDefault: false;
  overlaps: M01GreyboxTargetOverlapEvidenceLayer[];
}

export const M01_GREYBOX_ART_ASSET_ROOT = "assets/art/stage1-m01";
export const M01_GREYBOX_ART_RESOURCE_ROOT = "assets/resources/art/stage1-m01";
export const M01_GREYBOX_RUNTIME_TRANSPARENT_ROOT =
  "assets/resources/art/stage1-m01/runtime-transparent";
export const M01_GREYBOX_RUNTIME_SPRITE_ROOT =
  "assets/resources/art/stage1-m01/runtime-sprites";
export const M01_GREYBOX_ART_SOURCE_SHEET =
  "docs/design/generated-m01-art-slices/m01-runtime-sprite-sheet-candidate-v2.png";
export const M01_GREYBOX_FRAGMENT_REFERENCE_STYLE_SOURCE_SHEET =
  "docs/design/generated-m01-art-slices/m01-reference-style-pieces-contact-sheet.png";
export const M01_GREYBOX_HIDDEN_FRAGMENT_DIRECT_SOURCE_IMAGE =
  "docs/design/generated-m01-art-slices/m01-direct-grey-hidden-pieces-source.png";

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
  folder:
    | "fragments"
    | "filters"
    | "hidden-fragments"
    | "evidence-markers"
    | "flashlights"
    | "surfaces",
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
    sourceFile: M01_GREYBOX_FRAGMENT_REFERENCE_STYLE_SOURCE_SHEET,
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

function runtimeHiddenFragmentResource(
  id: M01GreyboxRuntimeHiddenFragmentId,
  filename: string
): M01GreyboxRuntimeSpriteResource {
  const file = `${M01_GREYBOX_RUNTIME_SPRITE_ROOT}/hidden-fragments/${filename}`;

  return {
    id,
    role: "fragment_token",
    file,
    sourceFile: M01_GREYBOX_HIDDEN_FRAGMENT_DIRECT_SOURCE_IMAGE,
    assetDatabaseUrl: `db://${file}`,
    resourcesLoadPath: runtimeSpriteResourceLoadPath("hidden-fragments", filename),
    runtimeStatus: "isolated_candidate",
    displaySize: M01_STANDARD_PIECE_DISPLAY_SIZE
  };
}

function runtimeEvidenceResource(
  id: M01GreyboxRuntimeEvidenceSpriteId,
  filename: string
): M01GreyboxRuntimeSpriteResource {
  const file = `${M01_GREYBOX_RUNTIME_SPRITE_ROOT}/evidence-markers/${filename}`;

  return {
    id,
    role: "evidence_marker_token",
    file,
    sourceFile: "assets/resources/configs/stage1/m01-memory-gear.json",
    assetDatabaseUrl: `db://${file}`,
    resourcesLoadPath: runtimeSpriteResourceLoadPath("evidence-markers", filename),
    runtimeStatus: "isolated_candidate"
  };
}

function runtimeFlashlightResource(
  id: M01GreyboxRuntimeFlashlightId,
  filename: string
): M01GreyboxRuntimeSpriteResource {
  const file = `${M01_GREYBOX_RUNTIME_SPRITE_ROOT}/flashlights/${filename}`;

  return {
    id,
    role: "flashlight_token",
    file,
    sourceFile: `${M01_GREYBOX_RUNTIME_TRANSPARENT_ROOT}/m01-color-filters-slice-transparent.png`,
    assetDatabaseUrl: `db://${file}`,
    resourcesLoadPath: runtimeSpriteResourceLoadPath("flashlights", filename),
    runtimeStatus: "isolated_candidate"
  };
}

function runtimeSurfaceResource(
  id: "gearStar" | M01GreyboxRuntimeSurfaceId,
  role:
    | "repair_object_token"
    | "target_reference_surface"
    | "flashlight_tool_surface"
    | "fragment_floor_surface"
    | "toolcard_frame_surface",
  filename: string,
  sourceFile: string,
  displaySize?: { width: number; height: number }
): M01GreyboxRuntimeSpriteResource {
  const file = `${M01_GREYBOX_RUNTIME_SPRITE_ROOT}/surfaces/${filename}`;

  return {
    id,
    role,
    file,
    sourceFile,
    assetDatabaseUrl: `db://${file}`,
    resourcesLoadPath: runtimeSpriteResourceLoadPath("surfaces", filename),
    runtimeStatus: "isolated_candidate",
    displaySize
  };
}

function runtimeGearResource(): M01GreyboxRuntimeSpriteResource {
  return runtimeSurfaceResource(
    "gearStar",
    "repair_object_token",
    "m01-overlap-memory-gear.png",
    "docs/design/generated-m01-art-slices/m01-overlap-memory-gear-full-outline-rich-color-runtime.png",
    { width: 553, height: 553 }
  );
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
  runtimeFragmentResource("yellow_hexagon", "m01-fragment-yellow-hexagon.png"),
  runtimeFragmentResource("purple_circle", "m01-fragment-purple-circle.png"),
  runtimeFragmentResource("purple_triangle", "m01-fragment-purple-triangle.png"),
  runtimeFragmentResource("purple_hexagon", "m01-fragment-purple-hexagon.png"),
  runtimeFragmentResource("orange_circle", "m01-fragment-orange-circle.png"),
  runtimeFragmentResource("orange_triangle", "m01-fragment-orange-triangle.png"),
  runtimeFragmentResource("orange_hexagon", "m01-fragment-orange-hexagon.png"),
  runtimeFragmentResource("green_circle", "m01-fragment-green-circle.png"),
  runtimeFragmentResource("green_triangle", "m01-fragment-green-triangle.png"),
  runtimeFragmentResource("green_hexagon", "m01-fragment-green-hexagon.png")
];

export const M01_GREYBOX_RUNTIME_FILTER_RESOURCES: M01GreyboxRuntimeSpriteResource[] = [
  runtimeFilterResource("red", "m01-filter-red.png"),
  runtimeFilterResource("blue", "m01-filter-blue.png"),
  runtimeFilterResource("yellow", "m01-filter-yellow.png")
];

export const M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES: M01GreyboxRuntimeSpriteResource[] = [
  runtimeHiddenFragmentResource("hidden_circle", "m01-fragment-hidden-circle.png"),
  runtimeHiddenFragmentResource("hidden_triangle", "m01-fragment-hidden-triangle.png"),
  runtimeHiddenFragmentResource("hidden_hexagon", "m01-fragment-hidden-hexagon.png")
];

export const M01_GREYBOX_RUNTIME_EVIDENCE_RESOURCES: M01GreyboxRuntimeSpriteResource[] = [
  runtimeEvidenceResource(
    "evidence_purple_circle_triangle",
    "m01-evidence-purple-circle-triangle.png"
  ),
  runtimeEvidenceResource(
    "evidence_green_triangle_hexagon",
    "m01-evidence-green-triangle-hexagon.png"
  ),
  runtimeEvidenceResource(
    "evidence_orange_hexagon_hexagon",
    "m01-evidence-orange-hexagon-hexagon.png"
  ),
  runtimeEvidenceResource(
    "evidence_purple_hexagon_circle",
    "m01-evidence-purple-hexagon-circle.png"
  )
];

export const M01_GREYBOX_RUNTIME_FLASHLIGHT_RESOURCES: M01GreyboxRuntimeSpriteResource[] = [
  runtimeFlashlightResource("flashlight_red", "m01-flashlight-red.png"),
  runtimeFlashlightResource("flashlight_yellow", "m01-flashlight-yellow.png"),
  runtimeFlashlightResource("flashlight_blue", "m01-flashlight-blue.png")
];

export const M01_GREYBOX_RUNTIME_OBJECT_RESOURCES: M01GreyboxRuntimeSpriteResource[] = [
  runtimeGearResource()
];

export const M01_GREYBOX_RUNTIME_SURFACE_RESOURCES: M01GreyboxRuntimeSpriteResource[] = [
  runtimeSurfaceResource(
    "fragment_floor",
    "fragment_floor_surface",
    "m01-fragment-floor-surface.png",
    `${M01_GREYBOX_RUNTIME_TRANSPARENT_ROOT}/m01-nine-slot-tray-slice-transparent.png`
  ),
  runtimeSurfaceResource(
    "target_reference_card",
    "target_reference_surface",
    "m01-target-reference-card.png",
    "docs/design/generated-m01-art-slices/m01-generated-watercolor-psd-assets/source/m01-locked-knot-target-colored-overlaps-only-v1.png"
  ),
  runtimeSurfaceResource(
    "single_flashlight_tool",
    "flashlight_tool_surface",
    "m01-single-flashlight-tool.png",
    "docs/design/generated-m01-art-slices/m01-single-flashlight-tool-runtime-fixed.png"
  ),
  runtimeSurfaceResource(
    "toolcard_frame",
    "toolcard_frame_surface",
    "m01-toolcard-preview-frame.png",
    `${M01_GREYBOX_RUNTIME_TRANSPARENT_ROOT}/m01-toolcard-thumbnail-slice-transparent.png`
  )
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
  token: M01GreyboxTokenNode,
  colorTokenOverride?: M01BlendColor
): M01GreyboxRuntimeSpriteResource | undefined {
  if (token.kind === "fragment") {
    const colorToken = colorTokenOverride ?? "hidden";
    if (colorToken === "hidden") {
      return M01_GREYBOX_RUNTIME_HIDDEN_FRAGMENT_RESOURCES.find(
        (resource) => resource.id === `hidden_${token.shapeToken}`
      );
    }

    if (!isM01RuntimeFragmentColor(colorToken)) {
      return undefined;
    }

    return getM01GreyboxRuntimeFragmentSpriteResource(colorToken, token.shapeToken);
  }

  if (token.kind === "evidence") {
    const sourceShapeSignature = readEvidenceSourceShapeSignature(token.tags);

    if (!sourceShapeSignature) {
      return undefined;
    }

    return M01_GREYBOX_RUNTIME_EVIDENCE_RESOURCES.find(
      (resource) => resource.id === `evidence_${token.colorToken}_${sourceShapeSignature}`
    );
  }

  if (token.kind === "filter") {
    return M01_GREYBOX_RUNTIME_FILTER_RESOURCES.find(
      (resource) => resource.id === token.colorToken
    );
  }

  if (token.kind === "flashlight") {
    return undefined;
  }

  if (token.kind === "gear") {
    return M01_GREYBOX_RUNTIME_OBJECT_RESOURCES.find((resource) => resource.id === "gearStar");
  }

  return undefined;
}

function isM01RuntimeFragmentColor(colorToken: string): colorToken is M01BlendColor {
  return (
    colorToken === "red" ||
    colorToken === "yellow" ||
    colorToken === "blue" ||
    colorToken === "orange" ||
    colorToken === "green" ||
    colorToken === "purple"
  );
}

export function getM01GreyboxRuntimeFragmentSpriteResource(
  colorToken: M01BlendColor,
  shapeToken: M01Shape
): M01GreyboxRuntimeSpriteResource | undefined {
  return M01_GREYBOX_RUNTIME_FRAGMENT_RESOURCES.find(
    (resource) => resource.id === `${colorToken}_${shapeToken}`
  );
}

export function buildM01GreyboxTargetStandardPiecePlan(
  layout: M01GreyboxLayout
): M01GreyboxTargetStandardPiecePlan {
  return {
    enabledByDefault: false,
    pieces: layout.targetPieceSlots
      .map((slot): M01GreyboxTargetStandardPieceLayer => ({
          id: `target_standard_piece_${slot.id}`,
          pieceSlotId: slot.id,
          standardPieceId: slot.standardPieceId,
          shapeToken: slot.shapeToken,
          interactive: false,
          position: slot.position,
          displaySize: slot.size,
          rotationDegrees: slot.rotation,
          layer: slot.layer
        }))
      .sort((a, b) => a.layer - b.layer)
  };
}

export function buildM01GreyboxTargetOverlapEvidencePlan(
  layout: M01GreyboxLayout
): M01GreyboxTargetOverlapEvidencePlan {
  return {
    enabledByDefault: false,
    overlaps: layout.evidence
      .filter((evidence) => (evidence.magnetPolygon?.length ?? 0) >= 3)
      .map((evidence): M01GreyboxTargetOverlapEvidenceLayer => ({
        id: `target_overlap_${evidence.controllerId}`,
        evidenceId: evidence.controllerId,
        colorToken: evidence.colorToken,
        interactive: false,
        position: evidence.sourcePosition ?? evidence.position,
        outline: evidence.magnetPolygon ?? []
      }))
  };
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
      const resource = getM01GreyboxRuntimeTransparentResource(
        previewLayer.id as M01GreyboxArtSliceId
      );
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
    const singleFlashlightTool = M01_GREYBOX_RUNTIME_SURFACE_RESOURCES.find(
      (resource) => resource.id === "single_flashlight_tool"
    );
    const layers: M01GreyboxArtPreviewLayer[] = [];

    if (singleFlashlightTool) {
      layers.push({
        id: "singleFlashlightTool",
        role: "flashlight_tool_surface",
        resourcesLoadPath: singleFlashlightTool.resourcesLoadPath,
        interactive: false,
        position: { x: 420, y: 72 },
        size: { width: 58, height: 128 },
        rotationDegrees: 168
      });
    }

    return {
      enabledByDefault: false,
      layers
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
  const tokens = [
    layout.gear,
    ...layout.fragments,
    ...layout.evidence,
    ...layout.flashlights,
    ...(layout.filters ?? [])
  ]
    .filter((token) => token.kind !== "evidence")
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

export function getM01GreyboxToolCardFrameResource():
  | M01GreyboxRuntimeSpriteResource
  | undefined {
  return M01_GREYBOX_RUNTIME_SURFACE_RESOURCES.find(
    (resource) => resource.id === "toolcard_frame"
  );
}

export function getM01GreyboxTargetReferenceCardResource():
  | M01GreyboxRuntimeSpriteResource
  | undefined {
  return M01_GREYBOX_RUNTIME_SURFACE_RESOURCES.find(
    (resource) => resource.id === "target_reference_card"
  );
}

function readEvidenceSourceShapeSignature(tags: string[]): string | undefined {
  const sourceShapes = tags
    .filter((tag) => tag.startsWith("source-shape:"))
    .map((tag) => tag.slice("source-shape:".length));

  if (sourceShapes.length >= 2) {
    return sourceShapes.join("_");
  }

  const fallbackShapes = tags
    .filter((tag) => tag.startsWith("shape:"))
    .map((tag) => tag.slice("shape:".length));

  return fallbackShapes.length >= 2 ? fallbackShapes.slice(0, 2).join("_") : undefined;
}
