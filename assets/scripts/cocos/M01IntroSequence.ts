import {
  _decorator,
  BoxCollider2D,
  Color,
  Component,
  EventTouch,
  Graphics,
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
  getM01GreyboxRuntimeLemmyResource,
  M01_GREYBOX_RUNTIME_SURFACE_RESOURCES
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
// canvas X∈[-480,480]; platform/big-nut at 0, basket at 360.
const LEMMY_PLATFORM_FRONT_X = -320; // auto-walks in and stops here, then the player roams him freely
const LEMMY_UNDER_BASKET_X = 265; // 仅用于走入配速基准(LEMMY_WALK_SPEED); 顶篮落脚点见 LEMMY_HEADBUTT_X
const LEMMY_Y = GROUND_Y + LEMMY_DISPLAY.height / 2 - 10;
// 漫游(点哪走哪)横向边界, 留在画布内(960 宽, 半宽 480)。
const LEMMY_ROAM_MIN_X = -440;
const LEMMY_ROAM_MAX_X = 430;
const clampStageX = (x: number): number =>
  Math.max(LEMMY_ROAM_MIN_X, Math.min(LEMMY_ROAM_MAX_X, x));

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

// Timing (seconds).
const WALK_TO_BASKET_DURATION = 7.2; // 走入前进速度再次减半(1.8→3.6→7.2); 走路帧 fps 不变, 步频照旧
// Keep that tuned slow pace across all three walk segments (px/s); per-segment duration = distance / speed.
const LEMMY_WALK_SPEED = (LEMMY_UNDER_BASKET_X - LEMMY_OFFSCREEN_X) / WALK_TO_BASKET_DURATION;
const walkSegmentMs = (fromX: number, toX: number): number =>
  (Math.abs(toX - fromX) / LEMMY_WALK_SPEED) * 1000;
// Nail sits ~105px above the basket sprite's center (sprite anchorY≈0.934 of a 242-tall display).
// The wobble/tip pivot is placed here so the basket swings from the nail, nail itself fixed.
const BASKET_NAIL_OFFSET_Y = 105 * M01_INTRO_BASKET_SCALE;
// Time for the dropped standard-size pieces to settle into a physics heap inside the basket cavity
// before we freeze them Static (so the pile rides rigidly). The slow Lemmy walk-in covers it.
const BASKET_PILE_SETTLE_MS = 900;

// --- 顶篮 headbutt 机制(2026-06-08, 取代脚本掀翻) ----------------------------------------------
// 玩家点哪走哪自己把莱米走到篮下; 走近篮下时就收耳(earsback→耳后贴走入, 见 roamLemmyTo)→ 点篮(在篮下)
// 原地起跳用头顶篮底 → 上升段初次触篮底给拼片【向上+外扩】真实冲量(从下往上顶出)。
// ⚠️ 点篮【不再为顶篮走位】(原"走到正下方再顶"被吐槽"还是走到篮下才顶"); 收耳已前移到走近篮下时。
const LEMMY_HEADBUTT_X = 320; // 顶篮判定中心(篮心 360 略偏左); 莱米在此 ±容差内 = 在篮下
// 触发判定(2026-06-08 用户现场): 点篮时莱米在 |x - LEMMY_HEADBUTT_X| < 容差内 = 视为"在篮下" → 原地顶;
// 否则 = 走近篮子(到 REACH_X, 不到正下方)伸手够篮底边、篮子轻晃, 不顶。玩家需先点地把莱米走到篮下才能顶。
const LEMMY_HEADBUTT_UNDER_TOLERANCE = 80;
const LEMMY_BASKET_REACH_X = 230; // 不在篮下点篮: 莱米走到这个"靠近但不在篮下"的位置够篮(在 under 容差区 [240,400] 外)
// 点地走向篮下时(目的地在 under 容差区内)莱米在【到位前 FOLD_LEAD 处】就收耳 → 耳后贴走完最后一段进篮下,
// 而非到了才收耳(2026-06-08 用户现场: "靠近篮子就收耳, 不是要撞篮才收")。走出 under 区则抬耳复原。
const HEADBUTT_FOLD_LEAD_X = 70;
const BASKET_GENTLE_WOBBLE_DURATION = 0.4; // 轻碰篮底: 篮子绕钉子慢慢荡一下的每段时长(柔, 区别于顶篮的纵向上顶)
// 注: 起跳全靠 headbutt 帧自身腾空(jump_mode 抽帧已保留脚离地), 不再叠引擎纵移(否则=多一次原地跳)。
// 顶篮冲量(2026-06-08 用户现场两轮: 先 200→130 仍"太大", 再降到【原始 200/95/45/220 的 1/10】=
// 20/10/5/22 —— 拼片只被轻轻向上一推就靠重力落出, 不再大力崩飞)。
const BASKET_HEADBUTT_IMPULSE_VY = 20; // px/s 向上(被头从下顶起), 重力再拉回成弧
const BASKET_HEADBUTT_IMPULSE_VX_SPREAD = 10; // px/s 每路横向外扩(左右开花, 不堆成一柱)
const BASKET_HEADBUTT_IMPULSE_VY_JITTER = 5; // px/s 每路竖向差(上层拼片弹更高)
const BASKET_HEADBUTT_IMPULSE_SPIN = 22; // deg/s 翻滚
// 篮子 = 不可拉伸软绳上的 2D 钟摆(非弹簧! 用户: "不是弹力绳只是软绳" + "弹起后被绳子拽着乱晃"): 顶篮给
// 向上+侧向初速度 → 弹道升起(绳松弛)→ 落回到绳长被绳拽住(径向非弹性、不回弹)→ 切向留下=左右乱晃, 渐收。
const BASKET_KICK_STRENGTH = 600; // 顶篮上抛初速度(px/s); 越大蹦越高。可 live 调。
const BASKET_SIDE_KICK = 240; // 顶篮侧向初速度(px/s); 让篮子被绳拽着【左右乱晃】(从哪边顶往反方向甩)。
const BASKET_GRAVITY = -1800; // 篮子自身重力(px/s²); 决定蹦起后多快落回。越大落得越快、滞空越短。
const BASKET_AIR_DAMPING = 0.99; // 篮子每帧速度阻尼(<1); 越小越快收住, 越接近 1 晃越久。
// 可重复顶篮(active.md B「顶一下出一部分、反复顶到全出」): 每顶一次撞出这么多片(顶层优先),
// 9÷3=3 次顶清空。早批走手动弹道落地, 最后一批才调 onSpill 交 physicsPile 整堆沉降→开谜题。
const HEADBUTT_PIECES_PER_HIT = 3;

// --- 手电掉落砸头→拾起叙事(spec §5.2; 脚本化编排, 比物理可控) ----------------------------------
// 倒篮后一支三色手电从篮里掉出、弧线落到莱米头上(startle 受惊)→ 落地 → 玩家点它 → 莱米走过去蹲下
// (crouch)拾起 → acquired(交接 onFlashlightAcquired; v4 手持功能道具另做, 此处仅叙事)。
// 手电视觉尺寸 = 莱米身体高的 ~1/5(2026-06-08 用户现场: 原 50×128 几乎与兔等高 = 太大)。
// 兔含耳在屏 ≈ LEMMY_DISPLAY.height ×(430/512)≈151px(帧里兔占 512² 画布约 430px 高); 取 1/5 ≈30,
// 保持手电原瘦长比 50:128。改"1/5"这个除数即整体缩放, 可现场微调。
const FLASHLIGHT_VISUAL_HEIGHT = Math.round(((LEMMY_DISPLAY.height * 430) / 512) / 5); // ≈30
const FLASHLIGHT_DISPLAY = {
  width: Math.round((FLASHLIGHT_VISUAL_HEIGHT * 50) / 128), // ≈12, 维持 50:128 瘦长比
  height: FLASHLIGHT_VISUAL_HEIGHT
};
// 触摸目标下限(手电视觉缩小后仍要好点中; 视觉与点击区解耦, 见 spawnIntroFlashlight)。
const FLASHLIGHT_TAP_MIN = 44;

// --- 绳子物理(2026-06-08; 替代画死在篮 PNG 里的吊带, 已用 m01-basket-strip-suspension.py 抹掉) ------
// 模型(见 update): 篮子 = 不可拉伸软绳上的 2D 钟摆(非弹簧; 顶起=上抛+侧向→落到绳长被绳拽住、左右乱晃渐收);
// 绳子 = 两端钉(钉子+篮挂点)的 Verlet 视觉链, 中段自垂 → 软绳观感。渲为【两股吊带】(splay 到两耳)。
// 篮子靠节点位移驱动(内胆/拼片自然跟随, 不引刚体→无脱节)。所有参数可 live 微调。
const ROPE_POINTS = 12; // 绳子离散点数(含两端); 越多越柔, 越少越硬
const ROPE_WIDTH = 9; // 单股吊带线宽(px); 原吊带共 ~18px=两股各 ~9
// 两股吊带: 钉子处汇聚(offset 0)、篮子【两耳打结处】分开 ±此。实测原图吊带接在篮心 ±约 99 显示px
// 处(原图 1586px 中两带在 y545 接篮于 img x426/1148=中心±361 → ×433/1586≈±99)。同链渲两次, 横向偏移。
const STRAP_HALF_WIDTH = 99;
const ROPE_COLOR = new Color(196, 148, 74, 255); // 琥珀(原绳 hue~37.7); live 可调
const ROPE_GRAVITY = -1400; // 绳子自身重力(px/s²); 比世界重力(-640)大些 → 绳子甩动收得快、不软塌
const ROPE_DAMPING = 0.86; // 视觉链 Verlet 速度阻尼(<1 收敛); 越小越快静止
const ROPE_CONSTRAINT_ITERS = 18; // 视觉链每帧距离约束迭代; 越多绳越"不可拉伸"硬
// 绳子接篮端 = 篮子【两耳打结处】相对 basketNode 中心的竖直偏移(原图两带接篮于 img y545, 中心 y496 → 上偏一点)。
const ROPE_BASKET_ATTACH_OFFSET_Y =
  ((496 - 545) / 992) * M01_INTRO_BASKET_DISPLAY_SIZE.height; // ≈ -13
const FLASHLIGHT_BONK_FALL_MS = 420; // 从篮口弧线落到莱米头顶用时
const FLASHLIGHT_TO_GROUND_MS = 300; // 砸到后弹落到地面侧旁用时
const FLASHLIGHT_GROUND_DX = 56; // 落地点相对莱米的横向偏移(落在脚边一侧)
const FLASHLIGHT_HEAD_DY = 56; // 莱米头顶相对其节点中心(LEMMY_Y)的高度, startle 接触点
const FLASHLIGHT_GROUND_Y = GROUND_Y + 24; // 手电躺在地面的 y

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
  /** Called when Lemmy has picked the fallen flashlight up (intro 终点; 接 v4 手持工具用, 现可空). */
  onFlashlightAcquired?: () => void;
}

