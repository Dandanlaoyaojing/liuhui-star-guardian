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
  createLemmyCancellationContext,
  estimateLemmyActionDurationMs,
  isExpectedLemmyActionCancel,
  type LemmyActionId,
  type LemmyActionScheduleEntry,
  type LemmyActorEvent
} from "./LemmyActorContract.ts";

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

  async playAction(actionId: LemmyActionId, options: LemmyPlayOptions = {}): Promise<void> {
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
        }
        resolve();
      });
    });
  }

  private playPose(actionId: LemmyActionId, atMs: number): void {
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

  private nearestScheduleEntry(actionId: LemmyActionId, atMs: number): LemmyActionScheduleEntry {
    const schedule = LEMMY_ACTION_SCHEDULES[actionId].keyframes;
    return [...schedule]
      .reverse()
      .find((entry) => entry.atMs <= atMs) ?? schedule[0];
  }
}
