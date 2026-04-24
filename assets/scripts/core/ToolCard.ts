export interface ToolCard {
  puzzleId: string;
  stage: number;
  front: {
    toolName: string;
    scene: string;
    wisdomCrystal: string;
  };
  back: {
    coreAction: string;
    whenToUse: string[];
    realLifeExamples: string[];
    commonTraps: string;
  };
  unlockedAt: number;
}

export type ToolCardDraft = Omit<ToolCard, "unlockedAt">;

export type ToolCardValidationResult =
  | { ok: true; value: ToolCard }
  | { ok: false; errors: string[] };

export function createToolCard(draft: ToolCardDraft, unlockedAt = Date.now()): ToolCard {
  return {
    puzzleId: draft.puzzleId,
    stage: draft.stage,
    front: {
      toolName: draft.front.toolName,
      scene: draft.front.scene,
      wisdomCrystal: draft.front.wisdomCrystal
    },
    back: {
      coreAction: draft.back.coreAction,
      whenToUse: [...draft.back.whenToUse],
      realLifeExamples: [...draft.back.realLifeExamples],
      commonTraps: draft.back.commonTraps
    },
    unlockedAt
  };
}

export function validateToolCard(value: unknown): ToolCardValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["tool card must be an object"] };
  }

  requireNonEmptyString(value, "puzzleId", errors);
  if (!Number.isInteger(value.stage) || (value.stage as number) < 1 || (value.stage as number) > 5) {
    errors.push("stage must be an integer from 1 to 5");
  }

  validateFront(value.front, errors);
  validateBack(value.back, errors);

  if (typeof value.unlockedAt !== "number" || !Number.isFinite(value.unlockedAt)) {
    errors.push("unlockedAt must be a finite number");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: value as unknown as ToolCard };
}

function validateFront(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("front must be an object");
    return;
  }

  requireNonEmptyString(value, "toolName", errors, "front.toolName");
  requireNonEmptyString(value, "scene", errors, "front.scene");
  requireNonEmptyString(value, "wisdomCrystal", errors, "front.wisdomCrystal");
}

function validateBack(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("back must be an object");
    return;
  }

  requireNonEmptyString(value, "coreAction", errors, "back.coreAction");
  requireNonEmptyStringArray(value, "whenToUse", errors, "back.whenToUse");
  requireNonEmptyStringArray(value, "realLifeExamples", errors, "back.realLifeExamples");
  requireNonEmptyString(value, "commonTraps", errors, "back.commonTraps");
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  path = key
): void {
  if (typeof record[key] !== "string" || (record[key] as string).trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function requireNonEmptyStringArray(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
  path = key
): void {
  const value = record[key];
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must include at least one entry`);
    return;
  }

  if (!value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    errors.push(`${path} must contain only non-empty strings`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
