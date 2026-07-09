// M02 序章「三颗余烬点棒」cc 胶水层(greybox) —— 只做"渲染 view() + 拖余烬/点棒/点火簇"。
// 规则全在 M02PrologueSession(纯逻辑, 已单测); 本文件不算任何规则。
// greybox 占位表现: 余烬=光晕圆+核心点(光晕随命数收缩, 与主谜题倒数光晕同语言),
// 星光棒=插地斜杆/在手竖杆+棒尖圆。莱米走入/发抖/烤爪动画后补(spec §5.3 开场序章)。

import { _decorator, Color, Component, EventTouch, Graphics, Layers, Node, UITransform, Vec3 } from "cc";
import type { StarNetworkRules } from "../core/StarNetworkModel.ts";
import type { StarWebPrologue } from "../core/StarWebConfig.ts";
import { M02PrologueSession, type EmberView } from "./M02PrologueSession.ts";

const { ccclass } = _decorator;

const EMBER_CORE_RADIUS = 10;
const EMBER_GLOW_EXTRA = 22;    // 光晕最大外扩(px), 随命数比例收缩
const EMBER_DRAG_RADIUS = 48;   // 拾取命中半径(px), 比视觉大好点
const DRAG_ACTIVATE_PX = 12;    // 位移超过此值才升级为拖拽; 否则按点击处理(点火簇的点击不能被拖拽分支吞掉)
const WAND_TAP_RADIUS = 70;     // 点棒命中半径(px)
const WAND_LENGTH = 84;
const WAND_TIP_RADIUS = 9;
const DONE_DELAY_SECONDS = 1.1; // 棒亮后停一拍再交还主谜题(让玩家看清点燃)

// 与 M02StarWebView 同 palette(那边是模块私有常量, 此处按值复用)
const EMBER_COLOR: Record<EmberView["status"], Color> = {
  dark: new Color(92, 98, 116, 255),
  decaying: new Color(214, 170, 104, 255),
  frozen: new Color(248, 214, 150, 255)
};
const DECAYING_GLOW_COLOR = new Color(214, 170, 104, 95);
const FROZEN_GLOW_COLOR = new Color(248, 214, 150, 135);
const WAND_STICK_COLOR = new Color(126, 132, 150, 220);
const WAND_TIP_DIM_COLOR = new Color(92, 98, 116, 255);
const WAND_TIP_LIT_COLOR = new Color(248, 214, 150, 255);
const WAND_TIP_LIT_GLOW = new Color(248, 214, 150, 120);

@ccclass("M02PrologueView")
export class M02PrologueView extends Component {
  private session: M02PrologueSession | null = null;
  private onDone: (() => void) | null = null;
  private readonly emberGlow = new Map<string, Graphics>();
  private readonly emberCore = new Map<string, Graphics>();
  private wandGraphics: Graphics | null = null;
  private lifeMax = 1;
  private pressedEmberId: string | null = null; // 按下时命中的余烬(拖拽候选)
  private dragActivated = false;                // 位移超阈值后才为真; 为假时抬手按点击处理
  private pressX = 0;
  private pressY = 0;
  private activeTouchId: number | null = null;
  private doneCountdown = -1;
  private disposed = false;

  /** 由 M02StarWebView 注入配置与完成回调后启动 */
  init(prologue: StarWebPrologue, rules: StarNetworkRules, onDone: () => void): void {
    this.session = new M02PrologueSession(prologue, rules);
    this.onDone = onDone;
    this.lifeMax = rules.lifeMax;

    this.node.layer = Layers.Enum.UI_2D;
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(1000, 720); // 触摸区盖满棋盘, 同主视图

    const wandNode = this.makeUINode("M02PrologueWand");
    wandNode.parent = this.node;
    wandNode.setPosition(prologue.wand.x, prologue.wand.y, 0);
    wandNode.addComponent(UITransform);
    this.wandGraphics = wandNode.addComponent(Graphics);

    for (const ember of prologue.embers) {
      const glow = this.makeGraphicsNode(`M02PrologueEmberGlow_${ember.id}`);
      const core = this.makeGraphicsNode(`M02PrologueEmber_${ember.id}`);
      this.emberGlow.set(ember.id, glow);
      this.emberCore.set(ember.id, core);
    }

    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    this.render();
  }

