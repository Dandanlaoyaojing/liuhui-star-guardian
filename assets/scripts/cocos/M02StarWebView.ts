// M02《点亮你温暖我》Cocos 胶水层(greybox) —— 只做"渲染 view() + 把点击转给 session"。
// 规则全在 StarNetworkModel/StarWebSession(纯逻辑, 已单测); 本文件不算任何规则。
// greybox: 星=手绘五角星(每颗一个子节点各自 Graphics 以便独立着色), 边=一条共享 Graphics 折线。
// 交互: 根节点单一 touch-end + 最近星命中; 胜/竭后再点=进下一板/重来本板。

import { _decorator, Color, Component, EventTouch, Graphics, JsonAsset, Label, Layers, Node, resources, tween, UITransform, Vec3 } from "cc";
import { createProgressStore } from "../core/ProgressStore.ts";
import { validateStarWebConfig, type StarWebConfig } from "../core/StarWebConfig.ts";
import { buildToolCardPreview } from "../ui/ToolCardView.ts";
import { grantM02Completion } from "./M02CompletionController.ts";
import { StarWebSession, type StarNodeStatus, type StarNodeView, type StarWebView as StarWebViewState } from "./M02StarWebSession.ts";

const { ccclass, property } = _decorator;

const NODE_RADIUS = 22;   // 星视觉半径(px)
const TAP_RADIUS = 44;    // 命中半径(px), 比视觉大好点
const EDGE_WIDTH = 4;
const CHARGE_PIP_RADIUS = 8;
const CHARGE_PIP_GAP = 24;
const STAR_GLOW_EXTRA = 18;
const STARGAZE_STAR_WOBBLE = 0.35;
const STARGAZE_STAR_DRAW_ORDER = [0, 2, 4, 1, 3, 0] as const;
const FAILURE_OVERLAY_WIDTH = 1000;
const FAILURE_OVERLAY_HEIGHT = 720;
const REPAIR_FLOW_SECONDS = 0.72;
const COMPLETION_PANEL_WIDTH = 390;
const COMPLETION_PANEL_HEIGHT = 188;
const COMPLETION_CARD_WIDTH = 360;
const COMPLETION_CARD_HEIGHT = 128;

const COLOR: Record<StarNodeStatus, Color> = {
  dark: new Color(92, 98, 116, 255),
  decaying: new Color(214, 170, 104, 255),
  frozen: new Color(248, 214, 150, 255)
};
const EDGE_COLOR = new Color(110, 116, 138, 150);
const CHARGE_COLOR = new Color(248, 214, 150, 255);
const CHARGE_EMPTY_COLOR = new Color(92, 98, 116, 120);
const DECAYING_GLOW_COLOR = new Color(214, 170, 104, 95);
const FROZEN_GLOW_COLOR = new Color(248, 214, 150, 135);
const STAR_STROKE_COLOR = new Color(255, 244, 202, 180);
const DARK_STAR_STROKE_COLOR = new Color(126, 132, 150, 150);
const FAILURE_OVERLAY_COLOR = new Color(24, 26, 34, 118);
const FAILURE_LEAK_COLOR = new Color(214, 170, 104, 125);
const COMPLETION_PANEL_FILL = new Color(250, 244, 222, 242);
const COMPLETION_PANEL_STROKE = new Color(82, 72, 54, 255);
const COMPLETION_CARD_FILL = new Color(255, 250, 235, 246);
const COMPLETION_CARD_STROKE = new Color(132, 112, 74, 255);
const COMPLETION_TEXT_COLOR = new Color(45, 42, 36, 255);
const COMPLETION_ACCENT_COLOR = new Color(248, 214, 150, 255);

interface StargazeStarPoint {
  x: number;
  y: number;
}

@ccclass("M02StarWebView")
export class M02StarWebView extends Component {
  @property(String)
  configPath = "configs/stage1/m02-starweb-warmth";

  private config: StarWebConfig | null = null;
  private session: StarWebSession | null = null;
  private edgeGraphics: Graphics | null = null;
  private starLayer: Node | null = null;
  private chargeLayer: Node | null = null;
  private failureLayer: Node | null = null;
  private completionRoot: Node | null = null;
  private readonly starGlowGraphics = new Map<string, Graphics>();
  private readonly starGraphics = new Map<string, Graphics>();
  private readonly repairTweens: ReturnType<typeof tween>[] = [];
  private readonly progressStore = createProgressStore();
  private lifeMax = 1;
  private activeTouchId: number | null = null;
  private repairSequencePlaying = false;
  private completionShown = false;
  private disposed = false;

