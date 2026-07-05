// M02《点亮你温暖我》Cocos 胶水层(greybox) —— 只做"渲染 view() + 把点击转给 session"。
// 规则全在 StarNetworkModel/StarWebSession(纯逻辑, 已单测); 本文件不算任何规则。
// greybox: 星=填色圆(每颗一个子节点各自 Graphics 以便独立着色), 边=一条共享 Graphics 折线。
// 交互: 根节点单一 touch-end + 最近星命中; 胜/竭后再点=进下一板/重来本板。

import { _decorator, Color, Component, EventTouch, Graphics, JsonAsset, Node, resources, UITransform, Vec3 } from "cc";
import { validateStarWebConfig } from "../core/StarWebConfig.ts";
import { StarWebSession, type StarNodeStatus } from "./M02StarWebSession.ts";

const { ccclass, property } = _decorator;

const NODE_RADIUS = 22;   // 星视觉半径(px)
const TAP_RADIUS = 44;    // 命中半径(px), 比视觉大好点
const EDGE_WIDTH = 4;

const COLOR: Record<StarNodeStatus, Color> = {
  dark: new Color(92, 98, 116, 255),
  decaying: new Color(214, 170, 104, 255),
  frozen: new Color(248, 214, 150, 255)
};
const EDGE_COLOR = new Color(110, 116, 138, 150);

@ccclass("M02StarWebView")
export class M02StarWebView extends Component {
  @property(String)
  configPath = "configs/stage1/m02-starweb-warmth";

  private session: StarWebSession | null = null;
  private edgeGraphics: Graphics | null = null;
  private starLayer: Node | null = null;
  private readonly starGraphics = new Map<string, Graphics>();
  private disposed = false;

  onLoad(): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    // 触摸区覆盖整片棋盘(星跨 ±~230px), 否则默认 100x100 收不到大部分点击
    transform.setContentSize(1000, 720);
    const edgeNode = new Node("M02Edges");
    edgeNode.parent = this.node;
    this.edgeGraphics = edgeNode.addComponent(Graphics);

    this.starLayer = new Node("M02Stars");
    this.starLayer.parent = this.node;

    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.loadConfig();
  }

  onDestroy(): void {
    this.disposed = true;
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
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
      this.session = new StarWebSession(result.value);
      this.buildBoard();
    });
  }

  private onTouchEnd(event: EventTouch): void {
    if (!this.session) return;
    const status = this.session.view.status;

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
    const hit = this.nearestNodeId(event);
    if (hit === null) return;
    this.session.tapNode(hit);
    this.renderStars();
  }

  private nearestNodeId(event: EventTouch): string | null {
    if (!this.session) return null;
    const transform = this.node.getComponent(UITransform);
    if (!transform) return null;
    const ui = event.getUILocation();
    const local = transform.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));
    let bestId: string | null = null;
    let bestDist = TAP_RADIUS * TAP_RADIUS;
    for (const node of this.session.view.nodes) {
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
      const starNode = new Node(`M02Star_${node.id}`);
      starNode.parent = this.starLayer;
      starNode.setPosition(node.x, node.y, 0);
      this.starGraphics.set(node.id, starNode.addComponent(Graphics));
    }
    this.renderStars();
  }

  /** 按当前 view 的呈现态给每颗星着色 */
  private renderStars(): void {
    if (!this.session) return;
    for (const node of this.session.view.nodes) {
      const graphics = this.starGraphics.get(node.id);
      if (!graphics) continue;
      graphics.clear();
      graphics.fillColor = COLOR[node.status];
      graphics.circle(0, 0, NODE_RADIUS);
      graphics.fill();
    }
  }
}
