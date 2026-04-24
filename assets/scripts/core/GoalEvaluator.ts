import type { GoalDef, PuzzleDimension } from "./PuzzleConfig.ts";

export interface AllSortedGoalParams {
  dimensions: PuzzleDimension[];
  colors?: string[];
  shapes?: string[];
  expectedEntityIds?: string[];
  entityTag?: string;
}

export interface SortableEntityState {
  id: string;
  attributes: Record<string, string | undefined>;
  placedInSlotId?: string | null;
  tags?: string[];
}

export interface SortSlotState {
  id: string;
  accepts: Record<string, string | undefined>;
  tags?: string[];
}

export interface SortState {
  entities: SortableEntityState[];
  slots: SortSlotState[];
}

export interface GoalEvaluationResult {
  success: boolean;
  failures: string[];
}

export function evaluateGoal(goal: GoalDef, state: SortState): GoalEvaluationResult {
  if (goal.type !== "all_sorted") {
    return {
      success: false,
      failures: [`Unsupported goal type: ${goal.type}`]
    };
  }

  return evaluateAllSorted(goal.params as unknown as AllSortedGoalParams, state);
}

export function evaluateAllSorted(
  params: AllSortedGoalParams,
  state: SortState
): GoalEvaluationResult {
  const failures: string[] = [];

  if (!Array.isArray(params.dimensions) || params.dimensions.length === 0) {
    return {
      success: false,
      failures: ["all_sorted requires at least one dimension"]
    };
  }

  const entities = selectEntities(params, state.entities);
  const slotsById = new Map(state.slots.map((slot) => [slot.id, slot]));

  if (entities.length === 0) {
    failures.push("all_sorted has no entities to evaluate");
  }

  collectExpectedEntityFailures(params, entities, failures);

  for (const entity of entities) {
    const dimensionFailures = collectDimensionFailures(params, entity);
    failures.push(...dimensionFailures);

    if (!entity.placedInSlotId) {
      failures.push(`${entity.id} is not placed`);
      continue;
    }

    const slot = slotsById.get(entity.placedInSlotId);
    if (slot === undefined) {
      failures.push(`${entity.id} is placed in unknown slot ${entity.placedInSlotId}`);
      continue;
    }

    for (const dimension of params.dimensions) {
      const actualValue = entity.attributes[dimension];
      const acceptedValue = slot.accepts[dimension];
      if (actualValue !== undefined && acceptedValue !== actualValue) {
        failures.push(
          `${entity.id} is in ${slot.id}, which does not match ${dimension}=${actualValue}`
        );
      }
    }
  }

  return {
    success: failures.length === 0,
    failures
  };
}

function selectEntities(
  params: AllSortedGoalParams,
  entities: SortableEntityState[]
): SortableEntityState[] {
  if (params.entityTag === undefined) {
    return entities;
  }

  const entityTag = params.entityTag;
  return entities.filter((entity) => entity.tags?.includes(entityTag) === true);
}

function collectExpectedEntityFailures(
  params: AllSortedGoalParams,
  entities: SortableEntityState[],
  failures: string[]
): void {
  if (params.expectedEntityIds === undefined) {
    return;
  }

  const entityIds = new Set(entities.map((entity) => entity.id));
  for (const expectedId of params.expectedEntityIds) {
    if (!entityIds.has(expectedId)) {
      failures.push(`missing expected entity ${expectedId}`);
    }
  }
}

function collectDimensionFailures(
  params: AllSortedGoalParams,
  entity: SortableEntityState
): string[] {
  const failures: string[] = [];

  for (const dimension of params.dimensions) {
    const value = entity.attributes[dimension];

    if (value === undefined || value.length === 0) {
      failures.push(`${entity.id} is missing ${dimension}`);
      continue;
    }

    const allowedValues = getAllowedValues(params, dimension);
    if (allowedValues !== undefined && !allowedValues.includes(value)) {
      failures.push(`${entity.id} has unsupported ${dimension}=${value}`);
    }
  }

  return failures;
}

function getAllowedValues(
  params: AllSortedGoalParams,
  dimension: PuzzleDimension
): readonly string[] | undefined {
  if (dimension === "color") {
    return params.colors;
  }
  if (dimension === "shape") {
    return params.shapes;
  }

  return undefined;
}
