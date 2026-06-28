import {
  _decorator,
  CircleCollider2D,
  CCBoolean,
  Color,
  Component,
  EffectAsset,
  ERigidBody2DType,
  EventTouch,
  Graphics,
  ImageAsset,
  input,
  Input,
  JsonAsset,
  Label,
  Material,
  Node,
  PolygonCollider2D,
  resources,
  RigidBody2D,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  tween,
  Vec2,
  Vec3,
  Vec4,
  game
} from "cc";
import {
  beginDragSession,
  cancelDragSession,
  endDragSession,
  moveDragSession,
  type DragState
} from "../interaction/DragHandler.ts";
import { resolveM01GreyboxDrop } from "./M01GreyboxDrag.ts";
import {
  buildRepairTimeline,
  spiralOutTargets,
  type RepairStepConfig
} from "./M01RepairSequence.ts";
import { aspectContentSize, spriteFrameSize } from "./M01SpriteAspect.ts";
import {
  buildM01GreyboxLayout,
  resolveM01EvidenceFragmentSnapPosition,
  type M01GreyboxLayout,
  type M01GreyboxPoint,
  type M01GreyboxTokenNode
} from "./M01GreyboxLayout.ts";
import {
  resolveM01StandardPieceBlendOverlays,
  type M01StandardPieceBlendPlacement
} from "./M01StandardPieceBlend.ts";
import {
  readM01ManualTargetPlacements,
  writeM01ManualTargetPlacements,
  type M01ManualTargetStorage
} from "./M01ManualTargetPersistence.ts";
import {
  deriveM01TargetEvidenceFromPlacements,
  resolveM01ConfigWithCurrentTargetEvidence,
  type M01ManualTargetPiecePlacement
} from "./M01TargetPatternGenerator.ts";
import { M01GreyboxSession } from "./M01GreyboxSession.ts";
import type {
  M01GreyboxFilterPresentation,
  M01GreyboxFragmentPresentation,
  M01GreyboxPlaceResult,
  M01GreyboxRepairPresentation,
  M01GreyboxSlotPresentation
} from "./M01GreyboxSession.ts";
import {
  coveragePoolHalfHeight,
  cycleLight,
  fragmentsInCoverage,
  type CoverageFragment,
  type LightState
} from "./M01FlashlightObservation.ts";
import { worldBeamFromGeometry } from "./M01FlashlightBeam.ts";
import { routeTap } from "./M01PuzzleInputRouter.ts";
import type {
  M01BaseColor,
  M01BlendColor,
  M01BottomLightState,
  M01MemoryGearConfig
} from "../levels/stage1/M01MemoryGearController.ts";
import { buildToolCardPreview } from "../ui/ToolCardView.ts";
import {
  buildM01GreyboxStaticArtPlan,
  buildM01GreyboxTargetOverlapEvidencePlan,
  getM01GreyboxRuntimeLightEdgeResourceForToken,
  getM01GreyboxRuntimeLightMaskResourceForToken,
  getM01GreyboxTargetReferenceCardResource,
  getM01GreyboxToolCardFrameResource,
  getM01GreyboxRuntimeSpriteResourceForToken,
  type M01GreyboxRuntimeSpriteResource
} from "./M01GreyboxArt.ts";
import { formatM01GreyboxText, type M01GreyboxTextOverrides } from "./M01GreyboxText.ts";
import { M01PhysicsBoundary } from "./M01PhysicsBoundary.ts";
import { M01PhysicsPile } from "./M01PhysicsPile.ts";
import { M01IntroSequence } from "./M01IntroSequence.ts";
import type { M01PhysicsShape } from "./M01PhysicsRotation.ts";

const { ccclass, property } = _decorator;
// ponytail: hide all on-screen greybox text (status/feedback/buttons/tool-card). Flip to true to bring labels back.
const HIDE_SCREEN_TEXT = true;
const CLICK_DRAG_THRESHOLD = 6;
const ROTATE_DOUBLE_TAP_MS = 300; // 双击同一持握拼片(此间隔内、几乎原位)= 旋转 90°(取代旧"旋转90°"按钮)
const ROTATE_DOUBLE_TAP_RADIUS = 24; // 两击位移需 < 此(持片时片随指针, 原位双击≈0 位移)才算双击; 移动后点=放下
const FRAGMENT_INPUT_HIT_SIZE = 64;
const TARGET_PATTERN_POSITION_TOLERANCE = 1;
const TARGET_PATTERN_ROTATION_TOLERANCE = 1;
const VALIDATION_FAILURE_FLASH_COUNT = 2;
const M01_HINT_ICON_RESOURCE_PATH = "art/icons/icon-hint/spriteFrame";
const M01_HINT_ICON_DISPLAY_SIZE = { width: 24.5, height: 30 };
const OBSERVED_FRAGMENT_TINT_ALPHA = 255;
const M01_TARGET_BLEND_RGB: Record<
  Exclude<M01BlendColor, M01BaseColor>,
  [number, number, number]
> = {
  purple: [167, 140, 166],
  green: [136, 166, 138],
  orange: [206, 154, 114]
};
// Base/beam RGBs still drive the three same-color flashlight observations.
// Blend observations reuse the target-evidence palette so clues and lit pieces match.
const M01_BASE_RGB: Record<"red" | "yellow" | "blue", [number, number, number]> = {
  red:    [230, 120, 110],
  yellow: [240, 220, 130],
  blue:   [115, 150, 215]
};
const M01_BEAM_RGB: Record<"red" | "yellow" | "blue", [number, number, number]> = {
  red:    [255, 130, 110],
  yellow: [255, 235, 130],
  blue:   [120, 160, 240]
};
// 仅用于【光束视觉】(锥光/大头光晕)的调色: 与显色逻辑用的 M01_BEAM_RGB 解耦, 可单独提饱和让淡色看清。
// 黄色尤其: M01_BEAM_RGB.yellow 太浅(近白)→ 光束看不清, 这里调成更显眼的金黄。
const M01_BEAM_VISUAL_RGB: Record<"red" | "yellow" | "blue", [number, number, number]> = {
  red:    [255, 130, 110],
  yellow: [255, 200, 55], // 金黄(比显色用的 [255,235,130] 深/艳, 在浅背景上看得清)
  blue:   [120, 160, 240]
};
function multiplyRgb(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [
    Math.round((a[0] * b[0]) / 255),
    Math.round((a[1] * b[1]) / 255),
    Math.round((a[2] * b[2]) / 255)
  ];
}
const OBSERVED_FRAGMENT_TINT_COLORS: Record<M01BlendColor, [number, number, number]> = {
  red:    multiplyRgb(M01_BASE_RGB.red,    M01_BEAM_RGB.red),
  yellow: multiplyRgb(M01_BASE_RGB.yellow, M01_BEAM_RGB.yellow),
  blue:   multiplyRgb(M01_BASE_RGB.blue,   M01_BEAM_RGB.blue),
  orange: M01_TARGET_BLEND_RGB.orange,
  green:  M01_TARGET_BLEND_RGB.green,
  purple: M01_TARGET_BLEND_RGB.purple
};
// --- 莱米手持手电的覆盖面光池(v4; spec §5.2) -----------------------------------------------
// 视觉常量(玩法数值 radius/centerOffset 在 config.flashlightCoverage, 按 puzzle-configs 规则)。
// 真实光效用【代码生成的渐变纹理】渲染(GPU 逐像素采样, 无分层/无分界线), 取代旧 Graphics 多边形硬叠。
// 主体 = 有方向的【锥形渐变】精灵: 锥顶(出光口)最亮、沿光向张开、越远越散越淡(近强远弱发散);
// 再叠一个【白色径向】精灵当出光口的白热核。锥顶锚在手电大头 → 光从手电射出贴地铺开, 不悬空。
const COVERAGE_POOL_SQUASH = 0.32; // 仅用于 coveragePoolHalfHeight 的拼接盘钳制(光不照盘)
const COVERAGE_POOL_BOARD_CLEARANCE = 6; // px; 光与拼接盘下缘之间保留的间隙
const COVERAGE_MUZZLE_REACH = 13; // px; 出光口相对手电节点中心的【脸前方】偏移≈半个手电长
const COVERAGE_MUZZLE_DROP = 6; // px; 出光口相对手电节点中心的【向下】偏移(光顶/白热核往下贴到大头)。光顶偏高调大、偏低调小
const COVERAGE_BEAM_TILT_DEG = -3; // deg; 在 muzzle→着地点方向上叠加倾角: 正=向下压更斜, 负=抬平贴地。三角更贴地调更负、更立起调正
const COVERAGE_FALLBACK_FORWARD = 34; // px; 手电没朝下(朝上/水平, 够不到地面)时, 游戏判定圆心退化落在脚边前方此距离
const COVERAGE_BEAM_LENGTH = 190; // px; 视觉光锥沿手电朝向的长度(射程)。嫌短调大、嫌长调小
const GLOW_TEX_SIZE = 128; // 渐变纹理边长(px); 越大越细腻、越费内存
const GLOW_FALLOFF_GAUSS = 5.2; // 白热核(径向纹理)高斯紧致度(大=核小边锐)
// 锥形纹理: 锥顶在【左中】(出光口)最亮, 沿 +x 张开到右; 越远 alpha 越低、锥越宽 → 近强远弱发散。
const CONE_TEX_MIN_HALF = 0.05; // 锥顶半宽(归一化); apex 实宽≈此×len×FAN, 调到≈手电头宽(出光口和大头一样宽)。太窄调大、太宽调小
const CONE_TEX_MAX_HALF = 0.5; // 锥底(far)半宽 = 纹理半高(铺满)
const CONE_ALONG_POW = 0.8; // 沿光向衰减指数(大=衰减快近端集中; 小=远端/落地 footprint 更亮, 一片到底无缝)
const COVERAGE_CONE_ALPHA = 110; // 锥形光(灯色)整体不透明度(别太高抢拼片显色)
const COVERAGE_CONE_FAN = 1.0; // 锥底张开宽 = len × 此(=1.0 → 锥底宽≈光束长, 明显扇形展开)。嫌窄调大、嫌宽调小
const COVERAGE_CORE_ALPHA = 120; // 出光口白热核不透明度
const COVERAGE_CORE_DIAM_PX = 14; // px; 出光口白热核直径(固定, 贴合小手电头≈12px)
// 地面线: 光锥落到 center.y 再下落此值 = 视觉地面(光锥宽端落这条线, 不穿地)。
const COVERAGE_POOL_DROP = 18; // px; 地面线相对 center.y 的下落(光斑偏高调大、偏低调小)
// 换灯色时只【大头】变色: 手电体保持本色, 在大头处叠一小团灯色光晕(挂手电节点, 随之转/移)。
const HELD_FLASHLIGHT_HEAD_Y = 11; // px; 大头光晕相对手电节点中心的局部 y(沿手电长轴到大头一端)。在错的一端就取负
const COVERAGE_HEAD_GLOW_PX = 18; // px; 大头灯色光晕直径(≈手电头)
const COVERAGE_HEAD_GLOW_ALPHA = 210; // 大头光晕不透明度
// 手电逐像素显色 shader(fx_color-filter): true=拼片显色由 shader 按光束逐像素照亮; false/加载失败=回退旧整片染色。
// ⚠️ 真机若 shader 编译崩(headless 看不到), 置 false 强制走 fallback。
const USE_COLOR_FILTER_SHADER = false; // 暂回退可靠的整片染色 —— 逐像素 shader 卡在 Cocos 2D 材质 uniform 投递(共享→随机宽/逐实例→不显色), 无法 headless 验证调试; 待编辑器内可验时再开

// 代码生成一张【白色径向渐变】柔光纹理: alpha 高斯衰减到 0, GPU 逐像素采样 → 平滑无分界线
// (Cocos Graphics 没有 canvas 的 createRadialGradient, 故把渐变烤进运行时纹理)。建一次缓存复用。
let cachedGlowSpriteFrame: SpriteFrame | null = null;
function radialGlowFalloff(d: number): number {
  // d∈[0,1]: 高斯核 × 末端压平, 保证 d=1 → 0(边缘不硬切)。处处连续 → 无可见分界。
  if (d >= 1) return 0;
  const g = Math.exp(-(d * d) * GLOW_FALLOFF_GAUSS);
  const edge = 1 - d * d * d * d; // d→1 时拉到 0
  return Math.max(0, g * edge);
}
function getRadialGlowSpriteFrame(): SpriteFrame {
  if (cachedGlowSpriteFrame) {
    return cachedGlowSpriteFrame;
  }
  const size = GLOW_TEX_SIZE;
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  const maxR = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - c) / maxR;
      const dy = (y - c) / maxR;
      const a = Math.round(radialGlowFalloff(Math.min(1, Math.hypot(dx, dy))) * 255);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = a;
    }
  }
  const image = new ImageAsset({
    width: size,
    height: size,
    _data: data,
    _compressed: false,
    format: Texture2D.PixelFormat.RGBA8888
  });
  cachedGlowSpriteFrame = SpriteFrame.createWithImage(image);
  return cachedGlowSpriteFrame;
}

// 代码生成一张【有方向的锥形渐变】纹理: 锥顶在左中(出光口)最亮, 沿 +x 张开到右、越远越散越淡。
// 渲染时锥顶锚在手电大头、整片转到光向 → 光从手电射出、近端最强、向地面铺开发散变弱(真实光学)。
let cachedConeSpriteFrame: SpriteFrame | null = null;
function getConeGlowSpriteFrame(): SpriteFrame {
  if (cachedConeSpriteFrame) {
    return cachedConeSpriteFrame;
  }
  const size = GLOW_TEX_SIZE;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const across = y / (size - 1) - 0.5; // -0.5..0.5(锥轴在中线)
    for (let x = 0; x < size; x += 1) {
      const along = x / (size - 1); // 0=锥顶(出光口) .. 1=锥底(far)
      const halfW = CONE_TEX_MIN_HALF + along * (CONE_TEX_MAX_HALF - CONE_TEX_MIN_HALF);
      const q = Math.abs(across) / halfW; // 0=锥轴, 1=锥侧
      const bAlong = Math.pow(Math.max(0, 1 - along), CONE_ALONG_POW); // 近端最亮 → 远端 0
      const bAcross = Math.max(0, 1 - q * q); // 轴最亮 → 锥侧 0(柔边)
      const a = Math.round(Math.max(0, bAlong * bAcross) * 255);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = a;
    }
  }
  const image = new ImageAsset({
    width: size,
    height: size,
    _data: data,
    _compressed: false,
    format: Texture2D.PixelFormat.RGBA8888
  });
  cachedConeSpriteFrame = SpriteFrame.createWithImage(image);
  return cachedConeSpriteFrame;
}

type M01GreyboxPointerEvent = EventTouch & {
  getID?: () => number;
  getUILocation: () => { x: number; y: number };
};
type M01GreyboxPresentation =
  | M01GreyboxFragmentPresentation
  | M01GreyboxFilterPresentation
  | M01GreyboxSlotPresentation
  | M01GreyboxRepairPresentation
  | "normal";

function shouldEnableM01ArtPreviewFromUrl(): boolean {
  const search = (globalThis as { location?: { search?: string } }).location?.search;
  if (!search) {
    return false;
  }

  const searchParams = new URLSearchParams(search);
  return searchParams.get("m01ArtPreview") === "1";
}

function getM01ManualTargetStorage(): M01ManualTargetStorage | null {
  return (globalThis as { localStorage?: M01ManualTargetStorage }).localStorage ?? null;
}

@ccclass("M01GreyboxBootstrap")
export class M01GreyboxBootstrap extends Component {
  @property(Label)
  statusLabel: Label | null = null;

  @property({ type: CCBoolean })
  enableArtPreview = false;

  @property({ type: CCBoolean })
  showArtPreviewDebugUnderlay = false;

  private session: M01GreyboxSession | null = null;
  private config: M01MemoryGearConfig | null = null;
  private layout: M01GreyboxLayout | null = null;
  private greyboxRoot: Node | null = null;
  private physicsBoundary: M01PhysicsBoundary | null = null;
  private physicsPile: M01PhysicsPile | null = null;
  private physicsSettled = false;
  private introFragmentsReleased = true;
  private introSequence: M01IntroSequence | null = null;
  private pendingPhysicsFragments: { node: Node; shape: M01PhysicsShape; size: number }[] = [];
  private toolCardRoot: Node | null = null;
  private targetReferenceZoomRoot: Node | null = null;
  private hintButtonRoot: Node | null = null;
  private feedbackLabel: Label | null = null;
  private activeDragNode: Node | null = null;
  private activeDragToken: M01GreyboxTokenNode | null = null;
  private bottomLightGraphics: Graphics | null = null;
  private manualTargetBlendGraphics: Graphics | null = null;
  private validationFlashVisible = true;
  private validationLightResetTimeout: ReturnType<typeof setTimeout> | undefined;
  private validationFailureReturnTimeout: ReturnType<typeof setTimeout> | undefined;
  private readonly validationFailureFlashTimeouts: Array<ReturnType<typeof setTimeout>> = [];
  // 修复动画(spec §5.2: 齿轮转动→碎片漩涡喷出→化星光; 时序由 config repair.steps 经 M01RepairSequence 编排)。
  private readonly repairSequenceTimeouts: Array<ReturnType<typeof setTimeout>> = [];
  private repairSequencePlaying = false;
  private heldFragmentId: string | undefined;
  private heldPointerId: string | number | undefined;
  private heldFragmentPointerOffset: M01GreyboxPoint | null = null;
  private dragState: DragState = {};
  private activeFragmentDragOffset: M01GreyboxPoint | null = null;
  private globalPointerInputBound = false;
  private suppressNextRootClick = false;
  // 双击持握拼片旋转手势(取代旧"旋转90°"按钮): 记上一次点击时间/位置/拼片, 下次点击据此判双击。
  private lastHeldTapTime = 0;
  private lastHeldTapPos: M01GreyboxPoint = { x: 0, y: 0 };
  private lastHeldTapFragmentId: string | undefined;
  private readonly text: M01GreyboxTextOverrides = {};
  private readonly greyboxNodes = new Map<
    string,
    {
      node: Node;
      token: M01GreyboxTokenNode;
      graphics: Graphics;
      artSprite: Sprite | null;
      artEdgeSprite: Sprite | null;
    }
  >();
  private readonly artPreviewFallbackUnderlayIds = new Set<string>();
  private readonly artSpriteResourcePaths = new Map<Sprite, string>();
  private readonly weakSnappedFragmentsByEvidence = new Map<string, string[]>();
  private readonly tokenPositions = new Map<string, M01GreyboxPoint>();
  private readonly tokenRotations = new Map<string, number>();
  private hintedTargetIds = new Set<string>();
  // --- v4 手持手电状态(intro 捡起后交接; beam/覆盖面锚莱米, 点手电循环 红/黄/蓝/灭) ---
  /** Lemmy 已捡起手电(intro onFlashlightAcquired 交接后置 true; 与 physicsSettled 共同门控正式拼接)。 */
  private flashlightAcquired = false;
  /** 当前灯态(off/red/yellow/blue); 点手持手电经 cycleLight 循环, off 走 Session.clearFlashlight()。 */
  private activeLightState: LightState = "off";
  /** intro 交接的莱米节点 = beam/覆盖面锚点(每帧读其位置, 走位 tween 时光池随行)。 */
  private lemmyAnchorNode: Node | null = null;
  /** intro 交接的手持手电节点(挂在莱米身上); 用于按灯态给手电体着色反馈。 */
  private lemmyFlashlightNode: Node | null = null;
  private coverageBeamNode: Node | null = null;
  /** 光柱(空气光)/落地灯色晕/白热核 三层柔光精灵; 共用代码生成的径向渐变纹理, 每帧调位姿+染色。 */
  private coverageConeSprite: Sprite | null = null;
  private coverageCoreSprite: Sprite | null = null;
  private flashlightHeadGlow: Sprite | null = null; // 大头灯色光晕(挂手电节点; 只大头变色, 手电体本色)
  private colorFilterMat: Material | null = null; // fx_color-filter 共享材质(挂 9 拼片; 逐像素显色)
  private colorFilterAvailable = false; // 材质加载成功且总开关开 → 走 shader 显色; 否则 fallback 旧整片染色
  /** 上次显色重算的覆盖状态键(灯色+覆盖集合); 变化才触发 Session 重显色, 避免逐帧churn。 */
  private coverageStateKey: string | undefined;
  /** 上次光池重绘键(灯色+圆心); 变化才清画 Graphics。 */
  private coverageDrawKey: string | undefined;

