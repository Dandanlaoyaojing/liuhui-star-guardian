import {
  _decorator,
  BoxCollider2D,
  Component,
  EventTouch,
  Node,
  RigidBody2D,
  ERigidBody2DType,
  Sprite,
  SpriteFrame,
  Size,
  UITransform,
  Vec2,
  Vec3,
  resources,
  tween
} from "cc";

import {
  getM01GreyboxRuntimeIntroResource,
  getM01GreyboxRuntimeLemmyResource
} from "./M01GreyboxArt.ts";
import {
  M01_INTRO_BASKET_INNER_CAVITY,
  M01_INTRO_BASKET_INNER_CAVITY_WALLS,
  M01_INTRO_BASKET_DISPLAY_SIZE,
  M01_INTRO_BASKET_PILE_OFFSETS
} from "./M01IntroLayout.ts";
import { LemmyActor, isExpectedLemmyActionCancel } from "./LemmyActor.ts";
import { nextIntroPhase, type M01IntroEvent, type M01IntroPhase } from "./M01IntroFlow.ts";

const { ccclass } = _decorator;

/**
 * Opening sequence (diegetic "捡到式" intro, spec §5.2). A shallow wide-mouth tray hangs
 * from two ropes. The REAL 9 puzzle-piece nodes sit inside it. Phase machine lives in
 * M01IntroFlow (pure); this component only drives the cc animations and feeds events in.
 *
 * Flow (Task 3b — through spill; flashlight bonk/pickup added in Task 4/5):
 *   approaching       — Lemmy AUTO-walks in toward the big nut (no tap needed)
 *   observing         — stops, looks at the basket; WAITS for the player to tap the basket
 *   reaching          — (basket tapped) tiptoes / reaches up; emits reach_contact
 *   tipping           — basket wobbles, then tilts
 *   spillingFragments — pieces reparent to root + gain gravity; onSpill fires; onSettled fires
 *
 * Lemmy now STAYS on stage after the spill (he will pick up the flashlight and become the
 * player-controlled beam in later tasks) — the old "walk off to the right" exit is removed.
 */

const GROUND_Y = -270;

// Lemmy display + waypoints.
const LEMMY_DISPLAY = { width: 180, height: 180 };
const LEMMY_OFFSCREEN_X = -460; // left edge entry
const LEMMY_UNDER_BASKET_X = 290; // stands just left of basket bottom
const LEMMY_Y = GROUND_Y + LEMMY_DISPLAY.height / 2 - 10;

// Shallow wide tray basket suspended beneath the flashlight beam anchor (360, 110).
const BASKET_DISPLAY = M01_INTRO_BASKET_DISPLAY_SIZE;
const BASKET_X = 360;
const BASKET_Y = -20; // mid-canvas, below flashlight

// Basket mouth in world coords once tipped — used as a fallback drop origin
// if some fragment lacks a body.
const BASKET_MOUTH_X = BASKET_X - 30;
const BASKET_MOUTH_Y = BASKET_Y - 30;

// Two ropes hang from the basket's left+right rim-tie attachments up toward
// the flashlight body.
const ROPE_DISPLAY = { width: 18, height: 220 };
const ROPE_BOTTOM_Y_OFFSET = -4;
const ROPE_HORIZONTAL_OFFSET = BASKET_DISPLAY.width / 2 - 8;
const ROPE_LEFT_X = BASKET_X - ROPE_HORIZONTAL_OFFSET;
const ROPE_RIGHT_X = BASKET_X + ROPE_HORIZONTAL_OFFSET;
const ROPE_CENTER_Y = BASKET_Y + ROPE_BOTTOM_Y_OFFSET + ROPE_DISPLAY.height / 2;

// Timing (seconds).
const WALK_TO_BASKET_DURATION = 7.2; // 走入前进速度再次减半(1.8→3.6→7.2); 走路帧 fps 不变, 步频照旧
const BASKET_WOBBLE_DURATION = 0.14;
const BASKET_TIP_DURATION = 0.45;

const BASKET_TIP_ANGLE_DEG = -68; // tilts left so mouth faces lower-left

export interface M01IntroFragment {
  /** The real M01 puzzle-piece node managed by the bootstrap. */
  node: Node;
}

