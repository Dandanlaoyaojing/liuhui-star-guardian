import { _decorator, Color, Component, Graphics, JsonAsset, Label, Node, resources, UITransform } from "cc";
import {
  buildM01GreyboxLayout,
  type M01GreyboxLayout,
  type M01GreyboxTokenNode
} from "./M01GreyboxLayout.ts";
import { M01GreyboxSession } from "./M01GreyboxSession.ts";
import type {
  M01GreyboxFilterPresentation,
  M01GreyboxFragmentPresentation,
  M01GreyboxPlaceResult,
  M01GreyboxRepairPresentation,
  M01GreyboxSlotPresentation
} from "./M01GreyboxSession.ts";
import type { M01MemoryGearConfig } from "../levels/stage1/M01MemoryGearController.ts";
import { buildToolCardPreview } from "../ui/ToolCardView.ts";
import { formatM01GreyboxText, type M01GreyboxTextOverrides } from "./M01GreyboxText.ts";

const { ccclass, property } = _decorator;

@ccclass("M01GreyboxBootstrap")
export class M01GreyboxBootstrap extends Component {
  @property(Label)
  statusLabel: Label | null = null;

  private session: M01GreyboxSession | null = null;
  private layout: M01GreyboxLayout | null = null;
  private greyboxRoot: Node | null = null;
  private toolCardRoot: Node | null = null;
  private feedbackLabel: Label | null = null;
  private readonly text: M01GreyboxTextOverrides = {};
  private readonly greyboxNodes = new Map<
    string,
    { node: Node; token: M01GreyboxTokenNode; graphics: Graphics }
  >();

  start(): void {
    resources.load("configs/stage1/m01-memory-gear", JsonAsset, (error, asset) => {
      if (error || !asset) {
        this.setStatus(
          this.formatText("loadFailed", { reason: error?.message ?? "unknown error" })
        );
        return;
      }

      const m01Config = asset.json as unknown as M01MemoryGearConfig;
      this.session = M01GreyboxSession.fromConfig(m01Config, { text: this.text });
      this.layout = buildM01GreyboxLayout(m01Config, { text: this.text });
      this.toolCardRoot = null;
      this.feedbackLabel = null;
      this.renderGreybox(this.layout);
      this.syncVisualState();
      this.setStatus(this.layout.statusText);
    });
  }

  selectFilter(filterIdOrColor: string): void {
    if (!this.session) {
      this.setStatus(this.formatText("notInitialized"));
      return;
    }

    this.setStatus(this.session.activateFilter(filterIdOrColor).status);
    this.syncFeedbackFromSession();
    this.syncVisualState();
  }

  selectFragment(fragmentId: string): void {
    if (!this.session) {
      this.setStatus(this.formatText("notInitialized"));
      return;
    }

    this.setStatus(this.session.selectFragment(fragmentId).status);
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
      this.setFeedback(this.formatText("repairCompleted"));
      this.renderToolCardPreview(this.greyboxRoot, card);
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
    this.feedbackLabel = this.addFeedbackLabel(this.greyboxRoot);
    this.addHintButton(this.greyboxRoot);
  }

  private addStatusLabel(parent: Node): Label {
    const labelNode = new Node("M01StatusLabel");
    labelNode.setPosition(0, 286, 0);
    parent.addChild(labelNode);

    const transform = labelNode.addComponent(UITransform);
    transform.setContentSize(880, 32);

    const label = labelNode.addComponent(Label);
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
    transform.setContentSize(82, 34);

    const graphics = buttonNode.addComponent(Graphics);
    graphics.lineWidth = 2;
    graphics.strokeColor = new Color(44, 43, 38, 255);
    graphics.fillColor = new Color(239, 231, 203, 230);
    graphics.rect(-41, -17, 82, 34);
    graphics.fill();
    graphics.stroke();

    this.addButtonLabel(buttonNode, this.formatText("hintButton"));
    buttonNode.on("touch-end", () => this.requestHint(), this);
    return buttonNode;
  }

  private addButtonLabel(parent: Node, text: string): Label {
    const labelNode = new Node("M01HintButtonLabel");
    parent.addChild(labelNode);

    const transform = labelNode.addComponent(UITransform);
    transform.setContentSize(72, 22);

    const label = labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = 15;
    label.lineHeight = 20;
    label.color = new Color(43, 43, 39, 255);
    return label;
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

    this.addCardLabel(cardRoot, "M01ToolCardSubtitle", preview.subtitle, 0, 48, 13);
    this.addCardLabel(cardRoot, "M01ToolCardTitle", preview.title, 0, 24, 22);
    this.addCardLabel(cardRoot, "M01ToolCardCrystal", preview.lines[0] ?? "", 0, -8, 15);
    this.addCardLabel(cardRoot, "M01ToolCardAction", preview.lines[1] ?? "", 0, -34, 13);
    this.addCardLabel(cardRoot, "M01ToolCardUse", preview.lines[2] ?? "", 0, -56, 12);
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
        entry.graphics.lineWidth = view.selected ? 5 : view.hinted ? 4 : view.interactive ? 3 : 1;
        entry.graphics.fillColor = colorForToken(
          entry.token.colorToken,
          entry.token.kind,
          view.presentation
        );
        drawTokenShape(entry.graphics, entry.token);
      } else if (entry.token.kind === "slot") {
        const view = this.session.getSlotView(entry.token.controllerId);
        entry.graphics.lineWidth = view.presentation === "normal" ? 3 : 5;
        entry.graphics.fillColor = colorForToken(
          entry.token.colorToken,
          entry.token.kind,
          view.presentation
        );
        drawTokenShape(entry.graphics, entry.token);
      } else if (entry.token.kind === "filter") {
        const view = this.session.getFilterView(entry.token.controllerId);
        entry.graphics.lineWidth = view.active || view.hinted ? 4 : 2;
        entry.graphics.fillColor = colorForToken(
          entry.token.colorToken,
          entry.token.kind,
          view.presentation
        );
        drawTokenShape(entry.graphics, entry.token);
      } else if (entry.token.kind === "gear") {
        const view = this.session.getRepairView();
        entry.graphics.lineWidth = view.repaired ? 4 : 2;
        entry.graphics.fillColor = colorForToken(
          entry.token.colorToken,
          entry.token.kind,
          view.presentation
        );
        drawTokenShape(entry.graphics, entry.token);
      }
    }
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
  | M01GreyboxSlotPresentation
  | M01GreyboxRepairPresentation
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
  const colors: Record<string, [number, number, number]> = {
    red: [180, 92, 70],
    blue: [88, 119, 132],
    yellow: [188, 158, 87]
  };
  const [r, g, b] = colors[colorToken] ?? [160, 154, 132];

  return new Color(r, g, b, alpha);
}
