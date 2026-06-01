export const LEMMY_APPROVED_IDENTITY_SOURCE =
  "assets/art/style-references/lemmy-rabbit-canonical.png";

export const LEMMY_CLEAN_MASTER_PATH =
  "assets/art/style-references/lemmy-rabbit-canonical.png";

export type LemmyActionId = "idle_right" | "walk_right" | "reach_up_right";
export type LemmyActorEvent = "reach_contact" | "footstep_left" | "footstep_right";

export interface LemmyActionScheduleEntry {
  atMs: number;
  event?: LemmyActorEvent;
  offsetX?: number;
  offsetY?: number;
  rotateDeg?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface LemmyTransformSchedule {
  loop: boolean;
  keyframes: LemmyActionScheduleEntry[];
}

export interface LemmyActionToken {
  actionId: LemmyActionId;
  isActive: boolean;
}

export interface LemmyActionHandle {
  token: LemmyActionToken;
  promise: Promise<void>;
}

export interface LemmyCancellationContext {
  beginAction(actionId: LemmyActionId): LemmyActionHandle;
  resolveActive(token?: LemmyActionToken): void;
  destroy(): void;
}

interface LemmyPendingAction {
  token: LemmyActionToken;
  resolve: () => void;
  reject: (error: Error) => void;
}

export const LEMMY_ACTION_SCHEDULES: Record<LemmyActionId, LemmyTransformSchedule> = {
  idle_right: {
    loop: false,
    keyframes: [
      { atMs: 0, offsetY: 0, rotateDeg: 0, scaleX: 1, scaleY: 1 },
      { atMs: 280, offsetY: 3, rotateDeg: 1, scaleX: 1.01, scaleY: 0.99 },
      { atMs: 560, offsetY: 0, rotateDeg: 0, scaleX: 1, scaleY: 1 }
    ]
  },
  walk_right: {
    loop: false,
    keyframes: [
      { atMs: 0, event: "footstep_left", offsetY: 0, rotateDeg: -2, scaleX: 1, scaleY: 1 },
      { atMs: 220, offsetY: 5, rotateDeg: 2, scaleX: 0.99, scaleY: 1.02 },
      { atMs: 440, event: "footstep_right", offsetY: 0, rotateDeg: -1, scaleX: 1, scaleY: 1 },
      { atMs: 660, offsetY: 4, rotateDeg: 2, scaleX: 0.99, scaleY: 1.02 },
      { atMs: 880, offsetY: 0, rotateDeg: 0, scaleX: 1, scaleY: 1 }
    ]
  },
  reach_up_right: {
    loop: false,
    keyframes: [
      { atMs: 0, offsetY: 0, rotateDeg: 0, scaleX: 1, scaleY: 1 },
      { atMs: 160, offsetY: -4, rotateDeg: -3, scaleX: 1.05, scaleY: 0.96 },
      { atMs: 380, event: "reach_contact", offsetY: 13, rotateDeg: 5, scaleX: 0.93, scaleY: 1.13 },
      { atMs: 640, offsetY: 4, rotateDeg: 2, scaleX: 0.98, scaleY: 1.04 },
      { atMs: 820, offsetY: 0, rotateDeg: 0, scaleX: 1, scaleY: 1 }
    ]
  }
};

export class LemmyActionInterrupted extends Error {
  constructor(actionId: LemmyActionId) {
    super(`Lemmy action interrupted: ${actionId}`);
    this.name = "LemmyActionInterrupted";
  }
}

export class LemmyActorDestroyed extends Error {
  constructor(actionId: LemmyActionId) {
    super(`Lemmy actor destroyed during action: ${actionId}`);
    this.name = "LemmyActorDestroyed";
  }
}

export function getLemmyTransformSchedule(actionId: LemmyActionId): LemmyTransformSchedule {
  const schedule = LEMMY_ACTION_SCHEDULES[actionId];
  return {
    loop: schedule.loop,
    keyframes: schedule.keyframes.map((entry) => ({ ...entry }))
  };
}

export function estimateLemmyActionDurationMs(actionId: LemmyActionId): number {
  const schedule = LEMMY_ACTION_SCHEDULES[actionId].keyframes;
  return schedule[schedule.length - 1]?.atMs ?? 0;
}

export function createLemmyCancellationContext(): LemmyCancellationContext {
  let active: LemmyPendingAction | null = null;
  let destroyed = false;

  const rejectActive = (error: Error) => {
    if (!active) return;
    const pending = active;
    active = null;
    pending.token.isActive = false;
    pending.reject(error);
  };

  return {
    beginAction(actionId: LemmyActionId): LemmyActionHandle {
      if (active) {
        rejectActive(new LemmyActionInterrupted(active.token.actionId));
      }

      const token: LemmyActionToken = { actionId, isActive: !destroyed };
      const promise = new Promise<void>((resolve, reject) => {
        if (destroyed) {
          token.isActive = false;
          reject(new LemmyActorDestroyed(actionId));
          return;
        }
        active = { token, resolve, reject };
      });

      return { token, promise };
    },

    resolveActive(token?: LemmyActionToken): void {
      if (!active || (token && active.token !== token)) return;
      const pending = active;
      active = null;
      pending.token.isActive = false;
      pending.resolve();
    },

    destroy(): void {
      destroyed = true;
      if (active) {
        rejectActive(new LemmyActorDestroyed(active.token.actionId));
      }
    }
  };
}

export function isExpectedLemmyActionCancel(error: unknown): boolean {
  return error instanceof LemmyActionInterrupted || error instanceof LemmyActorDestroyed;
}
