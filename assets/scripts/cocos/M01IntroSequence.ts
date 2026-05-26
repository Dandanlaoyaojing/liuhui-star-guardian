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
 * Opening sequence: Lemmy the rabbit walks in, reaches for a basket of puzzle
 * pieces, the basket tips, and the pieces spill out. Player clicks the basket
 * to start the sequence. The actual physics drop is delegated back to the
 * bootstrap via the `onSpill` callback once the basket tips.
 *
 * Phases:
 *   idle      — Lemmy stands off-stage; basket sits upright, clickable
 *   walking   — Lemmy tweens toward the basket
 *   reaching  — Lemmy swaps to reaching pose, leans toward the basket
 *   tipping   — Basket tweens through a small shake and rotates onto its side
 *   spilling  — onSpill(basketMouthX, basketMouthY) fires; physics pile starts
 *   settled   — Lemmy swaps to surprised pose, small recoil; onSettled() fires
 */

const LEMMY_WALK_PATH = "art/stage1-m01/runtime-sprites/intro/m01-lemmy-walking/spriteFrame";
const LEMMY_REACH_PATH = "art/stage1-m01/runtime-sprites/intro/m01-lemmy-reaching/spriteFrame";
const LEMMY_SURPRISED_PATH = "art/stage1-m01/runtime-sprites/intro/m01-lemmy-surprised/spriteFrame";
const BASKET_UPRIGHT_PATH = "art/stage1-m01/runtime-sprites/intro/m01-basket-upright/spriteFrame";
const BASKET_TIPPED_PATH = "art/stage1-m01/runtime-sprites/intro/m01-basket-tipped/spriteFrame";

// Display sizes (Cocos units). Tuned to the canvas; basket mouth aligns with floor area.
const LEMMY_DISPLAY = { width: 180, height: 180 };
const BASKET_DISPLAY = { width: 160, height: 160 };

const GROUND_Y = -270;

// Lemmy/basket world positions (sprite centers).
const LEMMY_OFFSCREEN_X = -560;                    // off-stage left
const LEMMY_REACH_X = 80;                          // ends just left of basket
const LEMMY_RECOIL_X = 30;                         // small step back after spill
const LEMMY_Y = GROUND_Y + LEMMY_DISPLAY.height / 2 - 10;

const BASKET_X = 220;
const BASKET_Y = GROUND_Y + BASKET_DISPLAY.height / 2 - 8;

// Basket mouth in world coords — used as physics drop origin when the basket tips.
const BASKET_MOUTH_X = BASKET_X + 30;              // mouth biased toward the open side
const BASKET_MOUTH_Y = BASKET_Y + BASKET_DISPLAY.height / 2 - 18;

// Timing (seconds).
const WALK_DURATION = 1.6;
const REACH_DURATION = 0.5;
const BASKET_SHAKE_DURATION = 0.12;
const BASKET_TIP_DURATION = 0.45;
const RECOIL_DURATION = 0.35;

const BASKET_TIP_ANGLE_DEG = 72;                   // basket rotates to its side

export interface M01IntroSequenceOptions {
  /** Called once the basket has tipped; the bootstrap should kick off physics drop. */
  onSpill: (originX: number, originY: number) => void;
  /** Called once the recoil tween finishes, the intro is over and player can interact. */
  onSettled: () => void;
}

type IntroPhase = "idle" | "walking" | "reaching" | "tipping" | "spilling" | "settled";

@ccclass("M01IntroSequence")
export class M01IntroSequence extends Component {
  private options: M01IntroSequenceOptions | null = null;
  private phase: IntroPhase = "idle";
  private lemmySprite: Sprite | null = null;
  private lemmyNode: Node | null = null;
  private basketSprite: Sprite | null = null;
  private basketNode: Node | null = null;
  private spriteFrames: Partial<Record<
    "walking" | "reaching" | "surprised" | "basketUpright" | "basketTipped",
    SpriteFrame
  >> = {};

  init(options: M01IntroSequenceOptions): void {
    this.options = options;
    this.spawnLemmy();
    this.spawnBasket();
    this.loadSpriteFrames();
  }