  start(): void {
    this.loadColorFilterShader();
    resources.load("configs/stage1/m01-memory-gear", JsonAsset, (error, asset) => {
      if (error || !asset) {
        this.setStatus(
          this.formatText("loadFailed", { reason: error?.message ?? "unknown error" })
        );
        return;
      }

      const m01Config = resolveM01ConfigWithCurrentTargetEvidence(
        asset.json as unknown as M01MemoryGearConfig
      );
      this.config = m01Config;
      this.session = M01GreyboxSession.fromConfig(m01Config, { text: this.text });
      this.layout = buildM01GreyboxLayout(m01Config, { text: this.text });
      this.toolCardRoot = null;
      this.targetReferenceZoomRoot = null;
      this.hintButtonRoot = null;
      this.feedbackLabel = null;
      this.manualTargetBlendGraphics = null;
      this.weakSnappedFragmentsByEvidence.clear();
      this.tokenPositions.clear();
      this.tokenRotations.clear();
      this.hintedTargetIds.clear();
      this.heldFragmentId = undefined;
      this.heldPointerId = undefined;
      this.heldFragmentPointerOffset = null;
      this.validationFlashVisible = true;
      this.introFragmentsReleased = true;
      this.enableArtPreview = this.enableArtPreview || shouldEnableM01ArtPreviewFromUrl();
      this.renderGreybox(this.layout);
      this.restoreManualTargetDraft();
      this.exposeManualTargetTools();
      this.syncVisualState();
      this.setStatus(this.layout.statusText);

      // Physics + intro sequence: attach boundary, pile, and Lemmy/basket intro.
      // The pile is prepared synchronously (so box2d registers bodies) but does
      // NOT start dropping until the basket tips. Each fragment node is hidden
      // until the spill begins.
      if (this.greyboxRoot && this.layout) {
        this.physicsBoundary = this.greyboxRoot.addComponent(M01PhysicsBoundary);
        this.physicsPile = this.greyboxRoot.addComponent(M01PhysicsPile);

        // Step 1: collect physics fragments while nodes are still active.
        const physicsFragments: { node: Node; shape: M01PhysicsShape; size: number }[] = [];
        for (const fragmentToken of this.layout.fragments) {
          const entry = this.greyboxNodes.get(fragmentToken.controllerId);
          if (!entry) continue;
          physicsFragments.push({
            node: entry.node,
            shape: fragmentToken.shapeToken as M01PhysicsShape,
            size: Math.max(fragmentToken.size.width, fragmentToken.size.height)
          });
        }
        this.pendingPhysicsFragments = physicsFragments;

        // Step 2: pre-attach physics components while nodes are ACTIVE.
        // Required for Cocos box2d to register bodies with the physics world.
        this.physicsPile.preparePhysicsWorld(physicsFragments, this.physicsBoundary);
        this.physicsBoundary.renderGroundLine();

        // Step 3: hide all real fragments. The loaded hanging-basket artwork
        // already contains painted pieces, so the live physics fragments stay
        // invisible until the spill begins.
        this.introFragmentsReleased = false;
        for (const f of physicsFragments) {
          f.node.active = false;
        }

        // Step 4: lock input + show intro hint text. Player must tap basket to start.
        // 正式拼接双门控的两个闩在此一起复位: 拼片要等物理沉降 + 手电到手(spec §5.2 交互流程 ①)。
        this.physicsSettled = false;
        this.flashlightAcquired = false;
        this.activeLightState = "off";
        this.coverageStateKey = undefined;
        this.coverageDrawKey = undefined;
        this.setStatus(this.formatText("physicsSettling", {}));

        // Step 5: spawn the intro and hand it the REAL 9 fragment nodes. The
        // intro parents them into the basket (in pile shape), freezes their
        // physics bodies as Static, then releases them on tip by reparenting
        // back to greybox root and calling physicsPile.startDrop with
        // releaseInPlace=true — pieces fall from their actual basket positions,
        // not from the sky. No duplicate "preview" sprites in the basket.
        this.introSequence = this.greyboxRoot.addComponent(M01IntroSequence);
        this.introSequence.init({
          fragments: physicsFragments.map((f) => ({ node: f.node })),
          onSpill: (originX, originY) => {
            if (!this.physicsPile || !this.layout) return;
            this.introFragmentsReleased = true;
            this.physicsPile.startDrop({
              fragments: this.pendingPhysicsFragments,
              seed: Date.now(),
              dropOriginX: originX,
              dropOriginY: originY,
              jitterX: 22,
              settleTimeoutMs: 3600,
              releaseInPlace: true,
              onSettled: () => {
                this.physicsSettled = true;
                if (this.layout) {
                  this.setStatus(this.layout.statusText);
                }
                // 拾片放宽后玩家可能在沉降【前】就预拼完整结构; 若手电先到手、物理后落定, 之前两次 retry
                // 都因 !physicsSettled 早返回 → 落定这刻补一次, 否则要再挪片才触发底光(内部仍双门控, 没齐=no-op)。
                this.tryValidateCompleteEvidenceCandidate();
              }
            });
          },
          onSettled: () => {
            // Lemmy walked off-stage. Physics settle runs independently.
          },
          // v4 手持手电交接(intro 蹲下捡起后): 闩 flashlightAcquired + 记 beam 锚点(莱米节点,
          // 走位 tween 时每帧读位置)与手持手电节点。光束/覆盖面从此随莱米移动(spec §5.2)。
          onFlashlightAcquired: ({ lemmyNode, flashlightNode }) => {
            this.flashlightAcquired = true;
            this.lemmyAnchorNode = lemmyNode;
            this.lemmyFlashlightNode = flashlightNode;
            this.ensureCoverageBeamNode();
            this.applyHeldFlashlightTint();
            // 拾片放宽后(只需 physicsSettled)玩家可在捡手电【前】就拼出完整候选结构,
            // 但底光验证仍双门控、此前每次 drop 都 early-return。手电到手=验证门刚开 →
            // 这里补一次验证, 否则预拼好的完整结构要等下次挪片才会触发底光(codex P2)。
            this.tryValidateCompleteEvidenceCandidate();
          },
          // acquired 后点莱米手里的手电 → 循环 红/黄/蓝/灭(intro 只转发, 路由与显色在 puzzle 侧)。
          onHeldFlashlightTap: () => this.handleHeldFlashlightTap()
        });
      }
    });
  }

  private setCanvasCursor(style: string): void {
    if (game.canvas) game.canvas.style.cursor = style;
  }

  onDestroy(): void {
    this.setCanvasCursor("default");
    this.hideManualTargetTools();
    this.clearValidationLightReset();
    this.clearFailedCandidateReturn();
    this.clearRepairSequenceTimeouts();
    this.unbindGlobalPointerInput();
    this.dragState = {};
    this.clearActiveDrag();
  }

  update(): void {
    // 莱米走位是 tween 驱动 → 光池/覆盖面在 update 跟随其当前位置(位置派生, 非时间积分, 无需 dt)。
    this.syncFlashlightCoverage();

    if (!this.layout || this.layout.evidenceSnapEnabled) {
      return;
    }

    this.persistManualTargetDraft();
    this.syncManualTargetDebugExport();
  }

  selectFilter(filterIdOrColor: string): void {
    if (!this.session) {
      this.setStatus(this.formatText("notInitialized"));
      return;
    }

    this.setStatus(this.session.activateFilter(filterIdOrColor).status);
    this.clearHintTargets();
    this.syncFeedbackFromSession();
    this.syncVisualState();
  }

  selectFragment(fragmentId: string): void {
    if (!this.session) {
      this.setStatus(this.formatText("notInitialized"));
      return;
    }

    this.setStatus(this.session.selectFragment(fragmentId).status);
    this.clearHintTargets();
    this.syncFeedbackFromSession();
    this.syncVisualState();
  }

  placeFragment(fragmentId: string, slotId: string): void {
    if (!this.session) {
      this.setStatus(this.formatText("notInitialized"));
      return;
    }

    const selected = this.session.selectFragment(fragmentId);
    if (!selected.accepted) {
      this.setStatus(selected.status);
      this.syncFeedbackFromSession();
      this.syncVisualState();
      return;
    }

    const placed = this.session.placeSelectedFragment(slotId);
    this.setStatus(placed.status);
    this.clearHintTargets();
    this.syncFeedbackFromSession();
    this.syncVisualState();
    this.handlePlaceResult(placed);
  }

  placeSelectedFragment(slotId: string): void {
    if (!this.session) {
      this.setStatus(this.formatText("notInitialized"));
      return;
    }

    const placed = this.session.placeSelectedFragment(slotId);
    this.setStatus(placed.status);
    this.clearHintTargets();
    this.syncFeedbackFromSession();
    this.syncVisualState();
    this.handlePlaceResult(placed);
  }

  requestHint(): void {
    if (!this.session) {
      this.setStatus(this.formatText("notInitialized"));
      return;
    }

    const hint = this.session.requestHint();
    this.hintedTargetIds = new Set(hint.targetIds);
    this.setStatus(hint.text);
    this.setFeedback(hint.text);
    this.syncVisualState();
  }

  private setStatus(message: string): void {
    if (this.statusLabel) {
      this.statusLabel.string = message;
    }
  }

  private setFeedback(message: string): void {
    if (this.feedbackLabel) {
      this.feedbackLabel.string = message;
    }
  }

  private syncFeedbackFromSession(): void {
    const feedback = this.session?.getLastFeedback();
    this.setFeedback(feedback?.message ?? "");
  }

  private handlePlaceResult(result: M01GreyboxPlaceResult): void {
    if (!result.completed || !this.session || !this.greyboxRoot || this.toolCardRoot) {
      return;
    }

    const card = this.session.getLastToolCard();
    if (card) {
      this.setFeedback("");
      this.renderToolCardPreview(this.greyboxRoot, card);
    }
  }

  private renderGreybox(layout: M01GreyboxLayout): void {
    this.greyboxNodes.clear();
    this.artPreviewFallbackUnderlayIds.clear();
    this.artSpriteResourcePaths.clear();
    this.greyboxRoot = new Node("M01GreyboxRuntime");
    this.node.addChild(this.greyboxRoot);
    const rootTransform = this.greyboxRoot.addComponent(UITransform);
    rootTransform.setContentSize(layout.canvas.width, layout.canvas.height);
    this.addRootPointerCapture(this.greyboxRoot);
    this.bindGlobalPointerInput();

    this.addBottomLightNode(this.greyboxRoot, layout);
    this.addShapeNode(this.greyboxRoot, layout.gear);
    if (layout.evidence.length > 0) {
      this.addShapeNode(this.greyboxRoot, layout.board);
      this.addBottomLightHintNote(this.greyboxRoot);
    }
    if (this.enableArtPreview) {
      this.renderStaticArtPreview(this.greyboxRoot, layout);
      this.renderTargetOverlapEvidence(this.greyboxRoot, layout);
    }
    if (layout.referencePattern) {
      this.addShapeNode(this.greyboxRoot, layout.referencePattern);
    } else {
      for (const evidence of layout.referenceEvidence) {
        this.addShapeNode(this.greyboxRoot, evidence);
      }
    }
    for (const slot of layout.slots ?? []) {
      this.addShapeNode(this.greyboxRoot, slot);
    }
    for (const fragment of layout.fragments) {
      this.addShapeNode(this.greyboxRoot, fragment);
    }
    this.addManualTargetBlendOverlayNode(this.greyboxRoot, layout);
    for (const filter of layout.filters ?? []) {
      this.addShapeNode(this.greyboxRoot, filter);
    }

    if (!this.statusLabel) {
      this.statusLabel = this.addStatusLabel(this.greyboxRoot);
    }
    this.feedbackLabel = this.addFeedbackLabel(this.greyboxRoot);
    this.hintButtonRoot = this.addHintButton(this.greyboxRoot);
  }

  private addRootPointerCapture(parent: Node): void {
    parent.on("touch-start", (event: EventTouch) => this.beginActivePointerPress(event), this);
    parent.on("touch-end", (event: EventTouch) => this.placeHeldFragmentAt(event), this);
  }

  private addBottomLightNode(parent: Node, layout: M01GreyboxLayout): Node {
    const lightNode = new Node("M01BottomLight");
    const boardPosition = layout.board.position;
    lightNode.setPosition(boardPosition.x, boardPosition.y, 0);
    parent.addChild(lightNode);

    const transform = lightNode.addComponent(UITransform);
    transform.setContentSize(layout.board.size.width + 48, layout.board.size.height + 48);

    this.bottomLightGraphics = lightNode.addComponent(Graphics);
    this.drawBottomLight("off");
    return lightNode;
  }

  private addManualTargetBlendOverlayNode(parent: Node, layout: M01GreyboxLayout): Node | null {
    if (layout.evidenceSnapEnabled) {
      this.manualTargetBlendGraphics = null;
      return null;
    }

    const overlayNode = new Node("M01ManualTargetBlendOverlay");
    parent.addChild(overlayNode);

    const transform = overlayNode.addComponent(UITransform);
    transform.setContentSize(layout.canvas.width, layout.canvas.height);

    this.manualTargetBlendGraphics = overlayNode.addComponent(Graphics);
    this.drawManualTargetBlendOverlays();
    return overlayNode;
  }

  private drawManualTargetBlendOverlays(): void {
    const graphics = this.manualTargetBlendGraphics;
    if (!graphics) {
      return;
    }

    graphics.clear();
    if (!this.layout || this.layout.evidenceSnapEnabled) {
      return;
    }

    const overlays = resolveM01StandardPieceBlendOverlays(
      this.collectManualTargetBlendPieces()
    );
    for (const overlay of overlays) {
      graphics.lineWidth = 0;
      graphics.fillColor = colorForManualTargetBlendOverlay(overlay.colorToken);
      graphics.strokeColor = new Color(0, 0, 0, 0);
      drawPolygon(graphics, overlay.points);
      graphics.fill();
    }
  }

  private collectManualTargetBlendPieces(): M01StandardPieceBlendPlacement[] {
    if (!this.layout) {
      return [];
    }

    return this.layout.fragments
      .map((fragment) => ({
        id: fragment.controllerId,
        shapeToken: fragment.shapeToken,
        colorToken: fragment.colorToken,
        position: this.resolveManualTargetFragmentPosition(fragment),
        size: fragment.size,
        rotation: this.tokenRotations.get(fragment.controllerId) ?? 0
      }))
      .filter((piece) => this.isPointInsideManualTargetBoard(piece.position));
  }

  private getManualTargetPlacements(): M01ManualTargetPiecePlacement[] {
    if (!this.layout) {
      return [];
    }

    return this.layout.fragments
      .map((fragment) => ({
        fragmentId: fragment.controllerId,
        position: roundM01Point(this.resolveManualTargetFragmentPosition(fragment)),
        rotation: this.tokenRotations.get(fragment.controllerId) ?? 0
      }))
      .filter((placement) => this.isPointInsideManualTargetBoard(placement.position));
  }

  private resolveManualTargetFragmentPosition(fragment: M01GreyboxTokenNode): M01GreyboxPoint {
    const entry = this.greyboxNodes.get(fragment.controllerId);
    const nodePosition = entry?.node.position;
    if (nodePosition) {
      return {
        x: nodePosition.x,
        y: nodePosition.y
      };
    }

    return this.tokenPositions.get(fragment.controllerId) ?? fragment.position;
  }

  private deriveManualTargetEvidence(): ReturnType<typeof deriveM01TargetEvidenceFromPlacements> {
    if (!this.config) {
      return [];
    }

    return deriveM01TargetEvidenceFromPlacements(this.config, this.getManualTargetPlacements());
  }

  private exposeManualTargetTools(): void {
    (globalThis as {
      __m01ManualTargetTools?: {
        getPlacements: () => M01ManualTargetPiecePlacement[];
        deriveEvidence: () => ReturnType<typeof deriveM01TargetEvidenceFromPlacements>;
        saveDraft: () => void;
        restoreDraft: () => boolean;
      };
    }).__m01ManualTargetTools = {
      getPlacements: () => this.getManualTargetPlacements(),
      deriveEvidence: () => this.deriveManualTargetEvidence(),
      saveDraft: () => this.persistManualTargetDraft(),
      restoreDraft: () => this.restoreManualTargetDraft()
    };
    this.syncManualTargetDebugExport();
  }

