import { _decorator, Color, Component, Graphics, JsonAsset, Label, Node, resources, UITransform } from "cc";
import {
  buildM01GreyboxLayout,
  type M01GreyboxLayout,
  type M01GreyboxTokenNode
} from "./M01GreyboxLayout.ts";
import { M01GreyboxSession } from "./M01GreyboxSession.ts";
import type {
  M01GreyboxFilterPresentation,
  M01GreyboxFragmentPresentation
} from "./M01GreyboxSession.ts";
import type { M01MemoryGearConfig } from "../levels/stage1/M01MemoryGearController.ts";

const { ccclass, property } = _decorator;

@ccclass("M01GreyboxBootstrap")
export class M01GreyboxBootstrap extends Component {
  @property(Label)
  statusLabel: Label | null = null;

  private session: M01GreyboxSession | null = null;
  private layout: M01GreyboxLayout | null = null;
  private greyboxRoot: Node | null = null;
  private readonly greyboxNodes = new Map<
    string,
    { node: Node; token: M01GreyboxTokenNode; graphics: Graphics }
  >();

  start(): void {
    resources.load("configs/stage1/m01-memory-gear", JsonAsset, (error, asset) => {
      if (error || !asset) {
        this.setStatus(`Failed to load M01 config: ${error?.message ?? "unknown error"}`);
        return;
      }

      const m01Config = asset.json as unknown as M01MemoryGearConfig;
      this.session = M01GreyboxSession.fromConfig(m01Config);
      this.layout = buildM01GreyboxLayout(m01Config);
      this.renderGreybox(this.layout);
      this.syncVisualState();
      this.setStatus(this.layout.statusText);
    });
  }

  selectFilter(filterIdOrColor: string): void {
    if (!this.session) {
      this.setStatus("M01 is not initialized.");
      return;
    }

    this.setStatus(this.session.activateFilter(filterIdOrColor).status);
    this.syncVisualState();
  }

  selectFragment(fragmentId: string): void {
    if (!this.session) {
      this.setStatus("M01 is not initialized.");
      return;
    }

    this.setStatus(this.session.selectFragment(fragmentId).status);
    this.syncVisualState();
  }

  placeFragment(fragmentId: string, slotId: string): void {
    if (!this.session) {
      this.setStatus("M01 is not initialized.");
      return;
    }

    const selected = this.session.selectFragment(fragmentId);
    if (!selected.accepted) {
      this.setStatus(selected.status);
      this.syncVisualState();
      return;
    }

    this.setStatus(this.session.placeSelectedFragment(slotId).status);
    this.syncVisualState();
  }

  placeSelectedFragment(slotId: string): void {
    if (!this.session) {
      this.setStatus("M01 is not initialized.");
      return;
    }

    this.setStatus(this.session.placeSelectedFragment(slotId).status);
    this.syncVisualState();
  }

  private setStatus(message: string): void {
    if (this.statusLabel) {
      this.statusLabel.string = message;
    }
  }

  private renderGreybox(layout: M01GreyboxLayout): void {
    this.greyboxNodes.clear();
    this.greyboxRoot = new Node("M01GreyboxRuntime");
    this.node.addChild(this.greyboxRoot);

    this.addShapeNode(this.greyboxRoot, layout.gear);
    for (const slot of layout.slots) {
      this.addShapeNode(this.greyboxRoot, slot);
    }
    for (const fragment of layout.fragments) {
      this.addShapeNode(this.greyboxRoot, fragment);
    }
    for (const filter of layout.filters) {
      this.addShapeNode(this.greyboxRoot, filter);
    }

    if (!this.statusLabel) {
      this.statusLabel = this.addStatusLabel(this.greyboxRoot);
    }
  }

  private addStatusLabel(parent: Node): Label {
    const labelNode = new Node("M01StatusLabel");
    labelNode.setPosition(-430, 286, 0);
    parent.addChild(labelNode);

    const transform = labelNode.addComponent(UITransform);
    transform.setContentSize(840, 32);

    const label = labelNode.addComponent(Label);
    label.fontSize = 18;
    label.lineHeight = 24;
    label.color = new Color(43, 43, 39, 255);
    return label;
  }

