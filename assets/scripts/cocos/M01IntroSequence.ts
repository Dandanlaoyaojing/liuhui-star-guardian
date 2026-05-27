import {
  _decorator,
  Component,
  EventTouch,
  Node,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec3,
  resources,
  tween
} from "cc";

const { ccclass } = _decorator;

/**
 * Opening sequence: a wide-mouth basket hangs from an iron chain beneath the
 * flashlight. Inside the basket sit the grey-white puzzle pieces. Player clicks
 * the basket → Lemmy walks across the ground to stand under it → he tiptoes and
 * bats the basket → the basket wobbles, tips off the chain, and the pieces
 * spill out into the physics pile. Lemmy walks to the right side and stands.
 *
 * Phases:
 *   idle      — Lemmy at left edge; basket hangs upright; clickable
 *   walking   — Lemmy tweens toward the position under the basket
 *   reaching  — Lemmy swaps to reaching pose (tiptoe), basket wobbles
 *   tipping   — Basket commits to ~70° tilt; sprite swaps to tipped art
 *   spilling  — onSpill(originX, originY) fires; physics pile starts
 *   exiting   — Lemmy tweens to the right side, swaps back to walking pose
 *   settled   — onSettled() fires; player can drag pieces
 */

const LEMMY_WALK_PATH = "art/stage1-m01/runtime-sprites/intro/m01-lemmy-walking/spriteFrame";
const LEMMY_REACH_PATH = "art/stage1-m01/runtime-sprites/intro/m01-lemmy-reaching/spriteFrame";
const BASKET_HANGING_PATH = "art/stage1-m01/runtime-sprites/intro/m01-basket-hanging/spriteFrame";
const BASKET_TIPPED_PATH = "art/stage1-m01/runtime-sprites/intro/m01-basket-tipped/spriteFrame";
const CHAIN_PATH = "art/stage1-m01/runtime-sprites/intro/m01-chain-segment/spriteFrame";
const FRAGMENT_CIRCLE_PATH =
  "art/stage1-m01/runtime-sprites/hidden-fragments/m01-fragment-hidden-circle/spriteFrame";
const FRAGMENT_TRIANGLE_PATH =
  "art/stage1-m01/runtime-sprites/hidden-fragments/m01-fragment-hidden-triangle/spriteFrame";
const FRAGMENT_HEXAGON_PATH =
  "art/stage1-m01/runtime-sprites/hidden-fragments/m01-fragment-hidden-hexagon/spriteFrame";

const GROUND_Y = -270;

// Lemmy display + waypoints.
const LEMMY_DISPLAY = { width: 180, height: 180 };
const LEMMY_OFFSCREEN_X = -460;                    // left edge entry
const LEMMY_UNDER_BASKET_X = 290;                  // stands just left of basket bottom
const LEMMY_WATCHING_X = 470;                      // exits to the right and stands
const LEMMY_Y = GROUND_Y + LEMMY_DISPLAY.height / 2 - 10;

// Suspended basket: hangs beneath the flashlight beam anchor (360, 110).
const BASKET_DISPLAY = { width: 170, height: 170 };
const BASKET_X = 360;
const BASKET_Y = -20;                              // mid-canvas, below flashlight

// Basket mouth in world coords once tipped — used as physics drop origin.
const BASKET_MOUTH_X = BASKET_X - 30;              // mouth biased toward the lower-left
const BASKET_MOUTH_Y = BASKET_Y - 30;

// Chain hangs from the basket top up toward the flashlight body.
const CHAIN_DISPLAY = { width: 28, height: 180 };
const CHAIN_X = BASKET_X;
const CHAIN_Y = BASKET_Y + BASKET_DISPLAY.height / 2 + CHAIN_DISPLAY.height / 2 - 12;

// Small grey-white piece previews layered inside the basket mouth (visible peeking).
const BASKET_PIECE_DISPLAY = 24;
const BASKET_PIECE_LAYOUT: Array<{ key: "circle" | "triangle" | "hexagon"; dx: number; dy: number }> = [
  { key: "circle",   dx: -22, dy: BASKET_DISPLAY.height / 2 - 28 },
  { key: "triangle", dx:   2, dy: BASKET_DISPLAY.height / 2 - 22 },
  { key: "hexagon",  dx:  22, dy: BASKET_DISPLAY.height / 2 - 28 }
];