export interface M01IntroSequenceOptions {
  /** All 9 game-piece nodes that should sit inside the basket and spill out on tip. */
  fragments: M01IntroFragment[];
  /** Called when the basket has tipped and pieces are released to the greybox root. */
  onSpill: (originX: number, originY: number) => void;
  /** Called once the pieces have spilled and the puzzle workspace is live. */
  onSettled: () => void;
}

type SpriteKey = "basketHanging" | "basketTipped" | "basketFrontOccluder" | "rope";

@ccclass("M01IntroSequence")
export class M01IntroSequence extends Component {
  private options: M01IntroSequenceOptions | null = null;
  private phase: M01IntroPhase = "approaching";
  private lemmyActor: LemmyActor | null = null;
  private lemmyReady: Promise<void> = Promise.resolve();
  private basketSprite: Sprite | null = null;
  private basketFrontOccluderSprite: Sprite | null = null;
  private basketNode: Node | null = null;
  private basketInnerCavityNodes: Node[] = [];
  private ropeLeftNode: Node | null = null;
  private ropeRightNode: Node | null = null;
  private spriteFrames: Partial<Record<SpriteKey, SpriteFrame>> = {};
  private basketInnerCavityDestroyTimer: ReturnType<typeof setTimeout> | undefined;

  init(options: M01IntroSequenceOptions): void {
    this.options = options;
    this.spawnBasket();
    this.spawnBasketInnerCavity();
    this.spawnLemmy();
    this.stageFragmentsInBasket();
    this.loadSpriteFrames();
    // Lemmy walks in on his own; the player's first action is tapping the basket.
    void this.beginWalk();
  }

  /** Apply an intro event through the pure phase machine. Returns true if the phase changed. */
  private advance(event: M01IntroEvent): boolean {
    const next = nextIntroPhase(this.phase, event);
    if (next === this.phase) return false;
    this.phase = next;
    return true;
  }

  private spawnRopes(): void {
    const spawnOne = (name: string, x: number): Node => {
      const node = new Node(name);
      node.setPosition(x, ROPE_CENTER_Y, 0);
      this.node.addChild(node);

      const transform = node.addComponent(UITransform);
      transform.setContentSize(ROPE_DISPLAY.width, ROPE_DISPLAY.height);

      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      (node as Node & { __sprite?: Sprite }).__sprite = sprite;
      return node;
    };
    this.ropeLeftNode = spawnOne("M01IntroRopeLeft", ROPE_LEFT_X);
    this.ropeRightNode = spawnOne("M01IntroRopeRight", ROPE_RIGHT_X);
  }

