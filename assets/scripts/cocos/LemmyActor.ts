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

import {
  LEMMY_ACTION_SCHEDULES,
  LEMMY_FRAME_ACTIONS,
  advanceFramePlayback,
  createFramePlayback,
  createLemmyCancellationContext,
  estimateLemmyActionDurationMs,
  isExpectedLemmyActionCancel,
  type LemmyActionScheduleEntry,
  type LemmyActionToken,
  type LemmyActorEvent,
  type LemmyFrameActionId,
  type LemmyFramePlaybackState,
  type LemmyTransformActionId
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

export interface LemmyPlayOptions {
  onEvent?: (event: LemmyActorEvent) => void;
  loop?: boolean;
}

export {
  LEMMY_APPROVED_IDENTITY_SOURCE,
  LEMMY_CLEAN_MASTER_PATH,
  createLemmyCancellationContext,
  estimateLemmyActionDurationMs,
  getLemmyTransformSchedule,
  isExpectedLemmyActionCancel,
  LemmyActionInterrupted,
  LemmyActorDestroyed
} from "./LemmyActorContract.ts";

const DEFAULT_DISPLAY_SIZE = { width: 180, height: 180 };
const DEFAULT_LEMMY_RESOURCE_PATH = "art/characters/lemmy/lemmy-canonical/spriteFrame";
// 定妆图(canonical)是紧贴兔子的裁剪→贴合后填满显示框高; 走路帧是 384² 画布、兔子只占约 85% 高。
// 把定妆图按此系数缩小, 让站立尺寸与走路一致(用户偏好走路尺寸)。约 = 走路帧兔子高(328)/画布(384)。
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
  private canonicalFrame: SpriteFrame | null = null;

  init(options: LemmyActorOptions = {}): Promise<void> {
    this.displaySize = options.displaySize ?? DEFAULT_DISPLAY_SIZE;
    this.node.addComponent(UITransform).setContentSize(this.displaySize.width, this.displaySize.height);

    this.spriteNode = this.mountCanonicalSprite();
    this.readyPromise = this.loadSpriteFrame(options.resourcePath ?? DEFAULT_LEMMY_RESOURCE_PATH);

    return this.readyPromise;
  }

  playIdle(): void {
    void this.playAction("idle_right").catch((error) => {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    });
  }

  async walkTo(target: Vec3, options: LemmyWalkOptions = {}): Promise<void> {
    await this.readyPromise;
    const frames = await this.loadFrames("walk");
    const handle = this.cancellation.beginAction("walk");

    // Walk frames are authored facing LEFT; mirror (scaleX -1) to walk right.
    const movingRight = target.x > this.node.position.x;
    this.setFacingFlip(movingRight);

    // Loop the walk cycle (driven by update()) while the node slides to the target.
    this.framePlaybackFrames = frames;
    this.framePlayback = createFramePlayback("walk", frames.length);
    this.framePlaybackToken = handle.token;
    this.fitSpriteToFrame(frames[0]);
    this.showFrame(0);

    tween(this.node)
      .to(
        (options.durationMs ?? estimateLemmyActionDurationMs("walk_right")) / 1000,
        { position: target },
        // 走路要匀速(像真人走), 不能用缓动——sineInOut 会"头慢中间快尾慢", 看着忽快忽慢。
        { easing: "linear" }
      )
      .call(() => {
        // Arrived: stop the walk loop and return to the canonical standing sprite.
        this.framePlayback = null;
        this.framePlaybackToken = null;
        this.showCanonical();
        this.cancellation.resolveActive(handle.token);
      })
      .start();
    return handle.promise;
  }

  async playAction(actionId: LemmyTransformActionId, options: LemmyPlayOptions = {}): Promise<void> {
    await this.readyPromise;
    const handle = this.cancellation.beginAction(actionId);
    // Transform actions animate the canonical sprite — restore it in case a frame action ran last.
    this.showCanonical();
    const schedule = LEMMY_ACTION_SCHEDULES[actionId].keyframes;
    const durationMs = estimateLemmyActionDurationMs(actionId);

    this.playPose(actionId, 0);

    let chain = tween(this.node);
    let previousAtMs = 0;
    for (const entry of schedule.slice(1)) {
      const deltaMs = entry.atMs - previousAtMs;
      if (deltaMs > 0) {
        chain = chain.delay(deltaMs / 1000);
      }
      chain = chain.call(() => {
        this.playPose(actionId, entry.atMs);
        if (entry.event) options.onEvent?.(entry.event);
      });
      previousAtMs = entry.atMs;
    }

    const remainingMs = Math.max(0, durationMs - previousAtMs);
    if (remainingMs > 0) {
      chain = chain.delay(remainingMs / 1000);
    }

    chain
      .call(() => {
        this.playPose(actionId, durationMs);
        this.cancellation.resolveActive(handle.token);
      })
      .start();

    return handle.promise;
  }

  /**
   * Play a loaded frame sequence (startle / crouch) as a one-shot. Resolves when the
   * sequence completes (holdLast leaves the sprite on the final frame), or rejects if
   * interrupted by another action / actor destruction (same contract as playAction).
   */
  async playFrameAction(
    actionId: LemmyFrameActionId,
    options: { facing?: "left" | "right" } = {}
  ): Promise<void> {
    await this.readyPromise;
    const frames = await this.loadFrames(actionId);
    const handle = this.cancellation.beginAction(actionId);

    if (options.facing) this.setFacingFlip(options.facing === "right");

    this.framePlaybackFrames = frames;
    this.framePlayback = createFramePlayback(actionId, frames.length);
    this.framePlaybackToken = handle.token;
    this.fitSpriteToFrame(frames[0]);
    this.showFrame(0);

    return handle.promise;
  }

  update(deltaSeconds: number): void {
    const playback = this.framePlayback;
    const token = this.framePlaybackToken;
    if (!playback || !token) return;

    if (!token.isActive) {
      // Superseded by another action (beginAction already rejected this promise).
      this.framePlayback = null;
      this.framePlaybackToken = null;
      return;
    }

    const next = advanceFramePlayback(playback, deltaSeconds * 1000);
    this.framePlayback = next;
    if (next.frameIndex !== playback.frameIndex) this.showFrame(next.frameIndex);

    if (next.done) {
      // holdLast keeps the sprite on the final frame; resolve the action promise.
      this.framePlayback = null;
      this.framePlaybackToken = null;
      this.cancellation.resolveActive(token);
    }
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
   * Size contentSize to the frame's TRIMMED content aspect (canonical → tall; 384² frame
   * canvases → square), so Cocos sizeMode CUSTOM stretch-to-fill doesn't distort it.
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

  /** Restore the standing canonical sprite (un-mirrored) — used when a transform action follows frames. */
  private showCanonical(): void {
    this.setFacingFlip(false);
    if (this.sprite && this.canonicalFrame) {
      this.sprite.spriteFrame = this.canonicalFrame;
      this.fitSpriteToFrame(this.canonicalFrame, CANONICAL_FIT_SCALE);
    }
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

  onDestroy(): void {
    this.cancellation.destroy();
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
          // 缓存定妆帧供 showCanonical 复位; 按裁剪后内容比例设框(见 fitSpriteToFrame):
          // 定妆图竖长, 防止 sizeMode CUSTOM 把它横向拉宽。
          this.canonicalFrame = spriteFrame;
          this.sprite.spriteFrame = spriteFrame;
          this.fitSpriteToFrame(spriteFrame, CANONICAL_FIT_SCALE);
        }
        resolve();
      });
    });
  }

  private playPose(actionId: LemmyTransformActionId, atMs: number): void {
    const entry = this.nearestScheduleEntry(actionId, atMs);
    const node = this.spriteNode;
    if (!node) return;

    node.setPosition(entry.offsetX ?? 0, entry.offsetY ?? 0, 0);
    node.setRotationFromEuler(0, 0, entry.rotateDeg ?? 0);
    (node as Node & { setScale?: (x: number, y?: number, z?: number) => void }).setScale?.(
      entry.scaleX ?? 1,
      entry.scaleY ?? 1,
      1
    );
  }

  private nearestScheduleEntry(actionId: LemmyTransformActionId, atMs: number): LemmyActionScheduleEntry {
    const schedule = LEMMY_ACTION_SCHEDULES[actionId].keyframes;
    return [...schedule]
      .reverse()
      .find((entry) => entry.atMs <= atMs) ?? schedule[0];
  }
}
