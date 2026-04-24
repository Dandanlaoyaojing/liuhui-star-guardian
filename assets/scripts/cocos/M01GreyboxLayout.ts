import type {
  M01FilterDef,
  M01FragmentDef,
  M01MemoryGearConfig,
  M01Shape,
  M01SlotDef
} from "../levels/stage1/M01MemoryGearController.ts";

export type M01GreyboxNodeKind = "gear" | "filter" | "fragment" | "slot" | "label";

export interface M01GreyboxPoint {
  x: number;
  y: number;
}

export interface M01GreyboxSize {
  width: number;
  height: number;
}

export interface M01GreyboxTokenNode {
  id: string;
  controllerId: string;
  kind: M01GreyboxNodeKind;
  label: string;
  position: M01GreyboxPoint;
  size: M01GreyboxSize;
  colorToken: string;
  shapeToken: M01Shape;
  tags: string[];
}

export interface M01GreyboxLayout {
  canvas: M01GreyboxSize;
  statusText: string;
  gear: M01GreyboxTokenNode;
  filters: M01GreyboxTokenNode[];
  fragments: M01GreyboxTokenNode[];
  slots: M01GreyboxTokenNode[];
}

const CANVAS: M01GreyboxSize = { width: 960, height: 640 };
const STATUS_TEXT = "M01 灰盒：插入颜色过滤器，然后把同色碎片按形状归位。";

const colorLabels: Record<string, string> = {
  red: "红",
  blue: "蓝",
  yellow: "黄"
};

export function buildM01GreyboxLayout(config: M01MemoryGearConfig): M01GreyboxLayout {
  return {
    canvas: CANVAS,
    statusText: STATUS_TEXT,
    gear: buildGearNode(config),
    filters: config.filters.map((filter) => buildFilterNode(filter, config)),
    fragments: config.fragments.map(buildFragmentNode),
    slots: config.slots.map(buildSlotNode)
  };
}

function buildGearNode(config: M01MemoryGearConfig): M01GreyboxTokenNode {
  const gear = config.entities?.find((entity) => {
    if (!isRecord(entity)) {
      return false;
    }

    return entity.id === "entity_memory_gear";
  });
  const position = readPosition(isRecord(gear) ? gear.position : undefined, { x: 0, y: 0 });

  return {
    id: "entity_memory_gear",
    controllerId: "entity_memory_gear",
    kind: "gear",
    label: config.name,
    position,
    size: { width: 300, height: 300 },
    colorToken: "neutral",
    shapeToken: "gear",
    tags: ["gear", "repair_target"]
  };
}

function buildFilterNode(
  filter: M01FilterDef,
  config: M01MemoryGearConfig
): M01GreyboxTokenNode {
  const fallbackY = filter.color === "red" ? 160 : filter.color === "blue" ? 80 : 0;
  const entityPosition = findEntityPosition(config, filter.entityId ?? `entity_${filter.id}`);

  return {
    id: filter.id,
    controllerId: filter.id,
    kind: "filter",
    label: filter.label ?? `${colorLabels[filter.color] ?? filter.color}过滤器`,
    position: readPosition(entityPosition, { x: -420, y: fallbackY }),
    size: { width: 76, height: 44 },
    colorToken: filter.color,
    shapeToken: "filter",
    tags: ["filter", filter.color]
  };
}

function buildFragmentNode(fragment: M01FragmentDef): M01GreyboxTokenNode {
  return {
    id: fragment.id,
    controllerId: fragment.id,
    kind: "fragment",
    label: `${colorLabels[fragment.color] ?? fragment.color} ${fragment.shape}`,
    position: readPosition(fragment.position, { x: 0, y: 0 }),
    size: { width: 34, height: 34 },
    colorToken: fragment.color,
    shapeToken: fragment.shape,
    tags: [...(fragment.tags ?? [])]
  };
}

function buildSlotNode(slot: M01SlotDef): M01GreyboxTokenNode {
  return {
    id: slot.id,
    controllerId: slot.id,
    kind: "slot",
    label: `${colorLabels[slot.accepts.color] ?? slot.accepts.color} ${slot.accepts.shape}`,
    position: readPosition(slot.position, { x: 0, y: 0 }),
    size: { width: 52, height: 52 },
    colorToken: slot.accepts.color,
    shapeToken: slot.accepts.shape,
    tags: [...(slot.tags ?? [])]
  };
}

function readPosition(value: unknown, fallback: M01GreyboxPoint): M01GreyboxPoint {
  if (!isRecord(value) || typeof value.x !== "number" || typeof value.y !== "number") {
    return fallback;
  }

  return {
    x: value.x,
    y: value.y
  };
}

function findEntityPosition(config: M01MemoryGearConfig, entityId: string): unknown {
  const entity = config.entities?.find((candidate) => {
    return isRecord(candidate) && candidate.id === entityId;
  });

  return isRecord(entity) ? entity.position : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
