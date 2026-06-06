import {
  _decorator,
  Component,
  Node,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec3,
  resources,
  tween
} from "cc";
import type { TweenAction } from "cc";

import {
  LEMMY_FRAME_ACTIONS,
  advanceFramePlayback,
  createFramePlayback,
  createLemmyCancellationContext,
  frameEventsBetween,
  isExpectedLemmyActionCancel,
  type LemmyActionToken,
  type LemmyActorEvent,
  type LemmyFrameActionId,
  type LemmyFrameEvent,
  type LemmyFramePlaybackState
} from "./LemmyActorContract.ts";
import { aspectContentSize, spriteFrameSize } from "./M01SpriteAspect.ts";

export interface LemmyActorOptions {
  displaySize?: {
    width: number;
    height: number;
  };
  resourcePath?: string;
}

export interface LemmyWalkOptions {
  durationMs?: number;
}

export interface LemmyFramePlayOptions {
  facing?: "left" | "right";
  onEvent?: (event: LemmyActorEvent) => void;
}

export {
  LEMMY_APPROVED_IDENTITY_SOURCE,
  LEMMY_CLEAN_MASTER_PATH,
  createLemmyCancellationContext,
  isExpectedLemmyActionCancel,
  LemmyActionInterrupted,
  LemmyActorDestroyed
} from "./LemmyActorContract.ts";

const DEFAULT_DISPLAY_SIZE = { width: 180, height: 180 };
const DEFAULT_LEMMY_RESOURCE_PATH = "art/characters/lemmy/lemmy-canonical/spriteFrame";
const DEFAULT_WALK_DURATION_MS = 2000;
// 定妆图(canonical)是紧贴兔子的裁剪; 运行时帧是 512² 画布、兔子占约 84% 高。把定妆图按此系数
// 缩小, 让初始站姿尺寸与帧动画一致(canonical 只在 walk 前短暂显示, idle 帧一播即接管)。
const CANONICAL_FIT_SCALE = 0.854;

const { ccclass } = _decorator;

@ccclass("LemmyActor")
export class LemmyActor extends Component {
  private readonly cancellation = createLemmyCancellationContext();
  private readyPromise: Promise<void> = Promise.resolve();
  private displaySize = DEFAULT_DISPLAY_SIZE;
  private spriteNode: Node | null = null;
  private sprite: Sprite | null = null;
  private readonly frameCache = new Map<LemmyFrameActionId, SpriteFrame[]>();
  private framePlayback: LemmyFramePlaybackState | null = null;
  private framePlaybackFrames: SpriteFrame[] = [];
  private framePlaybackToken: LemmyActionToken | null = null;
  private framePlaybackOnEvent: ((event: LemmyActorEvent) => void) | null = null;
  // events clamped to the actually-loaded frame count (an out-of-range beat fires on the
  // last frame instead of never → no soft-lock if a sequence is ever re-extracted shorter).
  private framePlaybackEvents: ReadonlyArray<LemmyFrameEvent> = [];
  /** Retained horizontal facing so idle/reach after a walk keep the walk's direction (sticky). */
  private facing: "left" | "right" = "left";
  /** Active walk position tween — stopped on supersede/destroy so an interrupted walk halts. */
  private walkTween: TweenAction<Node> | null = null;

  init(options: LemmyActorOptions = {}): Promise<void> {
    this.displaySize = options.displaySize ?? DEFAULT_DISPLAY_SIZE;
    this.node.addComponent(UITransform).setContentSize(this.displaySize.width, this.displaySize.height);

    this.spriteNode = this.mountCanonicalSprite();
    this.readyPromise = this.loadSpriteFrame(options.resourcePath ?? DEFAULT_LEMMY_RESOURCE_PATH);

    return this.readyPromise;
  }

  /** Start the looping idle breathing animation (fire-and-forget; runs until superseded). */
  playIdle(): void {
    void this.playFrameAction("idle").catch((error) => {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    });
  }