  /** Public: where on screen pieces should appear when they spill out of the basket. */
  getSpillOrigin(): { x: number; y: number } {
    return { x: BASKET_MOUTH_X, y: BASKET_MOUTH_Y };
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

  private loadSpriteFrames(): void {
    const apply = (key: keyof typeof this.spriteFrames, sprite: Sprite | null) => {
      const frame = this.spriteFrames[key];
      if (frame && sprite) {
        sprite.spriteFrame = frame;
      }
    };

    const loadOne = (
      path: string,
      key: keyof typeof this.spriteFrames,
      sprite: Sprite | null
    ) => {
      resources.load(path, SpriteFrame, (error, spriteFrame) => {
        if (error || !spriteFrame) return;
        this.spriteFrames[key] = spriteFrame;
        apply(key, sprite);
      });
    };

    loadOne(LEMMY_WALK_PATH, "walking", this.lemmySprite);
    loadOne(LEMMY_REACH_PATH, "reaching", null);
    loadOne(LEMMY_SURPRISED_PATH, "surprised", null);
    loadOne(BASKET_UPRIGHT_PATH, "basketUpright", this.basketSprite);
    loadOne(BASKET_TIPPED_PATH, "basketTipped", null);
  }

  private handleBasketTap(_event: EventTouch): void {
    if (this.phase !== "idle") return;
    this.beginWalk();
  }

  private beginWalk(): void {
    if (!this.lemmyNode) return;
    this.phase = "walking";
    tween(this.lemmyNode)
      .to(WALK_DURATION, { position: new Vec3(LEMMY_REACH_X, LEMMY_Y, 0) }, { easing: "sineInOut" })
      .call(() => this.beginReach())
      .start();
  }

  private beginReach(): void {
    if (!this.lemmyNode || !this.lemmySprite) return;
    this.phase = "reaching";
    this.swapSprite(this.lemmySprite, "reaching");
    // small forward lean
    tween(this.lemmyNode)
      .to(REACH_DURATION, { position: new Vec3(LEMMY_REACH_X + 22, LEMMY_Y, 0) }, { easing: "sineOut" })
      .call(() => this.tipBasket())
      .start();
  }

  private tipBasket(): void {
    if (!this.basketNode) return;
    this.phase = "tipping";
    // Quick shakes (rotation jitter) before commit-tipping
    const tipAngle = -BASKET_TIP_ANGLE_DEG;
    tween(this.basketNode)
      .to(BASKET_SHAKE_DURATION, { eulerAngles: new Vec3(0, 0, -10) })
      .to(BASKET_SHAKE_DURATION, { eulerAngles: new Vec3(0, 0, 12) })
      .to(BASKET_SHAKE_DURATION, { eulerAngles: new Vec3(0, 0, -6) })
      .call(() => this.swapSprite(this.basketSprite, "basketTipped"))
      .to(BASKET_TIP_DURATION, { eulerAngles: new Vec3(0, 0, tipAngle) }, { easing: "quadOut" })
      .call(() => this.startSpill())
      .start();
  }

  private startSpill(): void {
    this.phase = "spilling";
    if (this.options) {
      this.options.onSpill(BASKET_MOUTH_X, BASKET_MOUTH_Y);
    }
    this.beginRecoil();
  }

  private beginRecoil(): void {
    if (!this.lemmyNode || !this.lemmySprite) return;
    this.swapSprite(this.lemmySprite, "surprised");
    tween(this.lemmyNode)
      .to(RECOIL_DURATION, { position: new Vec3(LEMMY_RECOIL_X, LEMMY_Y, 0) }, { easing: "sineOut" })
      .call(() => this.finishIntro())
      .start();
  }

  private finishIntro(): void {
    this.phase = "settled";
    if (this.options) {
      this.options.onSettled();
    }
  }

  private swapSprite(
    sprite: Sprite | null,
    key: keyof typeof this.spriteFrames
  ): void {
    if (!sprite) return;
    const frame = this.spriteFrames[key];
    if (frame) sprite.spriteFrame = frame;
  }
}