  private hideManualTargetTools(): void {
    delete (globalThis as { __m01ManualTargetTools?: unknown }).__m01ManualTargetTools;
    (globalThis as { document?: Document }).document
      ?.getElementById("m01-manual-target-export")
      ?.remove();
  }

  private restoreManualTargetDraft(): boolean {
    if (!this.layout || this.layout.evidenceSnapEnabled) {
      return false;
    }

    const placements = readM01ManualTargetPlacements(getM01ManualTargetStorage());
    if (placements.length === 0) {
      return false;
    }

    const fragmentsById = new Map(
      this.layout.fragments.map((fragment) => [fragment.controllerId, fragment])
    );
    let restored = false;
    for (const placement of placements) {
      const fragment = fragmentsById.get(placement.fragmentId);
      const entry = this.greyboxNodes.get(placement.fragmentId);
      if (!fragment || !entry || !this.isPointInsideManualTargetBoard(placement.position)) {
        continue;
      }

      entry.node.setPosition(placement.position.x, placement.position.y, 0);
      entry.node.setRotationFromEuler(0, 0, placement.rotation ?? 0);
      this.tokenPositions.set(placement.fragmentId, placement.position);
      this.tokenRotations.set(placement.fragmentId, placement.rotation ?? 0);
      restored = true;
    }

    this.drawManualTargetBlendOverlays();
    this.syncManualTargetDebugExport();
    return restored;
  }

  private persistManualTargetDraft(): void {
    if (!this.layout || this.layout.evidenceSnapEnabled) {
      return;
    }

    writeM01ManualTargetPlacements(getM01ManualTargetStorage(), this.getManualTargetPlacements());
    this.syncManualTargetDebugExport();
  }

  private redrawAndPersistManualTargetDraft(): void {
    this.drawManualTargetBlendOverlays();
    this.persistManualTargetDraft();
  }

  private syncManualTargetDebugExport(): void {
    const documentRef = (globalThis as { document?: Document }).document;
    if (!documentRef?.body) {
      return;
    }

    let exportNode = documentRef.getElementById("m01-manual-target-export");
    if (!exportNode) {
      exportNode = documentRef.createElement("div");
      exportNode.id = "m01-manual-target-export";
      exportNode.style.display = "none";
      documentRef.body.appendChild(exportNode);
    }

    const placements = this.getManualTargetPlacements();
    const evidence = this.deriveManualTargetEvidence();
    exportNode.setAttribute("data-placement-count", String(placements.length));
    exportNode.setAttribute("data-evidence-count", String(evidence.length));
    exportNode.setAttribute("data-placements-json", JSON.stringify(placements));
    exportNode.setAttribute("data-evidence-json", JSON.stringify(evidence));
  }

  private isPointInsideManualTargetBoard(point: M01GreyboxPoint): boolean {
    if (!this.layout) {
      return false;
    }

    const board = this.layout.board;
    const dx = point.x - board.position.x;
    const dy = point.y - board.position.y;
    const radius = board.size.width / 2 - FRAGMENT_INPUT_HIT_SIZE / 2;
    return dx * dx + dy * dy <= radius * radius;
  }

  private addBottomLightHintNote(parent: Node): Node {
    const noteNode = new Node("M01BottomLightNote");
    noteNode.setPosition(-372, -218, 0);
    parent.addChild(noteNode);

    const transform = noteNode.addComponent(UITransform);
    transform.setContentSize(144, 82);

    const graphics = noteNode.addComponent(Graphics);
    drawBottomLightHintNote(graphics);
    return noteNode;
  }

