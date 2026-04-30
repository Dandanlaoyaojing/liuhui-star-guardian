import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  input,
  Input,
  JsonAsset,
  Label,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  UITransform
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
  buildM01GreyboxLayout,
  type M01GreyboxLayout,
  type M01GreyboxPoint,
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
import {
  buildM01GreyboxStaticArtPlan,
  getM01GreyboxRuntimeSpriteResourceForToken
} from "./M01GreyboxArt.ts";
import { formatM01GreyboxText, type M01GreyboxTextOverrides } from "./M01GreyboxText.ts";

const { ccclass, property } = _decorator;
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

@ccclass("M01GreyboxBootstrap")
export class M01GreyboxBootstrap extends Component {
  @property(Label)
  statusLabel: Label | null = null;

  @property({ type: Boolean })
  enableArtPreview = false;

  @property({ type: Boolean })
  showArtPreviewDebugUnderlay = false;

  private session: M01GreyboxSession | null = null;
  private layout: M01GreyboxLayout | null = null;
  private greyboxRoot: Node | null = null;
  private toolCardRoot: Node | null = null;
  private feedbackLabel: Label | null = null;
  private activeDragNode: Node | null = null;
  private activeDragToken: M01GreyboxTokenNode | null = null;
  private dragState: DragState = {};
  private globalPointerInputBound = false;
  private readonly text: M01GreyboxTextOverrides = {};
  private readonly greyboxNodes = new Map<
    string,
    { node: Node; token: M01GreyboxTokenNode; graphics: Graphics; artSprite: Sprite | null }
  >();
  private readonly artPreviewFallbackUnderlayIds = new Set<string>();

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