  onLoad(): void {
    this.node.layer = Layers.Enum.UI_2D; // 确保整棵子树在 UI_2D 层(否则运行时新建节点默认 DEFAULT 层, 相机看不见)
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    // 触摸区覆盖整片棋盘(星跨 ±~230px), 否则默认 100x100 收不到大部分点击
    transform.setContentSize(1000, 720);
    this.edgeGraphics = this.makeGraphicsNode("M02Edges", this.node);

    this.starLayer = this.makeUINode("M02Stars");
    this.starLayer.parent = this.node;
    this.chargeLayer = this.makeUINode("M02ChargeMeter");
    this.chargeLayer.parent = this.node;
    this.chargeLayer.setPosition(-430, 300, 0);
    this.failureLayer = this.makeUINode("M02FailureOverlay");
    this.failureLayer.parent = this.node;

    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    this.loadConfig();
  }

  onDestroy(): void {
    this.disposed = true;
    this.activeTouchId = null;
    this.stopRepairTweens();
    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  private onTouchStart(event: EventTouch): void {
    if (this.repairSequencePlaying) return;
    if (this.activeTouchId !== null) return;
    this.activeTouchId = event.getID();
  }

  private onTouchEnd(event: EventTouch): void {
    if (this.activeTouchId !== event.getID()) return;
    this.activeTouchId = null;
    if (!this.session) return;
    if (this.repairSequencePlaying) return;
    if (this.completionShown) {
      this.pulseCompletionPanel();
      return;
    }
    const view = this.session.view;
    const status = view.status;

    if (status === "won") {
      this.beginBoardWinFlow();
      return;
    }
    if (status === "exhausted") {
      this.session.resetBoard();
      this.renderStars();
      return;
    }

    // playing: 命中最近的星
    const hit = this.nearestNodeId(event, view);
    if (hit === null) return;
    this.session.tapNode(hit);
    this.renderStars();
    if (this.session.view.status === "won") this.beginBoardWinFlow();
  }

  private onTouchCancel(event: EventTouch): void {
    if (this.activeTouchId === event.getID()) this.activeTouchId = null;
  }

  private loadConfig(): void {
    resources.load(this.configPath, JsonAsset, (error, asset) => {
      if (this.disposed) return; // 组件已销毁, 别碰节点
      if (error || !asset) {
        console.error("[M02] 配置加载失败", error);
        return;
      }
      const result = validateStarWebConfig(asset.json);
      if (!result.ok) {
        console.error("[M02] 配置非法", result.errors);
        return;
      }
      this.config = result.value;
      this.lifeMax = result.value.mechanic.lifeMax;
      this.session = new StarWebSession(result.value);
      this.buildBoard();
    });
  }

  private nearestNodeId(event: EventTouch, view: StarWebViewState): string | null {
    const transform = this.node.getComponent(UITransform);
    if (!transform) return null;
    const ui = event.getUILocation();
    const local = transform.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));
    let bestId: string | null = null;
    let bestDist = TAP_RADIUS * TAP_RADIUS;
    for (const node of view.nodes) {
      const dx = node.x - local.x;
      const dy = node.y - local.y;
      const dist = dx * dx + dy * dy;
      if (dist <= bestDist) {
        bestDist = dist;
        bestId = node.id;
      }
    }
    return bestId;
  }

  /** 换板/首次: 重建边与星子节点, 再着色 */
  private buildBoard(): void {
    if (!this.session || !this.starLayer || !this.edgeGraphics) return;
    const view = this.session.view;

    this.completionRoot?.destroy();
    this.completionRoot = null;
    this.completionShown = false;
    for (const child of [...this.starLayer.children]) {
      child.destroy();
    }
    this.starGlowGraphics.clear();
    this.starGraphics.clear();

    const posById = new Map(view.nodes.map((n) => [n.id, n]));
    const edges = this.edgeGraphics;
    edges.clear();
    edges.lineWidth = EDGE_WIDTH;
    edges.strokeColor = EDGE_COLOR;
    for (const [a, b] of view.edges) {
      const na = posById.get(a);
      const nb = posById.get(b);
      if (!na || !nb) continue;
      edges.moveTo(na.x, na.y);
      edges.lineTo(nb.x, nb.y);
    }
    edges.stroke();

    for (const node of view.nodes) {
      const glowGraphics = this.makeGraphicsNode(`M02StarGlow_${node.id}`, this.starLayer);
      glowGraphics.node.setPosition(node.x, node.y, 0);
      this.starGlowGraphics.set(node.id, glowGraphics);

      const starGraphics = this.makeGraphicsNode(`M02Star_${node.id}`, this.starLayer);
      starGraphics.node.setPosition(node.x, node.y, 0);
      this.starGraphics.set(node.id, starGraphics);
    }
    this.renderStars();
  }

  private beginBoardWinFlow(): void {
    if (!this.session || this.repairSequencePlaying || this.completionShown) return;
    this.repairSequencePlaying = true;
    this.playRepairFlow(() => {
      if (this.disposed || !this.session) return;
      this.repairSequencePlaying = false;
      if (this.session.isLevelComplete()) {
        this.renderCompletionReward();
        return;
      }
      if (this.session.nextBoard()) this.buildBoard();
    });
  }

  private playRepairFlow(onComplete: () => void): void {
    this.stopRepairTweens();
    const orderedGlows = this.session?.view.nodes
      .map((node) => this.starGlowGraphics.get(node.id))
      .filter((graphics): graphics is Graphics => graphics !== undefined) ?? [];
    const flow = { progress: 0 };
    const flowTween = tween(flow)
      .to(REPAIR_FLOW_SECONDS, { progress: 1 }, {
        easing: "quadInOut",
        onUpdate: () => {
          if (this.disposed) return;
          const activeIndex = Math.floor(flow.progress * Math.max(0, orderedGlows.length - 1));
          for (let i = 0; i < orderedGlows.length; i++) {
            const scale = i <= activeIndex ? 1.16 : 1;
            orderedGlows[i].node.setScale(scale, scale, 1);
          }
        }
      })
      .call(() => {
        if (this.disposed) return;
        for (const glow of orderedGlows) {
          glow.node.setScale(1, 1, 1);
        }
        onComplete();
      })
      .start();
    this.repairTweens.push(flowTween);
  }

  private stopRepairTweens(): void {
    for (const repairTween of this.repairTweens) {
      repairTween.stop();
    }
    this.repairTweens.length = 0;
  }

  private renderCompletionReward(): void {
    if (!this.config || this.completionShown) return;
    const card = grantM02Completion(this.progressStore, this.config.toolCard, Date.now());
    const preview = buildToolCardPreview(card, {
      text: {
        unlockedSubtitle: "认知工具卡已解锁",
        whenToUsePrefix: "何时使用：{value}"
      }
    });

    this.completionRoot?.destroy();
    const panel = new Node("M02CompletionPanel");
    panel.layer = Layers.Enum.UI_2D;
    panel.setPosition(0, -238, 0);
    this.node.addChild(panel);
    this.completionRoot = panel;

    const panelTransform = panel.addComponent(UITransform);
    panelTransform.setContentSize(COMPLETION_PANEL_WIDTH, COMPLETION_PANEL_HEIGHT);
    const panelGraphics = panel.addComponent(Graphics);
    panelGraphics.lineWidth = 2;
    panelGraphics.fillColor = COMPLETION_PANEL_FILL;
    panelGraphics.strokeColor = COMPLETION_PANEL_STROKE;
    panelGraphics.rect(
      -COMPLETION_PANEL_WIDTH / 2,
      -COMPLETION_PANEL_HEIGHT / 2,
      COMPLETION_PANEL_WIDTH,
      COMPLETION_PANEL_HEIGHT
    );
    panelGraphics.fill();
    panelGraphics.stroke();
    this.drawCompletionCrystal(panel);

    this.addCardLabel(panel, "M02WisdomCrystal", this.config.wisdomCrystal, 0, 72, 13, 350, 28);

    const cardRoot = new Node("M02ToolCardPreview");
    cardRoot.layer = Layers.Enum.UI_2D;
    cardRoot.setPosition(0, -28, 0);
    panel.addChild(cardRoot);
    const cardTransform = cardRoot.addComponent(UITransform);
    cardTransform.setContentSize(COMPLETION_CARD_WIDTH, COMPLETION_CARD_HEIGHT);
    const cardGraphics = cardRoot.addComponent(Graphics);
    cardGraphics.lineWidth = 2;
    cardGraphics.fillColor = COMPLETION_CARD_FILL;
    cardGraphics.strokeColor = COMPLETION_CARD_STROKE;
    cardGraphics.rect(
      -COMPLETION_CARD_WIDTH / 2,
      -COMPLETION_CARD_HEIGHT / 2,
      COMPLETION_CARD_WIDTH,
      COMPLETION_CARD_HEIGHT
    );
    cardGraphics.fill();
    cardGraphics.stroke();

    this.addCardLabel(cardRoot, "M02ToolCardSubtitle", preview.subtitle, 0, 42, 12, 320, 20);
    this.addCardLabel(cardRoot, "M02ToolCardTitle", preview.title, 0, 22, 20, 320, 24);
    this.addCardLabel(cardRoot, "M02ToolCardCrystal", preview.lines[0] ?? "", 0, -4, 12, 330, 22);
    this.addCardLabel(cardRoot, "M02ToolCardAction", this.wrapCardText(preview.lines[1] ?? "", 24), 0, -30, 11, 330, 36);
    this.addCardLabel(cardRoot, "M02ToolCardUse", this.wrapCardText(preview.lines[2] ?? "", 27), 0, -56, 10, 330, 32);

    this.completionShown = true;
  }

  private drawCompletionCrystal(parent: Node): void {
    const crystal = this.makeGraphicsNode("M02WisdomCrystalIcon", parent);
    crystal.node.setPosition(-170, 72, 0);
    crystal.fillColor = COMPLETION_ACCENT_COLOR;
    crystal.strokeColor = COMPLETION_CARD_STROKE;
    crystal.lineWidth = 2;
    crystal.moveTo(0, 18);
    crystal.lineTo(14, 0);
    crystal.lineTo(0, -18);
    crystal.lineTo(-14, 0);
    crystal.close();
    crystal.fill();
    crystal.stroke();
  }

  private addCardLabel(
    parent: Node,
    name: string,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    width = 320,
    height = 24
  ): Label {
    const labelNode = this.makeUINode(name);
    labelNode.setPosition(x, y, 0);
    parent.addChild(labelNode);

    const transform = labelNode.addComponent(UITransform);
    transform.setContentSize(width, height);

    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 5;
    label.color = COMPLETION_TEXT_COLOR;
    label.horizontalAlign = 1;
    return label;
  }

  private wrapCardText(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.match(new RegExp(`.{1,${maxChars}}`, "g"))?.join("\n") ?? "";
  }

  private pulseCompletionPanel(): void {
    if (!this.completionRoot) return;
    this.stopRepairTweens();
    this.completionRoot.setScale(1, 1, 1);
    const flow = { scale: 1 };
    const pulseTween = tween(flow)
      .to(0.08, { scale: 1.03 }, {
        onUpdate: () => {
          if (this.disposed || !this.completionRoot) return;
          this.completionRoot.setScale(flow.scale, flow.scale, 1);
        }
      })
      .to(0.12, { scale: 1 }, {
        onUpdate: () => {
          if (this.disposed || !this.completionRoot) return;
          this.completionRoot.setScale(flow.scale, flow.scale, 1);
        }
      })
      .start();
    this.repairTweens.push(pulseTween);
  }

  /** 建一个 UI_2D 层的节点(运行时新建节点默认落 DEFAULT 层, UI 相机看不见) */
  private makeUINode(name: string): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    return node;
  }

  private makeGraphicsNode(name: string, parent: Node): Graphics {
    const node = this.makeUINode(name);
    node.parent = parent;
    node.addComponent(UITransform); // Graphics 是 UI 渲染件, 运行时须显式补 UITransform 否则不出图
    return node.addComponent(Graphics);
  }

  /** 按当前 view 的呈现态给每颗星着色 */
  private renderStars(): void {
    if (!this.session) return;
    for (const node of this.session.view.nodes) {
      const glowGraphics = this.starGlowGraphics.get(node.id);
      const graphics = this.starGraphics.get(node.id);
      if (!graphics) continue;
      if (glowGraphics) {
        glowGraphics.clear();
        this.renderStarGlow(glowGraphics, node);
      }
      graphics.clear();
      this.renderStargazeStar(graphics, node);
    }
    this.renderChargeMeter();
    this.renderFailureOverlay();
  }

  private renderStargazeStar(graphics: Graphics, node: StarNodeView): void {
    const rng = this.rngFromStarId(node.id);
    const vertices = this.generateStargazeStarVertices(NODE_RADIUS, STARGAZE_STAR_WOBBLE, rng);
    graphics.fillColor = COLOR[node.status];
    this.drawStargazeStarPath(graphics, vertices);
    graphics.fill();

    const strokeColor = node.status === "dark" ? DARK_STAR_STROKE_COLOR : STAR_STROKE_COLOR;
    for (let pass = 0; pass < 3; pass++) {
      const drift = NODE_RADIUS * (0.07 + pass * 0.05);
      const drifted = vertices.map((v) => ({
        x: v.x + (rng() - 0.5) * drift,
        y: v.y + (rng() - 0.5) * drift
      }));
      graphics.strokeColor = strokeColor;
      graphics.lineWidth = Math.max(1.2, NODE_RADIUS * (0.08 + pass * 0.02));
      this.drawStargazeStarPath(graphics, drifted);
      graphics.stroke();
    }
  }

  private generateStargazeStarVertices(
    size: number,
    wobble: number,
    rng: () => number
  ): StargazeStarPoint[] {
    const vertices: StargazeStarPoint[] = [];
    const startAngle = -Math.PI / 2 + (rng() - 0.5) * 0.4;
    for (let i = 0; i < 5; i++) {
      const angle = startAngle + (i * Math.PI * 2) / 5;
      const r = size * (1 + (rng() - 0.5) * wobble);
      const angleShift = (rng() - 0.5) * wobble * 0.5;
      vertices.push({
        x: Math.cos(angle + angleShift) * r,
        y: Math.sin(angle + angleShift) * r
      });
    }
    return vertices;
  }

  private drawStargazeStarPath(graphics: Graphics, vertices: StargazeStarPoint[]): void {
    const first = vertices[STARGAZE_STAR_DRAW_ORDER[0]];
    if (!first) return;
    graphics.moveTo(first.x, first.y);
    for (let i = 1; i < STARGAZE_STAR_DRAW_ORDER.length; i++) {
      const point = vertices[STARGAZE_STAR_DRAW_ORDER[i]];
      if (point) graphics.lineTo(point.x, point.y);
    }
    graphics.close();
  }

  private rngFromStarId(id: string): () => number {
    let seed = 2166136261;
    for (let i = 0; i < id.length; i++) {
      seed ^= id.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    return () => {
      seed += 0x6D2B79F5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private renderStarGlow(graphics: Graphics, node: StarNodeView): void {
    if (!node.lit) return;
    const lifeRatio = node.status === "frozen" ? 1 : node.life / Math.max(1, this.lifeMax);
    const glowRadius = NODE_RADIUS + STAR_GLOW_EXTRA * lifeRatio;
    graphics.lineWidth = node.status === "frozen" ? 3 : 2;
    graphics.strokeColor = node.status === "frozen" ? FROZEN_GLOW_COLOR : DECAYING_GLOW_COLOR;
    graphics.circle(0, 0, glowRadius);
    graphics.stroke();
  }

  private renderChargeMeter(): void {
    if (!this.session || !this.chargeLayer) return;
    for (const child of [...this.chargeLayer.children]) {
      child.destroy();
    }

    const { chargesLeft, chargesTotal } = this.session.view;
    for (let i = 0; i < chargesTotal; i++) {
      const pip = this.makeGraphicsNode(`M02ChargePip_${i}`, this.chargeLayer);
      pip.node.setPosition(i * CHARGE_PIP_GAP, 0, 0);
      pip.fillColor = i < chargesLeft ? CHARGE_COLOR : CHARGE_EMPTY_COLOR;
      pip.circle(0, 0, CHARGE_PIP_RADIUS);
      pip.fill();
    }
  }

  private renderFailureOverlay(): void {
    if (!this.session || !this.failureLayer) return;
    for (const child of [...this.failureLayer.children]) {
      child.destroy();
    }
    if (this.session.view.status !== "exhausted") return;

    const overlay = this.makeGraphicsNode("M02FailureDark", this.failureLayer);
    overlay.fillColor = FAILURE_OVERLAY_COLOR;
    overlay.rect(-FAILURE_OVERLAY_WIDTH / 2, -FAILURE_OVERLAY_HEIGHT / 2, FAILURE_OVERLAY_WIDTH, FAILURE_OVERLAY_HEIGHT);
    overlay.fill();

    const leaks = this.makeGraphicsNode("M02FailureLeakPoints", this.failureLayer);
    leaks.fillColor = FAILURE_LEAK_COLOR;
    for (const [x, y, radius] of [[-74, 24, 18], [0, -16, 24], [82, 18, 14]]) {
      leaks.circle(x, y, radius);
    }
    leaks.fill();
  }
}