  /**
   * Walk Lemmy to `target`: loops the walk frame sequence (area-norm 正面3/4 帧) while the
   * node slides there at constant speed. Resolves on arrival (holds the last walk frame —
   * callers typically follow with playIdle). Rejects if interrupted / actor destroyed.
   */
  async walkTo(target: Vec3, options: LemmyWalkOptions = {}): Promise<void> {
    await this.readyPromise;
    const frames = await this.loadFrames("walk");
    const handle = this.cancellation.beginAction("walk");

    // 走路帧朝左原生; 朝右移动用 scaleX=-1 镜像翻转。朝向粘住, 供到位后的 idle/reach 沿用。
    this.stopWalkTween();
    const movingRight = target.x > this.node.position.x;
    this.facing = movingRight ? "right" : "left";
    this.setFacingFlip(movingRight);
    this.startFramePlayback("walk", frames, handle.token);

    this.walkTween = tween(this.node)
      .to(
        (options.durationMs ?? DEFAULT_WALK_DURATION_MS) / 1000,
        { position: target },
        // 走路匀速(像真人走), 不用缓动——sineInOut 会"头慢中间快尾慢"看着忽快忽慢。
        { easing: "linear" }
      )
      .call(() => {
        // 到位: 停走路帧循环(resolve → update 下一帧收掉播放), 站姿交回调用方。
        this.cancellation.resolveActive(handle.token);
      })
      .start();

    return handle.promise;
  }

  /**
   * Play a loaded frame sequence. idle/walk loop (never resolve until superseded);
   * reach/startle/crouch are one-shot hold-last and resolve when complete. reach emits
   * reach_contact via options.onEvent at its apex frame. Rejects if interrupted / destroyed.
   */
  async playFrameAction(
    actionId: LemmyFrameActionId,
    options: LemmyFramePlayOptions = {}
  ): Promise<void> {
    await this.readyPromise;
    const frames = await this.loadFrames(actionId);
    const handle = this.cancellation.beginAction(actionId);

    // 朝向: 调用方显式指定则用之, 否则沿用上一动作(走右后 idle/reach 不会翻回朝左)。
    this.stopWalkTween();
    this.facing = options.facing ?? this.facing;
    this.setFacingFlip(this.facing === "right");
    this.startFramePlayback(actionId, frames, handle.token, options.onEvent);

    return handle.promise;
  }

  /** Warm a frame sequence into cache so the first playFrameAction has no loadDir hitch. */
  async preloadFrames(actionId: LemmyFrameActionId): Promise<void> {
    await this.loadFrames(actionId);
  }

  update(deltaSeconds: number): void {
    const playback = this.framePlayback;
    const token = this.framePlaybackToken;
    if (!playback || !token) return;

    if (!token.isActive) {
      // Superseded by another action (beginAction already rejected this promise).
      this.clearFramePlayback();
      return;
    }

    const next = advanceFramePlayback(playback, deltaSeconds * 1000);
    this.framePlayback = next;

    if (next.frameIndex !== playback.frameIndex) {
      this.showFrame(next.frameIndex);
      const onEvent = this.framePlaybackOnEvent;
      if (onEvent) {
        for (const event of frameEventsBetween(
          this.framePlaybackEvents,
          playback.frameIndex,
          next.frameIndex
        )) {
          onEvent(event);
        }
      }
    }

    if (next.done) {
      // holdLast keeps the sprite on the final frame; resolve the action promise.
      const finished = token;
      this.clearFramePlayback();
      this.cancellation.resolveActive(finished);
    }
  }

  onDestroy(): void {
    this.stopWalkTween();
    this.cancellation.destroy();
  }