  private drawBottomLight(state: M01BottomLightState): void {
    if (!this.bottomLightGraphics) {
      return;
    }

    const graphics = this.bottomLightGraphics;
    graphics.clear();
    graphics.lineWidth = state === "off" ? 1.5 : 3;
    graphics.fillColor = colorForBottomLightFill(state);
    graphics.strokeColor = colorForBottomLightStroke(state);
    graphics.circle(0, 0, state === "off" ? 152 : 170);
    graphics.fill();
    graphics.stroke();

    if (state === "off") {
      return;
    }

    graphics.lineWidth = state === "flash_then_off" ? 2 : 2.5;
    graphics.strokeColor = colorForBottomLightRay(state);
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      const inner = state === "flash_then_off" ? 112 : 98;
      const outer = state === "flash_then_off" ? 186 : 176;
      graphics.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      graphics.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    }
    graphics.stroke();
  }

  private addStatusLabel(parent: Node): Label {
    const labelNode = new Node("M01StatusLabel");
    labelNode.setPosition(0, 286, 0);
    parent.addChild(labelNode);

    const transform = labelNode.addComponent(UITransform);
    transform.setContentSize(880, 32);

    const label = labelNode.addComponent(Label);
    label.enabled = !HIDE_SCREEN_TEXT;
    label.fontSize = 18;
    label.lineHeight = 24;
    label.color = new Color(43, 43, 39, 255);
    return label;
  }

  private addFeedbackLabel(parent: Node): Label {
    const labelNode = new Node("M01FeedbackLabel");
    labelNode.setPosition(0, -250, 0);
    parent.addChild(labelNode);

    const transform = labelNode.addComponent(UITransform);
    transform.setContentSize(820, 28);

    const label = labelNode.addComponent(Label);
    label.enabled = !HIDE_SCREEN_TEXT;
    label.string = "";
    label.fontSize = 16;
    label.lineHeight = 22;
    label.color = new Color(82, 76, 63, 255);
    return label;
  }

  private addHintButton(parent: Node): Node {
    const buttonNode = new Node("M01HintButton");
    buttonNode.setPosition(412, 244, 0);
    parent.addChild(buttonNode);

    const transform = buttonNode.addComponent(UITransform);
    transform.setContentSize(54, 54);

    this.addHintIcon(buttonNode);
    buttonNode.on("touch-end", () => this.requestHint(), this);
    return buttonNode;
  }

  private addHintIcon(parent: Node): Sprite {
    const iconNode = new Node("M01HintButtonIcon");
    parent.addChild(iconNode);

    const transform = iconNode.addComponent(UITransform);
    transform.setContentSize(M01_HINT_ICON_DISPLAY_SIZE.width, M01_HINT_ICON_DISPLAY_SIZE.height);

    const sprite = iconNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    resources.load(M01_HINT_ICON_RESOURCE_PATH, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame) {
        this.setFeedback(
          this.formatText("loadFailed", {
            reason: error?.message ?? M01_HINT_ICON_RESOURCE_PATH
          })
        );
        iconNode.active = false;
        return;
      }

      sprite.spriteFrame = spriteFrame;
      // CUSTOM 模式会把裁剪后的贴图内容拉满写死框, 无视真实宽高比 → 横向压扁。
      // 按 frame.rect(裁剪后真实内容, 取不到再回退 spriteFrameSize)的宽高比,
      // 以 M01_HINT_ICON_DISPLAY_SIZE 为锚定框 "contain" 重算 contentSize(同 LemmyActor.fitSpriteToFrame)。
      const rect = spriteFrame.rect;
      const real =
        rect && rect.width > 0 && rect.height > 0 ? rect : spriteFrameSize(spriteFrame);
      const fitted = aspectContentSize(
        real.width,
        real.height,
        M01_HINT_ICON_DISPLAY_SIZE.width,
        M01_HINT_ICON_DISPLAY_SIZE.height,
        "contain"
      );
      transform.setContentSize(fitted.width, fitted.height);
    });
    return sprite;
  }

  private renderToolCardPreview(parent: Node, card: ReturnType<M01GreyboxSession["getLastToolCard"]>): void {
    if (!card) {
      return;
    }

    const preview = buildToolCardPreview(card, {
      text: {
        unlockedSubtitle: this.formatText("toolCardUnlockedSubtitle"),
        whenToUsePrefix: this.formatText("toolCardWhenToUsePrefix", { value: "{value}" })
      }
    });
    const cardRoot = new Node("M01ToolCardPreview");
    cardRoot.setPosition(240, -208, 0);
    parent.addChild(cardRoot);
    this.toolCardRoot = cardRoot;

    const transform = cardRoot.addComponent(UITransform);
    transform.setContentSize(360, 150);

    const background = cardRoot.addComponent(Graphics);
    background.lineWidth = 2;
    background.strokeColor = new Color(44, 43, 38, 255);
    background.fillColor = new Color(247, 244, 235, 238);
    background.rect(-180, -75, 360, 150);
    background.fill();
    background.stroke();
    this.renderToolCardArtFrame(cardRoot);

    this.addCardLabel(cardRoot, "M01ToolCardSubtitle", preview.subtitle, 0, 48, 13);
    this.addCardLabel(cardRoot, "M01ToolCardTitle", preview.title, 0, 24, 22);
    this.addCardLabel(cardRoot, "M01ToolCardCrystal", preview.lines[0] ?? "", 0, -8, 15);
    this.addCardLabel(cardRoot, "M01ToolCardAction", preview.lines[1] ?? "", 0, -34, 13);
    this.addCardLabel(cardRoot, "M01ToolCardUse", preview.lines[2] ?? "", 0, -56, 12);
  }

  private renderToolCardArtFrame(parent: Node): void {
    if (!this.enableArtPreview) {
      return;
    }

    const frame = getM01GreyboxToolCardFrameResource();
    if (!frame) {
      return;
    }

    const frameNode = new Node("M01ToolCardPreviewArtFrame");
    parent.addChild(frameNode);

    const transform = frameNode.addComponent(UITransform);
    transform.setContentSize(360, 150);

    const sprite = frameNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    resources.load(frame.resourcesLoadPath, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame) {
        this.setFeedback(this.formatText("loadFailed", { reason: error?.message ?? frame.resourcesLoadPath }));
        frameNode.active = false;
        return;
      }
      sprite.spriteFrame = spriteFrame;
    });
  }

  private addCardLabel(
    parent: Node,
    name: string,
    text: string,
    x: number,
    y: number,
    fontSize: number
  ): Label {
    const labelNode = new Node(name);
    labelNode.setPosition(x, y, 0);
    parent.addChild(labelNode);

    const transform = labelNode.addComponent(UITransform);
    transform.setContentSize(320, 24);

    const label = labelNode.addComponent(Label);
    label.enabled = !HIDE_SCREEN_TEXT;
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 5;
    label.color = new Color(43, 43, 39, 255);
    return label;
  }

  private addShapeNode(parent: Node, token: M01GreyboxTokenNode): Node {
    const node = new Node(token.id);
    node.setPosition(token.position.x, token.position.y, 0);
    parent.addChild(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(
      token.kind === "fragment" ? FRAGMENT_INPUT_HIT_SIZE : token.size.width,
      token.kind === "fragment" ? FRAGMENT_INPUT_HIT_SIZE : token.size.height
    );

    const graphics = node.addComponent(Graphics);
    this.applyTokenGraphicsState(graphics, token, "normal", token.kind === "slot" ? 3 : 2);
    this.bindGreyboxInput(node, token);
    const artSprite = this.enableArtPreview ? this.addTokenArtSprite(node, token) : null;
    const artEdgeSprite = this.enableArtPreview ? this.addTokenArtEdgeSprite(node, token) : null;
    this.greyboxNodes.set(token.controllerId, { node, token, graphics, artSprite, artEdgeSprite });
    this.tokenPositions.set(token.controllerId, token.position);
    this.tokenRotations.set(token.controllerId, 0);

    return node;
  }

  private applyTokenGraphicsState(
    graphics: Graphics,
    token: M01GreyboxTokenNode,
    presentation: M01GreyboxPresentation,
    lineWidth: number,
    colorTokenOverride?: string
  ): void {
    const color = colorForToken(colorTokenOverride ?? token.colorToken, token.kind, presentation);
    const forceFallbackUnderlay =
      this.artPreviewFallbackUnderlayIds.has(token.controllerId) ||
      (Boolean(colorTokenOverride) && token.kind !== "evidence" && token.kind !== "fragment");
    const renderStandardPieceGeometry = this.enableArtPreview && isM01StandardPieceToken(token);
    const renderUnderlay =
      !this.enableArtPreview ||
      shouldRenderArtPreviewUnderlay(
        token,
        presentation,
        this.showArtPreviewDebugUnderlay,
        forceFallbackUnderlay
      );
    graphics.lineWidth = renderUnderlay
      ? this.enableArtPreview
        ? lineWidthForArtPreview(token, lineWidth)
        : lineWidth
      : 0;
    graphics.strokeColor = renderUnderlay && renderStandardPieceGeometry
      ? new Color(44, 43, 38, presentation === "dimmed" ? 72 : 174)
      : renderUnderlay && this.enableArtPreview
      ? strokeColorForArtPreview(token, presentation)
      : renderUnderlay
        ? new Color(44, 43, 38, 255)
        : new Color(0, 0, 0, 0);
    graphics.fillColor = renderUnderlay && renderStandardPieceGeometry
      ? colorForStandardPieceGeometry(color, presentation)
      : renderUnderlay && this.enableArtPreview
      ? colorForArtPreviewUnderlay(color, presentation)
      : renderUnderlay
        ? color
        : new Color(0, 0, 0, 0);
    if (!renderUnderlay && token.kind === "reference_pattern") {
      graphics.clear();
      return;
    }
    drawTokenShape(graphics, token);
  }

  private addTokenArtSprite(parent: Node, token: M01GreyboxTokenNode): Sprite | null {
    if (token.kind === "evidence") {
      return null;
    }

    const resource = getM01GreyboxRuntimeSpriteResourceForToken(token);
    if (!resource) {
      return null;
    }

    const spriteNode = new Node(`M01ArtSprite_${resource.id}`);
    parent.addChild(spriteNode);

    const displaySize = resource.displaySize ?? token.size;
    const transform = spriteNode.addComponent(UITransform);
    transform.setContentSize(displaySize.width, displaySize.height);

    const sprite = spriteNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    if (token.kind === "fragment" && this.colorFilterMat) {
      sprite.customMaterial = this.colorFilterMat; // 逐像素显色 shader(材质后到则 attachColorFilterToFragments 补挂)
    }
    this.syncArtSpriteState(sprite, "normal", token);
    return sprite;
  }

  private addTokenArtEdgeSprite(parent: Node, token: M01GreyboxTokenNode): Sprite | null {
    if (token.kind !== "fragment") {
      return null;
    }

    const resource = getM01GreyboxRuntimeLightEdgeResourceForToken(token);
    if (!resource) {
      return null;
    }

    const spriteNode = new Node(`M01ArtSpriteEdge_${resource.id}`);
    parent.addChild(spriteNode);

    const displaySize = resource.displaySize ?? token.size;
    const transform = spriteNode.addComponent(UITransform);
    transform.setContentSize(displaySize.width, displaySize.height);

    const sprite = spriteNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.color = new Color(255, 255, 255, 255);
    spriteNode.active = false;
    this.syncArtSpriteFrameToResource(sprite, token, resource, { activateOnLoad: false });
    return sprite;
  }

  private renderStaticArtPreview(parent: Node, layout: M01GreyboxLayout): void {
    const plan = buildM01GreyboxStaticArtPlan(layout);
    for (const layer of plan.layers) {
      const layerNode = new Node(`M01StaticArt_${layer.id}`);
      layerNode.setPosition(layer.position.x, layer.position.y, 0);
      if (typeof layer.rotationDegrees === "number") {
        layerNode.setRotationFromEuler(0, 0, layer.rotationDegrees);
      }
      parent.addChild(layerNode);

      const transform = layerNode.addComponent(UITransform);
      transform.setContentSize(layer.size.width, layer.size.height);

      const spriteNode = layer.spriteSize ? new Node(`M01StaticArtImage_${layer.id}`) : layerNode;
      if (layer.spriteSize) {
        layerNode.addChild(spriteNode);
        const spriteTransform = spriteNode.addComponent(UITransform);
        spriteTransform.setContentSize(layer.spriteSize.width, layer.spriteSize.height);
      }

      const sprite = spriteNode.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      if (layer.tintColor) {
        sprite.color = new Color(
          layer.tintColor.r,
          layer.tintColor.g,
          layer.tintColor.b,
          layer.tintColor.a
        );
      }
      resources.load(layer.resourcesLoadPath, SpriteFrame, (error, spriteFrame) => {
        if (error || !spriteFrame) {
          this.setFeedback(
            this.formatText("loadFailed", { reason: error?.message ?? layer.resourcesLoadPath })
          );
          this.markStaticArtPreviewUnderlayFallback(layer.id);
          layerNode.active = false;
          return;
        }
        sprite.spriteFrame = spriteFrame;
      });
    }
  }

  private renderTargetOverlapEvidence(parent: Node, layout: M01GreyboxLayout): void {
    const plan = buildM01GreyboxTargetOverlapEvidencePlan(layout);
    for (const overlap of plan.overlaps) {
      const overlapNode = new Node(`M01TargetOverlapEvidence_${overlap.evidenceId}`);
      overlapNode.setPosition(overlap.position.x, overlap.position.y, 0);
      parent.addChild(overlapNode);

      const transform = overlapNode.addComponent(UITransform);
      const bounds = boundsForPoints(overlap.outline);
      transform.setContentSize(bounds.width, bounds.height);

      const overlapGraphics = overlapNode.addComponent(Graphics);
      overlapGraphics.lineWidth = 1.6;
      overlapGraphics.fillColor = colorForTargetOverlapEvidence(overlap.colorToken);
      overlapGraphics.strokeColor = new Color(44, 43, 38, 205);
      drawPolygon(overlapGraphics, overlap.outline);
      overlapGraphics.fill();
      overlapGraphics.stroke();
    }
  }

  private addTargetReferenceCircleFrame(parent: Node, size: { width: number; height: number }): void {
    const frameNode = new Node("M01TargetReferenceCircleFrame");
    parent.addChild(frameNode);

    const transform = frameNode.addComponent(UITransform);
    transform.setContentSize(size.width, size.height);

    const graphics = frameNode.addComponent(Graphics);
    const radius = Math.min(size.width, size.height) / 2;
    graphics.lineWidth = 3;
    graphics.strokeColor = new Color(44, 43, 38, 210);
    graphics.fillColor = new Color(247, 240, 220, 36);
    graphics.circle(0, 0, radius);
    graphics.fill();
    graphics.stroke();
  }

  private bindGreyboxInput(node: Node, token: M01GreyboxTokenNode): void {
    if (token.kind === "reference_pattern") {
      node.on("touch-end", () => this.toggleTargetReferenceZoom(), this);
    }

    if (token.kind === "slot") {
      node.on("touch-end", () => this.placeSelectedFragment(token.controllerId), this);
    }

    if (token.kind === "filter" || token.kind === "fragment") {
      node.on("touch-start", (event: EventTouch) => this.beginTokenDrag(event, node, token), this);
      node.on("touch-move", (event: EventTouch) => this.moveTokenDrag(event, node), this);
      node.on("touch-end", (event: EventTouch) => this.endTokenDrag(event, node, token), this);
      node.on("touch-cancel", (event: EventTouch) => this.cancelTokenDrag(event, node, token), this);
      // 光标手型提示(桌面/Steam; iOS 触屏无 hover, no-op): 悬到【此刻真能拖】的 token 上变摊开手(grab),
      // 移开复箭头, 抓起时由 beginTokenDrag 切握拳(grabbing)。fragment 跟拾片门控对齐(未顶出篮的不显手,
      // 否则视觉骗"能捡"); filter 恒可拖。落点松手后若仍悬在片上要移开再回才刷新成 grab(不跟踪 hover, 可接受)。
      node.on(
        "mouse-enter" as any,
        () => {
          if (
            token.kind !== "fragment" ||
            this.physicsSettled ||
            (this.introSequence?.isFragmentSpilledOut(node) ?? true)
          )
            this.setCanvasCursor("grab");
        },
        this
      );
      node.on("mouse-leave" as any, () => this.setCanvasCursor("default"), this);
    }
  }

  private toggleTargetReferenceZoom(): void {
    if (this.targetReferenceZoomRoot) {
      this.targetReferenceZoomRoot.active = false;
      this.targetReferenceZoomRoot = null;
      return;
    }

    if (!this.greyboxRoot || !this.layout?.referencePattern) {
      return;
    }

    const resource = getM01GreyboxTargetReferenceCardResource();
    if (!resource) {
      return;
    }

    const zoomRoot = new Node("M01TargetReferenceZoom");
    this.greyboxRoot.addChild(zoomRoot);
    this.targetReferenceZoomRoot = zoomRoot;

    const rootTransform = zoomRoot.addComponent(UITransform);
    rootTransform.setContentSize(this.layout.canvas.width, this.layout.canvas.height);
    zoomRoot.on("touch-end", () => this.toggleTargetReferenceZoom(), this);

    const backdrop = zoomRoot.addComponent(Graphics);
    backdrop.fillColor = new Color(36, 32, 26, 112);
    backdrop.rect(-this.layout.canvas.width / 2, -this.layout.canvas.height / 2, this.layout.canvas.width, this.layout.canvas.height);
    backdrop.fill();

    const cardNode = new Node("M01TargetReferenceZoomCard");
    zoomRoot.addChild(cardNode);
    const cardTransform = cardNode.addComponent(UITransform);
    cardTransform.setContentSize(360, 360);

    const circleFrame = cardNode.addComponent(Graphics);
    circleFrame.lineWidth = 4;
    circleFrame.strokeColor = new Color(44, 43, 38, 230);
    circleFrame.fillColor = new Color(247, 240, 220, 232);
    circleFrame.circle(0, 0, 180);
    circleFrame.fill();
    circleFrame.stroke();

    const spriteNode = new Node("M01TargetReferenceZoomImage");
    cardNode.addChild(spriteNode);
    const spriteTransform = spriteNode.addComponent(UITransform);
    spriteTransform.setContentSize(310, 173);
    const sprite = spriteNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    resources.load(resource.resourcesLoadPath, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame) {
        this.setFeedback(
          this.formatText("loadFailed", { reason: error?.message ?? resource.resourcesLoadPath })
        );
        return;
      }
      sprite.spriteFrame = spriteFrame;
    });
  }

  private bindGlobalPointerInput(): void {
    if (this.globalPointerInputBound) {
      return;
    }

    input.on(Input.EventType.MOUSE_DOWN, this.beginActivePointerPress, this);
    input.on(Input.EventType.MOUSE_MOVE, this.moveActivePointerDrag, this);
    input.on(Input.EventType.MOUSE_UP, this.endActivePointerDrag, this);
    input.on(Input.EventType.TOUCH_START, this.beginActivePointerPress, this);
    input.on(Input.EventType.TOUCH_MOVE, this.moveActivePointerDrag, this);
    input.on(Input.EventType.TOUCH_END, this.endActivePointerDrag, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.cancelActivePointerDrag, this);
    this.globalPointerInputBound = true;
  }

  private unbindGlobalPointerInput(): void {
    if (!this.globalPointerInputBound) {
      return;
    }

    input.off(Input.EventType.MOUSE_DOWN, this.beginActivePointerPress, this);
    input.off(Input.EventType.MOUSE_MOVE, this.moveActivePointerDrag, this);
    input.off(Input.EventType.MOUSE_UP, this.endActivePointerDrag, this);
    input.off(Input.EventType.TOUCH_START, this.beginActivePointerPress, this);
    input.off(Input.EventType.TOUCH_MOVE, this.moveActivePointerDrag, this);
    input.off(Input.EventType.TOUCH_END, this.endActivePointerDrag, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.cancelActivePointerDrag, this);
    this.globalPointerInputBound = false;
  }

  /**
   * Puzzle 侧两阶段点击路由(routeTap 纯函数定优先级)。此处只消费"点拼片=拾取且灭灯"这一拍:
   * 地面/吊篮/掉落手电归 intro sequence(点哪走哪/顶篮/拾取), 手持手电点击经 onHeldFlashlightTap
   * 进 handleHeldFlashlightTap, 持片放下由根节点 touch-end(placeHeldFragmentAt)结算 — 不双重处理。
   */
  private beginActivePointerPress(_event: M01GreyboxPointerEvent): void {
    // 全局按下不再做"近邻拼片→灭灯"判定(64px 近邻会误灭: 玩家点地走位、附近恰好有片时也灭)。
    // 灭灯改由 beginTokenDrag 在【真正抓到拼片节点】时触发(见该处)。拖拽的 move/end 仍走全局处理器。
  }

  private beginTokenDrag(event: M01GreyboxPointerEvent, node: Node, token: M01GreyboxTokenNode): void {
    if (!this.layout) {
      return;
    }
    // 拾片门控(spec §5.2): physicsSettled(整堆落定=谜题阶段)后, 碎片在盘上/地上任意位置都可拾放整理 ——
    // 这是常态。仅在【整堆落定前(顶篮间隙)】才用 intro.isFragmentSpilledOut 限制: 只许拾【真顶出篮(已释放且
    // 低于篮当前底边)】的片, 防"被顶起又弹回落在篮内堆上的片"被误判可拾(用户报"篮里三角形可拾")。
    // 注: 此门控贯穿全生命周期, 故必须用 physicsSettled 放行谜题阶段, 否则放到盘上(高于篮底)的片会变不可拾→卡死(codex)。
    if (
      token.kind === "fragment" &&
      !(this.physicsSettled || (this.introSequence?.isFragmentSpilledOut(node) ?? true))
    ) {
      return;
    }
    // 修复动画播放窗内锁输入(codex P2): 不许把刚验证的拼片拖走和喷出 tween 打架。
    if (this.repairSequencePlaying) {
      return;
    }

    const position = this.eventToLocalPoint(event);
    this.setCanvasCursor("grabbing"); // 抓起=握拳; clearActiveDrag(松手/取消)复位
    this.activeDragNode = node;
    this.activeDragToken = token;
    this.dragState = beginDragSession({
      pointerId: this.pointerIdForEvent(event),
      entityId: token.controllerId,
      position
    });
    if (token.kind === "fragment") {
      // 灭灯只在【真正抓到拼片】时(本 per-node touch-start 命中拼片节点)触发 —— 不再由全局
      // beginActivePointerPress 的 64px 近邻命中触发(那会在玩家只是点地走位、附近恰好有片时误灭灯)。
      this.suspendFlashlightObservation();
      this.heldFragmentPointerOffset = null;
      this.activeFragmentDragOffset = {
        x: node.position.x - position.x,
        y: node.position.y - position.y
      };
      const body = node.getComponent(RigidBody2D);
      if (body) {
        body.type = ERigidBody2DType.Kinematic;
        body.linearVelocity = new Vec2(0, 0);
        body.angularVelocity = 0;
      }
      this.setFragmentPointerControl(node, true);
      this.tokenPositions.set(token.controllerId, this.pointFromNodePosition(node.position));
    } else {
      this.activeFragmentDragOffset = null;
      node.setPosition(position.x, position.y, 0);
      this.tokenPositions.set(token.controllerId, position);
    }
    this.redrawAndPersistManualTargetDraft();
  }

  private moveActivePointerDrag(event: M01GreyboxPointerEvent): void {
    if (this.activeDragNode) {
      this.moveTokenDrag(event, this.activeDragNode);
      return;
    }

    this.moveHeldFragmentWithPointer(event);
  }

  private moveTokenDrag(event: M01GreyboxPointerEvent, node: Node): void {
    if (!this.dragState.active) {
      return;
    }

    this.dragState = moveDragSession(this.dragState, {
      pointerId: this.pointerIdForActiveDragEvent(event),
      position: this.eventToLocalPoint(event)
    });

    const active = this.dragState.active;
    if (active) {
      const target =
        this.activeDragToken?.kind === "fragment"
          ? this.resolveActiveFragmentDragTarget(active.currentPosition)
          : active.currentPosition;
      node.setPosition(target.x, target.y, 0);
      if (this.activeDragToken) {
        this.tokenPositions.set(this.activeDragToken.controllerId, target);
      }
      this.redrawAndPersistManualTargetDraft();
    }
  }

  private endActivePointerDrag(event: M01GreyboxPointerEvent): void {
    if (this.activeDragNode && this.activeDragToken) {
      this.endTokenDrag(event, this.activeDragNode, this.activeDragToken);
    }
  }

  private cancelActivePointerDrag(event: M01GreyboxPointerEvent): void {
    if (this.activeDragNode && this.activeDragToken) {
      this.cancelTokenDrag(event, this.activeDragNode, this.activeDragToken);
    }
  }

  private endTokenDrag(event: M01GreyboxPointerEvent, node: Node, token: M01GreyboxTokenNode): void {
    if (!this.dragState.active) {
      this.clearActiveDrag();
      return;
    }

    const transition = endDragSession(this.dragState, {
      pointerId: this.pointerIdForActiveDragEvent(event),
      position: this.eventToLocalPoint(event)
    });
    this.dragState = transition.state;

    if (transition.outcome.type !== "ended" || !transition.outcome.session) {
      this.resetTokenNode(node, token);
      this.clearActiveDrag();
      return;
    }

    if (this.tryHandleTokenClick(node, token, transition.outcome.session)) {
      this.suppressRootClickOnce();
      this.clearActiveDrag();
      return;
    }

    this.handleTokenDrop(node, token, transition.outcome.session.currentPosition);
    this.suppressRootClickOnce();
    this.clearActiveDrag();
  }

  private cancelTokenDrag(event: M01GreyboxPointerEvent, node: Node, token: M01GreyboxTokenNode): void {
    const transition = cancelDragSession(this.dragState, this.pointerIdForActiveDragEvent(event));
    this.dragState = transition.state;
    this.resetTokenNode(node, token);
    this.clearActiveDrag();
  }

  private clearActiveDrag(): void {
    if (this.activeDragToken?.kind === "fragment" && this.activeDragNode) {
      this.stopFragmentBodyMotion(this.activeDragNode);
    }
    this.activeFragmentDragOffset = null;
    this.activeDragNode = null;
    this.activeDragToken = null;
    // 松手/取消: 仍举着片(点击式拾取 heldFragmentId)→ 维持握拳; 否则复箭头(再悬到片上由 mouse-enter 切回 grab)。
    this.setCanvasCursor(this.heldFragmentId ? "grabbing" : "default");
  }

  private resolveActiveFragmentDragTarget(pointerPosition: M01GreyboxPoint): M01GreyboxPoint {
    const offset = this.activeFragmentDragOffset ?? { x: 0, y: 0 };
    return {
      x: pointerPosition.x + offset.x,
      y: pointerPosition.y + offset.y
    };
  }

  // ── v4 手持手电: 点手电循环灯色 + 覆盖面显色 + 光池渲染(锚莱米) ────────────────────────

  /**
   * acquired 后点莱米手里的手电(intro 仅转发)。routeTap 决定这次点击归谁: 持片时任何点击 =
   * 放下(由根节点 touch-end 的 placeHeldFragmentAt 结算, 此处不切灯), 否则循环 红→黄→蓝→灭。
   * red/yellow/blue 映射 Session.selectFlashlight(flashlight_<color>), off 走 clearFlashlight()。
   */
  private handleHeldFlashlightTap(): void {
    if (!this.session || this.repairSequencePlaying) {
      return; // 修复动画窗内不再循环灯色(codex P2 输入锁)
    }

    const action = routeTap(
      { heldFlashlight: true },
      { flashlightAcquired: this.flashlightAcquired, holdingPiece: this.heldFragmentId !== undefined }
    );
    if (action !== "cycleLight") {
      return;
    }

    this.activeLightState = cycleLight(this.activeLightState);
    const result =
      this.activeLightState === "off"
        ? this.session.clearFlashlight()
        : this.session.selectFlashlight(`flashlight_${this.activeLightState}`);
    this.setStatus(result.status);
    this.applyHeldFlashlightTint();
    this.syncFlashlightCoverage();
    this.syncVisualState();
  }

  /**
   * 覆盖面随莱米(每帧 update + 换色时调): 圆心 = 莱米当前位置 + config 偏移(flashlightCoverage);
   * fragmentsInCoverage 决定覆盖面内(排除已在拼接盘上的)哪些碎片以当前灯色显色。覆盖集合或灯色
   * 变化才走 Session 重显色 — 进圈显色、出圈/灭灯立即复灰(取代已删的一次性全场显色)。
   */
  private syncFlashlightCoverage(): void {
    const coverage = this.config?.flashlightCoverage;
    const anchor = this.lemmyAnchorNode;
    if (
      !this.session ||
      !coverage ||
      !anchor ||
      !this.flashlightAcquired ||
      this.activeLightState === "off"
    ) {
      this.hideCoverageBeam();
      return;
    }

    const beam = this.computeBeamGeometry(anchor, coverage);
    const center = beam.center;
    const covered = fragmentsInCoverage(center, coverage.radius, this.collectCoverageCandidates());
    const stateKey = `${this.activeLightState}:${covered.join(",")}`;
    if (stateKey !== this.coverageStateKey) {
      this.coverageStateKey = stateKey;
      this.session.clearObservedFragmentColors();
      if (covered.length > 0) {
        // persistent: 显色由覆盖面成员关系决定(出圈经上面的 clear 复灰), 不靠 2s 计时过期。
        this.session.revealFragments(covered, { persistent: true });
      }
      this.syncVisualState();
    }

    this.redrawCoverageBeam(beam, coverage.radius);
  }

  /**
   * 光束几何: 从手电【大头】(muzzle)沿手电真实朝向 dir 投到地面, 命中点=光池圆心(脚边)。
   * 手电朝向取手持手电节点 z 旋转(intro 据脸朝向设 ±120°, 已镜像)。角约定: 0=大头竖直上, -90=水平右
   * → dir = (-sin θ, cos θ)。
   * ⚠️ 圆心 = muzzle + dir × t(t 使 y 落到地面平面)→ muzzle→center 正好沿 dir, 光锥方向 = 手电朝向。
   * 手电斜下照 → 光打在莱米脚边(近), 不再硬塞到水平前方 150px(那会和手电朝向对不上)。
   */
  private computeBeamGeometry(
    anchor: Node,
    coverage: { radius: number; centerOffsetX: number; centerOffsetY: number }
  ): { muzzle: M01GreyboxPoint; dir: M01GreyboxPoint; center: M01GreyboxPoint } {
    const fl = this.lemmyFlashlightNode;
    const thetaDeg = fl ? fl.eulerAngles.z : 0;
    const theta = (thetaDeg * Math.PI) / 180;
    const dir = { x: -Math.sin(theta), y: Math.cos(theta) };
    const horiz = dir.x >= 0 ? 1 : -1; // 脸前方水平向(dir.x 的符号可靠, dir.y 竖直分量实测反, 不用)
    // 大头出光口(drawing 空间): 莱米节点位 + 手电局部位(手部) + 脸前方 REACH、向下 DROP 到大头。
    // ⚠️ 竖直用明确的【向下 DROP】, 不用 dir.y(它反了会把光顶往上推、与大头错开)。
    const gripX = anchor.position.x + (fl ? fl.position.x : 0);
    const gripY = anchor.position.y + (fl ? fl.position.y : 0);
    const muzzle = {
      x: gripX + horiz * COVERAGE_MUZZLE_REACH,
      y: gripY - COVERAGE_MUZZLE_DROP
    };
    // 圆心一律落在地面平面 y = 莱米 + centerOffsetY(碎片落地高度) → 光永远打地、绝不戳天。
    // 游戏判定圆心 = 光沿 dir 触地点(手电朝下才有交点; 否则退化为脚边前方一点, 保证落在地面)。
    const groundY = anchor.position.y + coverage.centerOffsetY;
    const hitForward =
      dir.y < -0.05 ? dir.x * ((groundY - muzzle.y) / dir.y) : horiz * COVERAGE_FALLBACK_FORWARD;
    const center = {
      x: muzzle.x + hitForward + coverage.centerOffsetX,
      y: groundY
    };
    return { muzzle, dir, center };
  }

  /** 覆盖面候选: 9 拼片的实时位置 + 是否在拼接盘上(已放槽/弱吸附在证据/位于盘圆内 → 光束不照)。 */
  private collectCoverageCandidates(): CoverageFragment[] {
    if (!this.layout || !this.session) {
      return [];
    }

    const candidates: CoverageFragment[] = [];
    for (const fragment of this.layout.fragments) {
      const entry = this.greyboxNodes.get(fragment.controllerId);
      if (!entry) {
        continue;
      }
      const position = this.pointFromNodePosition(entry.node.position);
      const view = this.session.getFragmentView(fragment.controllerId);
      const onAssemblyBoard =
        view.placed ||
        this.isFragmentWeakSnappedToEvidence(fragment.controllerId) ||
        this.isPointInsideManualTargetBoard(position);
      candidates.push({ id: fragment.controllerId, pos: position, onTray: onAssemblyBoard });
    }
    return candidates;
  }

  private isFragmentWeakSnappedToEvidence(fragmentId: string): boolean {
    for (const fragmentIds of this.weakSnappedFragmentsByEvidence.values()) {
      if (fragmentIds.includes(fragmentId)) {
        return true;
      }
    }
    return false;
  }

  /** 三层柔光精灵(共用代码生成的径向渐变纹理)挂 greybox 根最底层; 手电交接时建一次。 */
  private ensureCoverageBeamNode(): void {
    if (this.coverageBeamNode || !this.greyboxRoot || !this.layout) {
      return;
    }

    const beamNode = new Node("M01LemmyCoverageLightPool");
    this.greyboxRoot.addChild(beamNode);
    // 光池=地面辉光, 必须在拼片【下方】(否则亮核盖掉拼片显色)。送到最底层。
    // ⚠️ index 0 也压到 M01BottomLight 之下(今天无害: 区域不重叠+底光半透明); 若将来 greyboxRoot
    // 挂整屏不透明背景, 光池会被盖住 → 那时改成"插在拼片层正下方"。
    beamNode.setSiblingIndex(0);
    beamNode.setPosition(0, 0, 0);
    beamNode.active = false;
    this.coverageBeamNode = beamNode;

    // 画序(子节点先加=先画=在下): 空中三角光锥(锚点【左中】=锥顶/出光口) → 出光口白热核(居中, 上)。
    this.coverageConeSprite = this.addGlowSprite(beamNode, getConeGlowSpriteFrame(), 0, 0.5);
    this.coverageCoreSprite = this.addGlowSprite(beamNode, getRadialGlowSpriteFrame(), 0.5, 0.5);
  }

  /** 建一个用渐变纹理的柔光精灵子节点(内容尺寸=纹理边长, 锚点 ax/ay, 之后靠 node.scale/rotation 摆位)。 */
  private addGlowSprite(parent: Node, frame: SpriteFrame, ax: number, ay: number): Sprite {
    const node = new Node("M01GlowSprite");
    parent.addChild(node);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(GLOW_TEX_SIZE, GLOW_TEX_SIZE);
    transform.setAnchorPoint(ax, ay);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = frame;
    return sprite;
  }

  private hideCoverageBeam(): void {
    if (this.coverageBeamNode?.active) {
      this.coverageBeamNode.active = false;
    }
    this.writeBeamOff(); // 灯灭/出覆盖 → shader 关光, 否则拼片显色粘住不灭
    this.coverageDrawKey = undefined;
    this.coverageStateKey = undefined;
  }

  /** 加载 fx_color-filter effect → 建共享材质 → 挂到已建拼片。失败/总开关关 → colorFilterAvailable=false 走 fallback。 */
  private loadColorFilterShader(): void {
    if (!USE_COLOR_FILTER_SHADER) {
      this.colorFilterAvailable = false;
      return;
    }
    resources.load("shaders/fx_color-filter", EffectAsset, (err, eff) => {
      if (err || !eff) {
        this.colorFilterAvailable = false;
        return;
      }
      const mat = new Material();
      mat.initialize({ effectAsset: eff });
      this.colorFilterMat = mat;
      this.colorFilterAvailable = true;
      this.attachColorFilterToFragments();
      this.coverageDrawKey = undefined; // 强制下帧重画光束 → 写 uniform(否则光束没动时早退不写)
      this.syncVisualState(); // 让拼片改走 shader 路径(不换 light_mask 贴图)
    });
  }

  /** 给 9 个拼片 artSprite 挂共享 customMaterial(逐像素显色由 shader + sprite.color=revealColor 出)。 */
  private attachColorFilterToFragments(): void {
    if (!this.colorFilterMat) return;
    for (const entry of this.greyboxNodes.values()) {
      if (entry.token.kind === "fragment" && entry.artSprite) {
        entry.artSprite.customMaterial = this.colorFilterMat;
      }
    }
  }

  /** shader 关光(on=0): 多个早退路径(过盘/灯灭)都要写到各拼片实例, 否则上次 on=1 残留 → 显色不灭。 */
  private writeBeamOff(): void {
    if (!this.colorFilterAvailable) return;
    this.setBeamUniformOnFragments(new Vec4(0, 0, 0, 0), new Vec4(1, 0, 0, 0));
  }

  /**
   * 摆放光效精灵(灯色/朝向/位置变化才更新): 锥形灯色光(锥顶=大头出光口、张开射向地面远端, 近强远弱发散)
   * + 出光口白热核。经 coveragePoolHalfHeight 判定与拼接盘横向重叠时整束隐藏(光不照盘)。
   */
  private redrawCoverageBeam(
    beam: { muzzle: M01GreyboxPoint; dir: M01GreyboxPoint; center: M01GreyboxPoint },
    radius: number
  ): void {
    const beamNode = this.coverageBeamNode;
    const cone = this.coverageConeSprite;
    const core = this.coverageCoreSprite;
    const lightState = this.activeLightState;
    if (!beamNode || !cone || !core || !this.layout || lightState === "off") {
      return;
    }
    const { muzzle, center } = beam;

    const drawKey = `${lightState}:${Math.round(center.x)}:${Math.round(center.y)}:${Math.round(
      muzzle.x
    )}:${Math.round(muzzle.y)}`;
    if (drawKey === this.coverageDrawKey && beamNode.active) {
      return;
    }
    this.coverageDrawKey = drawKey;

    const board = this.layout.board;
    const halfHeight = coveragePoolHalfHeight({
      center,
      radiusX: radius,
      naturalHalfHeight: radius * COVERAGE_POOL_SQUASH,
      board: {
        x: board.position.x,
        y: board.position.y,
        width: board.size.width,
        height: board.size.height
      },
      clearance: COVERAGE_POOL_BOARD_CLEARANCE
    });
    if (halfHeight <= 0) {
      beamNode.active = false; // 与拼接盘横向重叠 → 整束隐藏(光不照盘硬规则)
      this.writeBeamOff(); // shader 同步关光, 否则过盘时拼片仍显色(违反光不照盘)
      return;
    }
    beamNode.active = true;

    const [r, g, b] = M01_BEAM_VISUAL_RGB[lightState]; // 光束视觉用提饱和调色板(黄色更显眼)
    const s = GLOW_TEX_SIZE;

    // ① 锥形灯色光: 锥顶(出光口)锚在大头, 沿【muzzle→着地点 center】方向张开 —— 这是你确认"对上了"的方向
    //    (center 被钳在地面 → 永远朝下前方; 比直接读手电 eulerAngles 稳, 后者实测竖直分量是反的)。
    //    长度独立用 BEAM_LENGTH 沿【同一方向】加长射程, 不被 center 的远近(短)限制。
    // 基础角 = muzzle→着地点; 再向下压 TILT(脸朝右 -、朝左 + → 两向都往地面偏)。
    const facing = Math.sign(center.x - muzzle.x) || 1;
    const baseAngle = (Math.atan2(center.y - muzzle.y, center.x - muzzle.x) * 180) / Math.PI;
    const angleDeg = baseAngle - facing * COVERAGE_BEAM_TILT_DEG;
    const angleRad = (angleDeg * Math.PI) / 180;
    const sinA = Math.sin(angleRad); // 竖直分量(<0=朝下)
    // 统一【地面线】= center.y 再下落 POOL_DROP(光斑贴的那条)。空中光锥与地面光斑都落到这条线 → 接上不断。
    const floorY = center.y - COVERAGE_POOL_DROP;
    // 钳【空中光锥】长度: 沿当前角到地面线的距离封顶 → 光锥落到地面线即止(与光斑同高), 不穿过地面。
    const lenToGround = sinA < -0.01 ? (floorY - muzzle.y) / sinA : COVERAGE_BEAM_LENGTH;
    const len = Math.max(1, Math.min(COVERAGE_BEAM_LENGTH, lenToGround));
    cone.node.setPosition(muzzle.x, muzzle.y, 0);
    cone.node.setRotationFromEuler(0, 0, angleDeg);
    cone.node.setScale(len / s, (len * COVERAGE_CONE_FAN) / s, 1); // 锥底张开宽 = len × FAN; 长度钳到地面线
    cone.color = new Color(r, g, b, COVERAGE_CONE_ALPHA);

    // 不叠椭圆光斑 —— 真实手电照地是【一个三角形】(顶点在大头、向前张开), 不是椭圆坨。
    // 这一条锥光本身就是三角形, footprint = 锥落地的宽端。

    // ② 出光口白热核: 大头处一小团白色柔光(固定小尺寸, 贴近镜头) → 白热核→灯色→透明的真实分布。
    const coreD = COVERAGE_CORE_DIAM_PX / s;
    core.node.setPosition(muzzle.x, muzzle.y, 0);
    core.node.setScale(coreD, coreD, 1);
    core.color = new Color(255, 255, 255, COVERAGE_CORE_ALPHA);

    // ③ 写 fx_color-filter 光束 uniform(世界空间): 拼片 shader 据此逐像素显色, 区域=可见光锥。
    // muzzle/center 是 greyboxRoot-local; beamNode 与拼片同在 greyboxRoot → 加 greyboxRoot 世界原点得世界坐标。
    // ⚠️ 假设 greyboxRoot 无缩放/旋转(预览需确认; 有则改 UITransform.convertToWorldSpaceAR)。
    const rootUT = this.greyboxRoot?.getComponent(UITransform) ?? null;
    if (this.colorFilterAvailable && this.colorFilterMat && rootUT) {
      // greyboxRoot-local muzzle/center → 世界坐标(含 Canvas 缩放/旋转), 与 2D sprite 顶点世界空间对齐。
      const muzzleW = rootUT.convertToWorldSpaceAR(new Vec3(muzzle.x, muzzle.y, 0));
      const centerW = rootUT.convertToWorldSpaceAR(new Vec3(center.x, floorY, 0)); // 落地点 = (center.x, floorY)
      // 半宽是长度量, 也要按 Canvas 缩放换算(用世界长度比值)。
      const worldLen = Math.hypot(centerW.x - muzzleW.x, centerW.y - muzzleW.y);
      const localLen = Math.hypot(center.x - muzzle.x, floorY - muzzle.y) || 1;
      const scale = worldLen / localLen;
      // 半宽与可见光锥纹理(getConeGlowSpriteFrame)几何完全一致: 锥全宽 = len×CONE_FAN,
      // 纹理近端半宽 = MIN_HALF×全宽, 远端 = MAX_HALF×全宽 → 显色区 = 可见光锥区(同形)。
      const fanwidth = len * COVERAGE_CONE_FAN;
      const field = worldBeamFromGeometry(
        { mx: muzzleW.x, my: muzzleW.y },
        { cx: centerW.x, cy: centerW.y },
        {
          nearHalf: CONE_TEX_MIN_HALF * fanwidth * scale,
          farHalf: CONE_TEX_MAX_HALF * fanwidth * scale,
          on: true
        }
      );
      this.setBeamUniformOnFragments(
        new Vec4(field.ox, field.oy, field.length, field.on ? 1 : 0),
        new Vec4(field.dx, field.dy, field.nearHalf, field.farHalf)
      );
    }
  }

  /**
   * 逐拼片把光束 uniform 写到【各自的材质实例】上(非共享原件)。共享材质 setProperty 不一定投递到
   * 2D sprite 的渲染实例 → 个别拼片冻结在赋材质时的旧值, 显色宽窄随机。逐实例写保证每片每帧都是最新光束。
   */
  private setBeamUniformOnFragments(origin: Vec4, dir: Vec4): void {
    for (const entry of this.greyboxNodes.values()) {
      if (entry.token.kind !== "fragment" || !entry.artSprite) continue;
      const mat = entry.artSprite.getMaterialInstance(0);
      if (!mat) continue;
      mat.setProperty("u_beamOrigin", origin);
      mat.setProperty("u_beamDir", dir);
    }
  }

  /**
   * 换灯色反馈: 手电【体】恒本色, 只在【大头】叠一小团灯色光晕(挂手电节点, 随之转/移)。
   * (旧实现 sprite.color 是整图染色 → 整个手电变色; 用户要求只大头变色。)
   */
  private applyHeldFlashlightTint(): void {
    const flashlightNode = this.lemmyFlashlightNode;
    if (!flashlightNode) {
      return;
    }

    // 手电体永远本色(白 = 不改原图)。
    const body =
      flashlightNode.getComponent(Sprite) ??
      flashlightNode.children
        .map((child) => child.getComponent(Sprite))
        .find((childSprite) => childSprite !== null) ??
      null;
    if (body) {
      body.color = new Color(255, 255, 255, 255);
    }

    // 大头灯色光晕(懒建, 挂手电节点的大头一端)。
    if (!this.flashlightHeadGlow) {
      const node = new Node("M01FlashlightHeadGlow");
      flashlightNode.addChild(node);
      node.setPosition(0, HELD_FLASHLIGHT_HEAD_Y, 0);
      node.addComponent(UITransform).setContentSize(GLOW_TEX_SIZE, GLOW_TEX_SIZE);
      const glow = node.addComponent(Sprite);
      glow.sizeMode = Sprite.SizeMode.CUSTOM;
      glow.spriteFrame = getRadialGlowSpriteFrame();
      const sc = COVERAGE_HEAD_GLOW_PX / GLOW_TEX_SIZE;
      node.setScale(sc, sc, 1);
      this.flashlightHeadGlow = glow;
    }

    const lightState = this.activeLightState;
    if (lightState === "off") {
      this.flashlightHeadGlow.node.active = false;
      return;
    }
    const [r, g, b] = M01_BEAM_VISUAL_RGB[lightState];
    this.flashlightHeadGlow.node.active = true;
    this.flashlightHeadGlow.color = new Color(r, g, b, COVERAGE_HEAD_GLOW_ALPHA);
  }

  /**
   * 灭灯统一出口(点拼片拾取 / 完成收尾): 灯态归 off、手电体复白、收光池, 并清 Session 激活
   * 手电色与所有候选碎片的观察显色(spec §5.2 点拼片=拾取且手电灭)。
   */
  private suspendFlashlightObservation(): void {
    this.activeLightState = "off";
    this.applyHeldFlashlightTint();
    this.hideCoverageBeam();
    this.session?.clearFlashlight();
    this.syncVisualState();
  }

  private suppressRootClickOnce(): void {
    this.suppressNextRootClick = true;
    setTimeout(() => {
      this.suppressNextRootClick = false;
    }, 0);
  }

  private tryHandleTokenClick(
    node: Node,
    token: M01GreyboxTokenNode,
    session: NonNullable<ReturnType<typeof endDragSession>["outcome"]["session"]>
  ): boolean {
    const movedSquared =
      session.totalDelta.x * session.totalDelta.x + session.totalDelta.y * session.totalDelta.y;
    if (movedSquared > CLICK_DRAG_THRESHOLD * CLICK_DRAG_THRESHOLD) {
      return false;
    }

    if (this.heldFragmentId) {
      // 双击同一持握拼片(原位、ROTATE_DOUBLE_TAP_MS 内)= 旋转 90°(取代旧按钮); 否则放下。
      if (this.isHeldFragmentRotateDoubleTap(session.currentPosition)) {
        this.rotateHeldFragmentClockwise();
        this.recordHeldTap(session.currentPosition); // 刷新基准 → 连续双击可继续转
        return true;
      }
      this.placeHeldFragmentAtPosition(session.currentPosition);
      return true;
    }

    if (token.kind === "fragment") {
      this.handleFragmentClick(node, token, session.currentPosition, session.pointerId);
      return true;
    }

    return false;
  }

  /** 双击持握拼片旋转手势判定: 同一拼片 + 间隔 < ROTATE_DOUBLE_TAP_MS + 几乎原位(移动后点=放下)。 */
  private isHeldFragmentRotateDoubleTap(position: M01GreyboxPoint): boolean {
    if (this.lastHeldTapFragmentId !== this.heldFragmentId) return false;
    if (Date.now() - this.lastHeldTapTime >= ROTATE_DOUBLE_TAP_MS) return false;
    const dx = position.x - this.lastHeldTapPos.x;
    const dy = position.y - this.lastHeldTapPos.y;
    return dx * dx + dy * dy <= ROTATE_DOUBLE_TAP_RADIUS * ROTATE_DOUBLE_TAP_RADIUS;
  }

  private recordHeldTap(position: M01GreyboxPoint): void {
    this.lastHeldTapTime = Date.now();
    this.lastHeldTapPos = position;
    this.lastHeldTapFragmentId = this.heldFragmentId;
  }

  private handleFragmentClick(
    node: Node,
    token: M01GreyboxTokenNode,
    position: M01GreyboxPoint,
    pointerId: string | number
  ): void {
    if (!this.session) {
      this.resetTokenNode(node, token);
      return;
    }

    const picked = this.session.pickFragment(token.controllerId);
    this.setStatus(picked.status);
    this.clearHintTargets();
    this.syncFeedbackFromSession();
    this.syncVisualState();
    if (!picked.accepted) {
      this.resetTokenNode(node, token);
      return;
    }

    this.heldFragmentId = token.controllerId;
    this.heldPointerId = pointerId;
    this.setFragmentPointerControl(node, true);
    const currentPosition = this.pointFromNodePosition(node.position);
    this.heldFragmentPointerOffset = {
      x: currentPosition.x - position.x,
      y: currentPosition.y - position.y
    };
    this.tokenPositions.set(token.controllerId, currentPosition);
    this.redrawAndPersistManualTargetDraft();
    this.recordHeldTap(position); // 拾取这一击作为旋转双击的【第一击】基准
  }

  private rotateHeldFragmentClockwise(): void {
    const heldFragmentId = this.heldFragmentId;
    if (!heldFragmentId) {
      this.setFeedback("先选中一个拼片");
      return;
    }

    const entry = this.greyboxNodes.get(heldFragmentId);
    if (!entry) {
      this.heldFragmentId = undefined;
      this.heldPointerId = undefined;
      this.heldFragmentPointerOffset = null;
      this.setFeedback("先选中一个拼片");
      return;
    }

    const currentRotation = this.tokenRotations.get(heldFragmentId) ?? 0;
    const nextRotation = (currentRotation + 90) % 360;
    this.tokenRotations.set(heldFragmentId, nextRotation);
    entry.node.setRotationFromEuler(0, 0, nextRotation);
    this.redrawAndPersistManualTargetDraft();
    this.setFeedback("已旋转90°");
  }

  private handleTokenDrop(node: Node, token: M01GreyboxTokenNode, dropPosition: M01GreyboxPoint): void {
    if (!this.layout || !this.session) {
      this.resetTokenNode(node, token);
      return;
    }

    const action = resolveM01GreyboxDrop(this.layout, token, dropPosition, {
      rotation: this.tokenRotations.get(token.controllerId) ?? 0
    });
    if (action.type === "activate_filter") {
      this.resetTokenNode(node, token);
      this.clearHintTargets();
      this.selectFilter(action.filterId);
      return;
    }

    if (action.type === "place_fragment") {
      const selected = this.session.selectFragment(action.fragmentId);
      if (!selected.accepted) {
        this.setStatus(selected.status);
        this.syncFeedbackFromSession();
        this.syncVisualState();
        this.resetTokenNode(node, token);
        return;
      }

      const placed = this.session.placeSelectedFragment(action.slotId);
      this.setStatus(placed.status);
      this.clearHintTargets();
      this.syncFeedbackFromSession();
      this.syncVisualState();
      this.handlePlaceResult(placed);
      if (!placed.accepted) {
        this.resetTokenNode(node, token);
      }
      return;
    }

    if (action.type === "weak_snap_fragment") {
      const snapped = this.session.weakSnapFragmentToEvidence(action.fragmentId, action.evidenceId);
      this.setStatus(snapped.status);
      this.syncFeedbackFromSession();
      if (!snapped.accepted) {
        this.syncVisualState();
        this.resetTokenNode(node, token);
        return;
      }

      this.trackWeakSnappedFragment(action.evidenceId, action.fragmentId);
      this.snapNodeToEvidence(node, token, action.evidenceId, dropPosition);
      this.parkFragmentBodyAtSnap(node);
      this.heldFragmentId = undefined;
      this.heldPointerId = undefined;
      this.heldFragmentPointerOffset = null;
      this.clearHintTargets();
      this.trySubmitWeakSnappedEvidencePair(action.evidenceId);
      this.tryValidateCompleteEvidenceCandidate();
      this.syncVisualState();
      return;
    }

    if (action.type === "snap_fragment_to_target_piece") {
      const picked = this.session.pickFragment(action.fragmentId);
      if (!picked.accepted) {
        this.setStatus(picked.status);
        this.syncFeedbackFromSession();
        this.syncVisualState();
        this.resetTokenNode(node, token);
        return;
      }

      this.removeWeakSnappedFragment(action.fragmentId);
      const placed = this.session.placeHeldFragment(action.position);
      this.setStatus(placed.status);
      this.heldFragmentId = undefined;
      this.heldPointerId = undefined;
      this.heldFragmentPointerOffset = null;
      this.clearHintTargets();
      this.syncFeedbackFromSession();
      this.syncVisualState();
      node.setPosition(action.position.x, action.position.y, 0);
      node.setRotationFromEuler(0, 0, action.rotation);
      this.parkFragmentBodyAtSnap(node);
      this.tokenPositions.set(action.fragmentId, action.position);
      this.tokenRotations.set(action.fragmentId, normalizeM01Rotation(action.rotation));
      this.redrawAndPersistManualTargetDraft();
      this.trySubmitTargetPatternEvidencePairs();
      this.tryValidateCompleteEvidenceCandidate();
      return;
    }

    if (action.type === "place_fragment_freely") {
      const picked = this.session.pickFragment(action.fragmentId);
      if (!picked.accepted) {
        this.setStatus(picked.status);
        this.syncFeedbackFromSession();
        this.syncVisualState();
        this.resetTokenNode(node, token);
        return;
      }

      this.removeWeakSnappedFragment(action.fragmentId);
      const freePosition = action.position ?? dropPosition;
      const placed = this.session.placeHeldFragment(freePosition);
      this.setStatus(placed.status);
      this.heldFragmentId = undefined;
      this.heldPointerId = undefined;
      this.heldFragmentPointerOffset = null;
      this.clearHintTargets();
      this.syncFeedbackFromSession();
      this.syncVisualState();
      node.setPosition(freePosition.x, freePosition.y, 0);
      this.releaseFragmentBodyToPhysics(node);
      this.tokenPositions.set(action.fragmentId, freePosition);
      this.redrawAndPersistManualTargetDraft();
      return;
    }

    this.resetTokenNode(node, token);
  }

  private placeHeldFragmentAt(event: M01GreyboxPointerEvent): void {
    if (this.suppressNextRootClick) {
      this.suppressNextRootClick = false;
      return;
    }

    const heldFragmentId = this.heldFragmentId;
    if (!heldFragmentId) {
      return;
    }

    const entry = this.greyboxNodes.get(heldFragmentId);
    if (!entry) {
      this.heldFragmentId = undefined;
      this.heldPointerId = undefined;
      this.heldFragmentPointerOffset = null;
      return;
    }

    this.placeHeldFragmentAtPosition(this.eventToLocalPoint(event));
  }

  private moveHeldFragmentWithPointer(event: M01GreyboxPointerEvent): void {
    const heldFragmentId = this.heldFragmentId;
    if (!heldFragmentId || this.heldPointerId !== this.pointerIdForEvent(event)) {
      return;
    }

    const entry = this.greyboxNodes.get(heldFragmentId);
    if (!entry) {
      this.heldFragmentId = undefined;
      this.heldPointerId = undefined;
      this.heldFragmentPointerOffset = null;
      return;
    }

    const position = this.resolveHeldFragmentPosition(this.eventToLocalPoint(event));
    entry.node.setPosition(position.x, position.y, 0);
    this.tokenPositions.set(heldFragmentId, position);
    this.redrawAndPersistManualTargetDraft();
  }

  private placeHeldFragmentAtPosition(position: M01GreyboxPoint): void {
    const heldFragmentId = this.heldFragmentId;
    if (!heldFragmentId) {
      return;
    }

    const entry = this.greyboxNodes.get(heldFragmentId);
    if (!entry) {
      this.heldFragmentId = undefined;
      this.heldPointerId = undefined;
      this.heldFragmentPointerOffset = null;
      return;
    }

    this.handleTokenDrop(entry.node, entry.token, this.resolveHeldFragmentPosition(position));
  }

  private resolveHeldFragmentPosition(pointerPosition: M01GreyboxPoint): M01GreyboxPoint {
    const offset = this.heldFragmentPointerOffset ?? { x: 0, y: 0 };
    return {
      x: pointerPosition.x + offset.x,
      y: pointerPosition.y + offset.y
    };
  }

  private pointFromNodePosition(position: Readonly<{ x: number; y: number }>): M01GreyboxPoint {
    return {
      x: position.x,
      y: position.y
    };
  }

  private trackWeakSnappedFragment(evidenceId: string, fragmentId: string): void {
    this.removeWeakSnappedFragment(fragmentId);
    const current = this.weakSnappedFragmentsByEvidence.get(evidenceId) ?? [];
    const next = [...current.filter((candidate) => candidate !== fragmentId), fragmentId].slice(-2);
    this.weakSnappedFragmentsByEvidence.set(evidenceId, next);
  }

  private removeWeakSnappedFragment(fragmentId: string): void {
    for (const [evidenceId, fragmentIds] of this.weakSnappedFragmentsByEvidence) {
      if (!fragmentIds.includes(fragmentId)) {
        continue;
      }

      const next = fragmentIds.filter((candidate) => candidate !== fragmentId);
      if (next.length === 0) {
        this.weakSnappedFragmentsByEvidence.delete(evidenceId);
      } else {
        this.weakSnappedFragmentsByEvidence.set(evidenceId, next);
      }
    }

    this.session?.unstageFragment(fragmentId);
  }

  private trySubmitWeakSnappedEvidencePair(evidenceId: string): void {
    if (!this.session) {
      return;
    }

    const fragmentIds = this.weakSnappedFragmentsByEvidence.get(evidenceId);
    if (!fragmentIds || fragmentIds.length < 2) {
      return;
    }

    const submitted = this.session.submitEvidencePair(evidenceId, [
      fragmentIds[0],
      fragmentIds[1]
    ]);
    this.setStatus(submitted.status);
  }

  private trySubmitTargetPatternEvidencePairs(): void {
    if (!this.session || !this.layout || !this.config?.targetPattern?.locked) {
      return;
    }

    const targetSlotByFragmentId = new Map(
      this.layout.targetPieceSlots
        .filter((slot) => slot.expectedFragmentId)
        .map((slot) => [slot.expectedFragmentId!, slot])
    );
    if (targetSlotByFragmentId.size === 0) {
      return;
    }

    for (const evidence of this.config.evidence) {
      const fragmentIds = evidence.solution.fragmentIds;
      if (fragmentIds.length !== 2) {
        continue;
      }
      const [firstFragmentId, secondFragmentId] = fragmentIds;
      if (
        this.isFragmentAtTargetPatternPose(firstFragmentId, targetSlotByFragmentId) &&
        this.isFragmentAtTargetPatternPose(secondFragmentId, targetSlotByFragmentId)
      ) {
        this.session.submitEvidencePair(evidence.id, [firstFragmentId, secondFragmentId]);
      }
    }
  }

  private isFragmentAtTargetPatternPose(
    fragmentId: string,
    targetSlotByFragmentId: Map<string, { position: M01GreyboxPoint; rotation: number }>
  ): boolean {
    const targetSlot = targetSlotByFragmentId.get(fragmentId);
    const actualPosition = this.tokenPositions.get(fragmentId);
    if (!targetSlot || !actualPosition) {
      return false;
    }

    const actualRotation = this.tokenRotations.get(fragmentId) ?? 0;
    const positionMatches =
      Math.hypot(actualPosition.x - targetSlot.position.x, actualPosition.y - targetSlot.position.y) <=
      TARGET_PATTERN_POSITION_TOLERANCE;
    const rotationMatches =
      rotationDistanceDegrees(actualRotation, targetSlot.rotation) <= TARGET_PATTERN_ROTATION_TOLERANCE;

    return positionMatches && rotationMatches;
  }

  private tryValidateCompleteEvidenceCandidate(): void {
    if (!this.session || !this.layout || this.layout.evidence.length === 0) {
      return;
    }
    // 双门控(与 beginTokenDrag 同一对闩): 底光整体验证属正式拼接判定, 落堆稳定且手电到手才触发。
    // 修复动画窗内也不再触发(codex P2 输入锁: 防动画期间重复验证)。
    if (!(this.physicsSettled && this.flashlightAcquired) || this.repairSequencePlaying) {
      return;
    }

    const allEvidenceStaged = this.session.areAllEvidenceStaged();
    if (!allEvidenceStaged) {
      return;
    }

    const validation = this.session.validateCandidateStructure();
    this.setStatus(
      validation.validationLightSeconds === null
        ? validation.status
        : `${validation.status} (${validation.validationLightSeconds}s)`
    );
    this.syncFeedbackFromSession();
    this.scheduleValidationLightReset(validation.validationLightSeconds, validation.completed);
    this.scheduleFailedCandidateReturn(validation.validationLightSeconds, validation.completed);
    // 全对 = 先播修复动画(齿轮转→碎片漩涡喷出→星光, spec §5.2), 播完才出智慧结晶卡。
    this.beginRepairSequenceThenToolCard(validation.completed);
  }

  /**
   * 修复动画(spec §5.2 修复动画): config repair.steps → M01RepairSequence.buildRepairTimeline
   * 的绝对时间窗, 逐段调度 cc 表现 —— entity_animate=齿轮(大螺母)转 turns 圈;
   * fragments_spiral_out=已拼上的 solution 碎片按 spiralOutTargets 放射喷出+自旋;
   * starlight=齿轮星光脉冲(scale 呼吸 ×pulses)。整段播完再出 ToolCard(镜头拉远无相机系统, 本轮省略)。
   */
  private beginRepairSequenceThenToolCard(completed: boolean): void {
    if (!completed) {
      this.renderCompletionToolCardIfAvailable(completed);
      return;
    }
    if (this.repairSequencePlaying) {
      return;
    }
    const steps = (this.config?.repair?.steps ?? []) as RepairStepConfig[];
    if (steps.length === 0) {
      this.renderCompletionToolCardIfAvailable(true); // 无修复配置: 直接收尾(向后兼容)
      return;
    }
    this.repairSequencePlaying = true;
    const timeline = buildRepairTimeline(
      steps.map((step) => ({
        type: step.type,
        params: step.params ?? {},
        duration: step.duration,
        delay: step.delay
      }))
    );
    for (const segment of timeline.segments) {
      this.repairSequenceTimeouts.push(
        setTimeout(() => {
          this.playRepairSegment(segment.type, segment.params, segment.end - segment.start);
        }, segment.start * 1000)
      );
    }
    this.repairSequenceTimeouts.push(
      setTimeout(() => {
        this.repairSequencePlaying = false;
        this.renderCompletionToolCardIfAvailable(true);
      }, timeline.total * 1000)
    );
  }

  /** 单段修复表现。未知类型静默跳过(config 可扩, 不硬失败)。 */
  private playRepairSegment(
    type: string,
    params: Record<string, unknown>,
    durationSeconds: number
  ): void {
    if (type === "entity_animate") {
      const gear = this.greyboxNodes.get("entity_memory_gear")?.node;
      if (!gear) return;
      const turns = typeof params.turns === "number" ? params.turns : 2;
      // 齿轮(大螺母)绕 z 转 turns 圈(负角=顺时针; tween 时长即段长, 帧率无关)。
      tween(gear)
        .to(durationSeconds, { eulerAngles: new Vec3(0, 0, -360 * turns) }, { easing: "quadInOut" })
        .start();
      return;
    }
    if (type === "fragments_spiral_out") {
      const board = this.layout?.board.position ?? { x: 0, y: 0 };
      const radius = typeof params.radius === "number" ? params.radius : 320;
      const turnsDeg = typeof params.turnsDeg === "number" ? params.turnsDeg : 540;
      // 喷出对象 = 验证通过时拼在证据上的 solution 碎片(弱磁吸登记表), 去重保序。
      const placedIds: string[] = [];
      for (const ids of this.weakSnappedFragmentsByEvidence.values()) {
        for (const id of ids) {
          if (!placedIds.includes(id)) placedIds.push(id);
        }
      }
      const targets = spiralOutTargets(placedIds.length, board, { radius, turnsDeg });
      placedIds.forEach((fragmentId, index) => {
        const entry = this.greyboxNodes.get(fragmentId);
        const target = targets[index];
        if (!entry || !target) return;
        tween(entry.node)
          .to(
            durationSeconds,
            {
              position: new Vec3(target.x, target.y, 0),
              eulerAngles: new Vec3(0, 0, target.spinDeg)
            },
            { easing: "quadOut" }
          )
          .start();
      });
      return;
    }
    if (type === "starlight") {
      const gear = this.greyboxNodes.get("entity_memory_gear")?.node;
      if (!gear) return;
      const pulses = typeof params.pulses === "number" ? params.pulses : 3;
      const half = durationSeconds / Math.max(1, pulses) / 2;
      let chain = tween(gear);
      for (let i = 0; i < pulses; i += 1) {
        chain = chain
          .to(half, { scale: new Vec3(1.08, 1.08, 1) }, { easing: "sineInOut" })
          .to(half, { scale: new Vec3(1, 1, 1) }, { easing: "sineInOut" });
      }
      chain.start();
    }
  }

  private clearRepairSequenceTimeouts(): void {
    for (const handle of this.repairSequenceTimeouts) {
      clearTimeout(handle);
    }
    this.repairSequenceTimeouts.length = 0;
    this.repairSequencePlaying = false;
  }

  private scheduleValidationLightReset(
    validationLightSeconds: number | null,
    completed: boolean
  ): void {
    this.clearValidationLightReset();
    if (validationLightSeconds === null || completed) {
      return;
    }

    const delayMs = Math.max(0, validationLightSeconds * 1000);
    this.validationLightResetTimeout = setTimeout(() => {
      this.validationLightResetTimeout = undefined;
      this.syncVisualState();
    }, delayMs);
  }

  private clearValidationLightReset(): void {
    if (this.validationLightResetTimeout === undefined) {
      return;
    }

    clearTimeout(this.validationLightResetTimeout);
    this.validationLightResetTimeout = undefined;
  }

  private scheduleFailedCandidateReturn(
    validationLightSeconds: number | null,
    completed: boolean
  ): void {
    this.clearFailedCandidateReturn();
    this.validationFlashVisible = true;
    if (validationLightSeconds === null || completed) {
      return;
    }

    const delayMs = Math.max(0, validationLightSeconds * 1000);
    const flashToggleCount = VALIDATION_FAILURE_FLASH_COUNT * 2 - 1;
    const flashIntervalMs = delayMs / (flashToggleCount + 1);
    for (let index = 1; index <= flashToggleCount; index += 1) {
      this.validationFailureFlashTimeouts.push(
        setTimeout(() => {
          this.validationFlashVisible = !this.validationFlashVisible;
          this.syncVisualState();
        }, flashIntervalMs * index)
      );
    }

    this.validationFailureReturnTimeout = setTimeout(() => {
      this.validationFailureReturnTimeout = undefined;
      this.validationFlashVisible = true;
      this.resetWeakSnappedCandidate();
    }, delayMs);
  }

  private clearFailedCandidateReturn(): void {
    for (const timeout of this.validationFailureFlashTimeouts) {
      clearTimeout(timeout);
    }
    this.validationFailureFlashTimeouts.length = 0;

    if (this.validationFailureReturnTimeout !== undefined) {
      clearTimeout(this.validationFailureReturnTimeout);
      this.validationFailureReturnTimeout = undefined;
    }
  }

  private resetWeakSnappedCandidate(): void {
    if (!this.session) {
      return;
    }

    const fragmentIds = this.session.resetCandidateStructure();
    this.weakSnappedFragmentsByEvidence.clear();
    this.heldFragmentId = undefined;
    this.heldPointerId = undefined;
    this.heldFragmentPointerOffset = null;
    for (const fragmentId of fragmentIds) {
      const entry = this.greyboxNodes.get(fragmentId);
      if (entry) {
        this.resetTokenNode(entry.node, entry.token);
      }
    }
    this.clearHintTargets();
    this.syncFeedbackFromSession();
    this.syncVisualState();
  }

  private renderCompletionToolCardIfAvailable(completed: boolean): void {
    if (!completed || !this.session || !this.greyboxRoot || this.toolCardRoot) {
      return;
    }

    const card = this.session.getLastToolCard();
    if (card) {
      this.setFeedback("");
      // 完成收尾灭灯走统一出口(灯态/手电体/光池/Session 显色一起收), 不再单清 Session。
      this.suspendFlashlightObservation();
      if (this.hintButtonRoot) {
        this.hintButtonRoot.active = false;
      }
      this.renderToolCardPreview(this.greyboxRoot, card);
    }
  }

  private snapNodeToEvidence(
    node: Node,
    token: M01GreyboxTokenNode,
    evidenceId: string,
    fallback: M01GreyboxPoint
  ): void {
    const evidence = this.layout?.evidence.find(
      (candidate) => candidate.controllerId === evidenceId
    );
    const position = evidence
      ? resolveM01EvidenceFragmentSnapPosition(evidence, token.controllerId)
      : fallback;
    node.setPosition(position.x, position.y, 0);
    this.tokenPositions.set(token.controllerId, position);
    this.redrawAndPersistManualTargetDraft();
  }

  private resetTokenNode(node: Node, token: M01GreyboxTokenNode): void {
    if (token.kind === "fragment") {
      const body = node.getComponent(RigidBody2D);
      if (body) {
        // Physics-controlled fragment: leave it where it is, let gravity take over.
        this.releaseFragmentBodyToPhysics(node);
        return;
      }
    }

    // Non-physics path (filters, slots, or fragment before physics enabled)
    node.setPosition(token.position.x, token.position.y, 0);
    node.setRotationFromEuler(0, 0, this.tokenRotations.get(token.controllerId) ?? 0);
    this.tokenPositions.set(token.controllerId, token.position);
    this.redrawAndPersistManualTargetDraft();
  }

  private parkFragmentBodyAtSnap(fragmentNode: Node): void {
    const body = fragmentNode.getComponent(RigidBody2D);
    if (!body) return;
    this.setFragmentPointerControl(fragmentNode, false);
    body.type = ERigidBody2DType.Kinematic;
    body.linearVelocity = new Vec2(0, 0);
    body.angularVelocity = 0;
  }

  private releaseFragmentBodyToPhysics(fragmentNode: Node): void {
    const body = fragmentNode.getComponent(RigidBody2D);
    if (!body) return;
    this.setFragmentPointerControl(fragmentNode, false);
    body.type = ERigidBody2DType.Dynamic;
    body.linearVelocity = new Vec2(0, 0);
    body.angularVelocity = 0;
  }

  private setFragmentPointerControl(fragmentNode: Node, controlledByPointer: boolean): void {
    const body = fragmentNode.getComponent(RigidBody2D);
    if (controlledByPointer) {
      this.setFragmentColliderEnabled(fragmentNode, false);
      if (body) {
        body.linearVelocity = new Vec2(0, 0);
        body.angularVelocity = 0;
        body.enabled = false;
      }
      return;
    }

    if (body) {
      body.enabled = true;
      body.linearVelocity = new Vec2(0, 0);
      body.angularVelocity = 0;
    }
    this.setFragmentColliderEnabled(fragmentNode, true);
  }

  private setFragmentColliderEnabled(fragmentNode: Node, enabled: boolean): void {
    const colliders: Array<CircleCollider2D | PolygonCollider2D | null> = [
      fragmentNode.getComponent(CircleCollider2D),
      fragmentNode.getComponent(PolygonCollider2D)
    ];
    for (const collider of colliders) {
      if (!collider) {
        continue;
      }

      collider.enabled = enabled;
      if (enabled) {
        collider.apply();
      }
    }
  }

  private stopFragmentBodyMotion(fragmentNode: Node): void {
    const body = fragmentNode.getComponent(RigidBody2D);
    if (!body) return;
    body.linearVelocity = new Vec2(0, 0);
    body.angularVelocity = 0;
  }

  private clearHintTargets(): void {
    this.hintedTargetIds.clear();
  }

  private pointerIdForEvent(event: M01GreyboxPointerEvent): string | number {
    return event.getID?.() ?? "mouse";
  }

  private pointerIdForActiveDragEvent(event: M01GreyboxPointerEvent): string | number {
    const pointerId = this.pointerIdForEvent(event);
    if (pointerId === "mouse" && this.dragState.active) {
      return this.dragState.active.pointerId;
    }

    return pointerId;
  }

  private eventToLocalPoint(event: M01GreyboxPointerEvent): M01GreyboxPoint {
    const location = event.getUILocation();
    const canvas = this.layout?.canvas ?? { width: 960, height: 640 };

    return {
      x: location.x - canvas.width / 2,
      y: location.y - canvas.height / 2
    };
  }

  private syncVisualState(): void {
    if (!this.session) {
      return;
    }

    const bottomLight = this.session.getCompletionState().bottomLight;
    for (const entry of this.greyboxNodes.values()) {
      if (entry.token.kind === "fragment") {
        const view = this.session.getFragmentView(entry.token.controllerId);
        const validationColor = this.validationFlashVisible ? view.validationColor : undefined;
        const fragmentColorOverride = validationColor ?? view.observedColor;
        const textureBackedFragmentReveal = this.shouldUseTextureBackedFragmentReveal(
          entry.token,
          entry.artSprite,
          fragmentColorOverride
        );
        // During the intro the 9 real fragments sit staged & VISIBLE inside the empty basket
        // (the old painted-piece basket art is gone), so render them solid ("normal") and keep
        // them active. After the spill, fall back to the session-driven presentation + the
        // released/placed visibility rule.
        const introStaged = !this.introFragmentsReleased;
        const presentation = introStaged
          ? "normal"
          : view.validationColor && !this.validationFlashVisible
            ? "normal"
            : view.presentation;
        entry.node.active = !view.placed;
        this.applyTokenGraphicsState(
          entry.graphics,
          entry.token,
          textureBackedFragmentReveal ? "normal" : presentation,
          view.selected ? 5 : view.hinted ? 4 : view.interactive ? 3 : 1,
          textureBackedFragmentReveal ? undefined : fragmentColorOverride
        );
        this.syncArtSpriteState(
          entry.artSprite,
          presentation,
          entry.token,
          fragmentColorOverride
        );
        this.syncArtEdgeSpriteState(entry.artEdgeSprite, entry.token, fragmentColorOverride);
      } else if (entry.token.kind === "slot") {
        const view = this.session.getSlotView(entry.token.controllerId);
        this.applyTokenGraphicsState(
          entry.graphics,
          entry.token,
          view.presentation,
          view.presentation === "normal" ? 3 : 5
        );
      } else if (entry.token.kind === "filter") {
        const view = this.session.getFilterView(entry.token.controllerId);
        this.applyTokenGraphicsState(
          entry.graphics,
          entry.token,
          view.presentation,
          view.active || view.hinted ? 4 : 2
        );
        this.syncArtSpriteState(entry.artSprite, view.presentation, entry.token);
      } else if (entry.token.kind === "gear") {
        const view = this.session.getRepairView();
        this.applyTokenGraphicsState(
          entry.graphics,
          entry.token,
          view.presentation,
          view.repaired ? 4 : 2
        );
        this.syncArtSpriteState(entry.artSprite, view.presentation, entry.token);
      } else if (entry.token.kind === "evidence") {
        const hinted = this.hintedTargetIds.has(entry.token.controllerId);
        const evidenceLit = bottomLight === "steady_on" || bottomLight === "flash_then_off";
        const presentation = hinted ? "hinted" : evidenceLit ? "highlighted" : "normal";
        this.applyTokenGraphicsState(
          entry.graphics,
          entry.token,
          presentation,
          hinted ? 5 : evidenceLit ? 4 : 3
        );
        this.syncArtSpriteState(entry.artSprite, presentation, entry.token);
      }
    }
    this.drawBottomLight(bottomLight);
    this.drawManualTargetBlendOverlays();
  }

  private shouldUseTextureBackedFragmentReveal(
    token: M01GreyboxTokenNode,
    sprite: Sprite | null,
    colorTokenOverride: M01BlendColor | undefined
  ): boolean {
    return Boolean(
      this.enableArtPreview &&
        sprite &&
        colorTokenOverride &&
        token.kind === "fragment" &&
        !this.artPreviewFallbackUnderlayIds.has(token.controllerId)
    );
  }

  private markArtPreviewUnderlayFallback(controllerId: string): void {
    this.artPreviewFallbackUnderlayIds.add(controllerId);
    this.syncVisualState();
  }

  private markStaticArtPreviewUnderlayFallback(layerId: string): void {
    if (layerId === "nineSlotTray" && this.layout) {
      for (const controllerId of (this.layout.slots ?? []).map((slot) => slot.controllerId)) {
        this.artPreviewFallbackUnderlayIds.add(controllerId);
      }
    }
    if (layerId === "targetReferenceCard" && this.layout?.referencePattern) {
      this.artPreviewFallbackUnderlayIds.add(this.layout.referencePattern.controllerId);
    }
    this.syncVisualState();
  }

  private syncArtSpriteState(
    sprite: Sprite | null,
    presentation:
      | M01GreyboxFragmentPresentation
      | M01GreyboxFilterPresentation
      | M01GreyboxRepairPresentation
      | "normal",
    token?: M01GreyboxTokenNode,
    colorTokenOverride?: M01BlendColor
  ): void {
    if (!sprite) {
      return;
    }

    this.syncArtSpriteFrame(sprite, token, colorTokenOverride);
    // 兜底: 每次同步都确保拼片挂着 shader 材质(防创建/重置时序漏挂 → 个别拼片回退整片染色显得"更宽")。
    if (token?.kind === "fragment" && this.colorFilterAvailable && this.colorFilterMat) {
      sprite.customMaterial = this.colorFilterMat;
    }
    sprite.color = colorForArtSprite(presentation, token, colorTokenOverride);
  }

  private syncArtSpriteFrame(
    sprite: Sprite,
    token?: M01GreyboxTokenNode,
    colorTokenOverride?: M01BlendColor
  ): void {
    if (!token) {
      return;
    }

    // shader 显色: 拼片始终用灰白 hidden 贴图(shader 据 sprite.color=revealColor + 光束逐像素染色),
    // 不再换 light_mask。仅 fallback(shader 不可用)才换 light_mask 整片染色。
    const resource =
      token.kind === "fragment" && colorTokenOverride && !this.colorFilterAvailable
        ? getM01GreyboxRuntimeLightMaskResourceForToken(token)
        : getM01GreyboxRuntimeSpriteResourceForToken(token);
    if (!resource) {
      return;
    }

    this.syncArtSpriteFrameToResource(sprite, token, resource);
  }

  private syncArtSpriteFrameToResource(
    sprite: Sprite,
    token: M01GreyboxTokenNode,
    resource: M01GreyboxRuntimeSpriteResource,
    options?: { activateOnLoad?: boolean }
  ): void {
    const requestedPath = resource.resourcesLoadPath;
    const activateOnLoad = options?.activateOnLoad ?? true;
    if (this.artSpriteResourcePaths.get(sprite) === requestedPath) {
      return;
    }

    this.artSpriteResourcePaths.set(sprite, requestedPath);
    sprite.node.name = resource.id.startsWith("light_edge_")
      ? `M01ArtSpriteEdge_${resource.id}`
      : `M01ArtSprite_${resource.id}`;

    resources.load(requestedPath, SpriteFrame, (error, spriteFrame) => {
      if (this.artSpriteResourcePaths.get(sprite) !== requestedPath) {
        return;
      }
      if (error || !spriteFrame) {
        this.artSpriteResourcePaths.delete(sprite);
        this.setFeedback(
          this.formatText("loadFailed", { reason: error?.message ?? requestedPath })
        );
        this.markArtPreviewUnderlayFallback(token.controllerId);
        sprite.node.active = false;
        return;
      }
      sprite.spriteFrame = spriteFrame;
      // 按贴图真实宽高比重设 contentSize, 防止把贴图拉伸变形(如 gearStar 正方被压成椭圆)。
      // contain 模式: 贴图完整放进原框内、不超框、不变形(交互框不受影响)。
      const box = sprite.node.getComponent(UITransform);
      if (box) {
        // ⚠️ 用裁剪后 rect(内容真实比例)而非 spriteFrameSize —— 后者优先 getOriginalSize=整画布(齿轮 750×750
        // 正方含透明边), contain 会把略宽的齿轮压成正方→视觉"细长/变窄"。同 line~1005 hint icon 的正确写法。
        const rect = spriteFrame.rect;
        const real =
          rect && rect.width > 0 && rect.height > 0 ? rect : spriteFrameSize(spriteFrame);
        const fitted = aspectContentSize(real.width, real.height, box.width, box.height, "contain");
        box.setContentSize(fitted.width, fitted.height);
      }
      if (activateOnLoad) {
        sprite.node.active = true;
      }
    });
  }

  private syncArtEdgeSpriteState(
    sprite: Sprite | null,
    token: M01GreyboxTokenNode,
    colorTokenOverride?: M01BlendColor
  ): void {
    if (!sprite) {
      return;
    }

    const resource = getM01GreyboxRuntimeLightEdgeResourceForToken(token);
    if (!resource || !colorTokenOverride) {
      sprite.node.active = false;
      return;
    }

    sprite.color = new Color(255, 255, 255, 255);
    this.syncArtSpriteFrameToResource(sprite, token, resource, { activateOnLoad: false });
    sprite.node.active = true;
  }

  private formatText(
    key: Parameters<typeof formatM01GreyboxText>[0],
    params: Record<string, string | number> = {}
  ): string {
    return formatM01GreyboxText(key, params, this.text);
  }
}

