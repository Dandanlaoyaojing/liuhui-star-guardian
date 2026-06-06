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
  M01_INTRO_BASKET_PILE_OFFSETS,
  M01_INTRO_BASKET_SCALE
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
const CANVAS_HALF_WIDTH = 480; // canvas is 960 wide; screen→world X = getUILocation().x - 480
const CANVAS_HEIGHT = 640;
// Three player-driven walk stops (canvas X∈[-480,480]; platform/big-nut at 0, basket at 360):
const LEMMY_PLATFORM_FRONT_X = -320; // ① auto-walks in, stops in front of the platform
const LEMMY_MID_X = 220; // ② after the player taps right, walks to the platform↔basket midpoint
const LEMMY_UNDER_BASKET_X = 265; // ③ after the player taps the basket, walks the last bit here, then reaches
const LEMMY_Y = GROUND_Y + LEMMY_DISPLAY.height / 2 - 10;

// Shallow wide tray basket suspended beneath the flashlight beam anchor (360, 110).
const BASKET_DISPLAY = M01_INTRO_BASKET_DISPLAY_SIZE;
const BASKET_X = 360;
// Anchor the basket SPRITE bottom here (≈ the bowl bottom). Enlarging the basket
// (M01_INTRO_BASKET_SCALE) then grows it UPWARD from this line, keeping Lemmy's
// reach-to-the-bowl-bottom intact. (At scale 1.0 this is the old hand-tuned -61.)
const BASKET_SPRITE_BOTTOM_Y = -182;
const BASKET_Y = BASKET_SPRITE_BOTTOM_Y + BASKET_DISPLAY.height / 2;

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
// Keep that tuned slow pace across all three walk segments (px/s); per-segment duration = distance / speed.
const LEMMY_WALK_SPEED = (LEMMY_UNDER_BASKET_X - LEMMY_OFFSCREEN_X) / WALK_TO_BASKET_DURATION;
const walkSegmentMs = (fromX: number, toX: number): number =>
  (Math.abs(toX - fromX) / LEMMY_WALK_SPEED) * 1000;
