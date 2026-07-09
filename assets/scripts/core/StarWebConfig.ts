// M02《点亮你温暖我》配置类型与校验 —— 载入 resources/configs/stage1/m02-starweb-warmth.json.
// 校验风格仿 PuzzleConfig.ts; 忽略 *_comment 说明字段. boardGraph() 把一板拍平成 StarNetworkModel 可吃的图.
import type { ValidationResult } from "./PuzzleConfig.ts";
import type { BoardGraph, StarNetworkRules } from "./StarNetworkModel.ts";
import { createToolCard, validateToolCard, type ToolCardDraft } from "./ToolCard.ts";

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

export interface PrologueEmber {
  id: string;
  x: number;
  y: number;
  initialLife: number;
}

/** 开场序章「三颗余烬点棒」配置(spec §5.3)。规则复用 mechanic 的 lifeMax/freezeThreshold。 */
export interface StarWebPrologue {
  beatSeconds: number;
  adjacencyRadius: number;
  rekindleBeats: number;
  wand: { x: number; y: number };
  wandDipRadius: number;
  embers: PrologueEmber[];
}

export interface StarWebConfig {
  id: string;
  name: string;
  stage: number;
  cognitiveSkill: string;
  wisdomCrystal: string;
  description?: string;
  toolCard: ToolCardDraft;
  mechanic: StarWebMechanic;
  prologue?: StarWebPrologue;
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
  requireOptionalString(value, "description", errors);

  validateToolCardDraft(value.toolCard, errors);
  validateToolCardMatchesConfig(value, errors);
  validateMechanic(value.mechanic, errors);
  validatePrologue(value.prologue, value.mechanic, errors);
  validateBoards(value.boards, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: value as unknown as StarWebConfig };
}

function validateToolCardDraft(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("toolCard must be an object");
    return;
  }

  try {
    const result = validateToolCard(createToolCard(value as unknown as ToolCardDraft, 0));
    if (!result.ok) errors.push(...result.errors.map((error) => `toolCard.${error}`));
  } catch {
    errors.push("toolCard must be a valid tool card draft");
  }
}

