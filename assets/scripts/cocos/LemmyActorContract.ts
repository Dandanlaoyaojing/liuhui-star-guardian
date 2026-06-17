// 游戏内动态身份基准 = 带铅笔描边版(W5@820)。以后所有动作都用这张图喂即梦生图,
// 生成帧不再逐帧补描边(描边已烘进母版; 见 source-videos/README)。
export const LEMMY_APPROVED_IDENTITY_SOURCE =
  "assets/art/style-references/lemmy-rabbit-canonical-pencil.png";

// 干净无描边母版(W1) = 商标/logo 原型(2026-06-07 由 lemmy-rabbit-canonical.png 改名)。
// 仅品牌用途, 不进游戏动态管线。
export const LEMMY_CLEAN_MASTER_PATH =
  "assets/art/style-references/lemmy-rabbit-trademark-master.png";

// 2026-06-05: 全部 5 个动作都改为播放加载的 PNG 帧序列(idle/walk 循环, reach/startle/crouch
// 一次性 hold-last)。旧的"transform 关键帧变换单张 canonical"路径(idle_right/walk_right/
// reach_up_right + 引擎走路)已废弃删除——现在有了对齐原图的足量帧(见 source-videos/README)。
export type LemmyFrameActionId =
  | "idle" | "walk" | "reach" | "startle" | "crouch"
  // reachmiss(2026-06-08): 伸手够篮【够不着】教学 beat —— 踮脚伸够两次落空、耳朵耷拉失望、回站。
  // (2026-06-16 弃用: 用户嫌不好看, 改回 reach 伸手 + headshake 摇头; 帧集留盘上可切回)
  | "reachmiss"
  // headshake(2026-06-16, 即梦生成): 够不着后的"不行"轻轻摇头, 身体静止只头动; 接在 reach 之后。
  | "headshake"
  // 2026-06-08 耳后贴系列(惊扰→顶篮): 收耳(立→后贴) / 耳后贴 idle / 耳后贴走 / 跳起顶篮 / 展耳(后贴→立)。
  // 渲染缩放见各动作 renderScale(逐帧/ramp 补回源姿势身高差, 脚底锚定, 接缝恒 404)。
  | "earsback" | "idleback" | "walkback" | "headbutt" | "earsup";
/** Any Lemmy action id. (All actions are frame sequences now.) */
export type LemmyActionId = LemmyFrameActionId;

/**
 * Gameplay-relevant beat emitted at a specific frame.
 * - reach_contact: reach apex → Lemmy touches the hanging basket (first-tap gentle nudge).
 * - headbutt_contact: rising head first touches the basket bottom → real outward impulse on the pieces.
 */
export type LemmyActorEvent = "reach_contact" | "headbutt_contact";

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
  /**
   * 渲染缩放(可选; ⚠️ 当前全部动作均【不设】= 1.0)。
   * 2026-06-15 修「走到篮下变大」根因: 曾给折耳族设 1.34~1.5 想"补回更矮的源姿势", 但
   * LemmyActor.fitSpriteToFrame 的 "contain" 适配【已经】把每帧裁剪框(alpha 包围盒, 各帧实测均竖长,
   * 高度受限)归一到 displayH —— 于是 renderScale 是在已归一的渲染高上再乘一遍, 折耳族整体被放大
   * 34~50%(idleback 1.338 / headbutt 1.502)。各动作脚底行恒在 512² 画布 y≈490(measure 脚本实测),
   * 源帧本就脚底对齐+等比, 不需要逐动作缩放。旧测试守的是"身体像素高×renderScale≈404"(自洽标定),
   * 与运行时 contain 渲染无关, 所以测试恒绿而画面恒错。
   * 字段保留: 若日后要让"去耳身体高"严格恒等(竖耳姿势自然更高), 应在 LemmyActor 按【身体高】锚定,
   * 而非整框乘系数。number = 整段恒定; {from,to} = 线性渐变; number[] = 逐帧查表。
   */
  renderScale?: number | { from: number; to: number } | ReadonlyArray<number>;
}

/**
 * 某动作第 frameIndex 帧的渲染缩放。数组=逐帧查表(越界夹到末端); ramp 按 [0, frameCount-1]
 * 线性插值, 单帧序列取 to(动作的"完成态")。LemmyActor 每帧据此 setContentSize + 脚底锚定。
 */
export function lemmyRenderScaleAt(
  scale: number | { from: number; to: number } | ReadonlyArray<number> | undefined,
  frameIndex: number,
  frameCount: number
): number {
  if (scale === undefined) return 1;
  if (typeof scale === "number") return scale;
  if (Array.isArray(scale)) {
    if (scale.length === 0) return 1;
    return scale[Math.min(Math.max(0, frameIndex), scale.length - 1)];
  }
  const ramp = scale as { from: number; to: number };
  if (frameCount <= 1) return ramp.to;
  const t = Math.min(1, Math.max(0, frameIndex / (frameCount - 1)));
  return ramp.from + (ramp.to - ramp.from) * t;
}

