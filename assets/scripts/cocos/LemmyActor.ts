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
    const handle = this.cancellation.beginAction("walk_right");
    this.playPose("walk_right", 0);
    tween(this.node)
      .to(
        (options.durationMs ?? estimateLemmyActionDurationMs("walk_right")) / 1000,
        { position: target },
        { easing: "sineInOut" }
      )
      .call(() => this.cancellation.resolveActive(handle.token))
      .start();
    return handle.promise;
  }

  async playAction(actionId: LemmyTransformActionId, options: LemmyPlayOptions = {}): Promise<void> {
    await this.readyPromise;
    const handle = this.cancellation.beginAction(actionId);
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

    if (options.facing) this.applyFacing(options.facing);

    this.framePlaybackFrames = frames;
    this.framePlayback = createFramePlayback(actionId, frames.length);
    this.framePlaybackToken = handle.token;
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

  private applyFacing(facing: "left" | "right"): void {
    (
      this.spriteNode as (Node & { setScale?: (x: number, y?: number, z?: number) => void }) | null
    )?.setScale?.(facing === "left" ? -1 : 1, 1, 1);
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
          this.sprite.spriteFrame = spriteFrame;
          // 按贴图真实宽高比重设 contentSize, 防止莱米被拉宽/拉变形。
          const box = this.sprite.node.getComponent(UITransform);
          if (box) {
            // 按【裁剪后】内容比例(frame.rect)设框, 而不是含大量透明留白的方形原图。
            // 莱米定妆图是 2000² 方图、兔子只占居中竖长条(裁剪后约 1051×1926); sizeMode CUSTOM
            // 会把裁剪内容拉伸填满 contentSize, 若按方形原图设成方框就会把竖长的兔子横向拉宽变形。
            const rect = spriteFrame.rect;
            const real =
              rect && rect.width > 0 && rect.height > 0 ? rect : spriteFrameSize(spriteFrame);
            const fitted = aspectContentSize(
              real.width,
              real.height,
              this.displaySize.width,
              this.displaySize.height,
              "contain"
            );
            box.setContentSize(fitted.width, fitted.height);
          }
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