// Timing (seconds).
const WALK_TO_BASKET_DURATION = 1.8;
const REACH_HOLD_DURATION = 0.45;
const BASKET_WOBBLE_DURATION = 0.14;
const BASKET_TIP_DURATION = 0.45;
const LEMMY_EXIT_DURATION = 1.4;

const BASKET_TIP_ANGLE_DEG = -68;                  // tilts left so mouth faces lower-left

export interface M01IntroSequenceOptions {
  /** Called once the basket has tipped; the bootstrap should kick off physics drop. */
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
  | "chain"
  | "fragmentCircle"
  | "fragmentTriangle"
  | "fragmentHexagon";

@ccclass("M01IntroSequence")
export class M01IntroSequence extends Component {
  private options: M01IntroSequenceOptions | null = null;
  private phase: IntroPhase = "idle";
  private lemmySprite: Sprite | null = null;
  private lemmyNode: Node | null = null;
  private basketSprite: Sprite | null = null;
  private basketNode: Node | null = null;
  private chainNode: Node | null = null;
  private basketPieceNodes: Node[] = [];
  private spriteFrames: Partial<Record<SpriteKey, SpriteFrame>> = {};

  init(options: M01IntroSequenceOptions): void {
    this.options = options;
    this.spawnChain();
    this.spawnBasket();
    this.spawnBasketPieces();
    this.spawnLemmy();
    this.loadSpriteFrames();
  }

  /** Public: where pieces should appear when they spill out of the basket. */
  getSpillOrigin(): { x: number; y: number } {
    return { x: BASKET_MOUTH_X, y: BASKET_MOUTH_Y };
  }

  private spawnChain(): void {
    const node = new Node("M01IntroChain");
    node.setPosition(CHAIN_X, CHAIN_Y, 0);
    this.node.addChild(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(CHAIN_DISPLAY.width, CHAIN_DISPLAY.height);

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    // chain sprite is loaded later in loadSpriteFrames

    this.chainNode = node;
    // Use a temp Sprite reference so loadSpriteFrames can apply the frame.
    // We don't need to keep this in a class field beyond the load callback.
    this.spriteFrames.chain = undefined;
    (this.chainNode as Node & { __sprite?: Sprite }).__sprite = sprite;
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

  private spawnBasketPieces(): void {
    if (!this.basketNode) return;
    for (const slot of BASKET_PIECE_LAYOUT) {
      const node = new Node(`M01IntroBasketPiece_${slot.key}`);
      node.setPosition(slot.dx, slot.dy, 0);
      // parent to basket so pieces tip with it
      this.basketNode.addChild(node);

      const transform = node.addComponent(UITransform);
      transform.setContentSize(BASKET_PIECE_DISPLAY, BASKET_PIECE_DISPLAY);

      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      (node as Node & { __sprite?: Sprite; __key?: string }).__sprite = sprite;
      (node as Node & { __sprite?: Sprite; __key?: string }).__key = slot.key;

      this.basketPieceNodes.push(node);
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

    // Chain
    const chainSprite = (this.chainNode as (Node & { __sprite?: Sprite }) | null)?.__sprite ?? null;
    loadOne(CHAIN_PATH, "chain", chainSprite);

    // Basket pieces (apply to each by key)
    const findPieceSprite = (key: "circle" | "triangle" | "hexagon"): Sprite | null => {
      for (const node of this.basketPieceNodes) {
        const k = (node as Node & { __key?: string }).__key;
        if (k === key) {
          return (node as Node & { __sprite?: Sprite }).__sprite ?? null;
        }
      }
      return null;
    };
    loadOne(FRAGMENT_CIRCLE_PATH, "fragmentCircle", findPieceSprite("circle"));
    loadOne(FRAGMENT_TRIANGLE_PATH, "fragmentTriangle", findPieceSprite("triangle"));
    loadOne(FRAGMENT_HEXAGON_PATH, "fragmentHexagon", findPieceSprite("hexagon"));
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
    // hold the reach pose while the basket wobbles
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
    // hide the basket-internal piece previews — physics pile takes over now
    for (const piece of this.basketPieceNodes) {
      piece.active = false;
    }
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