export function drawTokenShape(graphics: Graphics, token: M01GreyboxTokenNode): void {
  graphics.clear();

  if (token.kind === "gear") {
    drawGear(graphics, token.size.width / 2);
  } else if (token.shapeToken === "generated_overlap") {
    if (token.magnetPolygon && token.magnetPolygon.length >= 3) {
      drawPolygon(graphics, token.magnetPolygon);
    } else {
      drawGeneratedOverlap(graphics, token.size.width, token.size.height);
    }
  } else if (token.shapeToken === "reference_pattern") {
    drawStandardReferencePattern(graphics, token.size.width, token.size.height);
    return;
  } else if (token.shapeToken === "triangle") {
    drawExactEquilateralTriangle(graphics, token.size.width, token.size.height);
  } else if (token.shapeToken === "hexagon") {
    drawExactRegularHexagon(graphics, token.size.width, token.size.height);
  } else if (token.kind === "filter") {
    drawFilter(graphics, token.size.width, token.size.height);
  } else {
    graphics.circle(0, 0, Math.min(token.size.width, token.size.height) / 2);
  }

  graphics.fill();
  graphics.stroke();
}

function isM01StandardPieceToken(token: M01GreyboxTokenNode): boolean {
  return token.kind === "fragment";
}

function drawStandardPieceShape(
  graphics: Graphics,
  shapeToken: string,
  size: { width: number; height: number }
): void {
  if (shapeToken === "triangle") {
    drawExactEquilateralTriangle(graphics, size.width, size.height);
    return;
  }

  if (shapeToken === "hexagon") {
    drawExactRegularHexagon(graphics, size.width, size.height);
    return;
  }

  graphics.circle(0, 0, Math.min(size.width, size.height) / 2);
}