  onDestroy(): void {
    this.unbindGlobalPointerInput();
    this.dragState = {};
    this.clearActiveDrag();
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
      this.setFeedback("");
      this.renderToolCardPreview(this.greyboxRoot, card);
    }
  }

  private renderGreybox(layout: M01GreyboxLayout): void {
    this.greyboxNodes.clear();
    this.artPreviewFallbackUnderlayIds.clear();
    this.greyboxRoot = new Node("M01GreyboxRuntime");
    this.node.addChild(this.greyboxRoot);
    this.bindGlobalPointerInput();

    this.addShapeNode(this.greyboxRoot, layout.gear);
    if (this.enableArtPreview) {
      this.renderStaticArtPreview(this.greyboxRoot);
    }
    for (const slot of layout.slots ?? []) {
      this.addShapeNode(this.greyboxRoot, slot);
    }
    for (const fragment of layout.fragments) {
      this.addShapeNode(this.greyboxRoot, fragment);
    }
    for (const filter of layout.filters ?? []) {
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
    this.applyTokenGraphicsState(graphics, token, "normal", token.kind === "slot" ? 3 : 2);
    this.bindGreyboxInput(node, token);
    const artSprite = this.enableArtPreview ? this.addTokenArtSprite(node, token) : null;
    this.greyboxNodes.set(token.controllerId, { node, token, graphics, artSprite });

    return node;
  }

  private applyTokenGraphicsState(
    graphics: Graphics,
    token: M01GreyboxTokenNode,
    presentation: M01GreyboxPresentation,
    lineWidth: number
  ): void {
    const color = colorForToken(token.colorToken, token.kind, presentation);
    const renderUnderlay =
      !this.enableArtPreview ||
      shouldRenderArtPreviewUnderlay(
        token,
        presentation,
        this.showArtPreviewDebugUnderlay,
        this.artPreviewFallbackUnderlayIds.has(token.controllerId)
      );
    graphics.lineWidth = renderUnderlay
      ? this.enableArtPreview
        ? lineWidthForArtPreview(token, lineWidth)
        : lineWidth
      : 0;
    graphics.strokeColor = renderUnderlay && this.enableArtPreview
      ? strokeColorForArtPreview(token, presentation)
      : renderUnderlay
        ? new Color(44, 43, 38, 255)
        : new Color(0, 0, 0, 0);
    graphics.fillColor = renderUnderlay && this.enableArtPreview
      ? colorForArtPreviewUnderlay(color, presentation)
      : renderUnderlay
        ? color
        : new Color(0, 0, 0, 0);
    drawTokenShape(graphics, token);
  }

  private addTokenArtSprite(parent: Node, token: M01GreyboxTokenNode): Sprite | null {
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
    this.syncArtSpriteState(sprite, "normal");
    resources.load(resource.resourcesLoadPath, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame) {
        this.setFeedback(
          this.formatText("loadFailed", { reason: error?.message ?? resource.resourcesLoadPath })
        );
        this.markArtPreviewUnderlayFallback(token.controllerId);
        spriteNode.active = false;
        return;
      }
      sprite.spriteFrame = spriteFrame;
    });
    return sprite;
  }

  private renderStaticArtPreview(parent: Node): void {
    const plan = buildM01GreyboxStaticArtPlan();
    for (const layer of plan.layers) {
      const layerNode = new Node(`M01StaticArt_${layer.id}`);
      layerNode.setPosition(layer.position.x, layer.position.y, 0);
      parent.addChild(layerNode);

      const transform = layerNode.addComponent(UITransform);
      transform.setContentSize(layer.size.width, layer.size.height);

      const sprite = layerNode.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
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

  private bindGreyboxInput(node: Node, token: M01GreyboxTokenNode): void {
    if (token.kind === "slot") {
      node.on("touch-end", () => this.placeSelectedFragment(token.controllerId), this);
    }

    if (token.kind === "filter" || token.kind === "fragment") {
      node.on("touch-start", (event: EventTouch) => this.beginTokenDrag(event, node, token), this);
      node.on("touch-move", (event: EventTouch) => this.moveTokenDrag(event, node), this);
      node.on("touch-end", (event: EventTouch) => this.endTokenDrag(event, node, token), this);
      node.on("touch-cancel", (event: EventTouch) => this.cancelTokenDrag(event, node, token), this);
    }
  }

  private bindGlobalPointerInput(): void {
    if (this.globalPointerInputBound) {
      return;
    }

    input.on(Input.EventType.MOUSE_MOVE, this.moveActivePointerDrag, this);
    input.on(Input.EventType.MOUSE_UP, this.endActivePointerDrag, this);
    this.globalPointerInputBound = true;
  }

  private unbindGlobalPointerInput(): void {
    if (!this.globalPointerInputBound) {
      return;
    }

    input.off(Input.EventType.MOUSE_MOVE, this.moveActivePointerDrag, this);
    input.off(Input.EventType.MOUSE_UP, this.endActivePointerDrag, this);
    this.globalPointerInputBound = false;
  }

  private beginTokenDrag(event: M01GreyboxPointerEvent, node: Node, token: M01GreyboxTokenNode): void {
    if (!this.layout) {
      return;
    }

    const position = this.eventToLocalPoint(event);
    this.activeDragNode = node;
    this.activeDragToken = token;
    this.dragState = beginDragSession({
      pointerId: this.pointerIdForEvent(event),
      entityId: token.controllerId,
      position
    });
    node.setPosition(position.x, position.y, 0);
  }

  private moveActivePointerDrag(event: M01GreyboxPointerEvent): void {
    if (this.activeDragNode) {
      this.moveTokenDrag(event, this.activeDragNode);
    }
  }

  private moveTokenDrag(event: M01GreyboxPointerEvent, node: Node): void {
    if (!this.dragState.active) {
      return;
    }

    this.dragState = moveDragSession(this.dragState, {
      pointerId: this.pointerIdForEvent(event),
      position: this.eventToLocalPoint(event)
    });

    const active = this.dragState.active;
    if (active) {
      node.setPosition(active.currentPosition.x, active.currentPosition.y, 0);
    }
  }

  private endActivePointerDrag(event: M01GreyboxPointerEvent): void {
    if (this.activeDragNode && this.activeDragToken) {
      this.endTokenDrag(event, this.activeDragNode, this.activeDragToken);
    }
  }

  private endTokenDrag(event: M01GreyboxPointerEvent, node: Node, token: M01GreyboxTokenNode): void {
    if (!this.dragState.active) {
      return;
    }

    const transition = endDragSession(this.dragState, {
      pointerId: this.pointerIdForEvent(event),
      position: this.eventToLocalPoint(event)
    });
    this.dragState = transition.state;

    if (transition.outcome.type !== "ended" || !transition.outcome.session) {
      this.resetTokenNode(node, token);
      this.clearActiveDrag();
      return;
    }

    this.handleTokenDrop(node, token, transition.outcome.session.currentPosition);
    this.clearActiveDrag();
  }

  private cancelTokenDrag(event: M01GreyboxPointerEvent, node: Node, token: M01GreyboxTokenNode): void {
    const transition = cancelDragSession(this.dragState, this.pointerIdForEvent(event));
    this.dragState = transition.state;
    this.resetTokenNode(node, token);
    this.clearActiveDrag();
  }

  private clearActiveDrag(): void {
    this.activeDragNode = null;
    this.activeDragToken = null;
  }

  private handleTokenDrop(node: Node, token: M01GreyboxTokenNode, dropPosition: M01GreyboxPoint): void {
    if (!this.layout || !this.session) {
      this.resetTokenNode(node, token);
      return;
    }

    const action = resolveM01GreyboxDrop(this.layout, token, dropPosition);
    if (action.type === "activate_filter") {
      this.resetTokenNode(node, token);
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
      this.syncFeedbackFromSession();
      this.syncVisualState();
      this.handlePlaceResult(placed);
      if (!placed.accepted) {
        this.resetTokenNode(node, token);
      }
      return;
    }

    this.resetTokenNode(node, token);
  }

  private resetTokenNode(node: Node, token: M01GreyboxTokenNode): void {
    node.setPosition(token.position.x, token.position.y, 0);
  }

  private pointerIdForEvent(event: M01GreyboxPointerEvent): string | number {
    return event.getID?.() ?? "mouse";
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

    for (const entry of this.greyboxNodes.values()) {
      if (entry.token.kind === "fragment") {
        const view = this.session.getFragmentView(entry.token.controllerId);
        entry.node.active = !view.placed;
        this.applyTokenGraphicsState(
          entry.graphics,
          entry.token,
          view.presentation,
          view.selected ? 5 : view.hinted ? 4 : view.interactive ? 3 : 1
        );
        this.syncArtSpriteState(entry.artSprite, view.presentation);
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
        this.syncArtSpriteState(entry.artSprite, view.presentation);
      } else if (entry.token.kind === "gear") {
        const view = this.session.getRepairView();
        this.applyTokenGraphicsState(
          entry.graphics,
          entry.token,
          view.presentation,
          view.repaired ? 4 : 2
        );
        this.syncArtSpriteState(entry.artSprite, view.presentation);
      }
    }
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
    this.syncVisualState();
  }

  private syncArtSpriteState(
    sprite: Sprite | null,
    presentation:
      | M01GreyboxFragmentPresentation
      | M01GreyboxFilterPresentation
      | M01GreyboxRepairPresentation
      | "normal"
  ): void {
    if (!sprite) {
      return;
    }

    sprite.color = colorForArtSprite(presentation);
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
  const colors: Record<string, [number, number, number]> = {
    red: [180, 92, 70],
    blue: [88, 119, 132],
    yellow: [188, 158, 87]
  };
  const [r, g, b] = colors[colorToken] ?? [160, 154, 132];

  return new Color(r, g, b, alpha);
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

function withAlpha(color: Color, alpha: number): Color {
  return new Color(color.r, color.g, color.b, alpha);
}

function colorForArtSprite(
  presentation:
    | M01GreyboxFragmentPresentation
    | M01GreyboxFilterPresentation
    | M01GreyboxRepairPresentation
    | "normal"
): Color {
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