// Nail sits ~105px above the basket sprite's center (sprite anchorY≈0.934 of a 242-tall display).
// The wobble/tip pivot is placed here so the basket swings from the nail, nail itself fixed.
const BASKET_NAIL_OFFSET_Y = 105 * M01_INTRO_BASKET_SCALE;
const BASKET_WOBBLE_DURATION = 0.4; // 慢: 每半摆 0.4s(原0.14太快); 第一次轻碰只是慢慢荡
const BASKET_TIP_WOBBLE_DURATION = 0.18; // 第二次打翻的摇晃更有力(快些), 然后倾倒
const BASKET_TIP_DURATION = 0.45;
// Time for the dropped standard-size pieces to settle into a physics heap inside the
// basket cavity before we freeze them Static (so the pile rides rigidly with the swing).
// The slow Lemmy walk-in covers this, so the player never sees them mid-settle.
const BASKET_PILE_SETTLE_MS = 900;

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
  // Fixed pivot at the nail (top of the hanging-basket sprite). The basket hangs as a child
  // and swings/tips about this point, so the painted nail stays put — only the basket below moves.
  private basketPivotNode: Node | null = null;
  private basketInnerCavityNodes: Node[] = [];
  private ropeLeftNode: Node | null = null;
  private ropeRightNode: Node | null = null;
  private spriteFrames: Partial<Record<SpriteKey, SpriteFrame>> = {};
  private basketInnerCavityDestroyTimer: ReturnType<typeof setTimeout> | undefined;
  private basketPileFreezeTimer: ReturnType<typeof setTimeout> | undefined;
  private advanceCatcherNode: Node | null = null;

  init(options: M01IntroSequenceOptions): void {
    this.options = options;
    this.spawnAdvanceTapCatcher();
    this.spawnBasket();
    this.spawnBasketInnerCavity();
    this.spawnLemmy();
    this.stageFragmentsInBasket();
    // Front-wall occluder LAST so it is the topmost child of the basket and draws
    // over the staged pieces' lower halves (the "pieces tucked inside" look).
    this.spawnBasketFrontOccluder();
    this.loadSpriteFrames();
    // Warm the non-walk frame sequences during the (slow) walk-in so the reach has no load hitch.
    void this.lemmyReady.then(() => {
      const actor = this.lemmyActor;
      if (!actor) return;
      void actor.preloadFrames("reach");
      void actor.preloadFrames("startle");
      void actor.preloadFrames("crouch");
    });
    // Lemmy walks in on his own; the player drives the rest with taps.
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

  /** Full-canvas invisible tap catcher (below the basket/Lemmy) for the "tap right side to walk on" beat. */
  private spawnAdvanceTapCatcher(): void {
    const node = new Node("M01IntroAdvanceTapCatcher");
    node.setPosition(0, 0, 0);
    this.node.addChild(node);
    node.addComponent(UITransform).setContentSize(CANVAS_HALF_WIDTH * 2, CANVAS_HEIGHT);
    node.on(Node.EventType.TOUCH_END, this.handleAdvanceTap, this);
    this.advanceCatcherNode = node;
  }

  private spawnBasket(): void {
    // Fixed nail pivot; the basket hangs below it so wobble/tip swing about the nail.
    const pivot = new Node("M01IntroBasketPivot");
    pivot.setPosition(BASKET_X, BASKET_Y + BASKET_NAIL_OFFSET_Y, 0);
    this.node.addChild(pivot);
    this.basketPivotNode = pivot;

    const node = new Node("M01IntroBasket");
    // Basket center hangs BASKET_NAIL_OFFSET_Y below the nail → world pos still (BASKET_X, BASKET_Y).
    node.setPosition(0, -BASKET_NAIL_OFFSET_Y, 0);
    pivot.addChild(node);

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
   * Stage the 9 REAL standard-size game-piece nodes as a VISIBLE static heap inside the basket.
   * They sit at M01_INTRO_BASKET_PILE_OFFSETS (a hand-tuned pile: lower rows tucked behind the
   * front-wall occluder, upper 4-5 caps peeking over the rim) and ride rigidly with the swinging
   * basket. On tip they are released to Dynamic and spill (releaseFragmentsFromBasket + startDrop).
   *
   * NOTE: an earlier attempt dropped them Dynamic to "physics-stack" — but they fell straight
   * THROUGH the cavity to the floor (the runtime cavity walls didn't catch them), so the basket
   * showed empty. A static hand-placed heap reliably reads as "pieces stacked in the basket".
   */
  private stageFragmentsInBasket(): void {
    if (!this.options || !this.basketNode) return;
    const fragments = this.options.fragments;
    for (let i = 0; i < fragments.length; i += 1) {
      const slot = M01_INTRO_BASKET_PILE_OFFSETS[i % M01_INTRO_BASKET_PILE_OFFSETS.length];
      const frag = fragments[i].node;
      frag.parent = this.basketNode;
      frag.setPosition(slot.x, slot.y, 0);
      frag.active = true; // REAL pieces, dropped into the basket as a physics pile

      const body = frag.getComponent(RigidBody2D);
      if (body) {
        body.type = ERigidBody2DType.Dynamic; // fall + settle into a touching heap (sloped walls funnel them)
        body.gravityScale = 1;
        body.linearVelocity = new Vec2(0, 0);
        body.angularVelocity = 0;
      }
    }
    this.scheduleBasketPileFreeze(); // once settled, freeze Static so the heap rides the swinging basket
  }

  /** After the dropped pieces settle, freeze them Static so the pile swings rigidly. */
  private scheduleBasketPileFreeze(): void {
    this.clearBasketPileFreezeTimer();
    this.basketPileFreezeTimer = setTimeout(() => {
      this.basketPileFreezeTimer = undefined;
      this.freezeBasketPile();
    }, BASKET_PILE_SETTLE_MS);
  }

  private freezeBasketPile(): void {
    if (!this.options) return;
    for (const frag of this.options.fragments) {
      const body = frag.node.getComponent(RigidBody2D);
      if (body) {
        body.type = ERigidBody2DType.Static;
        body.linearVelocity = new Vec2(0, 0);
        body.angularVelocity = 0;
      }
    }
  }

  private clearBasketPileFreezeTimer(): void {
    if (this.basketPileFreezeTimer === undefined) return;
    clearTimeout(this.basketPileFreezeTimer);
    this.basketPileFreezeTimer = undefined;
  }

  /**
   * Release all 9 game-piece nodes from the basket: capture each piece's
   * current world position (after the basket has tipped), reparent it to the
   * greybox root (the basket's parent), restore the world position, then
   * defer to the bootstrap's onSpill callback which kicks the physics pile
   * with releaseInPlace=true.
   */
  private releaseFragmentsFromBasket(): void {
    if (!this.options || !this.basketNode || !this.basketPivotNode) return;
    // Reparent to the PIVOT's parent (the greybox root) — basketNode.parent is now the pivot.
    const greyboxRoot = this.basketPivotNode.parent;
    if (!greyboxRoot) return;
    // The swing/tip rotation lives on the pivot (basket's own local angle stays 0), so each
    // piece's world angle = pivot angle + the piece's local angle.
    const pivotAngleZ = this.basketPivotNode.eulerAngles.z;
    for (const frag of this.options.fragments) {
      const node = frag.node;
      node.active = true;
      const worldPos = node.worldPosition.clone();
      const worldAngleZ = pivotAngleZ + node.eulerAngles.z;
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

  /** Player taps the basket. 1st tap (observing→reaching) gently nudges; 2nd tap (nudged→tipping) tips it. */
  private handleBasketTap(_event: EventTouch): void {
    if (!this.advance("basketTapped")) return;
    if (this.phase === "reaching") {
      void this.beginReach(); // first contact: gentle sway, no tip
    } else if (this.phase === "tipping") {
      void this.beginTipReach(); // second contact: bigger swing that tips + spills
    }
  }

  /** ① Lemmy auto-walks in and stops in FRONT of the platform; waits for the player to tap the right side. */
  private async beginWalk(): Promise<void> {
    if (!this.lemmyActor) return;
    try {
      await this.lemmyReady;
      await this.lemmyActor.walkTo(new Vec3(LEMMY_PLATFORM_FRONT_X, LEMMY_Y, 0), {
        durationMs: walkSegmentMs(LEMMY_OFFSCREEN_X, LEMMY_PLATFORM_FRONT_X)
      });
      this.advance("walkArrived"); // approaching → atPlatform
      this.lemmyActor.playIdle(); // 站在平台前待机, 等玩家点右侧(不 await: idle 是循环)
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    }
  }

  /** Player taps the right side while at the platform → Lemmy walks on to the midpoint. */
  private handleAdvanceTap(event: EventTouch): void {
    const worldX = event.getUILocation().x - CANVAS_HALF_WIDTH;
    if (worldX <= 0) return; // only a tap on the right half (toward the basket) advances
    if (this.advance("advanceTapped")) {
      this.advanceCatcherNode?.destroy(); // one-shot: gone before the basket-tap / puzzle phases
      this.advanceCatcherNode = null;
      void this.beginWalkToMid();
    }
  }

  /** ② Lemmy walks to the platform↔basket midpoint and stands, waiting for the player to tap the basket. */
  private async beginWalkToMid(): Promise<void> {
    if (!this.lemmyActor) return;
    try {
      await this.lemmyActor.walkTo(new Vec3(LEMMY_MID_X, LEMMY_Y, 0), {
        durationMs: walkSegmentMs(LEMMY_PLATFORM_FRONT_X, LEMMY_MID_X)
      });
      this.advance("walkArrived"); // walkingToMid → observing
      this.lemmyActor.playIdle();
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    }
  }

  /** ③ Player tapped the basket: Lemmy walks the last bit to the reach spot, then tiptoes up. */
  private async beginReach(): Promise<void> {
    if (!this.lemmyActor) return;
    try {
      await this.lemmyActor.walkTo(new Vec3(LEMMY_UNDER_BASKET_X, LEMMY_Y, 0), {
        durationMs: walkSegmentMs(LEMMY_MID_X, LEMMY_UNDER_BASKET_X)
      });
      await this.lemmyActor.playFrameAction("reach"); // tiptoe all the way up; holds at the touch
      // The basket sways at the RELEASE — the instant the reach finishes and Lemmy lowers his paw,
      // NOT mid-reach. First contact only nudges it; it waits for a SECOND tap to actually tip.
      if (this.advance("reachContact")) {
        this.gentleNudgeBasket();
      }
      this.lemmyActor.playIdle(); // paw comes back down (the release) while the basket gently sways
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    }
  }

  /** Second basket tap: Lemmy reaches again and this time swings it hard enough to tip → spill. */
  private async beginTipReach(): Promise<void> {
    if (!this.lemmyActor) return;
    try {
      await this.lemmyActor.playFrameAction("reach"); // already at the basket; reach up again
      this.wobbleAndTipBasket(); // bigger swing → commitTip → spill (advances "tipped")
      this.lemmyActor.playIdle();
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    }
  }

  // Both swing the NAIL PIVOT (not the basket) → pendulum about the nail, nail stays put.
  // Decaying amplitude + sineInOut per half-swing reads as a real damped pendulum.

  /** First contact: gentle, slow, small sway that settles back to rest. Does NOT tip. */
  private gentleNudgeBasket(): void {
    if (!this.basketPivotNode) return;
    tween(this.basketPivotNode)
      .to(BASKET_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, -5) }, { easing: "sineInOut" })
      .to(BASKET_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, 3.5) }, { easing: "sineInOut" })
      .to(BASKET_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, -2) }, { easing: "sineInOut" })
      .to(BASKET_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, 0) }, { easing: "sineInOut" })
      .start();
  }

  /** Second contact: a bigger, more energetic swing that tips the basket over → spill. */
  private wobbleAndTipBasket(): void {
    if (!this.basketPivotNode) return;
    tween(this.basketPivotNode)
      .to(BASKET_TIP_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, -12) }, { easing: "sineInOut" })
      .to(BASKET_TIP_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, 14) }, { easing: "sineInOut" })
      .to(BASKET_TIP_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, -8) }, { easing: "sineInOut" })
      .to(BASKET_TIP_WOBBLE_DURATION, { eulerAngles: new Vec3(0, 0, 6) }, { easing: "sineInOut" })
      .call(() => this.commitTip())
      .start();
  }

  private commitTip(): void {
    if (!this.basketPivotNode) return;
    // Tip about the nail pivot too, so the basket swings over while still hanging from the nail.
    tween(this.basketPivotNode)
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
    // The empty rattan basket simply stays (already rotated by the tip tween) — no
    // swap to a separate "tipped" sprite (the old terracotta basin tile is retired).
    this.clearBasketPileFreezeTimer();
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

  onDestroy(): void {
    this.clearBasketPileFreezeTimer();
    this.destroyBasketInnerCavity();
  }
}