function drawGear(graphics: Graphics, radius: number): void {
  const teeth = 12;
  for (let i = 0; i <= teeth * 2; i += 1) {
    const angle = (Math.PI * 2 * i) / (teeth * 2);
    const pointRadius = i % 2 === 0 ? radius : radius * 0.82;
    const x = Math.cos(angle) * pointRadius;
    const y = Math.sin(angle) * pointRadius;

    if (i === 0) {
      graphics.moveTo(x, y);
    } else {
      graphics.lineTo(x, y);
    }
  }
  graphics.close();
}

function drawExactEquilateralTriangle(graphics: Graphics, width: number, height: number): void {
  const sideLength = Math.min(width, (height * 2) / Math.sqrt(3));
  const halfSide = sideLength / 2;
  const triangleHeight = (sideLength * Math.sqrt(3)) / 2;

  graphics.moveTo(0, triangleHeight / 2);
  graphics.lineTo(-halfSide, -triangleHeight / 2);
  graphics.lineTo(halfSide, -triangleHeight / 2);
  graphics.close();
}

function drawExactRegularHexagon(graphics: Graphics, width: number, height: number): void {
  const radius = Math.min(width / 2, height / Math.sqrt(3));
  const halfRadius = radius / 2;
  const halfHeight = (Math.sqrt(3) * radius) / 2;

  graphics.moveTo(-radius, 0);
  graphics.lineTo(-halfRadius, halfHeight);
  graphics.lineTo(halfRadius, halfHeight);
  graphics.lineTo(radius, 0);
  graphics.lineTo(halfRadius, -halfHeight);
  graphics.lineTo(-halfRadius, -halfHeight);
  graphics.close();
}