  onDestroy(): void {
    this.disposed = true;
    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  update(dt: number): void {
    if (this.disposed || !this.session) return;
    this.session.update(dt);
    if (this.session.view.done) {
      if (this.doneCountdown < 0) {
        this.doneCountdown = DONE_DELAY_SECONDS;
      } else {
        this.doneCountdown -= dt;
        if (this.doneCountdown <= 0 && this.onDone) {
          const done = this.onDone;
          this.onDone = null;
          done();
          return;
        }
      }
    }
    this.render();
  }

  private onTouchStart(event: EventTouch): void {
    event.propagationStopped = true; // 序章期间不让触摸冒泡进主视图
    if (this.activeTouchId !== null || !this.session) return;
    this.activeTouchId = event.getID();
    const local = this.toLocal(event);
    this.pressX = local.x;
    this.pressY = local.y;
    this.pressedEmberId = this.nearestEmberId(local.x, local.y);
    this.dragActivated = false;
  }

  private onTouchMove(event: EventTouch): void {
    event.propagationStopped = true;
    if (event.getID() !== this.activeTouchId || !this.session || !this.pressedEmberId) return;
    const local = this.toLocal(event);
    // 按下命中余烬 != 拖拽; 位移超阈值才升级, 否则抬手仍按点击处理(修 codex 审出的"点火簇被拖拽分支吞掉")
    if (!this.dragActivated && Math.hypot(local.x - this.pressX, local.y - this.pressY) < DRAG_ACTIVATE_PX) {
      return;
    }
    this.dragActivated = true;
    this.session.moveEmber(this.pressedEmberId, local.x, local.y);
    this.render();
  }

  private onTouchEnd(event: EventTouch): void {
    event.propagationStopped = true;
    if (event.getID() !== this.activeTouchId) return;
    this.activeTouchId = null;
    const wasDrag = this.dragActivated;
    this.pressedEmberId = null;
    this.dragActivated = false;
    if (!this.session) return;
    if (wasDrag) return; // 拖拽落下: 位置已在 TOUCH_MOVE 里更新

    const local = this.toLocal(event);
    const view = this.session.view;
    const wandDistance = Math.hypot(view.wand.x - local.x, view.wand.y - local.y);
    if (view.wandState === "planted" && wandDistance <= WAND_TAP_RADIUS) {
      this.session.pullWand();
    } else {
      this.session.dipWand(local.x, local.y); // 失败(未拔棒/没有冻结簇)静默: 序章靠画面教学, 不弹提示
    }
    this.render();
  }

  private onTouchCancel(event: EventTouch): void {
    event.propagationStopped = true;
    if (event.getID() === this.activeTouchId) {
      this.activeTouchId = null;
      this.pressedEmberId = null;
      this.dragActivated = false;
    }
  }

  private toLocal(event: EventTouch): Vec3 {
    const transform = this.node.getComponent(UITransform);
    const ui = event.getUILocation();
    return transform
      ? transform.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0))
      : new Vec3(ui.x, ui.y, 0);
  }

  private nearestEmberId(x: number, y: number): string | null {
    if (!this.session) return null;
    let bestId: string | null = null;
    let bestDist = EMBER_DRAG_RADIUS * EMBER_DRAG_RADIUS;
    for (const ember of this.session.view.embers) {
      const dx = ember.x - x;
      const dy = ember.y - y;
      const dist = dx * dx + dy * dy;
      if (dist <= bestDist) {
        bestDist = dist;
        bestId = ember.id;
      }
    }
    return bestId;
  }

  private render(): void {
    if (!this.session) return;
    const view = this.session.view;
    for (const ember of view.embers) {
      const glow = this.emberGlow.get(ember.id);
      const core = this.emberCore.get(ember.id);
      if (!glow || !core) continue;
      glow.node.setPosition(ember.x, ember.y, 0);
      core.node.setPosition(ember.x, ember.y, 0);

      glow.clear();
      if (ember.status === "frozen") {
        glow.fillColor = FROZEN_GLOW_COLOR;
        glow.circle(0, 0, EMBER_CORE_RADIUS + EMBER_GLOW_EXTRA);
        glow.fill();
      } else if (ember.status === "decaying") {
        // 光晕随命数收缩 —— 与主谜题倒数光晕同语言
        glow.fillColor = DECAYING_GLOW_COLOR;
        glow.circle(0, 0, EMBER_CORE_RADIUS + (EMBER_GLOW_EXTRA * ember.life) / this.lifeMax);
        glow.fill();
      }

      core.clear();
      core.fillColor = EMBER_COLOR[ember.status];
      core.circle(0, 0, ember.status === "dark" ? EMBER_CORE_RADIUS * 0.7 : EMBER_CORE_RADIUS);
      core.fill();
    }
    this.renderWand(view.wandState);
  }

  private renderWand(state: "planted" | "held" | "lit"): void {
    const graphics = this.wandGraphics;
    if (!graphics) return;
    graphics.clear();
    // 插地=斜杆, 在手/点亮=竖杆(greybox 占位; 正式版由莱米手持)
    const tip = state === "planted" ? { x: 30, y: WAND_LENGTH - 20 } : { x: 0, y: WAND_LENGTH };
    graphics.lineWidth = 5;
    graphics.strokeColor = WAND_STICK_COLOR;
    graphics.moveTo(0, -16);
    graphics.lineTo(tip.x, tip.y);
    graphics.stroke();

    if (state === "lit") {
      graphics.fillColor = WAND_TIP_LIT_GLOW;
      graphics.circle(tip.x, tip.y, WAND_TIP_RADIUS + 12);
      graphics.fill();
    }
    graphics.fillColor = state === "lit" ? WAND_TIP_LIT_COLOR : WAND_TIP_DIM_COLOR;
    graphics.circle(tip.x, tip.y, WAND_TIP_RADIUS);
    graphics.fill();
  }

  private makeUINode(name: string): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    return node;
  }

  private makeGraphicsNode(name: string): Graphics {
    const node = this.makeUINode(name);
    node.parent = this.node;
    node.addComponent(UITransform); // Graphics 是 UI 渲染件, 运行时须显式补 UITransform 否则不出图
    return node.addComponent(Graphics);
  }
}