function validateToolCardMatchesConfig(config: Record<string, unknown>, errors: string[]): void {
  if (!isRecord(config.toolCard)) return;
  const toolCard = config.toolCard;

  if (isNonEmptyString(config.id) && isNonEmptyString(toolCard.puzzleId) && toolCard.puzzleId !== config.id) {
    errors.push("toolCard.puzzleId must match id");
  }
  if (isPositiveInteger(config.stage) && isPositiveInteger(toolCard.stage) && toolCard.stage !== config.stage) {
    errors.push("toolCard.stage must match stage");
  }
  if (!isRecord(toolCard.front) || !isNonEmptyString(config.wisdomCrystal)) return;
  if (isNonEmptyString(toolCard.front.wisdomCrystal) && toolCard.front.wisdomCrystal !== config.wisdomCrystal) {
    errors.push("toolCard.front.wisdomCrystal must match wisdomCrystal");
  }
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

/** 序章可选; 存在则整段校验。数值边界之外还锁两条设计不变量: 开局不得预成簇、余烬数必须够冻结。 */
function validatePrologue(value: unknown, mechanic: unknown, errors: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    errors.push("prologue must be an object");
    return;
  }
  requirePositiveNumber(value, "beatSeconds", errors, "prologue.beatSeconds");
  requirePositiveNumber(value, "adjacencyRadius", errors, "prologue.adjacencyRadius");
  requirePositiveNumber(value, "wandDipRadius", errors, "prologue.wandDipRadius");
  requirePositiveInteger(value, "rekindleBeats", errors, "prologue.rekindleBeats");

  if (!isRecord(value.wand) || !isFiniteNumber(value.wand.x) || !isFiniteNumber(value.wand.y)) {
    errors.push("prologue.wand must be an object with finite x/y");
  }

  const lifeMax = isRecord(mechanic) && isPositiveInteger(mechanic.lifeMax) ? mechanic.lifeMax : null;
  const freezeThreshold =
    isRecord(mechanic) && isPositiveInteger(mechanic.freezeThreshold) ? mechanic.freezeThreshold : null;

  if (!Array.isArray(value.embers) || value.embers.length === 0) {
    errors.push("prologue.embers must be a non-empty array");
    return;
  }
  const ids = new Set<string>();
  const positions: { x: number; y: number }[] = [];
  value.embers.forEach((ember, i) => {
    const path = `prologue.embers[${i}]`;
    if (!isRecord(ember)) {
      errors.push(`${path} must be an object`);
      return;
    }
    if (!isNonEmptyString(ember.id)) {
      errors.push(`${path}.id must be a non-empty string`);
    } else if (ids.has(ember.id)) {
      errors.push(`${path}.id "${ember.id}" is duplicated`);
    } else {
      ids.add(ember.id);
    }
    if (!isFiniteNumber(ember.x)) errors.push(`${path}.x must be a finite number`);
    if (!isFiniteNumber(ember.y)) errors.push(`${path}.y must be a finite number`);
    requirePositiveInteger(ember, "initialLife", errors, `${path}.initialLife`);
    if (lifeMax !== null && isPositiveInteger(ember.initialLife) && ember.initialLife > lifeMax) {
      errors.push(`${path}.initialLife must be <= mechanic.lifeMax (${lifeMax})`);
    }
    if (isFiniteNumber(ember.x) && isFiniteNumber(ember.y)) positions.push({ x: ember.x, y: ember.y });
  });

  // 余烬数不够 freezeThreshold+1 时序章永远冻结不了 = 软锁; 开局预成簇则"三颗成簇长明"的顿悟被白送。
  if (freezeThreshold !== null && value.embers.length < freezeThreshold + 1) {
    errors.push(`prologue.embers must have at least freezeThreshold+1 (${freezeThreshold + 1}) embers`);
  }
  if (isFiniteNumber(value.adjacencyRadius) && positions.length === value.embers.length) {
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const distance = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
        if (distance <= value.adjacencyRadius) {
          errors.push(`prologue.embers[${i}] and prologue.embers[${j}] start within adjacencyRadius (开局不得预成簇)`);
        }
      }
    }
  }
}

function validateBoards(value: unknown, errors: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("boards must be a non-empty array");
    return;
  }
  const ids = new Set<string>();
  value.forEach((board, index) => {
    validateBoard(board, index, errors);
    if (!isRecord(board) || !isNonEmptyString(board.id)) return;
    if (ids.has(board.id)) {
      errors.push(`boards[${index}].id "${board.id}" is duplicated`);
    } else {
      ids.add(board.id);
    }
  });
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
    // 拒绝自环与重复/镜像边: 让"一条无向边 = 一次邻接"成为配置层的硬保证, 任何消费方
    // (模型 / 未来的视图 / 工具) 都不会因重复计数而误判冻结。堵在门口最稳。
    const seenEdges = new Set<string>();
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
      if (edge[0] === edge[1]) {
        errors.push(`${edgePath} must not be a self-loop`);
        return;
      }
      const key = JSON.stringify([edge[0], edge[1]].sort());
      if (seenEdges.has(key)) {
        errors.push(`${edgePath} duplicates edge ${edge[0]}-${edge[1]}`);
      } else {
        seenEdges.add(key);
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
  requireOptionalString(value, "teaches", errors, `${path}.teaches`);
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

function requireOptionalString(record: Record<string, unknown>, key: string, errors: string[], path = key): void {
  if (record[key] !== undefined && typeof record[key] !== "string") {
    errors.push(`${path} must be a string`);
  }
}

function requirePositiveInteger(record: Record<string, unknown>, key: string, errors: string[], path = key): void {
  if (!Number.isInteger(record[key]) || (record[key] as number) < 1) {
    errors.push(`${path} must be a positive integer`);
  }
}

function requirePositiveNumber(record: Record<string, unknown>, key: string, errors: string[], path = key): void {
  if (!isFiniteNumber(record[key]) || (record[key] as number) <= 0) {
    errors.push(`${path} must be a positive number`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}