function drawFilter(graphics: Graphics, width: number, height: number): void {
  graphics.rect(-width / 2, -height / 2, width, height);
}

function drawGeneratedOverlap(graphics: Graphics, width: number, height: number): void {
  const radius = Math.min(width, height) / 2;
  graphics.moveTo(-radius * 0.7, radius * 0.2);
  graphics.lineTo(-radius * 0.2, radius * 0.72);
  graphics.lineTo(radius * 0.58, radius * 0.42);
  graphics.lineTo(radius * 0.72, -radius * 0.18);
  graphics.lineTo(radius * 0.18, -radius * 0.68);
  graphics.lineTo(-radius * 0.6, -radius * 0.46);
  graphics.close();
}

type ReferenceShape = "circle" | "triangle" | "hexagon";

interface ReferencePiece {
  id: string;
  shape: ReferenceShape;
  center: M01GreyboxPoint;
}

const REFERENCE_STANDARD_PIECE_SIZE = 48;
const REFERENCE_CIRCLE_SEGMENTS = 40;
const STANDARD_REFERENCE_TARGET_PIECES: ReferencePiece[] = [
  { id: "circle_left", shape: "circle", center: { x: -62, y: 24 } },
  { id: "triangle_left", shape: "triangle", center: { x: -34, y: 22 } },
  { id: "triangle_right", shape: "triangle", center: { x: 4, y: 22 } },
  { id: "hexagon_top", shape: "hexagon", center: { x: 28, y: 20 } },
  { id: "hexagon_lower", shape: "hexagon", center: { x: 30, y: -18 } },
  { id: "circle_lower", shape: "circle", center: { x: -4, y: -18 } }
];
const STANDARD_REFERENCE_OVERLAPS: Array<{
  firstId: string;
  secondId: string;
  color: Color;
}> = [
  { firstId: "circle_left", secondId: "triangle_left", color: new Color(139, 105, 156, 210) },
  { firstId: "triangle_right", secondId: "hexagon_top", color: new Color(92, 145, 112, 210) },
  { firstId: "hexagon_top", secondId: "hexagon_lower", color: new Color(199, 126, 75, 218) },
  { firstId: "hexagon_lower", secondId: "circle_lower", color: new Color(139, 105, 156, 210) }
];

