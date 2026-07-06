// M02《点亮你温暖我》Cocos 胶水层(greybox) —— 只做"渲染 view() + 把点击转给 session"。
// 规则全在 StarNetworkModel/StarWebSession(纯逻辑, 已单测); 本文件不算任何规则。
// greybox: 星=手绘五角星(每颗一个子节点各自 Graphics 以便独立着色), 边=一条共享 Graphics 折线。
// 交互: 根节点单一 touch-end + 最近星命中; 胜/竭后再点=进下一板/重来本板。

import { _decorator, Color, Component, EventTouch, Graphics, JsonAsset, Layers, Node, resources, UITransform, Vec3 } from "cc";
import { validateStarWebConfig } from "../core/StarWebConfig.ts";
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

interface StargazeStarPoint {
  x: number;
  y: number;
}

@ccclass("M02StarWebView")
export class M02StarWebView extends Component {
  @property(String)
  configPath = "configs/stage1/m02-starweb-warmth";

  private session: StarWebSession | null = null;
  private edgeGraphics: Graphics | null = null;
  private starLayer: Node | null = null;
  private chargeLayer: Node | null = null;
  private failureLayer: Node | null = null;
  private readonly starGraphics = new Map<string, Graphics>();
  private lifeMax = 1;
  private activeTouchId: number | null = null;
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
    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  private onTouchStart(event: EventTouch): void {
    if (this.activeTouchId !== null) return;
    this.activeTouchId = event.getID();
  }

  private onTouchEnd(event: EventTouch): void {
    if (this.activeTouchId !== event.getID()) return;
    this.activeTouchId = null;
    if (!this.session) return;
    const view = this.session.view;
    const status = view.status;

    if (status === "won") {
      if (this.session.nextBoard()) this.buildBoard();
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

    for (const child of [...this.starLayer.children]) {
      child.destroy();
    }
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
      const starGraphics = this.makeGraphicsNode(`M02Star_${node.id}`, this.starLayer);
      starGraphics.node.setPosition(node.x, node.y, 0);
      this.starGraphics.set(node.id, starGraphics);
    }
    this.renderStars();
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
      const graphics = this.starGraphics.get(node.id);
      if (!graphics) continue;
      graphics.clear();
      this.renderStarGlow(graphics, node);
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

    const overlay = this.makeGraphicsNode("M02FailureLeak", this.failureLayer);
    overlay.fillColor = FAILURE_OVERLAY_COLOR;
    overlay.rect(-FAILURE_OVERLAY_WIDTH / 2, -FAILURE_OVERLAY_HEIGHT / 2, FAILURE_OVERLAY_WIDTH, FAILURE_OVERLAY_HEIGHT);
    overlay.fill();
    overlay.fillColor = FAILURE_LEAK_COLOR;
    for (const [x, y, radius] of [[-74, 24, 18], [0, -16, 24], [82, 18, 14]]) {
      overlay.circle(x, y, radius);
    }
    overlay.fill();
  }
}