  private spawnBasket(): void {
    const node = new Node("M01IntroBasket");
    node.setPosition(BASKET_X, BASKET_Y, 0);
    this.node.addChild(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(BASKET_DISPLAY.width, BASKET_DISPLAY.height);

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    node.on(Node.EventType.TOUCH_END, this.handleBasketTap, this);

    this.basketNode = node;
    this.basketSprite = sprite;
  }

  private spawnBasketInnerCavity(): void {
    if (!this.basketNode) return;
    this.destroyBasketInnerCavity();

    for (const wall of M01_INTRO_BASKET_INNER_CAVITY_WALLS) {
      const node = new Node(`M01IntroBasketInnerCavity_${wall.id}`);
      node.setPosition(wall.center.x, wall.center.y, 0);
      node.setRotationFromEuler(0, 0, wall.angleDeg);
      this.basketNode.addChild(node);

      const transform = node.addComponent(UITransform);
      transform.setContentSize(wall.size.width, wall.size.height);

      const body = node.addComponent(RigidBody2D);
      body.type = ERigidBody2DType.Static;
      body.gravityScale = 0;

      const collider = node.addComponent(BoxCollider2D);
      collider.size = new Size(wall.size.width, wall.size.height);
      collider.offset = new Vec2(0, 0);
      collider.friction = M01_INTRO_BASKET_INNER_CAVITY.wallFriction;
      collider.restitution = M01_INTRO_BASKET_INNER_CAVITY.wallRestitution;
      collider.density = 1;
      collider.apply();

      this.basketInnerCavityNodes.push(node);
    }
  }

  private spawnBasketFrontOccluder(): void {
    if (!this.basketNode) return;
    const node = new Node("M01IntroBasketFrontOccluder");
    node.setPosition(0, 0, 0);
    this.basketNode.addChild(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(BASKET_DISPLAY.width, BASKET_DISPLAY.height);

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.basketFrontOccluderSprite = sprite;
  }

  /**
   * Stage the 9 REAL game-piece nodes inside the basket: activate them,
   * parent them to the basket so they tip with it, position each at its
   * BASKET_PILE_OFFSETS slot. The offsets are a deterministic physical stack
   * inside the basket inner cavity: no staged pieces overlap, and only the
   * upper 4-5 caps remain visible once the front-wall occluder is drawn.
   */
  private stageFragmentsInBasket(): void {
    if (!this.options || !this.basketNode) return;
    const fragments = this.options.fragments;
    for (let i = 0; i < fragments.length; i += 1) {
      const slot = M01_INTRO_BASKET_PILE_OFFSETS[i % M01_INTRO_BASKET_PILE_OFFSETS.length];
      const frag = fragments[i].node;
      frag.parent = this.basketNode;
      frag.setPosition(slot.x, slot.y, 0);
      frag.active = false;

      const body = frag.getComponent(RigidBody2D);
      if (body) {
        body.type = ERigidBody2DType.Static;
        body.linearVelocity = new Vec2(0, 0);
        body.angularVelocity = 0;
      }
    }
  }

  /**
   * Release all 9 game-piece nodes from the basket: capture each piece's
   * current world position (after the basket has tipped), reparent it to the
   * greybox root (the basket's parent), restore the world position, then
   * defer to the bootstrap's onSpill callback which kicks the physics pile
   * with releaseInPlace=true.
   */
  private releaseFragmentsFromBasket(): void {
    if (!this.options || !this.basketNode) return;
    const greyboxRoot = this.basketNode.parent;
    if (!greyboxRoot) return;
    for (const frag of this.options.fragments) {
      const node = frag.node;
      node.active = true;
      const worldPos = node.worldPosition.clone();
      const worldAngleZ = this.basketNode.eulerAngles.z + node.eulerAngles.z;
      node.parent = greyboxRoot;
      node.setWorldPosition(worldPos);
      node.setRotationFromEuler(0, 0, worldAngleZ);
    }
  }

  private spawnLemmy(): void {
    const node = new Node("M01IntroLemmy");
    node.setPosition(LEMMY_OFFSCREEN_X, LEMMY_Y, 0);
    this.node.addChild(node);

    const actor = node.addComponent(LemmyActor);
    this.lemmyReady = actor.init({
      displaySize: LEMMY_DISPLAY,
      resourcePath: getM01GreyboxRuntimeLemmyResource("lemmy_canonical")?.resourcesLoadPath
    });

    this.lemmyActor = actor;
  }

  private loadSpriteFrames(): void {
    const ropeLeftSprite = (this.ropeLeftNode as (Node & { __sprite?: Sprite }) | null)?.__sprite ?? null;
    const ropeRightSprite = (this.ropeRightNode as (Node & { __sprite?: Sprite }) | null)?.__sprite ?? null;

    const tryApply = (key: SpriteKey, sprite: Sprite | null) => {
      const frame = this.spriteFrames[key];
      if (!frame) return;
      if (sprite) sprite.spriteFrame = frame;
      if (key === "rope") {
        if (ropeLeftSprite) ropeLeftSprite.spriteFrame = frame;
        if (ropeRightSprite) ropeRightSprite.spriteFrame = frame;
      }
    };

    // Each art slot maps to a manifest entry in M01GreyboxArt — same registry
    // that already owns the gear, flashlight, filters, etc.
    const slots: Array<{
      manifestId: Parameters<typeof getM01GreyboxRuntimeIntroResource>[0];
      key: SpriteKey;
      sprite: Sprite | null;
    }> = [
      { manifestId: "intro_basket_hanging", key: "basketHanging", sprite: this.basketSprite },
      { manifestId: "intro_basket_tipped", key: "basketTipped", sprite: null },
      {
        manifestId: "intro_basket_front_occluder",
        key: "basketFrontOccluder",
        sprite: this.basketFrontOccluderSprite
      },
      { manifestId: "intro_rope_segment", key: "rope", sprite: ropeLeftSprite }
    ];

    for (const slot of slots) {
      const manifestEntry = getM01GreyboxRuntimeIntroResource(slot.manifestId);
      if (!manifestEntry) continue;
      resources.load(manifestEntry.resourcesLoadPath, SpriteFrame, (error, spriteFrame) => {
        if (error || !spriteFrame) return;
        this.spriteFrames[slot.key] = spriteFrame;
        tryApply(slot.key, slot.sprite);
      });
    }
  }

  /** Player taps the basket. Only advances observing → reaching (ignored before Lemmy arrives). */
  private handleBasketTap(_event: EventTouch): void {
    if (this.advance("basketTapped")) {
      void this.beginReach();
    }
  }

  /** Lemmy auto-walks to the basket, then stands and looks at it, waiting for the player tap. */
  private async beginWalk(): Promise<void> {
    if (!this.lemmyActor) return;
    try {
      await this.lemmyReady;
      await this.lemmyActor.walkTo(new Vec3(LEMMY_UNDER_BASKET_X, LEMMY_Y, 0), {
        durationMs: WALK_TO_BASKET_DURATION * 1000
      });
      this.advance("walkArrived"); // approaching → observing
      this.lemmyActor.playIdle(); // 站定待机循环, 等玩家点篮(不 await: idle 是循环)
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    }
  }

  private async beginReach(): Promise<void> {
    if (!this.lemmyActor) return;
    try {
      await this.lemmyActor.playFrameAction("reach", {
        onEvent: (event) => {
          if (event === "reach_contact" && this.advance("reachContact")) {
            this.wobbleBasket();
          }
        }
      });
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    }
  }

  private wobbleBasket(): void {
    if (!this.basketNode) return;
    tween(this.basketNode)
      .to(BASKET_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, -12) })
      .to(BASKET_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, 14) })
      .to(BASKET_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, -8) })
      .to(BASKET_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, 6) })
      .call(() => this.commitTip())
      .start();
  }

  private commitTip(): void {
    if (!this.basketNode) return;
    tween(this.basketNode)
      .to(
        BASKET_TIP_DURATION,
        { eulerAngles: new Vec3(0, 0, BASKET_TIP_ANGLE_DEG) },
        { easing: "quadOut" }
      )
      .call(() => {
        if (this.advance("tipped")) this.startSpill();
      })
      .start();
  }

  private startSpill(): void {
    // Reparent the 9 real pieces back to the greybox root (preserving world
    // positions captured AFTER the basket tip), then signal the bootstrap.
    this.swapSprite(this.basketSprite, "basketTipped");
    this.releaseFragmentsFromBasket();
    if (this.options) {
      this.options.onSpill(BASKET_MOUTH_X, BASKET_MOUTH_Y);
      this.destroyBasketInnerCavityAfterReleaseGuide();
      // Lemmy stays on stage (no exit walk). The workspace is live once pieces spill.
      this.options.onSettled();
    }
  }

  private destroyBasketInnerCavityAfterReleaseGuide(): void {
    this.clearBasketInnerCavityDestroyTimer();
    this.basketInnerCavityDestroyTimer = setTimeout(() => {
      this.basketInnerCavityDestroyTimer = undefined;
      this.destroyBasketInnerCavity();
    }, M01_INTRO_BASKET_INNER_CAVITY.releaseGuideMs);
  }

  private destroyBasketInnerCavity(): void {
    this.clearBasketInnerCavityDestroyTimer();
    for (const node of this.basketInnerCavityNodes) {
      node.destroy();
    }
    this.basketInnerCavityNodes.length = 0;
  }

  private clearBasketInnerCavityDestroyTimer(): void {
    if (this.basketInnerCavityDestroyTimer === undefined) {
      return;
    }
    clearTimeout(this.basketInnerCavityDestroyTimer);
    this.basketInnerCavityDestroyTimer = undefined;
  }

  private swapSprite(sprite: Sprite | null, key: SpriteKey): void {
    if (!sprite) return;
    const frame = this.spriteFrames[key];
    if (frame) sprite.spriteFrame = frame;
  }

  onDestroy(): void {
    this.destroyBasketInnerCavity();
  }
}
