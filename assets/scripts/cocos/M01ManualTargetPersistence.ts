import type { M01ManualTargetPiecePlacement } from "./M01TargetPatternGenerator.ts";

export const M01_MANUAL_TARGET_STORAGE_KEY = "liuhui-star-guardian:m01:manual-target-draft:v1";

export interface M01ManualTargetStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readM01ManualTargetPlacements(
  storage: M01ManualTargetStorage | null | undefined
): M01ManualTargetPiecePlacement[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(M01_MANUAL_TARGET_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isManualTargetPlacement);
  } catch {
    return [];
  }
}

export function writeM01ManualTargetPlacements(
  storage: M01ManualTargetStorage | null | undefined,
  placements: M01ManualTargetPiecePlacement[]
): void {
  if (!storage) {
    return;
  }

  storage.setItem(M01_MANUAL_TARGET_STORAGE_KEY, JSON.stringify(placements));
}

function isManualTargetPlacement(value: unknown): value is M01ManualTargetPiecePlacement {
  if (!isRecord(value) || typeof value.fragmentId !== "string") {
    return false;
  }
  if (!isRecord(value.position) || typeof value.position.x !== "number" || typeof value.position.y !== "number") {
    return false;
  }

  return value.rotation === undefined || typeof value.rotation === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
