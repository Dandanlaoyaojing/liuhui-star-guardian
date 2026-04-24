import type { ToolCard } from "./ToolCard.ts";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PuzzleCompletionRecord {
  completedAt: number;
}

export interface ProgressData {
  completedPuzzles: Record<string, PuzzleCompletionRecord>;
  unlockedToolCards: Record<string, { unlockedAt: number }>;
}

export interface ProgressStore {
  getProgress(): ProgressData;
  isPuzzleCompleted(puzzleId: string): boolean;
  markPuzzleCompleted(puzzleId: string, completedAt?: number): void;
  hasToolCard(puzzleId: string): boolean;
  unlockToolCard(puzzleIdOrCard: string | ToolCard, unlockedAt?: number): void;
  reset(): void;
}

export interface CreateProgressStoreOptions {
  storage?: KeyValueStorage | null;
  storageKey?: string;
  now?: () => number;
}

const defaultStorageKey = "liuhui-star-guardian:progress:v1";

export function createProgressStore(options: CreateProgressStoreOptions = {}): ProgressStore {
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  const memoryStorage = storage ?? createMemoryStorage();
  const storageKey = options.storageKey ?? defaultStorageKey;
  const now = options.now ?? Date.now;

  return new ProgressStoreImpl(memoryStorage, storageKey, now);
}

export function createMemoryStorage(initialValues?: Record<string, string>): KeyValueStorage {
  const values = new Map<string, string>(Object.entries(initialValues ?? {}));

  return {
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
    removeItem(key: string): void {
      values.delete(key);
    }
  };
}

class ProgressStoreImpl implements ProgressStore {
  public constructor(
    private readonly storage: KeyValueStorage,
    private readonly storageKey: string,
    private readonly now: () => number
  ) {}

  public getProgress(): ProgressData {
    return cloneProgress(this.readProgress());
  }

  public isPuzzleCompleted(puzzleId: string): boolean {
    return this.readProgress().completedPuzzles[puzzleId] !== undefined;
  }

  public markPuzzleCompleted(puzzleId: string, completedAt = this.now()): void {
    const progress = this.readProgress();
    progress.completedPuzzles[puzzleId] = { completedAt };
    this.writeProgress(progress);
  }

  public hasToolCard(puzzleId: string): boolean {
    return this.readProgress().unlockedToolCards[puzzleId] !== undefined;
  }

  public unlockToolCard(puzzleIdOrCard: string | ToolCard, unlockedAt = this.now()): void {
    const puzzleId =
      typeof puzzleIdOrCard === "string" ? puzzleIdOrCard : puzzleIdOrCard.puzzleId;
    const timestamp =
      typeof puzzleIdOrCard === "string" ? unlockedAt : puzzleIdOrCard.unlockedAt;

    const progress = this.readProgress();
    progress.unlockedToolCards[puzzleId] = { unlockedAt: timestamp };
    this.writeProgress(progress);
  }

  public reset(): void {
    this.storage.removeItem(this.storageKey);
  }

  private readProgress(): ProgressData {
    const raw = this.storage.getItem(this.storageKey);
    if (raw === null) {
      return createEmptyProgress();
    }

    try {
      return normalizeProgress(JSON.parse(raw));
    } catch {
      return createEmptyProgress();
    }
  }

  private writeProgress(progress: ProgressData): void {
    this.storage.setItem(this.storageKey, JSON.stringify(progress));
  }
}

function getDefaultStorage(): KeyValueStorage | null {
  const maybeGlobal = globalThis as { localStorage?: KeyValueStorage };
  return maybeGlobal.localStorage ?? null;
}

function createEmptyProgress(): ProgressData {
  return {
    completedPuzzles: {},
    unlockedToolCards: {}
  };
}

function normalizeProgress(value: unknown): ProgressData {
  if (!isRecord(value)) {
    return createEmptyProgress();
  }

  return {
    completedPuzzles: normalizeCompletionRecords(value.completedPuzzles),
    unlockedToolCards: normalizeToolCardRecords(value.unlockedToolCards)
  };
}

function normalizeCompletionRecords(value: unknown): Record<string, PuzzleCompletionRecord> {
  if (!isRecord(value)) {
    return {};
  }

  const records: Record<string, PuzzleCompletionRecord> = {};
  for (const [puzzleId, record] of Object.entries(value)) {
    if (isRecord(record) && typeof record.completedAt === "number") {
      records[puzzleId] = { completedAt: record.completedAt };
    }
  }

  return records;
}

function normalizeToolCardRecords(value: unknown): Record<string, { unlockedAt: number }> {
  if (!isRecord(value)) {
    return {};
  }

  const records: Record<string, { unlockedAt: number }> = {};
  for (const [puzzleId, record] of Object.entries(value)) {
    if (isRecord(record) && typeof record.unlockedAt === "number") {
      records[puzzleId] = { unlockedAt: record.unlockedAt };
    }
  }

  return records;
}

function cloneProgress(progress: ProgressData): ProgressData {
  return {
    completedPuzzles: { ...progress.completedPuzzles },
    unlockedToolCards: { ...progress.unlockedToolCards }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
