import {
  _decorator,
  Component,
  EventTouch,
  Node,
  RigidBody2D,
  ERigidBody2DType,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec2,
  Vec3,
  resources,
  tween
} from "cc";

const { ccclass } = _decorator;

/**
 * Opening sequence: a shallow wide-mouth wicker tray hangs from two ropes
 * beneath the flashlight. The REAL 9 puzzle-piece nodes are parented to the
 * basket and sit visibly inside it in their initial pile shape. Player clicks
 * the basket → Lemmy walks under, tiptoes, basket wobbles + tips → the 9
 * pieces are reparented back to the greybox root (preserving world positions)
 * and physics gravity engages on them, so they fall from wherever they
 * happened to be when the basket tipped.
 *
 * Phases:
 *   idle      — Lemmy at left edge; basket holds the 9 pieces upright
 *   walking   — Lemmy tweens toward the position under the basket
 *   reaching  — Lemmy swaps to reaching pose (tiptoe)
 *   tipping   — Basket wobbles, then commits to a tilt
 *   spilling  — Pieces reparent back to root and gain gravity; onSpill fires
 *   exiting   — Lemmy walks to the right side
 *   settled   — onSettled() fires; player can drag pieces
 */

const LEMMY_WALK_PATH = "art/stage1-m01/runtime-sprites/intro/m01-lemmy-walking/spriteFrame";
const LEMMY_REACH_PATH = "art/stage1-m01/runtime-sprites/intro/m01-lemmy-reaching/spriteFrame";
const BASKET_HANGING_PATH = "art/stage1-m01/runtime-sprites/intro/m01-basket-hanging/spriteFrame";
const BASKET_TIPPED_PATH = "art/stage1-m01/runtime-sprites/intro/m01-basket-tipped/spriteFrame";
const ROPE_PATH = "art/stage1-m01/runtime-sprites/intro/m01-rope-segment/spriteFrame";

const GROUND_Y = -270;

// Lemmy display + waypoints.
const LEMMY_DISPLAY = { width: 180, height: 180 };
const LEMMY_OFFSCREEN_X = -460;                    // left edge entry
const LEMMY_UNDER_BASKET_X = 290;                  // stands just left of basket bottom
const LEMMY_WATCHING_X = 470;                      // exits to the right and stands
const LEMMY_Y = GROUND_Y + LEMMY_DISPLAY.height / 2 - 10;

// Shallow wide tray basket suspended beneath the flashlight beam anchor (360, 110).
const BASKET_DISPLAY = { width: 280, height: 190 };
const BASKET_X = 360;
const BASKET_Y = -20;                              // mid-canvas, below flashlight

// Basket mouth in world coords once tipped — used as a fallback drop origin
// if some fragment lacks a body.
const BASKET_MOUTH_X = BASKET_X - 30;
const BASKET_MOUTH_Y = BASKET_Y - 30;

// Two ropes hang from the basket's left+right rim-tie attachments up toward
// the flashlight body. The basket art shows two small rope-tie stubs sticking
// out from the rim; the rope sprites visually connect into those stubs.
const ROPE_DISPLAY = { width: 18, height: 220 };
const ROPE_BOTTOM_Y_OFFSET = -4;
const ROPE_HORIZONTAL_OFFSET = BASKET_DISPLAY.width / 2 - 8;
const ROPE_LEFT_X = BASKET_X - ROPE_HORIZONTAL_OFFSET;
const ROPE_RIGHT_X = BASKET_X + ROPE_HORIZONTAL_OFFSET;
const ROPE_CENTER_Y = BASKET_Y + ROPE_BOTTOM_Y_OFFSET + ROPE_DISPLAY.height / 2;

// Layout for the 9 real game pieces inside the basket (LOCAL to the basket node).
// A flat 4-3-2 spread across the shallow tray interior, visible from the 3/4
// overhead angle. Pieces are 56×56; we keep enough horizontal spacing to avoid
// heavy overlap while still reading as a small pile.
const BASKET_PILE_OFFSETS: ReadonlyArray<{ x: number; y: number }> = [
  // Back row (deeper into tray, higher Y in display)
  { x: -90, y: 22 },
  { x: -30, y: 26 },
  { x:  30, y: 26 },
  { x:  90, y: 22 },
  // Middle row
  { x: -60, y:  4 },
  { x:   0, y:  6 },
  { x:  60, y:  4 },
  // Front row (closer to viewer, lower Y)
  { x: -30, y: -16 },
  { x:  30, y: -16 }
];

// Timing (seconds).
const WALK_TO_BASKET_DURATION = 1.8;
const REACH_HOLD_DURATION = 0.45;
const BASKET_WOBBLE_DURATION = 0.14;
const BASKET_TIP_DURATION = 0.45;
const LEMMY_EXIT_DURATION = 1.4;

const BASKET_TIP_ANGLE_DEG = -68;                  // tilts left so mouth faces lower-left

export interface M01IntroFragment {
  /** The real M01 puzzle-piece node managed by the bootstrap. */
  node: Node;
}

export interface M01IntroSequenceOptions {
  /** All 9 game-piece nodes that should sit inside the basket and spill out on tip. */
  fragments: M01IntroFragment[];
  /** Called when the basket has tipped and pieces are released to the greybox root. */
  onSpill: (originX: number, originY: number) => void;
  /** Called once Lemmy has finished walking to the watching position. */
  onSettled: () => void;
}

type IntroPhase =
  | "idle"
  | "walking"
  | "reaching"
  | "tipping"
  | "spilling"
  | "exiting"
  | "settled";

type SpriteKey =
  | "walking"
  | "reaching"
  | "basketHanging"
  | "basketTipped"
  | "rope";

