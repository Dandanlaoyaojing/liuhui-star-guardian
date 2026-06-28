import {
  _decorator,
  BoxCollider2D,
  Color,
  Component,
  EventTouch,
  Graphics,
  Node,
  Rect,
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
import {
  createRope,
  kickTail,
  stepRope,
  type RopeOptions,
  type RopeState
} from "./M01RopePhysics.ts";

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
const BASKET_X = 300; // 2026-06 右移 160→300: 拉开与左侧平台的距离(原 160 离平台太近)。钉/绳 pivot 与 BASKET_MOUTH_X 跟着自动走
// Anchor the basket SPRITE bottom here (≈ the bowl bottom). Enlarging the basket
// (M01_INTRO_BASKET_SCALE) then grows it UPWARD from this line, keeping Lemmy's
// reach-to-the-bowl-bottom intact. (At scale 1.0 this is the old hand-tuned -61.)
const BASKET_SPRITE_BOTTOM_Y = -167; // 2026-06-17 整篮上移(原 -182→-177→-167); 篮+绳+钉+内胆全随之上移
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
// 频繁连点召唤提速(2026-06-17): 两次点地间隔 < WINDOW 视为"催它快来"→ 走速倍率累加(封顶), 否则回基础速。
const WALK_BOOST_WINDOW_MS = 650; // 连点判定窗(ms); 超过则下次点回 1×
const WALK_BOOST_STEP = 0.7; // 每次连点 +这么多倍速
const WALK_BOOST_MAX = 3; // 倍速上限(3× = 急召)
/** 下一次走速倍率: 距上次点地够近(连点)则 +STEP 封顶 MAX, 否则回 1×。纯函数便于测。 */
export function nextWalkBoost(prevMult: number, msSinceLastTap: number): number {
  return msSinceLastTap < WALK_BOOST_WINDOW_MS
    ? Math.min(prevMult + WALK_BOOST_STEP, WALK_BOOST_MAX)
    : 1;
}
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
const LEMMY_HEADBUTT_X = BASKET_X - 40; // 顶篮判定中心(篮心略偏左 40, 派生→随 BASKET_X 一起挪); 莱米在此 ±容差内 = 在篮下
// 触发判定(2026-06-08 用户现场): 点篮时莱米在 |x - LEMMY_HEADBUTT_X| < 容差内 = 视为"在篮下" → 原地顶;
// 否则 = 走近篮子(到 REACH_X, 不到正下方)伸手够篮底边、篮子轻晃, 不顶。玩家需先点地把莱米走到篮下才能顶。
const LEMMY_HEADBUTT_UNDER_TOLERANCE = 80;
// 收耳区 = 篮子【左右外沿】之间(分界=篮子外沿, 不是某个点): 中心=篮心 BASKET_X, 半宽=篮身外沿半宽。
// 篮身实测: 贴图 m01-basket-hanging-empty.png 非透明篮身占整图宽 0.646 且居中, sprite contentSize 433(trimType
// none 满图映射)→ 篮身显示宽 0.646×433≈280, 半宽 140(与探针实测篮底 inner-cavity 渲染范围 [160,440] 吻合)。
// 莱米中心越过篮子外沿(进入 [160,440])即收耳, 走出即立耳。与顶篮判定(LEMMY_HEADBUTT_X 偏左40 + 容差80)分开。
const LEMMY_EAR_FOLD_CENTER_X = BASKET_X;
const LEMMY_EAR_FOLD_HALF_WIDTH = 140;
// 不在篮下点篮: 莱米走到这个"靠近但不在篮下"的位置够篮。=顶篮中心左 90(在 under 容差区 80 外侧一点),
// 派生→随 BASKET_X 一起挪(原硬编码 230 是 BASKET_X 右移前的值, 没跟着挪→落进容差区内+离篮太远→够不着)。
const LEMMY_BASKET_REACH_X = LEMMY_HEADBUTT_X - 90;
// 收耳: 点地目的地落在 under 容差区内 → 进区即收耳, 全程耳后贴走(见 roamLemmyTo); 走出 under 区且当前确实
// 已离开篮下才抬耳(2026-06-08 用户现场: "靠近篮子就收耳, 不是要撞篮才收"; 篮下转身/连点走不立耳)。
// 注: 起跳全靠 headbutt 帧自身腾空(jump_mode 抽帧已保留脚离地), 不再叠引擎纵移(否则=多一次原地跳)。
// 顶篮冲量(2026-06-08 用户现场两轮: 先 200→130 仍"太大", 再降到【原始 200/95/45/220 的 1/10】=
// 20/10/5/22 —— 拼片只被轻轻向上一推就靠重力落出, 不再大力崩飞)。
const BASKET_HEADBUTT_IMPULSE_VY = 20; // px/s 向上(被头从下顶起), 重力再拉回成弧
const BASKET_HEADBUTT_IMPULSE_VX_SPREAD = 10; // px/s 每路横向外扩(左右开花, 不堆成一柱)
const BASKET_HEADBUTT_IMPULSE_VY_JITTER = 5; // px/s 每路竖向差(上层拼片弹更高)
const BASKET_HEADBUTT_IMPULSE_SPIN = 22; // deg/s 翻滚
// 顶篮冲击(被头从下顶起): 给绳链尾端(=篮子)注入速度, 之后被软绳拽住乱晃、渐收(模型见 M01RopePhysics)。
// 竖直为主; 侧向分量来自莱米头与篮心的横向偏移(物理来源: 偏着顶→往对侧甩)。
const BASKET_KICK_STRENGTH = 520; // 顶篮上抛初速度(px/s); 越大蹦越高。可 live 调。(2026-06-19 600→520 配合重力调低后保持蹦起高度≈原值, 只把回落变慢)
const BASKET_KICK_LATERAL_PER_PX = 3; // 莱米每偏离篮心 1px → 侧向初速这么多(px/s)
const BASKET_KICK_LATERAL_MAX = 220; // 侧向初速上限(px/s), 防极端偏心甩飞
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
// 割绳子式统一 Verlet 重尾链(M01RopePhysics, 业界标准做法): 篮子不是独立系统, 而是【链的末端重粒子】
// (invMass 远小于绳点)。顶篮 kickTail → 链松弛甩动 → 回落绷紧瞬间径向被吸收(不可拉伸·非弹簧·不回弹)、
// 切向保留 → 篮子被绳拽住乱晃、渐收。篮子靠节点位移跟随链尾(内胆/拼片自然跟随, 不引刚体→无脱节)。
const ROPE_POINTS = 12; // 绳链粒子数(含两端); 越多越柔
const ROPE_WIDTH = 9; // 描边回退线宽(px); 仅贴图未到时用
// 吊绳接篮点 = 篮沿上【打结处】(绳缠绕系在篮沿的结), 不是更外侧的篮耳圆环(用户: "接打结的地方, 不是篮子耳朵")。
// 相对 basketNode 中心的偏移(px, y-up)。量自 m01-basket-hanging-empty.png(整图 1586×992 trimType none → 满图映射
// 到 DISPLAY_SIZE): 左结 px(335,628)、右结 px(1205,625), 图心(793,496); 偏移 = (knotX-793, 496-knotY)×0.273。
// 右结落在 local x≈473(<480 画布边内, 之前的篮耳 499 在边外→那半根绳被裁掉看不见)。可 live 微调对准结。
// 绳头落在【打结处第一道横向缠绳的上沿】(不是结心、更不是外侧篮耳环): 比结心高 ~6px → 两股都更短。
// 左股再往内收(x 减小)→ 收口角度更立(用户: 左边太往外, 向内靠篮); 右股角度本就合适, x 不动。
const BASKET_KNOT_LEFT = { x: -111, y: -27 };
const BASKET_KNOT_RIGHT = { x: 109, y: -28 };
const ROPE_COLOR = new Color(196, 148, 74, 255); // 琥珀(原绳 hue~37.7); 仅贴图未到时的描边回退用
// 绳子贴图整体压暗(2026-06-17 用户: 吊带太浅, 再加深一点)。Sprite.color 是乘法 → 等比降明度、保琥珀色相。
// 调深浅只改这一个值: 越小越深(255=原图不染, 220≈暗 14%, 190≈暗 25%, 165≈暗 35%)。
const ROPE_STRAP_TINT = new Color(220, 220, 220, 255);
// 手绘麻花绳贴图(拧绳, 整图 204×550, 绳芯 trim 后 ~29×550)。两股吊带各一条整根贴图, 拉伸成 钉子→篮耳 一条直绳。
const ROPE_TEXTURE_PATH =
  "art/stage1-m01/runtime-sprites/intro/m01-rope-segment/spriteFrame";
const ROPE_RENDER_WIDTH = 12; // 单股吊带贴图渲染宽(px); 2026-06-16 用户要求调细 1/4(16→12)。可 live 调
const ROPE_OPTS: RopeOptions = {
  gravity: -1100, // 链重力 px/s²; 决定甩动/下垂的劲道与篮子回落速度 (2026-06-19 1500→1100 让篮子下落更柔, 与兔子落地协调)
  damping: 0.995, // 每【子步】速度保留(120Hz 下 ≈0.55/s); 越小乱晃收得越快
  iterations: 24, // 距离约束迭代 ≈2×粒子数(文献经验); 越多绳越不可拉伸
  substepDt: 1 / 120 // 固定子步长(文献强调不可用可变 dt, 否则抖)
};
const ROPE_TAIL_INV_MASS = 0.05; // 篮子≈20×绳点质量; 越小篮子越"沉"、绳越让位
// 绳子接篮端 = 篮子【两耳打结处】相对 basketNode 中心的竖直偏移(原图两带接篮于 img y545, 中心 y496 → 上偏一点)。
const ROPE_BASKET_ATTACH_OFFSET_Y =
  ((496 - 545) / 992) * M01_INTRO_BASKET_DISPLAY_SIZE.height; // ≈ -13
// 固定钉子贴图(2026-06-17): 原"钉子"画死在篮 PNG 顶, 随篮节点每帧平移跟随链尾 → "钉子跟着绳子跑";
// strip 抹吊带时又把整颗钉+一小段后沿一起抹了。解法: 把钉子抠成独立贴图, 钉死在 nailPoint(绳子固定端,
// this.node 局部坐标, 不挂篮子节点)→ 篮子摆动它纹丝不动。后沿已在 PNG 里补回, 钉子只在此独立渲染。
const NAIL_TEXTURE_PATH =
  "art/stage1-m01/runtime-sprites/intro/m01-basket-nail/spriteFrame";
const NAIL_SRC = { width: 93, height: 115 }; // 抠出的钉子源图尺寸(trimType none, 整图即内容)
// 篮子源整图宽 1586px → BASKET_DISPLAY.width(含 BASKET_SCALE); 同比缩放钉子, 随篮一起放大。
const NAIL_DISPLAY = {
  width: NAIL_SRC.width * (BASKET_DISPLAY.width / 1586),
  height: NAIL_SRC.height * (BASKET_DISPLAY.width / 1586)
};
const NAIL_ANCHOR_Y = 0.33; // 贴图里"两股绳汇聚点"在底起 33% 高处; 锚此点对齐 nailPoint, 钉头朝上露出
const FLASHLIGHT_BONK_FALL_MS = 420; // 从篮口弧线落到莱米头顶用时
const FLASHLIGHT_HEAD_DY = 56; // 莱米头顶相对其节点中心(LEMMY_Y)的高度, startle 接触点
// 砸头后【松给物理】(取代旧脚本落地 tween): 给手电刚体初速(被头从下弹起、朝脚边偏)→ 重力拉下、
// 撞地上拼片/地面、细长身子自己躺平。碰撞体让它与拼片真碰、不再穿叠。落定后冻 static 待捡。
// 松物理前先把手电转成【近水平】→ 平着掉、平着落 = 稳。(竖着 + 自转的细长体落到动态拼片堆会楔进去被
// Box2D 大冲量弹飞出界 —— 这就是"手电飞出屏幕"的根因。所以不上抛、不自转、预先躺平。)
const FLASHLIGHT_LYING_ANGLE = -82; // 落地躺平角(deg); -90=纯水平
const FLASHLIGHT_TOSS_VX = 20; // px/s 横向(轻微偏脚边, 别正砸莱米脚下); 可 live 调
const FLASHLIGHT_TOSS_VY = 0; // px/s 竖向初速; 0=从头部直接下落(不上抛, 免得冲回篮子区)
const FLASHLIGHT_TOSS_SPIN = 0; // deg/s 自转; 0=不转(细长体带自转落拼片堆会楔住被弹飞)
const FLASHLIGHT_SETTLE_MS = 1100; // 松物理后多久判定落定→冻 static(够掉落+弹稳); 可调
const FLASHLIGHT_COLLIDER = { width: 14, height: 30 }; // 手电碰撞体(≈视觉 12×30 略宽好碰); 可调
// 拾起后手电挂到莱米【手部】的局部偏移(身前手位)。y 调低=贴手不悬空; 可 live 调。
// 手持手电【跟脸朝向镜像】(syncHeldFlashlight 每帧据 lemmyActor.getFacing 设): 大头朝脸前方上翘 30°,
// 像人拿手电。下面是【朝右】的值, 朝左自动镜像(x 取反、angle 取反)。
// ⚠️ 手电挂在莱米【节点】上、而朝向翻转(scaleX=-1)在【内层 spriteNode】, 二者不联动 → 必须手动镜像。
const HELD_FLASHLIGHT_OFFSET = { x: 6, y: -34 }; // 朝右时手部位(爪位); 朝左镜像取 -x。2026-06-20 y -26→-34 下移到手位(原来偏高)。可 live 调
const HELD_FLASHLIGHT_ANGLE = -113; // 朝右手持角(deg): 大头右前下方斜照地(0=头竖直上, -90=水平右, -120=下垂30°, -113≈下垂23°)。调平→往 -90 靠
// 拾起起身: 手电从【蹲时低手位】tween 升到【站立手位】, 跟身体一起升(否则 acquired 当帧钉到站立位=手电先飞起来)。
const PICKUP_HAND_DROP = 30; // px; 蹲时手比站立低这么多, 手电起手点从此低位起升
const PICKUP_RISE_SEC = 0.7; // s; 手电随起身升到站立手位的 tween 时长。贴合起身动画(反播 crouch=40帧@50fps≈0.8s),
// 取略短 → tween 在 await playFrameAction 结束(crouchDone 交接)前就完, 不和 update 的 syncHeldFlashlight 抢位。
// ⚠️ 0.32 太快=手电先飞起; 1.5 太慢=滞后且越过交接抢位(codex 复核)。改 crouch 帧数/fps 要同步此值

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
  /**
   * Called when Lemmy has picked the fallen flashlight up. v4 手持手电交接载荷:
   * lemmyNode = 覆盖面圆心/beam 锚(bootstrap 每帧读位置); flashlightNode = 手持手电节点(挂在场上,
   * acquired 后点它经 onHeldFlashlightTap 循环灯色)。
   */
  onFlashlightAcquired?: (handoff: { lemmyNode: Node; flashlightNode: Node }) => void;
  /** acquired 后玩家点莱米手里的手电 → 循环 红/黄/蓝/灭(bootstrap 接 cycleLight, spec §5.2)。 */
  onHeldFlashlightTap?: () => void;
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
  /** 砸头松物理后, 计时到落定→冻 static 待捡; 拾取/重置时清掉防误冻。 */
  private flashlightSettleTimer: ReturnType<typeof setTimeout> | undefined;
  /** 点哪走哪的"催促提速": 频繁连点累加倍速(nextWalkBoost), 应用到 roamLemmyTo 走时长。 */
  private walkBoostMult = 1;
  private lastRoamTapMs = 0;
  private pickupInProgress = false;
  /** 莱米当前是否耳后贴(走近篮下时已收耳)。供 roam 走位/顶篮判断是否要再收/抬耳, 避免重复收耳。 */
  private earsFolded = false;
  // 统一软绳(M01RopePhysics): 钉子=链头(钉死)、篮子=链尾重粒子(this.node 局部坐标=世界坐标)。
  private ropeGraphics: Graphics | null = null;
  private rope: RopeState | null = null;
  // 麻花绳贴图渲染: 两股吊带各一条【整根贴图精灵】, 每帧拉伸/旋转成 钉子→篮耳 一条直绳。
  // 贴图异步未到时 drawRope 回退到 ropeGraphics 描边。
  private ropeStraps: Sprite[] = [];
  // 固定钉子(绳子固定端的独立贴图; 挂 this.node 不挂篮子 → 篮摆它不动)。
  private nailNode: Node | null = null;
  // 组件已销毁(onDestroy 置真)。Cocos 的 resources.load 回调/tween.call/await 链都不随节点自动取消,
  // 销毁后它们仍会触发并访问已销毁节点 → 崩。所有这类异步入口开头先查此标志早返回。
  private destroyed = false;

  init(options: M01IntroSequenceOptions): void {
    this.options = options;
    this.spawnStageTapCatcher();
    // 莱米先挂 → 渲染在篮子【后面】: 顶篮时头抬进篮子会被篮子挡住(塞到篮底后方), 不再"穿过篮子"。
    // 这是渲染层级遮挡, 不是物理 —— kinematic 头 × static 篮内胆在 Box2D 里不产生碰撞, 加碰撞体也挡不住穿帮。
    this.spawnLemmy();
    this.spawnBasket();
    this.spawnBasketRope(); // 独立 Verlet 绳子(钉子→篮顶), 每帧跟随篮子物理摆动
    this.spawnFixedNail(); // 钉死的钉子贴图(nailPoint), 不随篮摆动
    this.spawnBasketInnerCavity();
    this.stageFragmentsInBasket();
    // Front-wall occluder LAST so it is the topmost child of the basket and draws
    // over the staged pieces' lower halves (the "pieces tucked inside" look).
    this.spawnBasketFrontOccluder();
    this.spawnIntroFlashlight(); // 三色手电(藏在篮里, 倒篮后掉出砸头)
    this.loadSpriteFrames();
    // Warm the headbutt-sequence + flashlight-narrative frames during the walk-in so playback has no hitch.
    void this.lemmyReady.then(() => {
      if (this.destroyed) return; // lemmyReady 可能在组件销毁后才 resolve, 预热回调据此早返回(codex C1)
      const actor = this.lemmyActor;
      if (!actor) return;
      for (const id of [
        "earsback",
        "headbutt",
        "idleback",
        "walkback",
        "startle",
        "crouch",
        "reach",
        "headshake"
      ] as const) {
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
    const roamable =
      this.phase === "roaming" || this.phase === "readyToHeadbutt" || this.phase === "waitingPickup" || this.phase === "acquired";
    if (!roamable || this.headbuttInProgress || this.pickupInProgress) return;
    const worldX = event.getUILocation().x - CANVAS_HALF_WIDTH;
    // 频繁连点 → 催它快来: 据距上次点地的间隔累加走速倍率(见 nextWalkBoost), 应用到 roam 走时长。
    const now = Date.now();
    this.walkBoostMult = nextWalkBoost(this.walkBoostMult, now - this.lastRoamTapMs);
    this.lastRoamTapMs = now;
    void this.roamLemmyTo(clampStageX(worldX));
  }

  /** 走时长 ÷ 频繁连点提速倍率(催促召唤, 见 handleStageTap/nextWalkBoost); 仅 roam 走位用, 脚本走不提速。 */
  private boostedWalkMs(fromX: number, toX: number): number {
    return walkSegmentMs(fromX, toX) / this.walkBoostMult;
  }

  /**
   * 点哪走哪(roaming/waitingPickup/acquired): 分段走向目标 —— 路径跨篮子外沿(收耳区边界)时, 在边界点播
   * earsback/earsup 收/抬耳过程动画, 再继续走完。位置只是触发点, 收/抬耳动作完整、走路不被打断。从外走进→收耳,
   * 从内走出→立耳(按跨界方向)。收耳完全由兔子与篮子相对位置决定, 不看点击目标。
   * 之后玩家点篮(已在篮下且耳已折)→ beginHeadbutt 跳过收耳直接顶。
   */
  private async roamLemmyTo(targetX: number): Promise<void> {
    const actor = this.lemmyActor;
    if (!actor) return;
    try {
      // 走路前先按当前位置校正耳态(砸头 startle / 拾取起身等弄成竖耳但人站篮下 → 先补收耳), 消除"站篮下竖耳"。
      await this.alignEarToPosition();
      // 分段走: 路径若跨篮子外沿(收耳区边界 中心±半宽), 先走到边界点 → 播 earsback/earsup【收/抬耳过程动画】
      // → 再继续走完剩余。位置只是【触发点】, 收/抬耳动作完整保留, 且走路不被打断(分段连续走到 targetX)。
      const fromX = actor.node.position.x;
      const dir = Math.sign(targetX - fromX);
      if (dir !== 0) {
        const leftEdge = LEMMY_EAR_FOLD_CENTER_X - LEMMY_EAR_FOLD_HALF_WIDTH;
        const rightEdge = LEMMY_EAR_FOLD_CENTER_X + LEMMY_EAR_FOLD_HALF_WIDTH;
        // 本次行进路径跨过的外沿边界, 按行进方向排序(先遇到的先处理)
        const crossings = [leftEdge, rightEdge]
          .filter((edge) => fromX < edge !== targetX < edge)
          .sort((a, b) => dir * (a - b));
        let cur = fromX;
        for (const edge of crossings) {
          await actor.walkTo(new Vec3(edge, LEMMY_Y, 0), {
            durationMs: this.boostedWalkMs(cur, edge),
            action: this.earsFolded ? "walkback" : "walk"
          });
          // 跨过 edge 朝行进方向一步是否落在篮下 → 从外走进(收耳) / 从内走出(立耳)
          const nowUnder = this.isXEarFoldZone(edge + dir);
          if (nowUnder !== this.earsFolded) {
            this.earsFolded = nowUnder; // 先置标志(连点打断 earsback 也按已切, 不回退)
            await actor.playFrameAction(nowUnder ? "earsback" : "earsup"); // 收/抬耳过程动画(原地)
          }
          cur = edge;
        }
        if (Math.abs(targetX - cur) > 1) {
          await actor.walkTo(new Vec3(targetX, LEMMY_Y, 0), {
            durationMs: this.boostedWalkMs(cur, targetX),
            action: this.earsFolded ? "walkback" : "walk"
          });
        }
      }
      // 停下: 按最终落点收尾待机
      if (this.earsFolded) this.playIdleback();
      else actor.playIdle();
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    }
  }

  /** 按莱米【当前位置】校正耳态: 站在篮下却竖着耳(如砸头 startle 弹竖) → 补 earsback 收耳过程; 反之补 earsup。
   *  状态本就与位置一致则不动。用于走路/拾取开始前, 消除"明明站篮下却竖耳"。 */
  private async alignEarToPosition(): Promise<void> {
    const actor = this.lemmyActor;
    if (!actor) return;
    const under = this.isXEarFoldZone(actor.node.position.x);
    if (under === this.earsFolded) return;
    this.earsFolded = under;
    await actor.playFrameAction(under ? "earsback" : "earsup");
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
   * 割绳子式统一软绳(M01RopePhysics): 一条 Verlet 重尾链, 钉子=链头(钉死)、篮子=链尾(重粒子)。
   * 整段在 this.node 局部坐标(= 世界坐标)里算与画(⚠️ 不能用 worldPosition: Graphics 挂在局部
   * (0,0), 用世界坐标会双重偏移画到屏外——之前"看不到绳子"的根因)。
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
    this.rope = createRope(nail.x, nail.y, attach.x, attach.y, ROPE_POINTS, ROPE_TAIL_INV_MASS);
    this.drawRope(); // 初次静态绘制(update 每帧重绘; 先画一根防首帧空白)
    this.loadRopeTexture(); // 异步加载麻花绳贴图 → 就位后改纹理渲染(见 loadRopeTexture / drawRope)
  }

  /**
   * 固定钉子: 抠出的钉子贴图钉死在 nailPoint(绳子固定端, this.node 局部坐标)。
   * 关键: 挂 this.node 而非篮子节点 → 篮子每帧跟随链尾平移/摆动时钉子纹丝不动(修"钉子跟着绳子跑")。
   * 锚点 (0.5, NAIL_ANCHOR_Y) 让贴图里"两股绳汇聚点"对齐 nailPoint, 钉头露在绳结之上。
   */
  private spawnFixedNail(): void {
    const node = new Node("M01IntroBasketNail");
    this.node.addChild(node);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(NAIL_DISPLAY.width, NAIL_DISPLAY.height);
    transform.setAnchorPoint(0.5, NAIL_ANCHOR_Y);
    const nail = this.nailPoint();
    node.setPosition(nail.x, nail.y, 0);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.nailNode = node;
    resources.load(NAIL_TEXTURE_PATH, SpriteFrame, (error, frame) => {
      if (this.destroyed || error || !frame) return;
      sprite.spriteFrame = frame;
    });
  }

  /**
   * 加载麻花绳贴图, 沿高度竖切成 ROPE_POINTS-1 条条带, 给两股吊带各建一排纹理精灵(沿物理链逐段铺贴图)。
   * 异步: 贴图到达前 drawRope 走描边回退; 到达后清掉描边、改由这些纹理精灵渲染(从此看着是拧绳)。
   */
  private loadRopeTexture(): void {
    resources.load(ROPE_TEXTURE_PATH, SpriteFrame, (error, frame) => {
      const gfx = this.ropeGraphics;
      if (this.destroyed || error || !frame || !frame.texture || !gfx) return;
      const base = frame.rect; // 绳芯内容区(trim 后 ~29×550 整根麻花绳)
      // 两股吊带各一条【整根贴图精灵】, 挂在 this.node 下; 每帧由 drawRope 拉伸/旋转成 钉子→打结处 一条直绳。
      // ⚠️ 无头预览(playwright :7456)只画得出左股、右股不渲染 —— 是无头渲染的怪癖, 编辑器里两股都正常;
      // 绳子的视觉(角度/长度/左右对称)只在 Cocos 编辑器里核, 别信无头截图。
      for (let s = 0; s < 2; s += 1) {
        const node = new Node("M01IntroRopeStrap");
        this.node.addChild(node);
        node.addComponent(UITransform);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = ROPE_STRAP_TINT; // 压暗绳子(太浅, 用户 2026-06-17)
        const rope = new SpriteFrame();
        rope.texture = frame.texture;
        rope.rect = new Rect(base.x, base.y, base.width, base.height);
        rope.packable = false;
        sprite.spriteFrame = rope;
        this.ropeStraps.push(sprite);
      }
      gfx.clear(); // 纹理精灵就位 → 撤掉描边回退
      // 两股吊带贴图后挂进 this.node, 会盖住钉子 → 把钉子重新置顶, 钉头露在绳头汇聚处之上。
      this.nailNode?.setSiblingIndex(this.node.children.length - 1);
      this.drawRope();
    });
  }

  /** 钉子(绳子固定端), this.node 局部坐标(= 绳子 Graphics 的绘制空间; pivot 直接 setPosition 在此)。 */
  private nailPoint(): { x: number; y: number } {
    return { x: BASKET_X, y: BASKET_Y + BASKET_NAIL_OFFSET_Y };
  }

  /** 绳子接篮端(两耳打结处), this.node 局部坐标; 仅用于建链初始位形(运行时链尾自治、篮子跟它走)。 */
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
   * 每帧: ① stepRope 推进统一链(固定子步 Verlet + 质量加权距离约束)→ ② 篮子节点位移跟随链尾
   * (内胆/冻结拼片是 basketNode 子节点, 自然跟随)→ ③ 渲两股吊带。被顶起后的"弹起→被绳拽住乱晃→
   * 渐收"全部由链自身涌现, 这里不再有第二套篮子物理。
   */
  /** 手持手电跟莱米脸朝向: 大头朝脸前方、上翘 30°(朝右 -60° / 朝左镜像 +60°), x 也镜像到对应爪位。
   *  仅 acquired(已捡起手持)时生效。手电挂莱米节点、朝向翻转在内层 sprite, 二者不联动 → 必须手动镜像。 */
  private syncHeldFlashlight(): void {
    if (this.phase !== "acquired" || !this.flashlightNode || !this.lemmyActor) return;
    const right = this.lemmyActor.getFacing() === "right";
    this.flashlightNode.setPosition(
      right ? HELD_FLASHLIGHT_OFFSET.x : -HELD_FLASHLIGHT_OFFSET.x,
      HELD_FLASHLIGHT_OFFSET.y,
      0
    );
    this.flashlightNode.setRotationFromEuler(0, 0, right ? HELD_FLASHLIGHT_ANGLE : -HELD_FLASHLIGHT_ANGLE);
  }

  update(deltaSeconds: number): void {
    this.syncHeldFlashlight(); // 手持手电跟脸朝向(大头朝前上方翘); 独立于绳子, 放最前
    const rope = this.rope;
    if (!this.ropeGraphics || !rope) return;
    stepRope(rope, Math.min(deltaSeconds, 1 / 30), ROPE_OPTS);

    const tail = rope.pts[rope.pts.length - 1];
    const bn = this.basketNode;
    if (bn) {
      // 链尾(两耳打结处)→ basketNode 中心(pivot-local; pivot 固定在钉子位)。
      const localX = tail.x - BASKET_X;
      const localY = tail.y - ROPE_BASKET_ATTACH_OFFSET_Y - (BASKET_Y + BASKET_NAIL_OFFSET_Y);
      bn.setPosition(localX, localY, 0);
    }

    this.drawRope();
  }

  /**
   * 两股吊带各一条整根麻花绳贴图, 从【钉子】拉到对应【篮耳打结环】(篮耳 = basketNode 中心 + BASKET_EAR_*)。
   * 篮子随物理链摆动 → 篮耳跟着动 → 每帧重算 钉子→篮耳 的位置/角度/长度, 绳头始终接在打结环上。
   * 贴图异步未到 → 回退 Graphics 描边(同样两股, 钉子→篮耳; 不留空绳)。
   */
  private drawRope(): void {
    const rope = this.rope;
    if (!rope) return;
    const pts = rope.pts;
    const nail = pts[0]; // 钉子(固定端)
    const tail = pts[pts.length - 1]; // 链尾 = 篮子接绳点
    const cx = tail.x; // 篮子中心(this.node 局部): 由 update 的反推, 篮心 = (tail.x, tail.y - ATTACH_OFFSET)
    const cy = tail.y - ROPE_BASKET_ATTACH_OFFSET_Y;
    const knots = [BASKET_KNOT_LEFT, BASKET_KNOT_RIGHT];

    if (this.ropeStraps.length < 2) {
      // 回退: 贴图还没加载好, 先用描边占位(钉子→两篮耳; 首帧不空白)。
      const gfx = this.ropeGraphics;
      if (!gfx) return;
      gfx.clear();
      gfx.lineWidth = ROPE_WIDTH;
      gfx.strokeColor = ROPE_COLOR;
      for (const knot of knots) {
        gfx.moveTo(nail.x, nail.y);
        gfx.lineTo(cx + knot.x, cy + knot.y);
        gfx.stroke();
      }
      return;
    }

    // 贴图就位: 每股 = 一条整根绳贴图, 钉子→篮耳 拉伸成直绳。
    for (let s = 0; s < this.ropeStraps.length; s += 1) {
      const ex = cx + knots[s].x;
      const ey = cy + knots[s].y;
      const dx = ex - nail.x;
      const dy = ey - nail.y;
      const len = Math.hypot(dx, dy) || 1e-3;
      const node = this.ropeStraps[s].node;
      node.setPosition((nail.x + ex) / 2, (nail.y + ey) / 2, 0); // 钉子↔篮耳中点
      // 局部 +Y(贴图顶)对齐钉子端: 把 (0,1) 转到 up=(nail-ear)/len → deg=atan2(dx,-dy)。
      node.setRotationFromEuler(0, 0, (Math.atan2(dx, -dy) * 180) / Math.PI);
      const transform = node.getComponent(UITransform);
      if (transform) transform.setContentSize(ROPE_RENDER_WIDTH, len);
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

  /**
   * 拼片是否已【真正顶出篮】可拾(整理): 必须已 reparent 到舞台根(从篮里释放)【且】不在篮子当前 AABB 框内。
   * 仅判 parent 不够 —— 被头顶起的片可能弹回、落在篮内仍 Static 的未释放拼片堆上, 此时 parent 已是 root
   * (释放过)却仍在篮筐里, 用 parent 判定会误显"篮里可拾"。叠加"不在篮子【当前】AABB 框内"=确实出篮。
   */
  isFragmentSpilledOut(node: Node): boolean {
    const root = this.basketPivotNode?.parent;
    if (!root || node.parent !== root || !this.basketNode) return false; // 仍挂篮节点(未释放)或无篮 → 不可拾
    // 用篮子【当前】AABB(篮被绳物理摆动, 取 worldPosition 跟着摆): 框外(掉地在框下 / 被玩家挪到盘上, 盘 x≈-420
    // 远离篮 x≈300, 落在框侧)都算出篮可拾; 只挡【仍落在篮筐内】的片(弹回堆上)。只判"低于篮底"会误锁玩家挪到
    // 盘上、与篮同高的片(codex P2)。两侧都取 worldPosition → 同世界系, 不依赖 root 在原点。
    const bc = this.basketNode.worldPosition;
    const p = node.worldPosition;
    const insideBasket =
      Math.abs(p.x - bc.x) < BASKET_DISPLAY.width / 2 && Math.abs(p.y - bc.y) < BASKET_DISPLAY.height / 2;
    return !insideBasket;
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
        if (this.destroyed || error || !spriteFrame) return;
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
      if (this.isLemmyUnderBasket()) {
        void this.beginRepeatHeadbutt();
      } else {
        void this.walkToBasketAndHeadbutt();
      }
      return;
    }
    if (this.phase !== "roaming") return;
    // 位置判定: 莱米在篮正下方(玩家已点地走过去)→ 顶篮; 否则 → 走近伸手够、够不着(教学 beat)。
    if (this.isLemmyUnderBasket()) void this.beginHeadbutt();
    else void this.beginBasketReachMiss();
  }

  /** 某个 stage x 是否落在篮子正下方容差区(顶篮判定 + 走近自动收耳共用同一判定, 二者对齐)。 */
  private isXUnderBasket(x: number): boolean {
    return Math.abs(x - LEMMY_HEADBUTT_X) < LEMMY_HEADBUTT_UNDER_TOLERANCE;
  }

  /** 某 stage x 是否在【收耳】容差区(中心=篮心 BASKET_X, 与顶篮判定 isXUnderBasket 分开 → 收耳对准篮子正下方)。 */
  private isXEarFoldZone(x: number): boolean {
    return Math.abs(x - LEMMY_EAR_FOLD_CENTER_X) < LEMMY_EAR_FOLD_HALF_WIDTH;
  }

  /** 莱米是否站在篮子正下方(玩家点地把它走到了 LEMMY_HEADBUTT_X 容差内)。 */
  private isLemmyUnderBasket(): boolean {
    return this.isXUnderBasket(this.lemmyActor?.node.position.x ?? 0);
  }

  /**
   * 不在篮下点篮 = 教学 beat(spec §5.2 ②): 莱米走【近】篮子(到 REACH_X, 不进正下方)→ 伸手够篮
   * (复用原 reach 伸手动作)→【够不着】→ 轻轻摇头"不行"→ 篮子【纹丝不动】(暗示得换个办法: 走到正下方用头顶)。
   * 2026-06-16 用户现场: 换掉旧 reachmiss 帧(觉得不好看), 改回 reach 伸手 + 摇头小手势。
   * 不改相位(仍 roaming)、不收耳、不顶篮。headbuttInProgress 复用为防重入。
   */
  private async beginBasketReachMiss(): Promise<void> {
    if (!this.lemmyActor || this.headbuttInProgress) return;
    this.headbuttInProgress = true;
    try {
      const actor = this.lemmyActor;
      const startX = actor.node.position.x;
      // 走近(普通走、耳竖), 到"靠近但不在篮下"的位置
      await actor.walkTo(new Vec3(LEMMY_BASKET_REACH_X, LEMMY_Y, 0), {
        durationMs: walkSegmentMs(startX, LEMMY_BASKET_REACH_X)
      });
      // 伸手够篮: 朝篮子(右); 不传 onEvent → reach_contact 落空、篮子零运动(够不着)
      await actor.playFrameAction("reach", { facing: "right" });
      await actor.playFrameAction("headshake", { facing: "right" }); // 够不着 → 轻轻摇头"不行"(即梦帧, 身体静止只头动)
      actor.playIdle(); // 收手回待机(竖耳)
      // 同步: reachmiss 全程用竖耳帧(walk/reach/headshake/idle), earsFolded 必须归位 false —— 否则若进 reachmiss
      // 前标志残留 true, 之后走到篮下点篮 beginHeadbutt 会因 earsFolded===true 跳过 earsback → 竖耳顶篮(脱节)。
      // 下次玩家点地走位时 roamLemmyTo 开头的 alignEarToPosition 会按实际位置(REACH_X 在收耳区内)再补收耳。
      this.earsFolded = false;
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
    } finally {
      this.headbuttInProgress = false;
    }
  }

  /** Lemmy auto-walks in from offscreen, stops on stage, then hands control to the player (roaming). */
  private async beginWalk(): Promise<void> {
    if (!this.lemmyActor) return;
    try {
      await this.lemmyReady;
      if (this.destroyed) return; // lemmyReady 可能在组件销毁后才 resolve(codex #2)
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

  /** 不在篮下点篮(readyToHeadbutt): 走到篮下再顶。走路中玩家可点地改走别处(roamLemmyTo 自动取消旧走)。 */
  private async walkToBasketAndHeadbutt(): Promise<void> {
    if (!this.lemmyActor || this.headbuttInProgress) return;
    try {
      await this.roamLemmyTo(LEMMY_HEADBUTT_X);
      if (this.phase !== "readyToHeadbutt") return;
      void this.beginRepeatHeadbutt();
    } catch (error) {
      if (!isExpectedLemmyActionCancel(error)) throw error;
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
    const rope = this.rope;
    if (!rope) return;
    // 侧向初速 = 莱米头偏离篮心的物理结果: 偏多少甩多少(封顶), 从莱米那侧往反方向甩。
    const lemmyX = this.lemmyActor?.node.position.x ?? BASKET_X;
    const offset = BASKET_X - lemmyX; // 莱米在左(offset>0)→ 往右甩
    const lateral = Math.max(
      -BASKET_KICK_LATERAL_MAX,
      Math.min(BASKET_KICK_LATERAL_MAX, offset * BASKET_KICK_LATERAL_PER_PX)
    );
    kickTail(rope, lateral, BASKET_KICK_STRENGTH, ROPE_OPTS.substepDt);
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
        if (this.destroyed) return;
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
    this.flashlightNode.active = true;
    this.flashlightNode.setPosition(BASKET_MOUTH_X, BASKET_MOUTH_Y, 0);
    this.flashlightNode.setRotationFromEuler(0, 0, 0);
    tween(this.flashlightNode)
      .to(FLASHLIGHT_BONK_FALL_MS / 1000, { position: headPos }, { easing: "quadIn" }) // 弧线落到头顶
      .call(() => {
        // 手电砸头: 收耳状态播 startleback(全程收耳), 立耳状态播 startle; 播完按位置校正残留耳态。
        const startleAction = this.earsFolded ? "startleback" : "startle";
        if (!this.earsFolded) this.earsFolded = false;
        void this.lemmyActor
          ?.playFrameAction(startleAction)
          .then(() => this.alignEarToPosition())
          .catch((e) => {
            if (!isExpectedLemmyActionCancel(e)) throw e;
          });
        this.releaseFlashlightToPhysics(); // 砸头后松给物理: dynamic 掉落、撞拼片、自己躺平
      })
      .start();
  }

  /**
   * 砸头瞬间把手电交给 Cocos 物理: 启用 dynamic 刚体 + 碰撞体, 给初速(被头弹起、朝脚边偏) →
   * 重力拉下、与地上拼片/地面真碰、细长身子自然躺平。落定(FLASHLIGHT_SETTLE_MS)后冻 static 待捡。
   */
  private releaseFlashlightToPhysics(): void {
    if (this.destroyed) return; // tween .call 在销毁后仍可能触发本方法(创建 settle timer + 访问节点) → 早返回(覆盖 codex #3)
    const node = this.flashlightNode;
    if (!node) return;
    node.setRotationFromEuler(0, 0, FLASHLIGHT_LYING_ANGLE); // 先转平再松物理 → 平着掉、平着落, 不楔进拼片堆被弹飞
    let body = node.getComponent(RigidBody2D);
    if (!body) body = node.addComponent(RigidBody2D);
    let collider = node.getComponent(BoxCollider2D);
    if (!collider) collider = node.addComponent(BoxCollider2D);
    collider.size = new Size(FLASHLIGHT_COLLIDER.width, FLASHLIGHT_COLLIDER.height);
    collider.offset = new Vec2(0, 0);
    collider.density = 1;
    collider.friction = 0.6;
    collider.restitution = 0.04;
    collider.enabled = true;
    collider.apply();
    body.enabled = true;
    body.type = ERigidBody2DType.Dynamic;
    body.gravityScale = 1;
    body.linearVelocity = new Vec2(FLASHLIGHT_TOSS_VX, FLASHLIGHT_TOSS_VY);
    body.angularVelocity = FLASHLIGHT_TOSS_SPIN;
    if (this.flashlightSettleTimer !== undefined) clearTimeout(this.flashlightSettleTimer);
    this.flashlightSettleTimer = setTimeout(() => {
      this.flashlightSettleTimer = undefined;
      // 兜底: 物理万一仍把它甩出界 / 掉穿地面 → 拉回莱米脚边躺好, 保证可见可捡(绝不丢出屏幕)。
      const p = node.position;
      if (Math.abs(p.x) > CANVAS_HALF_WIDTH || p.y < GROUND_Y - 20) {
        const lx = this.lemmyActor ? this.lemmyActor.node.position.x : 0;
        node.setPosition(clampStageX(lx + 30), GROUND_Y + 8, 0);
        node.setRotationFromEuler(0, 0, FLASHLIGHT_LYING_ANGLE);
      }
      const settled = node.getComponent(RigidBody2D);
      if (settled) {
        settled.linearVelocity = new Vec2(0, 0);
        settled.angularVelocity = 0;
        // 保持 Dynamic(不冻 Static): 万一落在拼片上, 玩家挪走该片时手电要随重力继续落地, 不能悬空。
        // 莱米非物理体(无刚体/碰撞), 不会撞跑它。allowSleep=true: 落地/落片后随接触 island 一起休眠 ——
        // 否则永不睡的手电会把它压着的 dynamic 拼片堆也一起钉醒(拼片 finishSettling 只清速度未冻 Static),
        // 谜题阶段拼片被持续唤醒抖动(codex P1)。支撑片被拖走=该接触销毁, box2d 会自动唤醒两端 → 手电照样掉。
        settled.type = ERigidBody2DType.Dynamic;
        settled.gravityScale = 1;
        settled.allowSleep = true;
      }
      this.advance("flashlightBonked"); // bonking → waitingPickup(手电可点)
    }, FLASHLIGHT_SETTLE_MS);
  }

  /** waitingPickup: 点地上的手电 → 蹲下拾起; acquired: 点手里的手电 → 转发循环灯色(v4)。 */
  private handleFlashlightTap(_event: EventTouch): void {
    if (this.phase === "acquired") {
      this.options?.onHeldFlashlightTap?.();
      return;
    }
    if (this.phase !== "waitingPickup" || this.pickupInProgress) return;
    void this.beginPickup();
  }

  private async beginPickup(): Promise<void> {
    if (!this.lemmyActor || !this.flashlightNode || this.pickupInProgress) return;
    if (!this.advance("flashlightTapped")) return; // waitingPickup → pickingUp
    this.pickupInProgress = true;
    try {
      // 砸头 startle 可能把耳弹竖, 但莱米若站在篮下, 捡前应按位置先收耳 → 消除"明明站篮下却竖着耳去捡"。
      await this.alignEarToPosition();
      if (this.destroyed) return;
      this.walkBoostMult = 1; // 脚本编排走位不继承连点催速
      const flashX = this.flashlightNode.position.x;
      if (Math.abs(this.lemmyActor.node.position.x - flashX) > 30) {
        await this.roamLemmyTo(clampStageX(flashX - 30)); // 分段收耳走到手电旁(篮下保持收耳, 出篮下才立耳)
      }
      // roamLemmyTo 吞掉销毁/取消错误后【正常返回】→ 销毁期间走位被取消时这里必须自查, 否则继续访问已销毁的手电/莱米(codex #2)。
      if (this.destroyed) return;
      await this.lemmyActor.playFrameAction("crouch"); // 蹲下拾取
      // 拾起 = 手持: 关物理(不再受重力/碰撞) → 贴到莱米手部, 之后点哪走哪手电随身走(覆盖面随莱米, spec §5.2)。
      // cc 的 addChild 会自动从旧父节点摘下再挂新父(运行时语义), shim 只声明 addChild。
      if (this.flashlightSettleTimer !== undefined) {
        clearTimeout(this.flashlightSettleTimer);
        this.flashlightSettleTimer = undefined;
      }
      const heldBody = this.flashlightNode.getComponent(RigidBody2D);
      if (heldBody) heldBody.enabled = false; // 手持: 停物理, 跟莱米手走不掉落
      const heldCollider = this.flashlightNode.getComponent(BoxCollider2D);
      if (heldCollider) heldCollider.enabled = false;
      this.lemmyActor.node.addChild(this.flashlightNode);
      // 起身期间手电跟手一起升: 先放到蹲时低手位, 边起身边 tween 到站立手位(避免 acquired 当帧把手电钉到站立位=先飞起来)。
      // 仍 pickingUp(未 acquired) → update 的 syncHeldFlashlight 早返回不抢位, 由这段 tween 控位。
      const right = this.lemmyActor.getFacing() === "right";
      const heldX = right ? HELD_FLASHLIGHT_OFFSET.x : -HELD_FLASHLIGHT_OFFSET.x;
      this.flashlightNode.setRotationFromEuler(0, 0, right ? HELD_FLASHLIGHT_ANGLE : -HELD_FLASHLIGHT_ANGLE);
      this.flashlightNode.setPosition(heldX, HELD_FLASHLIGHT_OFFSET.y - PICKUP_HAND_DROP, 0);
      tween(this.flashlightNode)
        .to(
          PICKUP_RISE_SEC,
          { position: new Vec3(heldX, HELD_FLASHLIGHT_OFFSET.y, 0) },
          { easing: "sineOut" }
        )
        .start();
      await this.lemmyActor.playFrameAction("crouch", { reverse: true }); // 反播 crouch = 拿着手电起身(无专门起身帧, 复用蹲下帧倒放)
      this.lemmyActor.playIdle();
      // 起身 idle = 竖耳态 → 同步 earsFolded。否则拾取前若在篮下收过耳(标志残留 true), acquired 后走向
      // 篮下时 roamLemmyTo 的 !earsFolded 判定为假 → 跳过收耳 → "拿手电在篮下忘记收耳"(手电落点随机故间歇)。
      this.earsFolded = false;
      this.advance("crouchDone"); // pickingUp → acquired(起身完才让 update 接管贴手 + 开放交接, 否则起身期间就钉到站立位)
      this.syncHeldFlashlight(); // 站定后贴手部(之后每帧由 update 维持)
      // v4 交接放在起身【之后】: onFlashlightAcquired 会闩 bootstrap 的 flashlightAcquired —— 它门控碎片拖拽 +
      // beam 光池(physicsSettled && flashlightAcquired), 必须等莱米站定才开放; 否则起身动画没播完, 解谜输入/
      // beam 就提前打开(codex 审查发现)。起身只会被 destroy 中断(整体废弃), 那时丢交接无害。
      this.options?.onFlashlightAcquired?.({
        lemmyNode: this.lemmyActor.node,
        flashlightNode: this.flashlightNode
      });
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
    this.destroyed = true; // 异步回调/await 链据此早返回, 不再碰已销毁节点
    this.clearBasketPileFreezeTimer();
    // teardown 落在手电落定计时(FLASHLIGHT_SETTLE_MS)窗口内时, 不清会让 settle 回调访问已销毁的手电节点(L2)。
    if (this.flashlightSettleTimer !== undefined) clearTimeout(this.flashlightSettleTimer);
    this.destroyBasketInnerCavity();
  }
}
