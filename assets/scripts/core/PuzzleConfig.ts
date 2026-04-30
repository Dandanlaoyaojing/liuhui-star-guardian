export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

export interface Vec2Def {
  x: number;
  y: number;
}

export interface CameraDef {
  position: Vec2Def;
  zoom?: number;
  rotation?: number;
}

export type EntityType =
  | "draggable"
  | "slot"
  | "rotatable"
  | "emitter"
  | "static"
  | "animated"
  | "particle"
  | "slider";

export interface EntityDef {
  id: string;
  type: EntityType;
  sprite: string;
  position: Vec2Def;
  scale?: number;
  rotation?: number;
  properties: Record<string, unknown>;
  tags: string[];
}

export interface InteractionDef {
  trigger: string;
  condition?: string;
  effect: string;
  audio?: string;
  animation?: string;
}

export type GoalType =
  | "all_sorted"
  | "all_connected"
  | "threshold"
  | "sequence"
  | "alignment"
  | "assembly"
  | "dynamic_balance"
  | "all_conditions_met"
  | "causal_chain"
  | "path_reverse"
  | "creative_threshold"
  | "overlap_evidence_reconstructed"
  | "custom";

export type PuzzleDimension = "color" | "shape" | (string & {});

export interface AllSortedGoalParams {
  dimensions: PuzzleDimension[];
  colors?: string[];
  shapes?: string[];
  expectedEntityIds?: string[];
  entityTag?: string;
}

export interface GoalDef {
  type: GoalType;
  params: Record<string, unknown>;
  customScript?: string;
}

export interface HintDef {
  level: 1 | 2 | 3;
  delay: number;
  text: string;
  highlight?: string[];
}

export type RepairStepType =
  | "camera_zoom"
  | "particle_burst"
  | "entity_animate"
  | "audio_play"
  | "screen_flash"
  | "text_show";

export interface RepairStepDef {
  type: RepairStepType;
  params: Record<string, unknown>;
  duration: number;
  delay: number;
}

export interface RepairSequenceDef {
  steps: RepairStepDef[];
}

export interface PuzzleConfig {
  id: string;
  name: string;
  stage: number;
  cognitiveSkill: string;
  wisdomCrystal: string;
  scene: {
    background: string;
    ambientAudio: string;
    camera: CameraDef;
    entities: EntityDef[];
  };
  interactions: InteractionDef[];
  goals: GoalDef[];
  hints: HintDef[];
  repair: RepairSequenceDef;
}

const entityTypes: readonly EntityType[] = [
  "draggable",
  "slot",
  "rotatable",
  "emitter",
  "static",
  "animated",
  "particle",
  "slider"
];

const goalTypes: readonly GoalType[] = [
  "all_sorted",
  "all_connected",
  "threshold",
  "sequence",
  "alignment",
  "assembly",
  "dynamic_balance",
  "all_conditions_met",
  "causal_chain",
  "path_reverse",
  "creative_threshold",
  "overlap_evidence_reconstructed",
  "custom"
];

const repairStepTypes: readonly RepairStepType[] = [
  "camera_zoom",
  "particle_burst",
  "entity_animate",
  "audio_play",
  "screen_flash",
  "text_show"
];

export function validatePuzzleConfig(value: unknown): ValidationResult<PuzzleConfig> {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["config must be an object"] };
  }

  requireNonEmptyString(value, "id", errors);
  requireNonEmptyString(value, "name", errors);
  requirePositiveInteger(value, "stage", errors);
  requireNonEmptyString(value, "cognitiveSkill", errors);
  requireNonEmptyString(value, "wisdomCrystal", errors);

  validateScene(value.scene, errors);
  validateInteractions(value.interactions, errors);
  validateGoals(value.goals, errors);
  validateHints(value.hints, errors);
  validateRepair(value.repair, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: value as unknown as PuzzleConfig };
}

function validateScene(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("scene must be an object");
    return;
  }

  requireNonEmptyString(value, "background", errors, "scene.background");
  requireNonEmptyString(value, "ambientAudio", errors, "scene.ambientAudio");
  validateCamera(value.camera, errors);

  if (!Array.isArray(value.entities)) {
    errors.push("scene.entities must be an array");
    return;
  }

  if (value.entities.length === 0) {
    errors.push("scene.entities must include at least one entity");
  }

  value.entities.forEach((entity, index) => validateEntity(entity, index, errors));
}

function validateCamera(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("scene.camera must be an object");
    return;
  }

  validateVec2(value.position, "scene.camera.position", errors);
  if (value.zoom !== undefined && !isFiniteNumber(value.zoom)) {
    errors.push("scene.camera.zoom must be a finite number");
  }
  if (value.rotation !== undefined && !isFiniteNumber(value.rotation)) {
    errors.push("scene.camera.rotation must be a finite number");
  }
}