// fps 是观感参数,可在引擎内微调;帧数见 assets/art/characters/lemmy/source-videos/README。
export const LEMMY_FRAME_ACTIONS: Record<LemmyFrameActionId, LemmyFrameActionSpec> = {
  idle: { dir: "art/characters/lemmy/idle", fps: 12, loop: true, holdLast: false },
  // 走路 = 帧循环(area-norm 锁尺寸的正面3/4帧) + 引擎横移;朝左原生,朝右 scaleX=-1。
  walk: { dir: "art/characters/lemmy/walk", fps: 16, loop: true, holdLast: false },
  // reach 36 帧弧线(站→举臂够到≈#23→放下手#24-34→收住站姿)。#23 是爪举到最高、≈碰到篮子那刻 → 发 reach_contact。
  // (旧值 #34 其实是手已放下的收尾帧,误当成够到点 → 篮子晚晃一拍;现按实帧校到 #23,见 M01IntroSequence.beginReach 的 onEvent。)
  reach: {
    dir: "art/characters/lemmy/reach",
    fps: 12,
    loop: false,
    holdLast: true,
    events: [{ frameIndex: 23, event: "reach_contact" }]
  },
  // reachmiss 够不着(2026-06-08, spec §5.2 教学 beat): 踮脚伸手够两次→落空→耳朵耷拉失望→回站。
  // 无 events(够不着=零接触, 篮子纹丝不动); 即梦 frames2video 首尾双锁生成, arc 抽帧(统一缩放保高度弧)。
  reachmiss: {
    dir: "art/characters/lemmy/reachmiss",
    fps: 18,
    loop: false,
    holdLast: true
  },
  // headshake 轻轻摇头(2026-06-16, 即梦生成): 够不着后的"不行"小手势, 一次性 hold-last。
  // 源帧身体/脚静止、只头左右摆(实测 foot_x 恒定、head_x 摆动); 躯干131/脚底490 与 idle 同基准。
  headshake: {
    dir: "art/characters/lemmy/headshake",
    fps: 8, // 2026-06-17 摇头放慢(20→12→8; 28帧≈3.5s); 嫌快/慢再调
    loop: false,
    holdLast: true
  },
  startle: { dir: "art/characters/lemmy/startle", fps: 18, loop: false, holdLast: true },
  crouch: { dir: "art/characters/lemmy/crouch", fps: 32, loop: false, holdLast: true }, // 2026-06-17 捡东西下蹲提速 2×(16→32)
  // ── 耳后贴系列(2026-06-08) ── fps 是观感参数, 引擎内可微调。
  // ⚠️ 不设 renderScale(2026-06-15 修「走到篮下变大」): fitSpriteToFrame 的 contain 适配已把每帧
  //    裁剪框归一到 displayH, 再乘系数 = 整体超调 34~50%(详见上方 renderScale 字段注释)。
  // earsback 收耳(立→后贴), 一次性 hold-last。
  earsback: {
    dir: "art/characters/lemmy/earsback",
    fps: 48, // 2026-06-17 走去篮下收耳提速 2×(24→48)
    loop: false,
    holdLast: true
  },
  // idleback 耳后贴待机, 单呼吸周期循环 (19帧@10fps≈1.9s, 与 idle 同呼吸节奏)。
  // 2026-06-17 去重: 即梦源有效帧率低, 原48帧含27个重复/held帧 → 去重为19独立帧并旋转到相位闭合
  // (尾→首≈邻帧,无接缝跳), fps 24→10 保时长。帧数运行时数 loadDir, 改这里只需同步 fps。
  idleback: {
    dir: "art/characters/lemmy/idleback",
    fps: 10,
    loop: true,
    holdLast: false
  },
  // walkback 耳后贴走, 单步循环 (12帧@15fps=0.8s/步)。朝左原生, 朝右 scaleX=-1。
  // 2026-06-17 去重: 原28帧过采样(0.46s窗口抽28帧)含重复端点+16重复帧 → 12独立帧相位闭合, fps 35→15。
  walkback: {
    dir: "art/characters/lemmy/walkback",
    fps: 15,
    loop: true,
    holdLast: false
  },
  // headbutt 蹲地→起跳顶篮底→落 (124帧, 跳跃模式抽帧已保留腾空)。
  // ⚠️ contact 帧 = 头【在上升段初次触到篮底】那刻, 不是头停在篮底的峰值、更不是脚离地最高那刻:
  // 逐帧测头顶 Y —— #60=165 → #63=112 → #66=87 → #72=77(到顶, 之后一直贴篮底到 #96), 脚离地最高在 #81。
  // 头是在快速上冲中于 ~#66 就撞上篮底(距峰值仅 10px), #72 只是被篮底挡停的峰值。对到峰值(旧 #71)
  // 玩家看着像"跳到最高点篮子才受力"; 对到 #66(初次接触)→ 篮子在头撞上那一刻就受力。(2026-06-08 用户现场)
  headbutt: {
    dir: "art/characters/lemmy/headbutt",
    fps: 40,
    loop: false,
    holdLast: true,
    events: [{ frameIndex: 66, event: "headbutt_contact" }]
  },
  // earsup 展耳(后贴→立, 复原), 一次性 hold-last。
  earsup: {
    dir: "art/characters/lemmy/earsup",
    fps: 24,
    loop: false,
    holdLast: true
  }
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