  private startFramePlayback(
    actionId: LemmyFrameActionId,
    frames: SpriteFrame[],
    token: LemmyActionToken,
    onEvent?: (event: LemmyActorEvent) => void
  ): void {
    this.framePlaybackFrames = frames;
    this.framePlayback = createFramePlayback(actionId, frames.length);
    this.framePlaybackToken = token;
    this.framePlaybackOnEvent = onEvent ?? null;
    // Clamp each beat to the loaded frame count: an out-of-range frameIndex (e.g. reach
    // re-extracted shorter than the configured apex) fires on the last frame instead of
    // never — late, but no soft-lock. LemmyFrameAssets guard test keeps it in range.
    const lastFrame = frames.length - 1;
    this.framePlaybackEvents = (LEMMY_FRAME_ACTIONS[actionId].events ?? []).map((entry) =>
      entry.frameIndex <= lastFrame ? entry : { ...entry, frameIndex: lastFrame }
    );
    this.fitSpriteToFrame(frames[0]);
    this.showFrame(0);
  }

  private clearFramePlayback(): void {
    this.framePlayback = null;
    this.framePlaybackToken = null;
    this.framePlaybackOnEvent = null;
    this.framePlaybackFrames = [];
    this.framePlaybackEvents = [];
  }

  /** Stop & forget the walk position tween so an interrupted/destroyed walk stops sliding. */
  private stopWalkTween(): void {
    this.walkTween?.stop();
    this.walkTween = null;
  }

  private showFrame(index: number): void {
    const frame = this.framePlaybackFrames[index];
    if (this.sprite && frame) this.sprite.spriteFrame = frame;
  }

  /** Mirror the sprite horizontally. Walk frames face left, so flip=true makes Lemmy face right. */
  private setFacingFlip(flip: boolean): void {
    this.spriteNode?.setScale(flip ? -1 : 1, 1, 1);
  }

  /**
   * Size contentSize to the frame's TRIMMED content aspect (512² frame canvases are square,
   * canonical is tall), so Cocos sizeMode CUSTOM stretch-to-fill doesn't distort it.
   */
  private fitSpriteToFrame(frame: SpriteFrame, scale = 1): void {
    const box = this.sprite?.node.getComponent(UITransform);
    if (!box) return;
    const rect = frame.rect;
    const real = rect && rect.width > 0 && rect.height > 0 ? rect : spriteFrameSize(frame);
    const fitted = aspectContentSize(
      real.width,
      real.height,
      this.displaySize.width * scale,
      this.displaySize.height * scale,
      "contain"
    );
    box.setContentSize(fitted.width, fitted.height);
  }

  private loadFrames(actionId: LemmyFrameActionId): Promise<SpriteFrame[]> {
    const cached = this.frameCache.get(actionId);
    if (cached) return Promise.resolve(cached);

    const { dir } = LEMMY_FRAME_ACTIONS[actionId];
    return new Promise<SpriteFrame[]>((resolve, reject) => {
      resources.loadDir(dir, SpriteFrame, (error, frames) => {
        if (error) {
          reject(error);
          return;
        }
        if (!frames || frames.length === 0) {
          reject(new Error(`No frames for Lemmy action "${actionId}" at ${dir}`));
          return;
        }
        const sorted = [...frames].sort((a, b) =>
          a.name < b.name ? -1 : a.name > b.name ? 1 : 0
        );
        this.frameCache.set(actionId, sorted);
        resolve(sorted);
      });
    });
  }

  private mountCanonicalSprite(): Node {
    const node = new Node("LemmyCanonical");
    node.active = true;
    node.setPosition(0, 0, 0);
    node.setRotationFromEuler(0, 0, 0);
    this.node.addChild(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(this.displaySize.width, this.displaySize.height);

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.sprite = sprite;
    return node;
  }

  private loadSpriteFrame(resourcePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      resources.load(resourcePath, SpriteFrame, (error, spriteFrame) => {
        if (error) {
          reject(error);
          return;
        }
        if (this.sprite && spriteFrame) {
          // 初始站姿显示定妆帧; 按裁剪后内容比例设框(见 fitSpriteToFrame): 定妆图竖长,
          // 防止 sizeMode CUSTOM 把它横向拉宽。idle/walk 等帧动作一播即覆盖此帧。
          this.sprite.spriteFrame = spriteFrame;
          this.fitSpriteToFrame(spriteFrame, CANONICAL_FIT_SCALE);
        }
        resolve();
      });
    });
  }
}