function validateEntity(value: unknown, index: number, errors: string[]): void {
  const path = `scene.entities[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  requireNonEmptyString(value, "id", errors, `${path}.id`);
  requireOneOf(value, "type", entityTypes, errors, `${path}.type`);
  requireNonEmptyString(value, "sprite", errors, `${path}.sprite`);
  validateVec2(value.position, `${path}.position`, errors);

  if (value.scale !== undefined && !isFiniteNumber(value.scale)) {
    errors.push(`${path}.scale must be a finite number`);
  }
  if (value.rotation !== undefined && !isFiniteNumber(value.rotation)) {
    errors.push(`${path}.rotation must be a finite number`);
  }
  if (!isRecord(value.properties)) {
    errors.push(`${path}.properties must be an object`);
  }
  if (!isStringArray(value.tags)) {
    errors.push(`${path}.tags must be an array of strings`);
  }
}

function validateInteractions(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("interactions must be an array");
    return;
  }

  value.forEach((interaction, index) => {
    const path = `interactions[${index}]`;
    if (!isRecord(interaction)) {
      errors.push(`${path} must be an object`);
      return;
    }

    requireNonEmptyString(interaction, "trigger", errors, `${path}.trigger`);
    requireNonEmptyString(interaction, "effect", errors, `${path}.effect`);
    requireOptionalString(interaction, "condition", errors, `${path}.condition`);
    requireOptionalString(interaction, "audio", errors, `${path}.audio`);
    requireOptionalString(interaction, "animation", errors, `${path}.animation`);
  });
}

function validateGoals(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("goals must be an array");
    return;
  }

  if (value.length === 0) {
    errors.push("goals must include at least one goal");
  }

  value.forEach((goal, index) => {
    const path = `goals[${index}]`;
    if (!isRecord(goal)) {
      errors.push(`${path} must be an object`);
      return;
    }

    requireOneOf(goal, "type", goalTypes, errors, `${path}.type`);
    if (!isRecord(goal.params)) {
      errors.push(`${path}.params must be an object`);
    } else if (goal.type === "all_sorted") {
      validateAllSortedGoalParams(goal.params, path, errors);
    }
    requireOptionalString(goal, "customScript", errors, `${path}.customScript`);
  });
}

function validateAllSortedGoalParams(
  params: Record<string, unknown>,
  path: string,
  errors: string[]
): void {
  if (!isNonEmptyStringArray(params.dimensions)) {
    errors.push(`${path}.params.dimensions must include at least one dimension`);
  }
  if (params.colors !== undefined && !isNonEmptyStringArray(params.colors)) {
    errors.push(`${path}.params.colors must be a non-empty string array`);
  }
  if (params.shapes !== undefined && !isNonEmptyStringArray(params.shapes)) {
    errors.push(`${path}.params.shapes must be a non-empty string array`);
  }
  if (params.expectedEntityIds !== undefined && !isNonEmptyStringArray(params.expectedEntityIds)) {
    errors.push(`${path}.params.expectedEntityIds must be a non-empty string array`);
  }
  if (params.entityTag !== undefined && !isNonEmptyString(params.entityTag)) {
    errors.push(`${path}.params.entityTag must be a non-empty string`);
  }
}

function validateHints(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("hints must be an array");
    return;
  }

  value.forEach((hint, index) => {
    const path = `hints[${index}]`;
    if (!isRecord(hint)) {
      errors.push(`${path} must be an object`);
      return;
    }

    if (hint.level !== 1 && hint.level !== 2 && hint.level !== 3) {
      errors.push(`${path}.level must be 1, 2, or 3`);
    }
    if (!isFiniteNumber(hint.delay) || hint.delay < 0) {
      errors.push(`${path}.delay must be a non-negative number`);
    }
    requireNonEmptyString(hint, "text", errors, `${path}.text`);
    if (hint.highlight !== undefined && !isStringArray(hint.highlight)) {
      errors.push(`${path}.highlight must be an array of strings`);
    }
  });
}

function validateRepair(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("repair must be an object");
    return;
  }

  if (!Array.isArray(value.steps)) {
    errors.push("repair.steps must be an array");
    return;
  }

  value.steps.forEach((step, index) => {
    const path = `repair.steps[${index}]`;
    if (!isRecord(step)) {
      errors.push(`${path} must be an object`);
      return;
    }

    requireOneOf(step, "type", repairStepTypes, errors, `${path}.type`);
    if (!isRecord(step.params)) {
      errors.push(`${path}.params must be an object`);
    }
    if (!isFiniteNumber(step.duration) || step.duration < 0) {
      errors.push(`${path}.duration must be a non-negative number`);
    }
    if (!isFiniteNumber(step.delay) || step.delay < 0) {
      errors.push(`${path}.delay must be a non-negative number`);
    }
  });
}

function validateVec2(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isFiniteNumber(value.x)) {
    errors.push(`${path}.x must be a finite number`);
  }
  if (!isFiniteNumber(value.y)) {
    errors.push(`${path}.y must be a finite number`);
  }
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  path = key
): void {
  if (!isNonEmptyString(record[key])) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function requireOptionalString(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  path = key
): void {
  if (record[key] !== undefined && typeof record[key] !== "string") {
    errors.push(`${path} must be a string`);
  }
}

function requirePositiveInteger(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  path = key
): void {
  if (!Number.isInteger(record[key]) || (record[key] as number) < 1) {
    errors.push(`${path} must be a positive integer`);
  }
}

function requireOneOf<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[],
  errors: string[],
  path = key
): void {
  if (typeof record[key] !== "string" || !allowedValues.includes(record[key] as T)) {
    errors.push(`${path} must be one of: ${allowedValues.join(", ")}`);
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}
