export const LEMMY_APPROVED_IDENTITY_SOURCE =
  "assets/art/style-references/lemmy-rabbit-canonical.png";

export const LEMMY_CLEAN_MASTER_PATH =
  "assets/art/style-references/lemmy-rabbit-canonical.png";

// 2026-06-05: 全部 5 个动作都改为播放加载的 PNG 帧序列(idle/walk 循环, reach/startle/crouch
// 一次性 hold-last)。旧的"transform 关键帧变换单张 canonical"路径(idle_right/walk_right/
// reach_up_right + 引擎走路)已废弃删除——现在有了对齐原图的足量帧(见 source-videos/README)。
export type LemmyFrameActionId = "idle" | "walk" | "reach" | "startle" | "crouch";
/** Any Lemmy action id. (All actions are frame sequences now.) */
export type LemmyActionId = LemmyFrameActionId;

/** Gameplay-relevant beat emitted at a specific frame. reach apex → Lemmy touches the basket. */
export type LemmyActorEvent = "reach_contact";

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

// ── Frame-sequence actions ──────────────────────────────────────────────────
// Each action plays a loaded PNG sequence (resources.loadDir). Pure playback +
// event-timing state lives here; the cc glue (LemmyActor) owns sprites.

/**
 * A gameplay beat fired when playback crosses a specific frame index.
 * ⚠️ frameIndex 0 never fires: the first frame is shown on start without a crossing,
 * and the (prev, newIndex] window is half-open at prev (=0). Put beats on frame >= 1.
 * LemmyActor clamps an out-of-range frameIndex to the last loaded frame (fire late,
 * never soft-lock) — but keep it in range; the LemmyFrameAssets guard test enforces it.
 */
export interface LemmyFrameEvent {
  frameIndex: number;
  event: LemmyActorEvent;
}

export interface LemmyFrameActionSpec {
  /** resources-relative path passed to resources.loadDir(dir, SpriteFrame). */
  dir: string;
  fps: number;
  loop: boolean;
  /** one-shot only: keep showing the last frame once done. */
  holdLast: boolean;
  /** frame-indexed gameplay beats (e.g. reach apex → reach_contact). */
  events?: ReadonlyArray<LemmyFrameEvent>;
}

// fps 是观感参数,可在引擎内微调;帧数见 assets/art/characters/lemmy/source-videos/README。
export const LEMMY_FRAME_ACTIONS: Record<LemmyFrameActionId, LemmyFrameActionSpec> = {
  idle: { dir: "art/characters/lemmy/idle", fps: 12, loop: true, holdLast: false },
  // 走路 = 帧循环(area-norm 锁尺寸的正面3/4帧) + 引擎横移;朝左原生,朝右 scaleX=-1。
  walk: { dir: "art/characters/lemmy/walk", fps: 16, loop: true, holdLast: false },
  // reach 36 帧弧线(站→蹲蓄力→踮脚伸到顶);#34 是伸到顶≈碰到篮子 → 发 reach_contact。
  reach: {
    dir: "art/characters/lemmy/reach",
    fps: 18,
    loop: false,
    holdLast: true,
    events: [{ frameIndex: 34, event: "reach_contact" }]
  },
  startle: { dir: "art/characters/lemmy/startle", fps: 18, loop: false, holdLast: true },
  crouch: { dir: "art/characters/lemmy/crouch", fps: 16, loop: false, holdLast: true }
};

export interface LemmyFramePlaybackState {
  actionId: LemmyFrameActionId;
  frameCount: number;
  fps: number;
  loop: boolean;
  holdLast: boolean;
  elapsedMs: number;
  frameIndex: number;
  done: boolean;
}

export function createFramePlayback(
  actionId: LemmyFrameActionId,
  frameCount: number
): LemmyFramePlaybackState {
  const spec = LEMMY_FRAME_ACTIONS[actionId];
  return {
    actionId,
    frameCount,
    fps: spec.fps,
    loop: spec.loop,
    holdLast: spec.holdLast,
    elapsedMs: 0,
    frameIndex: 0,
    done: false
  };
}

/**
 * Advance a frame playback by deltaMs (frame-rate independent). Pure: returns a new state.
 * - loop: wraps frameIndex, never done.
 * - one-shot: clamps to the last frame and marks done once the sequence completes.
 */
export function advanceFramePlayback(
  state: LemmyFramePlaybackState,
  deltaMs: number
): LemmyFramePlaybackState {
  if (state.frameCount <= 0) {
    return { ...state, done: true, frameIndex: 0 };
  }

  const elapsedMs = state.elapsedMs + Math.max(0, deltaMs);
  const frameDurationMs = 1000 / state.fps;
  const rawIndex = Math.floor(elapsedMs / frameDurationMs);

  if (state.loop) {
    const wrapped = ((rawIndex % state.frameCount) + state.frameCount) % state.frameCount;
    return { ...state, elapsedMs, frameIndex: wrapped, done: false };
  }

  if (rawIndex >= state.frameCount - 1) {
    return { ...state, elapsedMs, frameIndex: state.frameCount - 1, done: true };
  }

  return { ...state, elapsedMs, frameIndex: rawIndex, done: false };
}

/**
 * Events (from a resolved, frame-count-clamped list) whose frame was crossed by advancing
 * prevIndex → newIndex this tick. Half-open at prevIndex (already shown), inclusive at
 * newIndex. Robust to multi-frame jumps under a large dt. Takes the events list directly
 * (not the actionId) so LemmyActor can pass a list clamped to the actually-loaded frames.
 */
export function frameEventsBetween(
  events: ReadonlyArray<LemmyFrameEvent> | undefined,
  prevIndex: number,
  newIndex: number
): LemmyActorEvent[] {
  if (!events || newIndex <= prevIndex) return [];
  return events
    .filter((entry) => entry.frameIndex > prevIndex && entry.frameIndex <= newIndex)
    .map((entry) => entry.event);
}
