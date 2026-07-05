// M02《点亮你温暖我》配置类型与校验 —— 载入 resources/configs/stage1/m02-starweb-warmth.json.
// 校验风格仿 PuzzleConfig.ts; 忽略 *_comment 说明字段. boardGraph() 把一板拍平成 StarNetworkModel 可吃的图.
import type { ValidationResult } from "./PuzzleConfig.ts";
import type { BoardGraph, StarNetworkRules } from "./StarNetworkModel.ts";

export interface StarWebMechanic extends StarNetworkRules {
  beatModel: string;
  tapLightsNeighbors: boolean;
  winRequiresAllFrozen: boolean;
}

export interface StarNodeLayout {
  id: string;
  x: number;
  y: number;
}

export interface StarBoardLayout {
  nodes: StarNodeLayout[];
  edges: [string, string][];
}

export interface StarBoardSolution {
  referenceTaps: string[];
  teaches?: string;
}

export interface StarBoard {
  id: string;
  name: string;
  charges: number;
  layout: StarBoardLayout;
  solution: StarBoardSolution;
}

export interface StarWebConfig {
  id: string;
  name: string;
  stage: number;
  cognitiveSkill: string;
  wisdomCrystal: string;
  description?: string;
  mechanic: StarWebMechanic;
  boards: StarBoard[];
}

/** 从一板取出 StarNetworkModel 需要的邻接图 */
export function boardGraph(board: StarBoard): BoardGraph {
  return {
    nodes: board.layout.nodes.map((n) => n.id),
    edges: board.layout.edges.map(([a, b]) => [a, b] as [string, string])
  };
}

export function validateStarWebConfig(value: unknown): ValidationResult<StarWebConfig> {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["config must be an object"] };
  }

  requireNonEmptyString(value, "id", errors);
  requireNonEmptyString(value, "name", errors);
  requirePositiveInteger(value, "stage", errors);
  requireNonEmptyString(value, "cognitiveSkill", errors);
  requireNonEmptyString(value, "wisdomCrystal", errors);

  validateMechanic(value.mechanic, errors);
  validateBoards(value.boards, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: value as unknown as StarWebConfig };
}

function validateMechanic(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("mechanic must be an object");
    return;
  }
  requirePositiveInteger(value, "lifeMax", errors, "mechanic.lifeMax");
  requirePositiveInteger(value, "freezeThreshold", errors, "mechanic.freezeThreshold");
  // 这三个 flag 描述 StarNetworkModel 当前唯一实现的语义。校验器强制它们等于受支持的
  // 值，避免"配置声明一套、模型做另一套"的静默分歧(model 并不读取它们)。
  if (value.beatModel !== "turn") {
    errors.push('mechanic.beatModel must be "turn" (仅支持回合制)');
  }
  if (value.tapLightsNeighbors !== true) {
    errors.push("mechanic.tapLightsNeighbors must be true (model 恒点亮邻居)");
  }
  if (value.winRequiresAllFrozen !== true) {
    errors.push("mechanic.winRequiresAllFrozen must be true (model 胜利判定=整网自锁)");
  }
}

function validateBoards(value: unknown, errors: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("boards must be a non-empty array");
    return;
  }
  value.forEach((board, index) => validateBoard(board, index, errors));
}

function validateBoard(value: unknown, index: number, errors: string[]): void {
  const path = `boards[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  requireNonEmptyString(value, "id", errors, `${path}.id`);
  requireNonEmptyString(value, "name", errors, `${path}.name`);
  requirePositiveInteger(value, "charges", errors, `${path}.charges`);

  const nodeIds = validateLayout(value.layout, `${path}.layout`, errors);
  validateSolution(value.solution, `${path}.solution`, nodeIds, errors);
}

/** 校验 layout 并返回节点 id 集合(供 edges / solution 交叉校验) */
function validateLayout(value: unknown, path: string, errors: string[]): Set<string> {
  const ids = new Set<string>();
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return ids;
  }

  if (!Array.isArray(value.nodes) || value.nodes.length === 0) {
    errors.push(`${path}.nodes must be a non-empty array`);
  } else {
    value.nodes.forEach((node, i) => {
      const nodePath = `${path}.nodes[${i}]`;
      if (!isRecord(node)) {
        errors.push(`${nodePath} must be an object`);
        return;
      }
      if (!isNonEmptyString(node.id)) {
        errors.push(`${nodePath}.id must be a non-empty string`);
      } else if (ids.has(node.id)) {
        errors.push(`${nodePath}.id "${node.id}" is duplicated`);
      } else {
        ids.add(node.id);
      }
      if (!isFiniteNumber(node.x)) errors.push(`${nodePath}.x must be a finite number`);
      if (!isFiniteNumber(node.y)) errors.push(`${nodePath}.y must be a finite number`);
    });
  }

  if (!Array.isArray(value.edges)) {
    errors.push(`${path}.edges must be an array`);
  } else {
    value.edges.forEach((edge, i) => {
      const edgePath = `${path}.edges[${i}]`;
      if (!Array.isArray(edge) || edge.length !== 2 || !isNonEmptyString(edge[0]) || !isNonEmptyString(edge[1])) {
        errors.push(`${edgePath} must be a [nodeId, nodeId] pair`);
        return;
      }
      for (const endpoint of edge) {
        if (ids.size > 0 && !ids.has(endpoint)) {
          errors.push(`${edgePath} references unknown node "${endpoint}"`);
        }
      }
    });
  }
  return ids;
}

function validateSolution(value: unknown, path: string, nodeIds: Set<string>, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isNonEmptyStringArray(value.referenceTaps)) {
    errors.push(`${path}.referenceTaps must be a non-empty string array`);
    return;
  }
  value.referenceTaps.forEach((tap, i) => {
    if (nodeIds.size > 0 && !nodeIds.has(tap)) {
      errors.push(`${path}.referenceTaps[${i}] references unknown node "${tap}"`);
    }
  });
}

function requireNonEmptyString(record: Record<string, unknown>, key: string, errors: string[], path = key): void {
  if (!isNonEmptyString(record[key])) errors.push(`${path} must be a non-empty string`);
}

function requirePositiveInteger(record: Record<string, unknown>, key: string, errors: string[], path = key): void {
  if (!Number.isInteger(record[key]) || (record[key] as number) < 1) {
    errors.push(`${path} must be a positive integer`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}