  private addShapeNode(parent: Node, token: M01GreyboxTokenNode): Node {
    const node = new Node(token.id);
    node.setPosition(token.position.x, token.position.y, 0);
    parent.addChild(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(token.size.width, token.size.height);

    const graphics = node.addComponent(Graphics);
    graphics.lineWidth = token.kind === "slot" ? 3 : 2;
    graphics.strokeColor = new Color(44, 43, 38, 255);
    graphics.fillColor = colorForToken(token.colorToken, token.kind, "normal");
    drawTokenShape(graphics, token);
    this.bindGreyboxInput(node, token);
    this.greyboxNodes.set(token.controllerId, { node, token, graphics });

    return node;
  }

  private bindGreyboxInput(node: Node, token: M01GreyboxTokenNode): void {
    if (token.kind === "filter") {
      node.on("touch-end", () => this.selectFilter(token.controllerId), this);
    } else if (token.kind === "fragment") {
      node.on("touch-end", () => this.selectFragment(token.controllerId), this);
    } else if (token.kind === "slot") {
      node.on("touch-end", () => this.placeSelectedFragment(token.controllerId), this);
    }
  }

  private syncVisualState(): void {
    if (!this.session) {
      return;
    }

    for (const entry of this.greyboxNodes.values()) {
      if (entry.token.kind === "fragment") {
        const view = this.session.getFragmentView(entry.token.controllerId);
        entry.node.active = !view.placed;
        entry.graphics.lineWidth = view.selected ? 5 : view.interactive ? 3 : 1;
        entry.graphics.fillColor = colorForToken(
          entry.token.colorToken,
          entry.token.kind,
          view.presentation
        );
        drawTokenShape(entry.graphics, entry.token);
      } else if (entry.token.kind === "filter") {
        const view = this.session.getFilterView(entry.token.controllerId);
        entry.graphics.lineWidth = view.active ? 4 : 2;
        entry.graphics.fillColor = colorForToken(
          entry.token.colorToken,
          entry.token.kind,
          view.presentation
        );
        drawTokenShape(entry.graphics, entry.token);
      }
    }
  }
}

export function drawTokenShape(graphics: Graphics, token: M01GreyboxTokenNode): void {
  graphics.clear();

  if (token.kind === "gear") {
    drawGear(graphics, token.size.width / 2);
  } else if (token.shapeToken === "triangle") {
    drawTriangle(graphics, token.size.width, token.size.height);
  } else if (token.shapeToken === "hexagon") {
    drawHexagon(graphics, token.size.width, token.size.height);
  } else if (token.kind === "filter") {
    drawFilter(graphics, token.size.width, token.size.height);
  } else {
    graphics.circle(0, 0, Math.min(token.size.width, token.size.height) / 2);
  }

  graphics.fill();
  graphics.stroke();
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

function drawTriangle(graphics: Graphics, width: number, height: number): void {
  graphics.moveTo(0, height / 2);
  graphics.lineTo(-width / 2, -height / 2);
  graphics.lineTo(width / 2, -height / 2);
  graphics.close();
}

function drawHexagon(graphics: Graphics, width: number, height: number): void {
  const halfWidth = width / 2;
  const quarterWidth = width / 4;
  const halfHeight = height / 2;

  graphics.moveTo(-quarterWidth, halfHeight);
  graphics.lineTo(quarterWidth, halfHeight);
  graphics.lineTo(halfWidth, 0);
  graphics.lineTo(quarterWidth, -halfHeight);
  graphics.lineTo(-quarterWidth, -halfHeight);
  graphics.lineTo(-halfWidth, 0);
  graphics.close();
}

function drawFilter(graphics: Graphics, width: number, height: number): void {
  graphics.rect(-width / 2, -height / 2, width, height);
}

function colorForToken(
  colorToken: string,
  kind: M01GreyboxTokenNode["kind"],
  presentation: M01GreyboxFragmentPresentation | M01GreyboxFilterPresentation | "normal"
): Color {
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
  const colors: Record<string, [number, number, number]> = {
    red: [180, 92, 70],
    blue: [88, 119, 132],
    yellow: [188, 158, 87]
  };
  const [r, g, b] = colors[colorToken] ?? [160, 154, 132];

  return new Color(r, g, b, alpha);
}