type SpriteKey = "basketHanging" | "basketTipped" | "basketFrontOccluder";

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
  private spriteFrames: Partial<Record<SpriteKey, SpriteFrame>> = {};
  private basketPileFreezeTimer: ReturnType<typeof setTimeout> | undefined;
  /** Set while a headbutt sequence (fold→jump→spill) is mid-flight, so taps don't re-trigger it. */
  private headbuttInProgress = false;
  private headbuttReleasedCount = 0; // 累计已撞出的拼片数; >= 总数 = 全出 → 接手电叙事
  private flashlightNode: Node | null = null;
  private flashlightSprite: Sprite | null = null;
  private pickupInProgress = false;
  /** 莱米当前是否耳后贴(走近篮下时已收耳)。供 roam 走位/顶篮判断是否要再收/抬耳, 避免重复收耳。 */
  private earsFolded = false;
  // 独立 Verlet 绳子: Graphics 画线 + 离散点(x,y)当前/上一帧位置(this.node 局部坐标=世界坐标)。
  private ropeGraphics: Graphics | null = null;
  private ropePts: Vec2[] = [];
  private ropePrev: Vec2[] = [];
  private ropeRestSeg = 0; // 视觉链每段静止长度(钉到篮距 ÷ 段数)
  // 篮子 2D 软绳钟摆物理(this.node 局部): 挂点 x/y + 速度; 绳长 = 钉到挂点静止距(不可拉伸上限)。
  private basketSuspX = 0;
  private basketSuspY = 0;
  private basketSuspVX = 0;
  private basketSuspVY = 0;
  private ropeLength = 0;

  init(options: M01IntroSequenceOptions): void {
    this.options = options;
    this.spawnStageTapCatcher();
    this.spawnBasket();
    this.spawnBasketRope(); // 独立 Verlet 绳子(钉子→篮顶), 每帧跟随篮子物理摆动
    this.spawnBasketInnerCavity();
    this.spawnLemmy();
    this.stageFragmentsInBasket();
    // Front-wall occluder LAST so it is the topmost child of the basket and draws
    // over the staged pieces' lower halves (the "pieces tucked inside" look).
    this.spawnBasketFrontOccluder();
    this.spawnIntroFlashlight(); // 三色手电(藏在篮里, 倒篮后掉出砸头)
    this.loadSpriteFrames();
    // Warm the headbutt-sequence + flashlight-narrative frames during the walk-in so playback has no hitch.
    void this.lemmyReady.then(() => {
      const actor = this.lemmyActor;
      if (!actor) return;
      for (const id of ["earsback", "headbutt", "idleback", "walkback", "startle", "crouch"] as const) {
        void actor.preloadFrames(id);
      }
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

  /**
   * Full-canvas invisible tap catcher (below the basket/Lemmy). PERSISTENT (unlike the old one-shot
   * advance catcher): in 'roaming' a tap on empty ground walks Lemmy there (点哪走哪). Taps that land
   * ON the basket are caught by the basket's own handler first (it sits on top), so they don't walk.
   */
  private spawnStageTapCatcher(): void {
    const node = new Node("M01IntroStageTapCatcher");
    node.setPosition(0, 0, 0);
    this.node.addChild(node);
    node.addComponent(UITransform).setContentSize(CANVAS_HALF_WIDTH * 2, CANVAS_HEIGHT);
    node.on(Node.EventType.TOUCH_END, this.handleStageTap, this);
  }

  /**
   * 点哪走哪: 'roaming' 玩家自由走位; 'waitingPickup' 手电已落地后莱米仍可自由走动(2026-06-08 用户现场:
   * 手电掉出来后还能随鼠标点的地方移动, 直到点掉在地上的手电才去拾起)。靠近篮下自动收耳见 roamLemmyTo。
   */
  private handleStageTap(event: EventTouch): void {
    const roamable = this.phase === "roaming" || this.phase === "waitingPickup";
    if (!roamable || this.headbuttInProgress || this.pickupInProgress) return;
    const worldX = event.getUILocation().x - CANVAS_HALF_WIDTH;
    void this.roamLemmyTo(clampStageX(worldX));
  }

  /** Walk Lemmy to a stage X using normal walk frames, then return to idle. Interrupt-safe. */
  private async walkLemmyTo(targetX: number, action: "walk" | "walkback" = "walk"): Promise<void> {
    if (!this.lemmyActor) return;
    try {
      await this.lemmyActor.walkTo(new Vec3(targetX, LEMMY_Y, 0), {
        durationMs: walkSegmentMs(this.lemmyActor.node.position.x, targetX),
        action
      });
      this.lemmyActor.playIdle();
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    }
  }

  /**
   * 点哪走哪(roaming/waitingPickup): 在普通走的基础上, 当目的地落在篮正下方容差区内 →【走近时就收耳】:
   * 普通走(耳竖)到"到位前 FOLD_LEAD"处 → earsback 收耳 → walkback 耳后贴走完最后一段进篮下 → idleback 待机。
   * 走出 under 区且当前是耳后贴 → 先 earsup 抬耳复原再普通走。其余(同态)按当前耳态直接走。
   * 之后玩家点篮(已在篮下且耳已折)→ beginHeadbutt 跳过收耳直接顶。
   */
  private async roamLemmyTo(targetX: number): Promise<void> {
    const actor = this.lemmyActor;
    if (!actor) return;
    const toUnderBasket = this.isXUnderBasket(targetX);
    try {
      if (toUnderBasket && !this.earsFolded) {
        // 走近篮下: 普通走到将近点 → 收耳 → 耳后贴走完最后一段
        const cur = actor.node.position.x;
        const dir = targetX >= cur ? 1 : -1;
        const foldX = clampStageX(targetX - dir * HEADBUTT_FOLD_LEAD_X);
        if ((dir > 0 && foldX > cur + 4) || (dir < 0 && foldX < cur - 4)) {
          await actor.walkTo(new Vec3(foldX, LEMMY_Y, 0), {
            durationMs: walkSegmentMs(cur, foldX),
            action: "walk"
          });
        }
        await actor.playFrameAction("earsback"); // 收耳(立→后贴), 原地
        this.earsFolded = true;
        const afterFoldX = actor.node.position.x;
        if (Math.abs(targetX - afterFoldX) > 4) {
          await actor.walkTo(new Vec3(targetX, LEMMY_Y, 0), {
            durationMs: walkSegmentMs(afterFoldX, targetX),
            action: "walkback"
          });
        }
        this.playIdleback();
      } else if (!toUnderBasket && this.earsFolded) {
        // 走离篮下: 先抬耳复原, 再普通走
        await actor.playFrameAction("earsup");
        this.earsFolded = false;
        await actor.walkTo(new Vec3(targetX, LEMMY_Y, 0), {
          durationMs: walkSegmentMs(actor.node.position.x, targetX),
          action: "walk"
        });
        actor.playIdle();
      } else {
        // 同态走(都耳竖 或 都耳后贴), 不切耳态
        await actor.walkTo(new Vec3(targetX, LEMMY_Y, 0), {
          durationMs: walkSegmentMs(actor.node.position.x, targetX),
          action: this.earsFolded ? "walkback" : "walk"
        });
        if (this.earsFolded) this.playIdleback();
        else actor.playIdle();
      }
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    }
  }

  /** 耳后贴待机循环(fire-and-forget; 吞被后续动作打断的预期 cancel)。 */
  private playIdleback(): void {
    void this.lemmyActor?.playFrameAction("idleback").catch((error) => {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    });
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

  /**
   * 独立 Verlet 物理绳子: 钉子端固定、篮子端每帧跟随篮子真实世界位置。绳子离散为 ROPE_POINTS 个点,
   * 自带重力 + 距离约束 → 篮子被顶起时绳子松弛甩动、落回时绷紧, 真实物理(替代画死在篮 PNG 的吊带)。
   * 整段在 this.node 局部坐标(= 世界坐标)里算与画。
   */
  private spawnBasketRope(): void {
    const ropeNode = new Node("M01IntroBasketRope");
    ropeNode.setPosition(0, 0, 0);
    this.node.addChild(ropeNode);
    ropeNode.addComponent(UITransform).setContentSize(CANVAS_HALF_WIDTH * 2, CANVAS_HEIGHT);
    const g = ropeNode.addComponent(Graphics);
    g.lineWidth = ROPE_WIDTH;
    g.strokeColor = ROPE_COLOR;
    this.ropeGraphics = g;

    const nail = this.nailPoint();
    const attach = this.basketAttachPoint();
    this.ropePts = [];
    this.ropePrev = [];
    for (let i = 0; i < ROPE_POINTS; i += 1) {
      const t = i / (ROPE_POINTS - 1);
      const x = nail.x + (attach.x - nail.x) * t;
      const y = nail.y + (attach.y - nail.y) * t;
      this.ropePts.push(new Vec2(x, y));
      this.ropePrev.push(new Vec2(x, y));
    }
    this.ropeLength = Math.hypot(attach.x - nail.x, attach.y - nail.y); // 不可拉伸绳长(钉到挂点静止距)
    this.ropeRestSeg = this.ropeLength / (ROPE_POINTS - 1);
    this.basketSuspX = attach.x; // 篮子挂点静止 x/y(钉子正下方)
    this.basketSuspY = attach.y;
    this.basketSuspVX = 0;
    this.basketSuspVY = 0;
    this.drawRope(); // 初次静态绘制(update 每帧重绘; 先画一根防首帧空白)
  }

  /** 钉子(绳子固定端), this.node 局部坐标(= 绳子 Graphics 的绘制空间; pivot 直接 setPosition 在此)。 */
  private nailPoint(): { x: number; y: number } {
    return { x: BASKET_X, y: BASKET_Y + BASKET_NAIL_OFFSET_Y };
  }

  /**
   * 绳子接篮端(碗顶 rim), this.node 局部坐标 —— 跟随篮子运动(basketNode.position.y 被 jolt 改)。
   * basketNode 是 pivot 的子, pivot 固定在 (BASKET_X, BASKET_Y+NAIL_OFFSET) 不旋转(gentleNudge 转角瞬时、收尾归0),
   * 故 basketNode 的 this.node 局部 = pivot 位 + basketNode.position。⚠️ 必须用局部坐标, 不能用 worldPosition——
   * 绳子 Graphics 节点挂在 this.node 局部 (0,0) 处画, 用 worldPosition 会双重偏移把绳子画到屏外(=之前看不到绳子的根因)。
   */
  private basketAttachPoint(): { x: number; y: number } {
    const bn = this.basketNode?.position;
    const bx = bn ? bn.x : 0;
    const by = bn ? bn.y : -BASKET_NAIL_OFFSET_Y;
    return {
      x: BASKET_X + bx,
      y: BASKET_Y + BASKET_NAIL_OFFSET_Y + by + ROPE_BASKET_ATTACH_OFFSET_Y
    };
  }

  /**
   * 每帧: ① 篮子在【不可拉伸软绳】上做 2D 钟摆(重力+空气阻尼, 绳长圆约束: 只拉不推, 被绳拉住那刻去掉
   * 径向、留切向→摆动)→ ② 节点位移驱动篮子 x/y(内胆/拼片自然跟随)→ ③ 视觉链跟随篮挂点自垂 → ④ 渲两股带。
   * 软绳非弹簧: 篮子被顶起=上抛(绳松弛)→ 落回到绳长被绳"拽住"→ 侧向初速让它**被绳拽着乱晃**, 渐渐收住。
   */
  update(deltaSeconds: number): void {
    if (!this.ropeGraphics || this.ropePts.length < 2) return;
    const dt = Math.min(deltaSeconds, 1 / 30);
    const nail = this.nailPoint();

    // ① 篮子 2D 钟摆: 重力 + 轻空气阻尼; 绳长圆约束(不可拉伸, 只拉不推, 径向非弹性=不回弹, 切向=摆)。
    this.basketSuspVY += BASKET_GRAVITY * dt;
    this.basketSuspVX *= BASKET_AIR_DAMPING;
    this.basketSuspVY *= BASKET_AIR_DAMPING;
    this.basketSuspX += this.basketSuspVX * dt;
    this.basketSuspY += this.basketSuspVY * dt;
    const rx = this.basketSuspX - nail.x;
    const ry = this.basketSuspY - nail.y;
    const dist = Math.hypot(rx, ry) || 1e-6;
    if (dist > this.ropeLength) {
      // 绳子到头(不可拉伸): 把篮子拉回绳长圆周上, 去掉向外径向速度(非弹性, 不回弹), 留切向→摆。
      const nx = rx / dist;
      const ny = ry / dist;
      this.basketSuspX = nail.x + nx * this.ropeLength;
      this.basketSuspY = nail.y + ny * this.ropeLength;
      const radial = this.basketSuspVX * nx + this.basketSuspVY * ny;
      if (radial > 0) {
        this.basketSuspVX -= nx * radial;
        this.basketSuspVY -= ny * radial;
      }
    }

    // ② 篮子跟随挂点(节点位移; basketNode 是 pivot 子, 换算到 pivot-local; 两点吊带→篮子平动不翻转)。
    const bn = this.basketNode;
    if (bn) {
      const localX = this.basketSuspX - BASKET_X;
      const localY =
        this.basketSuspY - ROPE_BASKET_ATTACH_OFFSET_Y - (BASKET_Y + BASKET_NAIL_OFFSET_Y);
      bn.setPosition(localX, localY, 0);
    }

    // ③ 视觉链: 两端钉(钉子 + 篮挂点, 随摆动移动), 中间点 Verlet 受重力自垂(篮被顶起=链松→垂)。
    const pts = this.ropePts;
    const prev = this.ropePrev;
    const last = pts.length - 1;
    pts[0].x = nail.x;
    pts[0].y = nail.y;
    pts[last].x = this.basketSuspX;
    pts[last].y = this.basketSuspY;
    const g = ROPE_GRAVITY * dt * dt;
    for (let i = 1; i < last; i += 1) {
      const px = pts[i].x;
      const py = pts[i].y;
      pts[i].x += (px - prev[i].x) * ROPE_DAMPING;
      pts[i].y += (py - prev[i].y) * ROPE_DAMPING + g;
      prev[i].x = px;
      prev[i].y = py;
    }
    // 距离约束【只拉不推】: 段被拉伸才收(松弛会垮/垂)。两端钉死。
    for (let iter = 0; iter < ROPE_CONSTRAINT_ITERS; iter += 1) {
      for (let i = 0; i < last; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        if (d <= this.ropeRestSeg) continue;
        const diff = ((d - this.ropeRestSeg) / d) * 0.5;
        const ox = dx * diff;
        const oy = dy * diff;
        const aEnd = i === 0;
        const bEnd = i + 1 === last;
        if (aEnd && !bEnd) {
          b.x -= ox * 2;
          b.y -= oy * 2;
        } else if (bEnd && !aEnd) {
          a.x += ox * 2;
          a.y += oy * 2;
        } else if (!aEnd && !bEnd) {
          a.x += ox;
          a.y += oy;
          b.x -= ox;
          b.y -= oy;
        }
      }
    }
    pts[0].x = nail.x;
    pts[0].y = nail.y;
    pts[last].x = nail.x;
    pts[last].y = this.basketSuspY;

    this.drawRope();
  }

  /**
   * 重绘绳子为【两股吊带】(this.node 局部=世界坐标)。同一根物理链渲两次, 横向偏移 = ±STRAP_HALF_WIDTH×t
   * (t: 0=钉子→1=篮口)→ 钉子处汇聚、篮口处分开成 V 形(像原画死的双吊带), 随链一起甩/垂/绷。
   */
  private drawRope(): void {
    const gfx = this.ropeGraphics;
    if (!gfx) return;
    const pts = this.ropePts;
    const n = pts.length;
    gfx.clear();
    gfx.lineWidth = ROPE_WIDTH;
    gfx.strokeColor = ROPE_COLOR;
    for (const sign of [-1, 1]) {
      gfx.moveTo(pts[0].x, pts[0].y); // 钉子端汇聚(offset 0)
      for (let i = 1; i < n; i += 1) {
        const t = i / (n - 1);
        gfx.lineTo(pts[i].x + sign * STRAP_HALF_WIDTH * t, pts[i].y);
      }
      gfx.stroke();
    }
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
  /** 把 `indices` 指定的那一批拼片从篮子释放到 greybox root, 保持当前世界位姿(仍 Static, 待施冲量)。 */
  private releaseFragmentsFromBasket(indices: number[]): void {
    if (!this.options || !this.basketNode || !this.basketPivotNode) return;
    // Reparent to the PIVOT's parent (the greybox root) — basketNode.parent is now the pivot.
    const greyboxRoot = this.basketPivotNode.parent;
    if (!greyboxRoot) return;
    // The swing/tip rotation lives on the pivot (basket's own local angle stays 0), so each
    // piece's world angle = pivot angle + the piece's local angle.
    const pivotAngleZ = this.basketPivotNode.eulerAngles.z;
    for (const i of indices) {
      const node = this.options.fragments[i].node;
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
    const tryApply = (key: SpriteKey, sprite: Sprite | null) => {
      const frame = this.spriteFrames[key];
      if (!frame) return;
      if (sprite) sprite.spriteFrame = frame;
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
      }
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

  /**
   * Player taps the basket. roaming → 首次顶篮(走过去+接近收耳+耳后贴走入+顶); readyToHeadbutt →
   * 再顶一次(莱米已在篮下耳后贴, 跳过走位/收耳直接顶)。可重复顶到拼片全出。
   */
  private handleBasketTap(_event: EventTouch): void {
    if (this.headbuttInProgress || !this.lemmyActor) return;
    if (this.phase === "readyToHeadbutt") {
      void this.beginRepeatHeadbutt(); // 篮里还有片 + 已在篮下耳后贴 → 再顶一次
      return;
    }
    if (this.phase !== "roaming") return;
    // 位置判定(2026-06-08 用户现场): 莱米在篮正下方(玩家已点地走过去)→ 顶篮; 否则 → 走近够篮只轻晃。
    if (this.isLemmyUnderBasket()) void this.beginHeadbutt();
    else void this.beginBasketReachNudge();
  }

  /** 某个 stage x 是否落在篮子正下方容差区(顶篮判定 + 走近自动收耳共用同一判定, 二者对齐)。 */
  private isXUnderBasket(x: number): boolean {
    return Math.abs(x - LEMMY_HEADBUTT_X) < LEMMY_HEADBUTT_UNDER_TOLERANCE;
  }

  /** 莱米是否站在篮子正下方(玩家点地把它走到了 LEMMY_HEADBUTT_X 容差内)。 */
  private isLemmyUnderBasket(): boolean {
    return this.isXUnderBasket(this.lemmyActor?.node.position.x ?? 0);
  }

  /**
   * 不在篮下点篮(2026-06-08 用户现场): 莱米走【近】篮子(到 REACH_X, 不进正下方)→ 伸手够篮底边(reach)→
   * 触到那刻篮子轻轻晃一下(gentleNudge, 柔, 不顶)。不改相位(仍 roaming)、不收耳、不顶篮——
   * 只有玩家点地把莱米走到篮下再点篮才顶。headbuttInProgress 复用为"篮子交互占用"防重入。
   */
  private async beginBasketReachNudge(): Promise<void> {
    if (!this.lemmyActor || this.headbuttInProgress) return;
    this.headbuttInProgress = true;
    try {
      const actor = this.lemmyActor;
      const startX = actor.node.position.x;
      // 走近(普通走、耳竖), 到"靠近但不在篮下"的位置
      await actor.walkTo(new Vec3(LEMMY_BASKET_REACH_X, LEMMY_Y, 0), {
        durationMs: walkSegmentMs(startX, LEMMY_BASKET_REACH_X)
      });
      // 伸手够篮底边, 触到(reach_contact @ #23)→ 篮子轻晃
      await actor.playFrameAction("reach", {
        onEvent: (e) => {
          if (e === "reach_contact") this.gentleNudgeBasket();
        }
      });
      actor.playIdle(); // 收手回待机
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    } finally {
      this.headbuttInProgress = false;
    }
  }

  /** 轻碰篮底: 篮子绕钉子慢慢荡一下再回(柔、衰减摆, 区别于顶篮 basketJolt 的纵向上顶)。 */
  private gentleNudgeBasket(): void {
    if (!this.basketPivotNode) return;
    const w = BASKET_GENTLE_WOBBLE_DURATION;
    tween(this.basketPivotNode)
      .to(w, { eulerAngles: new Vec3(0, 0, -5) }, { easing: "sineInOut" })
      .to(w, { eulerAngles: new Vec3(0, 0, 3.5) }, { easing: "sineInOut" })
      .to(w, { eulerAngles: new Vec3(0, 0, -2) }, { easing: "sineInOut" })
      .to(w, { eulerAngles: new Vec3(0, 0, 0) }, { easing: "sineInOut" })
      .start();
  }

  /** Lemmy auto-walks in from offscreen, stops on stage, then hands control to the player (roaming). */
  private async beginWalk(): Promise<void> {
    if (!this.lemmyActor) return;
    try {
      await this.lemmyReady;
      await this.lemmyActor.walkTo(new Vec3(LEMMY_PLATFORM_FRONT_X, LEMMY_Y, 0), {
        durationMs: walkSegmentMs(LEMMY_OFFSCREEN_X, LEMMY_PLATFORM_FRONT_X)
      });
      this.advance("walkArrived"); // approaching → roaming(玩家自由走位接管)
      this.lemmyActor.playIdle();
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    }
  }

  /**
   * 首次顶篮(莱米已在篮下, 玩家自己点地走到位): ①收耳(走近时若已折则跳过, 见 roamLemmyTo)→ ②原地起跳顶篮。
   * 点篮当场顶, 不为顶篮额外走位(原 walkback 到 320 被吐槽"还是走到篮下才顶"); 收耳已前移到走近篮下时
   * (2026-06-08 用户现场: "靠近篮子就收耳, 不是要撞篮才收")。顶篮落脚就在莱米当前 x(已在容差内, 篮够宽,
   * 头照样撞到篮底)。headbuttInProgress 防重入。
   */
  private async beginHeadbutt(): Promise<void> {
    if (!this.lemmyActor || this.headbuttInProgress) return;
    this.headbuttInProgress = true;
    try {
      const actor = this.lemmyActor;
      // ① 收耳(立→后贴), 原地。走近篮下时已收耳(roamLemmyTo)→ 跳过, 不重复收。
      if (!this.advance("headbuttStarted")) return; // roaming → folding
      if (!this.earsFolded) {
        await actor.playFrameAction("earsback");
        this.earsFolded = true;
      }
      this.advance("foldDone"); // folding → headbutting
      // ② 原地起跳顶篮(撞出第一批拼片)
      await this.playHeadbuttStrike();
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    } finally {
      this.headbuttInProgress = false;
    }
  }

  /** 再顶一次(篮里还有片时, readyToHeadbutt): 莱米已在篮下耳后贴 → 跳过走位/收耳, 直接顶。 */
  private async beginRepeatHeadbutt(): Promise<void> {
    if (!this.lemmyActor || this.headbuttInProgress) return;
    this.headbuttInProgress = true;
    try {
      if (!this.advance("headbuttStarted")) return; // readyToHeadbutt → headbutting
      await this.playHeadbuttStrike();
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    } finally {
      this.headbuttInProgress = false;
    }
  }

  /**
   * 一次顶篮的击打动作: 播 headbutt 跳跃帧 → 上升段初次触篮底(#66)发 headbutt_contact → commitHeadbuttSpill
   * 撞出本批拼片。落地后耳后贴待机(还有片→等玩家再点篮再顶; 全出→接 onSettled 开谜题 + 手电掉落叙事)。
   * 跳跃全靠帧自身腾空(jump_mode 已保留脚离地), 不叠引擎纵移(否则=多一次原地跳)。
   */
  private async playHeadbuttStrike(): Promise<void> {
    const actor = this.lemmyActor;
    if (!actor) return;
    let spilled = false;
    await actor.playFrameAction("headbutt", {
      onEvent: (e) => {
        if (e === "headbutt_contact" && !spilled) {
          spilled = true;
          this.commitHeadbuttSpill();
        }
      }
    });
    if (!spilled) this.commitHeadbuttSpill(); // 兜底: 顶点事件没来(帧被改短)
    // 落地耳后贴待机(循环, fire-and-forget)。全出那次随即被 startle(手电砸头)打断 → 吞预期 cancel。
    void actor.playFrameAction("idleback").catch((e) => {
      if (!isExpectedLemmyActionCancel(e)) throw e;
    });
    // 全出 = 谜题工作区上线 + 手电掉落叙事; 还有片则停在 readyToHeadbutt 等再点(commitHeadbuttSpill 已切相位)。
    if (this.options && this.headbuttReleasedCount >= this.options.fragments.length) {
      this.options.onSettled();
      this.beginFlashlightDrop();
    }
  }

  /**
   * 顶到篮底瞬间: 篮子被撞快速上跳抖 + 释放拼片到 root + 撤碗壁 + 给【向上+外扩】冲量
   * (从下往上顶 → 拼片往上弹出, 重力再拉回成弧; 与旧"向下左倾倒"方向相反)。advance headbuttContact。
   */
  private commitHeadbuttSpill(): void {
    if (!this.options) return;
    this.advance("headbuttContact"); // headbutting → spillingFragments
    this.clearBasketPileFreezeTimer();
    this.basketJolt();
    // 本次撞出顶层优先的一批(HEADBUTT_PIECES_PER_HIT 片); 累计到全部 = 最后一批。
    const order = this.headbuttReleaseOrder();
    const subset = order.slice(
      this.headbuttReleasedCount,
      this.headbuttReleasedCount + HEADBUTT_PIECES_PER_HIT
    );
    this.headbuttReleasedCount += subset.length;
    const allOut = this.headbuttReleasedCount >= this.options.fragments.length;
    this.releaseFragmentsFromBasket(subset); // 本批 reparent 到 root, 保持世界位姿
    this.destroyBasketInnerCavity(); // 撤碗壁(只第一次有效, 之后空操作), 拼片才能被往上顶出
    // 最后一批才把整堆(含早批)交 physicsPile 沉降→开谜题(early 批走手动弹道已自然落地)。
    // onSpill 会 zero 速度, 故本批冲量在其后施加。早批不再被 onSpill 影响(它们早已 Dynamic 落定)。
    if (allOut) {
      this.options.onSpill(BASKET_MOUTH_X, BASKET_MOUTH_Y);
    }
    this.applyHeadbuttImpulse(subset); // 给本批【向上+外扩】冲量
    if (!allOut) {
      this.advance("piecesRemain"); // spillingFragments → readyToHeadbutt(玩家可再点篮再顶)
    }
  }

  /** 拼片释放顺序: 按篮内堆叠高度(PILE_OFFSETS.y)降序 → 顶层先被头顶出。确定性(无 RNG → 可测)。 */
  private headbuttReleaseOrder(): number[] {
    const n = this.options?.fragments.length ?? 0;
    const offY = (i: number): number =>
      M01_INTRO_BASKET_PILE_OFFSETS[i % M01_INTRO_BASKET_PILE_OFFSETS.length].y;
    return Array.from({ length: n }, (_, i) => i).sort((a, b) => offY(b) - offY(a));
  }

  /**
   * 篮子被头从下顶: 给【绳末端(篮子物理点)】一个向上冲量 → 篮子蹦起(绳松弛)→ 落回被软绳拉住 →
   * 弹几下收敛(真实软绳约束, 见 update 的 Verlet 模型)。不再脚本 tween 篮子位置(那个弹回太快=头穿过去),
   * 改由物理驱动: 篮子蹦多高/收敛多快由 BASKET_KICK_STRENGTH + ROPE_GRAVITY/DAMPING 决定, 可 live 调。
   * 每顶一次(分批)都再踢一下(上抛+侧向)。钟摆模型见 update。
   */
  private basketJolt(): void {
    this.basketSuspVY += BASKET_KICK_STRENGTH; // 上抛 → 蹦起
    // 侧向初速: 从莱米所在那侧往反方向甩 → 落回时被绳拽着左右乱晃(见 update 的钟摆约束)。
    const lemmyX = this.lemmyActor?.node.position.x ?? BASKET_X;
    this.basketSuspVX += (lemmyX <= BASKET_X ? 1 : -1) * BASKET_SIDE_KICK;
  }

  /**
   * 顶篮冲量: 每个拼片获得【向上 + 每路横向外扩】速度(被头从下顶起), 重力(-640)再把它们拉成弧落地。
   * 确定性每路展开(无 RNG → 帧率无关、可测), 上层拼片弹更高。
   */
  /** 给 `indices` 这一批拼片【向上 + 每路横向外扩】速度(批内序 k 做展开 → 每批都左右开花)。 */
  private applyHeadbuttImpulse(indices: number[]): void {
    if (!this.options) return;
    for (let k = 0; k < indices.length; k += 1) {
      const body = this.options.fragments[indices[k]].node.getComponent(RigidBody2D);
      if (!body) continue;
      body.type = ERigidBody2DType.Dynamic;
      body.gravityScale = 1;
      const lane = (k % 3) - 1; // -1 | 0 | +1 → 横向左右开花
      const row = Math.floor(k / 3); // 上层弹更高
      body.linearVelocity = new Vec2(
        lane * BASKET_HEADBUTT_IMPULSE_VX_SPREAD,
        BASKET_HEADBUTT_IMPULSE_VY + row * BASKET_HEADBUTT_IMPULSE_VY_JITTER
      );
      body.angularVelocity = (lane === 0 ? 1 : -lane) * BASKET_HEADBUTT_IMPULSE_SPIN;
    }
  }

  // ── 手电掉落砸头 → 蹲下拾起 叙事(spec §5.2; bonking→waitingPickup→pickingUp→acquired) ──

  /** Spawn the single 3-color flashlight; hidden until it drops out on the headbutt spill. Tappable. */
  private spawnIntroFlashlight(): void {
    const node = new Node("M01IntroFlashlight");
    node.active = false; // 藏起, 倒篮后才掉出
    node.setPosition(BASKET_X, BASKET_Y, 0);
    this.node.addChild(node);
    // 父节点 = 点击区(≥44, 手电缩到 1/5 后仍好点中); 视觉精灵在子节点按真实小尺寸渲染。
    node
      .addComponent(UITransform)
      .setContentSize(
        Math.max(FLASHLIGHT_DISPLAY.width, FLASHLIGHT_TAP_MIN),
        Math.max(FLASHLIGHT_DISPLAY.height, FLASHLIGHT_TAP_MIN)
      );
    node.on(Node.EventType.TOUCH_END, this.handleFlashlightTap, this);

    const visual = new Node("M01IntroFlashlightVisual"); // 居中于点击区
    node.addChild(visual);
    visual.addComponent(UITransform).setContentSize(FLASHLIGHT_DISPLAY.width, FLASHLIGHT_DISPLAY.height);
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.flashlightNode = node;
    this.flashlightSprite = sprite;

    const res = M01_GREYBOX_RUNTIME_SURFACE_RESOURCES.find((r) => r.id === "single_flashlight_tool");
    if (res) {
      resources.load(res.resourcesLoadPath, SpriteFrame, (error, spriteFrame) => {
        if (!error && spriteFrame && this.flashlightSprite) this.flashlightSprite.spriteFrame = spriteFrame;
      });
    }
  }

  /**
   * 倒篮后: 手电从篮口弧线掉到莱米头顶(startle 受惊)→ 弹落到脚边地面 → 等玩家点拾起。
   * 脚本化(非物理)→ 砸头点/落点可控、可验。
   */
  private beginFlashlightDrop(): void {
    if (!this.flashlightNode || !this.lemmyActor) return;
    this.advance("fragmentsSettled"); // spillingFragments → bonking
    const lemmyX = this.lemmyActor.node.position.x;
    const headPos = new Vec3(lemmyX, LEMMY_Y + FLASHLIGHT_HEAD_DY, 0);
    const groundPos = new Vec3(clampStageX(lemmyX + FLASHLIGHT_GROUND_DX), FLASHLIGHT_GROUND_Y, 0);
    this.flashlightNode.active = true;
    this.flashlightNode.setPosition(BASKET_MOUTH_X, BASKET_MOUTH_Y, 0);
    tween(this.flashlightNode)
      .to(FLASHLIGHT_BONK_FALL_MS / 1000, { position: headPos }, { easing: "quadIn" }) // 弧线落到头顶
      .call(() => {
        // 手电砸头: startle 把耳后贴态弹成耳竖 → 复位 earsFolded, 之后走位/拾取按耳竖。
        this.earsFolded = false;
        void this.lemmyActor?.playFrameAction("startle").catch((e) => {
          if (!isExpectedLemmyActionCancel(e)) throw e;
        });
      })
      .to(FLASHLIGHT_TO_GROUND_MS / 1000, { position: groundPos }, { easing: "bounceOut" }) // 弹落脚边
      .call(() => {
        this.advance("flashlightBonked"); // bonking → waitingPickup(手电可点)
      })
      .start();
  }

  /** waitingPickup: 玩家点地上的手电 → 莱米走过去蹲下拾起。 */
  private handleFlashlightTap(_event: EventTouch): void {
    if (this.phase !== "waitingPickup" || this.pickupInProgress) return;
    void this.beginPickup();
  }

  private async beginPickup(): Promise<void> {
    if (!this.lemmyActor || !this.flashlightNode || this.pickupInProgress) return;
    if (!this.advance("flashlightTapped")) return; // waitingPickup → pickingUp
    this.pickupInProgress = true;
    try {
      const flashX = this.flashlightNode.position.x;
      if (Math.abs(this.lemmyActor.node.position.x - flashX) > 30) {
        await this.walkLemmyTo(clampStageX(flashX - 30)); // 走到手电旁
      }
      await this.lemmyActor.playFrameAction("crouch"); // 蹲下拾取
      // 拾起: 手电移到莱米身前(简化; v4 手持工具接管时再细化锚点)
      this.flashlightNode.setPosition(this.lemmyActor.node.position.x + 20, LEMMY_Y + 6, 0);
      this.advance("crouchDone"); // pickingUp → acquired
      this.lemmyActor.playIdle();
      this.options?.onFlashlightAcquired?.();
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    } finally {
      this.pickupInProgress = false;
    }
  }

  private destroyBasketInnerCavity(): void {
    for (const node of this.basketInnerCavityNodes) {
      node.destroy();
    }
    this.basketInnerCavityNodes.length = 0;
  }

  onDestroy(): void {
    this.clearBasketPileFreezeTimer();
    this.destroyBasketInnerCavity();
  }
}