@ccclass("M01IntroSequence")
export class M01IntroSequence extends Component {
  private options: M01IntroSequenceOptions | null = null;
  private phase: IntroPhase = "idle";
  private lemmySprite: Sprite | null = null;
  private lemmyNode: Node | null = null;
  private basketSprite: Sprite | null = null;
  private basketNode: Node | null = null;
  private ropeLeftNode: Node | null = null;
  private ropeRightNode: Node | null = null;
  private spriteFrames: Partial<Record<SpriteKey, SpriteFrame>> = {};

  init(options: M01IntroSequenceOptions): void {
    this.options = options;
    this.spawnRopes();
    this.spawnBasket();
    this.spawnLemmy();
    this.loadSpriteFrames();
    this.stageFragmentsInBasket();
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

  /**
   * Stage the 9 REAL game-piece nodes inside the basket: activate them,
   * parent them to the basket so they tip with it, position each at its
   * BASKET_PILE_OFFSETS slot, and freeze its physics body so it doesn't
   * react to gravity while sitting in the tray.
   */
  private stageFragmentsInBasket(): void {
    if (!this.options || !this.basketNode) return;
    const fragments = this.options.fragments;
    for (let i = 0; i < fragments.length; i += 1) {
      const slot = BASKET_PILE_OFFSETS[i % BASKET_PILE_OFFSETS.length];
      const frag = fragments[i].node;
      frag.parent = this.basketNode;
      frag.setPosition(slot.x, slot.y, 0);
      frag.active = true;

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
      const worldPos = node.worldPosition.clone();
      node.parent = greyboxRoot;
      node.setWorldPosition(worldPos);
    }
  }

  private spawnLemmy(): void {
    const node = new Node("M01IntroLemmy");
    node.setPosition(LEMMY_OFFSCREEN_X, LEMMY_Y, 0);
    this.node.addChild(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(LEMMY_DISPLAY.width, LEMMY_DISPLAY.height);

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    this.lemmyNode = node;
    this.lemmySprite = sprite;
  }

  private loadSpriteFrames(): void {
    const tryApply = (key: SpriteKey, sprite: Sprite | null) => {
      const frame = this.spriteFrames[key];
      if (frame && sprite) sprite.spriteFrame = frame;
    };

    const loadOne = (path: string, key: SpriteKey, sprite: Sprite | null) => {
      resources.load(path, SpriteFrame, (error, spriteFrame) => {
        if (error || !spriteFrame) return;
        this.spriteFrames[key] = spriteFrame;
        tryApply(key, sprite);
      });
    };

    loadOne(LEMMY_WALK_PATH, "walking", this.lemmySprite);
    loadOne(LEMMY_REACH_PATH, "reaching", null);
    loadOne(BASKET_HANGING_PATH, "basketHanging", this.basketSprite);
    loadOne(BASKET_TIPPED_PATH, "basketTipped", null);

    const ropeLeftSprite = (this.ropeLeftNode as (Node & { __sprite?: Sprite }) | null)?.__sprite ?? null;
    const ropeRightSprite = (this.ropeRightNode as (Node & { __sprite?: Sprite }) | null)?.__sprite ?? null;
    resources.load(ROPE_PATH, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame) return;
      this.spriteFrames.rope = spriteFrame;
      if (ropeLeftSprite) ropeLeftSprite.spriteFrame = spriteFrame;
      if (ropeRightSprite) ropeRightSprite.spriteFrame = spriteFrame;
    });
  }

  private handleBasketTap(_event: EventTouch): void {
    if (this.phase !== "idle") return;
    this.beginWalk();
  }

  private beginWalk(): void {
    if (!this.lemmyNode) return;
    this.phase = "walking";
    tween(this.lemmyNode)
      .to(
        WALK_TO_BASKET_DURATION,
        { position: new Vec3(LEMMY_UNDER_BASKET_X, LEMMY_Y, 0) },
        { easing: "sineInOut" }
      )
      .call(() => this.beginReach())
      .start();
  }

  private beginReach(): void {
    if (!this.lemmyNode || !this.lemmySprite) return;
    this.phase = "reaching";
    this.swapSprite(this.lemmySprite, "reaching");
    setTimeout(() => this.wobbleBasket(), REACH_HOLD_DURATION * 1000);
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
    this.phase = "tipping";
    this.swapSprite(this.basketSprite, "basketTipped");
    tween(this.basketNode)
      .to(
        BASKET_TIP_DURATION,
        { eulerAngles: new Vec3(0, 0, BASKET_TIP_ANGLE_DEG) },
        { easing: "quadOut" }
      )
      .call(() => this.startSpill())
      .start();
  }

  private startSpill(): void {
    this.phase = "spilling";
    // Reparent the 9 real pieces back to the greybox root (preserving world
    // positions captured AFTER the basket tip). Then signal the bootstrap.
    this.releaseFragmentsFromBasket();
    if (this.options) {
      this.options.onSpill(BASKET_MOUTH_X, BASKET_MOUTH_Y);
    }
    this.beginExit();
  }

  private beginExit(): void {
    if (!this.lemmyNode || !this.lemmySprite) return;
    this.phase = "exiting";
    this.swapSprite(this.lemmySprite, "walking");
    tween(this.lemmyNode)
      .to(
        LEMMY_EXIT_DURATION,
        { position: new Vec3(LEMMY_WATCHING_X, LEMMY_Y, 0) },
        { easing: "sineInOut" }
      )
      .call(() => this.finishIntro())
      .start();
  }

  private finishIntro(): void {
    this.phase = "settled";
    if (this.options) {
      this.options.onSettled();
    }
  }

  private swapSprite(sprite: Sprite | null, key: SpriteKey): void {
    if (!sprite) return;
    const frame = this.spriteFrames[key];
    if (frame) sprite.spriteFrame = frame;
  }
}