function drawStandardReferencePattern(graphics: Graphics, width: number, height: number): void {
  const frameWidth = width;
  const frameHeight = height;

  graphics.lineWidth = 2;
  graphics.fillColor = new Color(244, 235, 201, 218);
  graphics.strokeColor = new Color(72, 67, 55, 190);
  graphics.rect(-frameWidth / 2, -frameHeight / 2, frameWidth, frameHeight);
  graphics.fill();
  graphics.stroke();

  graphics.lineWidth = 1.2;
  graphics.fillColor = new Color(180, 178, 162, 96);
  graphics.strokeColor = new Color(44, 43, 38, 225);
  for (const piece of STANDARD_REFERENCE_TARGET_PIECES) {
    drawReferencePiece(graphics, piece);
    graphics.fill();
    graphics.stroke();
  }

  for (const overlap of STANDARD_REFERENCE_OVERLAPS) {
    const first = STANDARD_REFERENCE_TARGET_PIECES.find((piece) => piece.id === overlap.firstId);
    const second = STANDARD_REFERENCE_TARGET_PIECES.find((piece) => piece.id === overlap.secondId);
    if (!first || !second) {
      continue;
    }

    const intersection = intersectReferencePieces(first, second);
    if (intersection.length < 3) {
      continue;
    }

    graphics.lineWidth = 1.4;
    graphics.fillColor = overlap.color;
    graphics.strokeColor = new Color(44, 43, 38, 190);
    drawPolygon(graphics, intersection);
    graphics.fill();
    graphics.stroke();
  }

  graphics.lineWidth = 1.1;
  graphics.fillColor = new Color(0, 0, 0, 0);
  graphics.strokeColor = new Color(44, 43, 38, 210);
  for (const piece of STANDARD_REFERENCE_TARGET_PIECES) {
    drawReferencePiece(graphics, piece);
    graphics.stroke();
  }
}

function drawReferencePiece(graphics: Graphics, piece: ReferencePiece): void {
  if (piece.shape === "circle") {
    graphics.circle(piece.center.x, piece.center.y, REFERENCE_STANDARD_PIECE_SIZE / 2);
    return;
  }

  drawPolygon(graphics, buildReferencePiecePolygon(piece));
}

function intersectReferencePieces(first: ReferencePiece, second: ReferencePiece): M01GreyboxPoint[] {
  return clipConvexPolygon(
    buildReferencePiecePolygon(first),
    buildReferencePiecePolygon(second)
  );
}

function buildReferencePiecePolygon(piece: ReferencePiece): M01GreyboxPoint[] {
  const half = REFERENCE_STANDARD_PIECE_SIZE / 2;

  if (piece.shape === "circle") {
    return Array.from({ length: REFERENCE_CIRCLE_SEGMENTS }, (_, index) => {
      const angle = (Math.PI * 2 * index) / REFERENCE_CIRCLE_SEGMENTS;
      return {
        x: piece.center.x + Math.cos(angle) * half,
        y: piece.center.y + Math.sin(angle) * half
      };
    });
  }

  if (piece.shape === "triangle") {
    const sideLength = Math.min(
      REFERENCE_STANDARD_PIECE_SIZE,
      (REFERENCE_STANDARD_PIECE_SIZE * 2) / Math.sqrt(3)
    );
    const halfSide = sideLength / 2;
    const triangleHeight = (sideLength * Math.sqrt(3)) / 2;

    return [
      { x: piece.center.x, y: piece.center.y + triangleHeight / 2 },
      { x: piece.center.x - halfSide, y: piece.center.y - triangleHeight / 2 },
      { x: piece.center.x + halfSide, y: piece.center.y - triangleHeight / 2 }
    ];
  }

  const radius = Math.min(half, REFERENCE_STANDARD_PIECE_SIZE / Math.sqrt(3));
  const halfRadius = radius / 2;
  const halfHeight = (Math.sqrt(3) * radius) / 2;

  return [
    { x: piece.center.x - radius, y: piece.center.y },
    { x: piece.center.x - halfRadius, y: piece.center.y + halfHeight },
    { x: piece.center.x + halfRadius, y: piece.center.y + halfHeight },
    { x: piece.center.x + radius, y: piece.center.y },
    { x: piece.center.x + halfRadius, y: piece.center.y - halfHeight },
    { x: piece.center.x - halfRadius, y: piece.center.y - halfHeight }
  ];
}

function drawPolygon(graphics: Graphics, points: M01GreyboxPoint[]): void {
  const [first, ...rest] = points;
  if (!first) {
    return;
  }

  graphics.moveTo(first.x, first.y);
  for (const point of rest) {
    graphics.lineTo(point.x, point.y);
  }
  graphics.close();
}

function clipConvexPolygon(
  subjectPolygon: M01GreyboxPoint[],
  clipPolygon: M01GreyboxPoint[]
): M01GreyboxPoint[] {
  const clipOrientation = polygonArea(clipPolygon) >= 0 ? 1 : -1;
  let output = subjectPolygon;

  for (let index = 0; index < clipPolygon.length; index += 1) {
    const clipStart = clipPolygon[index];
    const clipEnd = clipPolygon[(index + 1) % clipPolygon.length];
    const input = output;
    output = [];

    if (input.length === 0) {
      break;
    }

    let previous = input[input.length - 1];
    for (const current of input) {
      const currentInside = isInsideClipEdge(current, clipStart, clipEnd, clipOrientation);
      const previousInside = isInsideClipEdge(previous, clipStart, clipEnd, clipOrientation);

      if (currentInside) {
        if (!previousInside) {
          output.push(intersectLineSegments(previous, current, clipStart, clipEnd));
        }
        output.push(current);
      } else if (previousInside) {
        output.push(intersectLineSegments(previous, current, clipStart, clipEnd));
      }

      previous = current;
    }
  }

  return output;
}

function isInsideClipEdge(
  point: M01GreyboxPoint,
  edgeStart: M01GreyboxPoint,
  edgeEnd: M01GreyboxPoint,
  orientation: number
): boolean {
  return orientation * cross(edgeStart, edgeEnd, point) >= -0.0001;
}

function intersectLineSegments(
  firstStart: M01GreyboxPoint,
  firstEnd: M01GreyboxPoint,
  secondStart: M01GreyboxPoint,
  secondEnd: M01GreyboxPoint
): M01GreyboxPoint {
  const firstDx = firstEnd.x - firstStart.x;
  const firstDy = firstEnd.y - firstStart.y;
  const secondDx = secondEnd.x - secondStart.x;
  const secondDy = secondEnd.y - secondStart.y;
  const denominator = firstDx * secondDy - firstDy * secondDx;

  if (Math.abs(denominator) < 0.0001) {
    return firstEnd;
  }

  const t =
    ((secondStart.x - firstStart.x) * secondDy -
      (secondStart.y - firstStart.y) * secondDx) /
    denominator;

  return {
    x: firstStart.x + firstDx * t,
    y: firstStart.y + firstDy * t
  };
}

function polygonArea(points: M01GreyboxPoint[]): number {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0);
}

function cross(
  edgeStart: M01GreyboxPoint,
  edgeEnd: M01GreyboxPoint,
  point: M01GreyboxPoint
): number {
  return (
    (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
    (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x)
  );
}

function drawBottomLightHintNote(graphics: Graphics): void {
  graphics.clear();
  graphics.lineWidth = 1.5;
  graphics.fillColor = new Color(244, 235, 201, 226);
  graphics.strokeColor = new Color(72, 67, 55, 180);
  graphics.rect(-72, -41, 144, 82);
  graphics.fill();
  graphics.stroke();

  graphics.lineWidth = 1.25;
  graphics.strokeColor = new Color(72, 67, 55, 150);
  graphics.moveTo(-60, 24);
  graphics.lineTo(-48, 30);
  graphics.lineTo(-38, 20);
  graphics.lineTo(-50, 14);
  graphics.close();
  graphics.stroke();

  drawNoteArrow(graphics, -28, 20, 2, 20);
  drawNoteLightBulb(graphics, 22, 20, false);
  drawNoteArrow(graphics, 42, 4, 42, -16);
  drawNoteLightBulb(graphics, 22, -24, true);

  graphics.lineWidth = 1;
  graphics.strokeColor = new Color(72, 67, 55, 96);
  graphics.moveTo(-60, -26);
  graphics.lineTo(-36, -30);
  graphics.moveTo(-58, -14);
  graphics.lineTo(-42, -10);
}

function drawNoteArrow(
  graphics: Graphics,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): void {
  graphics.lineWidth = 1.25;
  graphics.strokeColor = new Color(72, 67, 55, 150);
  graphics.moveTo(fromX, fromY);
  graphics.lineTo(toX, toY);
  graphics.lineTo(toX - 7, toY + 4);
  graphics.moveTo(toX, toY);
  graphics.lineTo(toX - 7, toY - 4);
  graphics.stroke();
}

function drawNoteLightBulb(graphics: Graphics, x: number, y: number, lit: boolean): void {
  graphics.lineWidth = lit ? 2 : 1.25;
  graphics.fillColor = lit ? new Color(221, 181, 91, 94) : new Color(171, 164, 142, 48);
  graphics.strokeColor = lit ? new Color(164, 124, 48, 174) : new Color(72, 67, 55, 128);
  graphics.circle(x, y, lit ? 17 : 12);
  graphics.fill();
  graphics.stroke();
  if (!lit) {
    return;
  }

  graphics.lineWidth = 1.25;
  graphics.strokeColor = new Color(164, 124, 48, 132);
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    graphics.moveTo(x + Math.cos(angle) * 21, y + Math.sin(angle) * 21);
    graphics.lineTo(x + Math.cos(angle) * 29, y + Math.sin(angle) * 29);
  }
  graphics.stroke();
}

function colorForBottomLightFill(state: M01BottomLightState): Color {
  const colors: Record<M01BottomLightState, Color> = {
    off: new Color(96, 92, 82, 18),
    flash_then_off: new Color(224, 157, 77, 86),
    steady_on: new Color(208, 185, 106, 112)
  };

  return colors[state];
}

function colorForBottomLightStroke(state: M01BottomLightState): Color {
  const colors: Record<M01BottomLightState, Color> = {
    off: new Color(74, 69, 58, 38),
    flash_then_off: new Color(196, 92, 66, 132),
    steady_on: new Color(142, 128, 62, 156)
  };

  return colors[state];
}

function colorForBottomLightRay(state: M01BottomLightState): Color {
  return state === "flash_then_off"
    ? new Color(216, 105, 70, 112)
    : new Color(194, 168, 76, 122);
}

function colorForToken(
  colorToken: string,
  kind: M01GreyboxTokenNode["kind"],
  presentation: M01GreyboxPresentation
): Color {
  if (presentation === "error") {
    return new Color(193, 80, 62, 132);
  }
  if (presentation === "hinted") {
    return new Color(220, 184, 86, 146);
  }
  if (presentation === "repaired") {
    return new Color(190, 178, 128, 176);
  }

  if (kind === "gear" || colorToken === "neutral") {
    return new Color(177, 174, 153, 120);
  }

  const alphaByPresentation: Record<string, number> = {
    active: 230,
    highlighted: 210,
    selected: 255,
    dimmed: 56,
    placed: 0,
    normal: kind === "slot" ? 72 : 180
  };
  const alpha = alphaByPresentation[presentation] ?? alphaByPresentation.normal;
  const targetBlendRgb = colorForTargetBlendRgb(colorToken);
  const colors: Record<string, [number, number, number]> = {
    hidden: [182, 180, 166],
    red: [180, 92, 70],
    blue: [72, 104, 190],
    yellow: [188, 158, 87]
  };
  const [r, g, b] = targetBlendRgb ?? colors[colorToken] ?? [160, 154, 132];

  return new Color(r, g, b, alpha);
}

function colorForManualTargetBlendOverlay(colorToken: string): Color {
  const targetBlendRgb = colorForTargetBlendRgb(colorToken);
  const colors: Record<string, [number, number, number]> = {
    red: [180, 92, 70],
    blue: [72, 104, 190],
    yellow: [188, 158, 87]
  };
  const [r, g, b] = targetBlendRgb ?? colors[colorToken] ?? [150, 132, 118];

  return new Color(r, g, b, 232);
}

function colorForTargetOverlapEvidence(colorToken: string): Color {
  const [r, g, b] = colorForTargetBlendRgb(colorToken) ?? [150, 132, 118];

  return new Color(r, g, b, 232);
}

function colorForTargetBlendRgb(colorToken: string): [number, number, number] | undefined {
  return M01_TARGET_BLEND_RGB[colorToken as Exclude<M01BlendColor, M01BaseColor>];
}

function boundsForPoints(points: M01GreyboxPoint[]): { width: number; height: number } {
  if (points.length === 0) {
    return { width: 1, height: 1 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(1, Math.max(...ys) - Math.min(...ys))
  };
}

function roundM01Point(point: M01GreyboxPoint): M01GreyboxPoint {
  return {
    x: Math.round(point.x * 100) / 100,
    y: Math.round(point.y * 100) / 100
  };
}

function normalizeM01Rotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

function rotationDistanceDegrees(left: number, right: number): number {
  const delta = Math.abs(normalizeM01Rotation(left) - normalizeM01Rotation(right));
  return Math.min(delta, 360 - delta);
}

function lineWidthForArtPreview(token: M01GreyboxTokenNode, lineWidth: number): number {
  if (lineWidth >= 5) {
    return token.kind === "slot" ? 2.5 : 2;
  }

  return Math.min(lineWidth, token.kind === "slot" ? 2 : 1);
}

function shouldRenderArtPreviewUnderlay(
  token: M01GreyboxTokenNode,
  presentation: M01GreyboxPresentation,
  showDebugUnderlay: boolean,
  forceFallbackUnderlay: boolean
): boolean {
  if (forceFallbackUnderlay) {
    return true;
  }
  if (showDebugUnderlay) {
    return true;
  }
  if (token.kind === "reference_pattern") {
    return false;
  }
  if (token.kind === "board") {
    return presentation !== "normal";
  }
  if (token.kind === "evidence") {
    return false;
  }
  if (token.kind === "fragment") {
    return false;
  }
  if (token.kind !== "slot" && token.kind !== "gear") {
    return true;
  }

  return presentation !== "normal" && presentation !== "repaired";
}

function strokeColorForArtPreview(
  token: M01GreyboxTokenNode,
  presentation: M01GreyboxPresentation
): Color {
  if (presentation === "error") {
    return new Color(193, 80, 62, 150);
  }
  if (presentation === "hinted") {
    return new Color(180, 136, 42, 128);
  }

  return new Color(44, 43, 38, token.kind === "slot" ? 82 : 48);
}

function colorForArtPreviewUnderlay(
  color: Color,
  presentation: M01GreyboxPresentation
): Color {
  if (presentation === "error" || presentation === "hinted") {
    return withAlpha(color, Math.min(color.a, 88));
  }
  if (presentation === "active" || presentation === "highlighted" || presentation === "selected") {
    return withAlpha(color, Math.min(color.a, 52));
  }

  return withAlpha(color, Math.min(color.a, 36));
}

function colorForStandardPieceGeometry(
  color: Color,
  presentation: M01GreyboxPresentation
): Color {
  if (presentation === "dimmed") {
    return withAlpha(color, Math.max(color.a, 84));
  }
  if (presentation === "selected" || presentation === "active" || presentation === "highlighted") {
    return withAlpha(color, Math.max(color.a, 218));
  }
  if (presentation === "error" || presentation === "hinted") {
    return withAlpha(color, Math.max(color.a, 190));
  }

  return withAlpha(color, Math.max(color.a, 188));
}

function withAlpha(color: Color, alpha: number): Color {
  return new Color(color.r, color.g, color.b, alpha);
}

function colorForObservedFragmentTint(colorToken: M01BlendColor): Color {
  const [r, g, b] = OBSERVED_FRAGMENT_TINT_COLORS[colorToken];
  return new Color(r, g, b, OBSERVED_FRAGMENT_TINT_ALPHA);
}

function colorForArtSprite(
  presentation:
    | M01GreyboxFragmentPresentation
    | M01GreyboxFilterPresentation
    | M01GreyboxRepairPresentation
    | "normal",
  token?: M01GreyboxTokenNode,
  colorTokenOverride?: M01BlendColor
): Color {
  if (token?.kind === "fragment" && colorTokenOverride) {
    return colorForObservedFragmentTint(colorTokenOverride);
  }

  if (token?.kind === "fragment" && presentation === "normal") {
    return new Color(255, 255, 255, 255);
  }

  const colors: Record<string, Color> = {
    active: new Color(255, 255, 255, 230),
    highlighted: new Color(255, 255, 255, 220),
    selected: new Color(255, 255, 255, 255),
    dimmed: new Color(255, 255, 255, 56),
    hinted: new Color(255, 232, 166, 230),
    placed: new Color(255, 255, 255, 0),
    repaired: new Color(255, 255, 255, 255),
    normal: new Color(255, 255, 255, 210)
  };

  return colors[presentation] ?? colors.normal;
}
