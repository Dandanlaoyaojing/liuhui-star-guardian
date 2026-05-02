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
  resolveM01EvidenceFragmentSnapPosition,
  type M01GreyboxLayout,
  type M01GreyboxPoint,
  type M01GreyboxTokenNode
} from "./M01GreyboxLayout.ts";
import { M01_OBSERVED_REVEAL_MS, M01GreyboxSession } from "./M01GreyboxSession.ts";
import type {
  M01GreyboxFilterPresentation,
  M01GreyboxFragmentPresentation,
  M01GreyboxPlaceResult,
  M01GreyboxRepairPresentation,
  M01GreyboxSlotPresentation
} from "./M01GreyboxSession.ts";
import type {
  M01BaseColor,
  M01BottomLightState,
  M01MemoryGearConfig
} from "../levels/stage1/M01MemoryGearController.ts";
import { buildToolCardPreview } from "../ui/ToolCardView.ts";
import {
  buildM01GreyboxStaticArtPlan,
  getM01GreyboxToolCardFrameResource,
  getM01GreyboxRuntimeSpriteResourceForToken
} from "./M01GreyboxArt.ts";
import { ObservedResetScheduler } from "./ObservedResetScheduler.ts";
import { formatM01GreyboxText, type M01GreyboxTextOverrides } from "./M01GreyboxText.ts";

const { ccclass, property } = _decorator;
const CLICK_DRAG_THRESHOLD = 6;
const DEFAULT_FLASHLIGHT_BEAM_REACH = 170;
const FRAGMENT_INPUT_HIT_SIZE = 64;
const FRAGMENT_FLOOR = {
  minX: -480,
  maxX: 480,
  minY: -320,
  maxY: -176
};
type M01GreyboxPointerEvent = EventTouch & {
  getID?: () => number;
  getUILocation: () => { x: number; y: number };
  getScrollY?: () => number;
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
  private hintButtonRoot: Node | null = null;
  private feedbackLabel: Label | null = null;
  private activeDragNode: Node | null = null;
  private activeDragToken: M01GreyboxTokenNode | null = null;
  private bottomLightGraphics: Graphics | null = null;
  private flashlightBeamGraphics: Graphics | null = null;
  private activeFlashlightId: string | undefined;
  private activeFlashlightColor: M01BaseColor | undefined;
  private heldFlashlightId: string | undefined;
  private heldFlashlightPointerId: string | number | undefined;
  private flashlightBeamAnchor: M01GreyboxPoint | undefined;
  private flashlightBeamGesturePointerId: string | number | undefined;
  private flashlightBeamLit = false;
  private flashlightBeamTarget: M01GreyboxPoint | undefined;
  private flashlightBeamReach = DEFAULT_FLASHLIGHT_BEAM_REACH;
  private suppressHeldFlashlightFollow = false;
  private validationLightResetTimeout: ReturnType<typeof setTimeout> | undefined;
  private readonly observedColorResetScheduler = new ObservedResetScheduler(() => {
    this.syncVisualState();
  });
  private heldFragmentId: string | undefined;
  private heldPointerId: string | number | undefined;
  private dragState: DragState = {};
  private globalPointerInputBound = false;
  private suppressNextRootClick = false;
  private readonly text: M01GreyboxTextOverrides = {};
  private readonly greyboxNodes = new Map<
    string,
    { node: Node; token: M01GreyboxTokenNode; graphics: Graphics; artSprite: Sprite | null }
  >();
  private readonly artPreviewFallbackUnderlayIds = new Set<string>();
  private readonly weakSnappedFragmentsByEvidence = new Map<string, string[]>();
  private readonly tokenPositions = new Map<string, M01GreyboxPoint>();
  private hintedTargetIds = new Set<string>();

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
      this.hintButtonRoot = null;
      this.feedbackLabel = null;
      this.weakSnappedFragmentsByEvidence.clear();
      this.tokenPositions.clear();
      this.hintedTargetIds.clear();
      this.heldFragmentId = undefined;
      this.heldPointerId = undefined;
      this.heldFlashlightId = undefined;
      this.heldFlashlightPointerId = undefined;
      this.activeFlashlightId = undefined;
      this.activeFlashlightColor = undefined;
      this.flashlightBeamAnchor = undefined;
      this.flashlightBeamGesturePointerId = undefined;
      this.flashlightBeamLit = false;
      this.flashlightBeamTarget = undefined;
      this.suppressHeldFlashlightFollow = false;
      this.flashlightBeamReach = DEFAULT_FLASHLIGHT_BEAM_REACH;
      this.renderGreybox(this.layout);
      this.syncVisualState();
      this.setStatus(this.layout.statusText);
    });
  }

  onDestroy(): void {
    this.clearValidationLightReset();
    this.clearObservedColorReset();
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

  setFlashlightBeamReach(reach: number): void {
    this.flashlightBeamReach = Math.max(24, Math.min(260, reach));
    this.drawFlashlightBeam();
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
    const rootTransform = this.greyboxRoot.addComponent(UITransform);
    rootTransform.setContentSize(layout.canvas.width, layout.canvas.height);
    this.addRootPointerCapture(this.greyboxRoot);
    this.bindGlobalPointerInput();

    this.addBottomLightNode(this.greyboxRoot, layout);
    this.addFlashlightBeamNode(this.greyboxRoot, layout);
    this.addShapeNode(this.greyboxRoot, layout.gear);
    if (layout.evidence.length > 0) {
      this.addShapeNode(this.greyboxRoot, layout.board);
      this.addBottomLightHintNote(this.greyboxRoot);
    }
    if (this.enableArtPreview) {
      this.renderStaticArtPreview(this.greyboxRoot, layout);
    }
    for (const evidence of layout.referenceEvidence) {
      this.addShapeNode(this.greyboxRoot, evidence);
    }
    for (const slot of layout.slots ?? []) {
      this.addShapeNode(this.greyboxRoot, slot);
    }
    for (const fragment of layout.fragments) {
      this.addShapeNode(this.greyboxRoot, fragment);
    }
    for (const flashlight of layout.flashlights) {
      this.addShapeNode(this.greyboxRoot, flashlight);
    }
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

  private addFlashlightBeamNode(parent: Node, layout: M01GreyboxLayout): Node {
    const beamNode = new Node("M01FlashlightBeam");
    parent.addChild(beamNode);

    const transform = beamNode.addComponent(UITransform);
    transform.setContentSize(layout.canvas.width, layout.canvas.height);

    this.flashlightBeamGraphics = beamNode.addComponent(Graphics);
    this.drawFlashlightBeam();
    return beamNode;
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

  private drawFlashlightBeam(): void {
    if (!this.flashlightBeamGraphics) {
      return;
    }

    const graphics = this.flashlightBeamGraphics;
    graphics.clear();
    if (
      !this.layout ||
      !this.activeFlashlightId ||
      !this.activeFlashlightColor ||
      !this.flashlightBeamLit
    ) {
      return;
    }

    const flashlight = this.layout.flashlights.find(
      (candidate) => candidate.controllerId === this.activeFlashlightId
    );
    if (!flashlight) {
      return;
    }

    const source =
      this.flashlightBeamAnchor ??
      this.tokenPositions.get(flashlight.controllerId) ??
      flashlight.position;
    const target = this.getFlashlightBeamTarget();
    const clippedBeam = clipFlashlightBeamToFragmentFloor(source, target);
    if (!clippedBeam) {
      return;
    }

    const clippedSource = clippedBeam.source;
    const clippedTarget = clippedBeam.target;
    const dx = clippedTarget.x - clippedSource.x;
    const dy = clippedTarget.y - clippedSource.y;
    const length = Math.max(Math.hypot(dx, dy), 1);
    const normalX = -dy / length;
    const normalY = dx / length;
    const nearWidth = 24;
    const farWidth = this.getFlashlightBeamReach();

    graphics.fillColor = colorForBeam(this.activeFlashlightColor);
    graphics.strokeColor = colorForBeamStroke(this.activeFlashlightColor);
    graphics.lineWidth = 1.5;
    const nearLeft = clampPointToFragmentFloor({
      x: clippedSource.x + normalX * nearWidth,
      y: clippedSource.y + normalY * nearWidth
    });
    const farLeft = clampPointToFragmentFloor({
      x: clippedTarget.x + normalX * farWidth,
      y: clippedTarget.y + normalY * farWidth
    });
    const farRight = clampPointToFragmentFloor({
      x: clippedTarget.x - normalX * farWidth,
      y: clippedTarget.y - normalY * farWidth
    });
    const nearRight = clampPointToFragmentFloor({
      x: clippedSource.x - normalX * nearWidth,
      y: clippedSource.y - normalY * nearWidth
    });

    graphics.moveTo(nearLeft.x, nearLeft.y);
    graphics.lineTo(farLeft.x, farLeft.y);
    graphics.lineTo(farRight.x, farRight.y);
    graphics.lineTo(nearRight.x, nearRight.y);
    graphics.close();
    graphics.fill();
    graphics.stroke();
  }

  private getFlashlightBeamTarget(): M01GreyboxPoint {
    if (this.flashlightBeamTarget) {
      return this.flashlightBeamTarget;
    }

    if (!this.layout || this.layout.fragments.length === 0) {
      return { x: 0, y: -238 };
    }

    const positions = this.layout.fragments.map((fragment) => {
      return this.tokenPositions.get(fragment.controllerId) ?? fragment.position;
    });
    const x = positions.reduce((sum, position) => sum + position.x, 0) / positions.length;
    const y = positions.reduce((sum, position) => sum + position.y, 0) / positions.length;

    return { x, y };
  }

  private getFlashlightBeamReach(): number {
    return this.flashlightBeamReach;
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
    this.greyboxNodes.set(token.controllerId, { node, token, graphics, artSprite });
    this.tokenPositions.set(token.controllerId, token.position);

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

  private renderStaticArtPreview(parent: Node, layout: M01GreyboxLayout): void {
    const plan = buildM01GreyboxStaticArtPlan(layout);
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

    if (token.kind === "filter" || token.kind === "flashlight" || token.kind === "fragment") {
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

    input.on(Input.EventType.MOUSE_DOWN, this.beginActivePointerPress, this);
    input.on(Input.EventType.MOUSE_MOVE, this.moveActivePointerDrag, this);
    input.on(Input.EventType.MOUSE_UP, this.endActivePointerDrag, this);
    input.on(Input.EventType.MOUSE_WHEEL, this.adjustFlashlightBeamReach, this);
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
    input.off(Input.EventType.MOUSE_WHEEL, this.adjustFlashlightBeamReach, this);
    input.off(Input.EventType.TOUCH_START, this.beginActivePointerPress, this);
    input.off(Input.EventType.TOUCH_MOVE, this.moveActivePointerDrag, this);
    input.off(Input.EventType.TOUCH_END, this.endActivePointerDrag, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.cancelActivePointerDrag, this);
    this.globalPointerInputBound = false;
  }

  private beginActivePointerPress(event: M01GreyboxPointerEvent): void {
    const position = this.eventToLocalPoint(event);
    const hitToken = this.findTokenAtPosition(
      [...(this.layout?.fragments ?? []), ...(this.layout?.flashlights ?? [])],
      position
    );
    this.suppressHeldFlashlightFollow = Boolean(
      hitToken && hitToken.controllerId !== this.heldFlashlightId
    );
    this.beginFlashlightBeamGesture(event);
  }

  private beginTokenDrag(event: M01GreyboxPointerEvent, node: Node, token: M01GreyboxTokenNode): void {
    if (!this.layout) {
      return;
    }
    if (token.kind === "flashlight" && token.controllerId === this.heldFlashlightId) {
      return;
    }
    if (token.kind !== "flashlight") {
      this.heldFlashlightId = undefined;
      this.heldFlashlightPointerId = undefined;
      this.suppressHeldFlashlightFollow = false;
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
    this.tokenPositions.set(token.controllerId, position);
  }

  private moveActivePointerDrag(event: M01GreyboxPointerEvent): void {
    if (this.activeDragNode) {
      this.moveTokenDrag(event, this.activeDragNode);
      return;
    }

    if (this.updateFlashlightBeamGesture(event)) {
      return;
    }

    this.moveFlashlightBeamWithPointer(event);
    this.moveHeldFlashlightWithPointer(event);
    this.moveHeldFragmentWithPointer(event);
  }

  private moveFlashlightBeamWithPointer(event: M01GreyboxPointerEvent): void {
    if (this.heldFlashlightId) {
      return;
    }
    if (!this.activeFlashlightId || !this.activeFlashlightColor) {
      return;
    }

    this.flashlightBeamTarget = this.eventToLocalPoint(event);
    const revealed = this.scanFlashlightBeamAtTarget(this.flashlightBeamTarget);
    if (revealed) {
      return;
    }

    this.drawFlashlightBeam();
  }

  private moveHeldFlashlightWithPointer(event: M01GreyboxPointerEvent): void {
    const heldFlashlightId = this.heldFlashlightId;
    if (
      !heldFlashlightId ||
      this.suppressHeldFlashlightFollow ||
      this.flashlightBeamGesturePointerId !== undefined ||
      (this.heldFlashlightPointerId !== undefined &&
        this.heldFlashlightPointerId !== this.pointerIdForEvent(event))
    ) {
      return;
    }

    const entry = this.greyboxNodes.get(heldFlashlightId);
    if (!entry) {
      this.heldFlashlightId = undefined;
      this.heldFlashlightPointerId = undefined;
      return;
    }

    const position = this.eventToLocalPoint(event);
    entry.node.setPosition(position.x, position.y, 0);
    this.tokenPositions.set(heldFlashlightId, position);
    if (!this.flashlightBeamLit) {
      this.flashlightBeamAnchor = position;
      this.drawFlashlightBeam();
    }
  }

  private beginFlashlightBeamGesture(event: M01GreyboxPointerEvent): void {
    if (!this.heldFlashlightId || !this.activeFlashlightId || !this.activeFlashlightColor) {
      return;
    }

    const position = this.eventToLocalPoint(event);
    const hitToken = this.findTokenAtPosition(
      [...(this.layout?.fragments ?? []), ...(this.layout?.flashlights ?? [])],
      position
    );
    if (hitToken && hitToken.controllerId !== this.heldFlashlightId) {
      return;
    }

    const pointerId = this.pointerIdForEvent(event);
    const source = this.tokenPositions.get(this.heldFlashlightId);
    if (!source) {
      return;
    }

    this.flashlightBeamGesturePointerId = pointerId;
    this.heldFlashlightPointerId = undefined;
    this.flashlightBeamAnchor = source;
    this.flashlightBeamLit = true;
    this.flashlightBeamTarget = position;
    this.scanFlashlightBeamAtTarget(this.flashlightBeamTarget);
    this.drawFlashlightBeam();
  }

  private updateFlashlightBeamGesture(event: M01GreyboxPointerEvent): boolean {
    if (this.flashlightBeamGesturePointerId === undefined) {
      return false;
    }

    this.flashlightBeamTarget = this.eventToLocalPoint(event);
    this.scanFlashlightBeamAtTarget(this.flashlightBeamTarget);
    this.drawFlashlightBeam();
    return true;
  }

  private adjustFlashlightBeamReach(event: M01GreyboxPointerEvent): void {
    if (!this.activeFlashlightId || !this.activeFlashlightColor) {
      return;
    }

    const scrollY = event.getScrollY?.() ?? 0;
    if (scrollY === 0) {
      return;
    }

    this.setFlashlightBeamReach(this.flashlightBeamReach + Math.sign(scrollY) * 16);
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
      if (this.activeDragToken) {
        this.tokenPositions.set(this.activeDragToken.controllerId, active.currentPosition);
      }
    }
  }

  private endActivePointerDrag(event: M01GreyboxPointerEvent): void {
    if (this.activeDragNode && this.activeDragToken) {
      this.endTokenDrag(event, this.activeDragNode, this.activeDragToken);
      this.suppressHeldFlashlightFollow = false;
      return;
    }

    if (this.flashlightBeamGesturePointerId !== undefined) {
      this.flashlightBeamGesturePointerId = undefined;
    }
    this.suppressHeldFlashlightFollow = false;
  }

  private cancelActivePointerDrag(event: M01GreyboxPointerEvent): void {
    if (this.activeDragNode && this.activeDragToken) {
      this.cancelTokenDrag(event, this.activeDragNode, this.activeDragToken);
      this.suppressHeldFlashlightFollow = false;
      return;
    }

    if (this.flashlightBeamGesturePointerId !== undefined) {
      this.flashlightBeamGesturePointerId = undefined;
    }
    this.suppressHeldFlashlightFollow = false;
  }

  private endTokenDrag(event: M01GreyboxPointerEvent, node: Node, token: M01GreyboxTokenNode): void {
    if (token.kind === "flashlight" && token.controllerId === this.heldFlashlightId) {
      this.clearActiveDrag();
      return;
    }
    if (!this.dragState.active) {
      this.clearActiveDrag();
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
    if (token.kind === "flashlight" && token.controllerId === this.heldFlashlightId) {
      this.clearActiveDrag();
      return;
    }
    const transition = cancelDragSession(this.dragState, this.pointerIdForEvent(event));
    this.dragState = transition.state;
    this.resetTokenNode(node, token);
    this.clearActiveDrag();
  }

  private clearActiveDrag(): void {
    this.activeDragNode = null;
    this.activeDragToken = null;
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

    if (this.heldFragmentId && this.heldFragmentId !== token.controllerId) {
      this.placeHeldFragmentAtPosition(session.currentPosition);
      return true;
    }

    if (token.kind === "fragment") {
      this.handleFragmentClick(node, token, session.currentPosition, session.pointerId);
      return true;
    }

    if (token.kind === "flashlight") {
      this.handleFlashlightClick(node, token, session.currentPosition, session.pointerId);
      return true;
    }

    return false;
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
    node.setPosition(position.x, position.y, 0);
    this.tokenPositions.set(token.controllerId, position);
  }

  private handleFlashlightClick(
    node: Node,
    token: M01GreyboxTokenNode,
    position: M01GreyboxPoint,
    pointerId: string | number
  ): void {
    if (!this.session) {
      this.resetTokenNode(node, token);
      return;
    }

    const selected = this.session.selectFlashlight(token.controllerId);
    this.setStatus(selected.status);
    this.clearHintTargets();
    this.syncFeedbackFromSession();
    if (!selected.accepted) {
      this.resetTokenNode(node, token);
      this.syncVisualState();
      return;
    }

    this.heldFlashlightId = token.controllerId;
    this.heldFlashlightPointerId = undefined;
    this.activeFlashlightId = selected.activeFlashlightId;
    this.activeFlashlightColor = selected.activeFlashlightColor;
    this.flashlightBeamLit = false;
    this.flashlightBeamAnchor = position;
    this.flashlightBeamTarget = undefined;
    node.setPosition(position.x, position.y, 0);
    this.tokenPositions.set(token.controllerId, position);
    this.clearObservedColorReset();
    this.syncVisualState();
  }

  private handleTokenDrop(node: Node, token: M01GreyboxTokenNode, dropPosition: M01GreyboxPoint): void {
    if (!this.layout || !this.session) {
      this.resetTokenNode(node, token);
      return;
    }

    const action = resolveM01GreyboxDrop(this.layout, token, dropPosition);
    if (action.type === "activate_filter") {
      this.resetTokenNode(node, token);
      this.clearHintTargets();
      this.selectFilter(action.filterId);
      return;
    }

    if (action.type === "select_flashlight") {
      this.resetTokenNode(node, token);
      const selected = this.session.selectFlashlight(action.flashlightId);
      if (selected.accepted) {
        this.activeFlashlightId = selected.activeFlashlightId;
        this.activeFlashlightColor = selected.activeFlashlightColor;
        this.heldFlashlightId = action.flashlightId;
        this.heldFlashlightPointerId = undefined;
        this.flashlightBeamAnchor =
          this.tokenPositions.get(action.flashlightId) ?? token.position;
        this.flashlightBeamLit = true;
        this.flashlightBeamTarget = dropPosition;
        this.clearObservedColorReset();
      }
      const revealed = selected.accepted
        ? this.tryRevealFragmentAtPosition(dropPosition)
        : undefined;
      this.setStatus(revealed?.status ?? selected.status);
      this.clearHintTargets();
      this.syncFeedbackFromSession();
      this.syncVisualState();
      this.scheduleObservedColorReset(revealed);
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
      this.heldFragmentId = undefined;
      this.heldPointerId = undefined;
      this.clearHintTargets();
      this.trySubmitWeakSnappedEvidencePair(action.evidenceId);
      this.tryValidateCompleteEvidenceCandidate();
      this.syncVisualState();
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
      this.clearHintTargets();
      this.syncFeedbackFromSession();
      this.syncVisualState();
      node.setPosition(freePosition.x, freePosition.y, 0);
      this.tokenPositions.set(action.fragmentId, freePosition);
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
      return;
    }

    const position = this.eventToLocalPoint(event);
    entry.node.setPosition(position.x, position.y, 0);
    this.tokenPositions.set(heldFragmentId, position);
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
      return;
    }

    this.handleTokenDrop(entry.node, entry.token, position);
  }

  private tryRevealFragmentAtPosition(
    position: M01GreyboxPoint
  ): ReturnType<M01GreyboxSession["revealFragment"]> | undefined {
    const fragment = this.findTokenAtPosition(this.layout?.fragments ?? [], position);
    return fragment && this.session ? this.session.revealFragment(fragment.controllerId) : undefined;
  }

  private scanFlashlightBeamAtTarget(position: M01GreyboxPoint): boolean {
    const revealed = this.tryRevealFragmentAtPosition(position);
    if (!revealed) {
      return false;
    }

    this.setStatus(revealed.status);
    this.clearHintTargets();
    this.syncFeedbackFromSession();
    this.syncVisualState();
    this.scheduleObservedColorReset(revealed);
    return revealed.accepted;
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

  private tryValidateCompleteEvidenceCandidate(): void {
    if (!this.session || !this.layout || this.layout.evidence.length === 0) {
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
    this.renderCompletionToolCardIfAvailable(validation.completed);
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

  private scheduleObservedColorReset(
    revealed: ReturnType<M01GreyboxSession["revealFragment"]> | undefined
  ): void {
    if (!revealed?.accepted) {
      return;
    }

    this.observedColorResetScheduler.schedule(revealed.fragmentId, M01_OBSERVED_REVEAL_MS);
  }

  private clearObservedColorReset(): void {
    this.observedColorResetScheduler.clearAll();
  }

  private renderCompletionToolCardIfAvailable(completed: boolean): void {
    if (!completed || !this.session || !this.greyboxRoot || this.toolCardRoot) {
      return;
    }

    const card = this.session.getLastToolCard();
    if (card) {
      this.setFeedback("");
      this.activeFlashlightId = undefined;
      this.activeFlashlightColor = undefined;
      this.heldFlashlightId = undefined;
      this.heldFlashlightPointerId = undefined;
      this.flashlightBeamAnchor = undefined;
      this.flashlightBeamGesturePointerId = undefined;
      this.flashlightBeamLit = false;
      this.flashlightBeamTarget = undefined;
      this.suppressHeldFlashlightFollow = false;
      this.drawFlashlightBeam();
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
  }

  private resetTokenNode(node: Node, token: M01GreyboxTokenNode): void {
    node.setPosition(token.position.x, token.position.y, 0);
    this.tokenPositions.set(token.controllerId, token.position);
  }

  private clearHintTargets(): void {
    this.hintedTargetIds.clear();
  }

  private findTokenAtPosition(
    tokens: M01GreyboxTokenNode[],
    position: M01GreyboxPoint
  ): M01GreyboxTokenNode | undefined {
    return tokens.find((token) => {
      const tokenPosition = this.tokenPositions.get(token.controllerId) ?? token.position;
      const halfWidth = token.size.width / 2;
      const halfHeight = token.size.height / 2;

      return (
        position.x >= tokenPosition.x - halfWidth &&
        position.x <= tokenPosition.x + halfWidth &&
        position.y >= tokenPosition.y - halfHeight &&
        position.y <= tokenPosition.y + halfHeight
      );
    });
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

    const bottomLight = this.session.getCompletionState().bottomLight;
    for (const entry of this.greyboxNodes.values()) {
      if (entry.token.kind === "fragment") {
        const view = this.session.getFragmentView(entry.token.controllerId);
        entry.node.active = !view.placed;
        this.applyTokenGraphicsState(
          entry.graphics,
          entry.token,
          view.presentation,
          view.selected ? 5 : view.hinted ? 4 : view.interactive ? 3 : 1,
          view.validationColor ?? view.observedColor
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
      } else if (entry.token.kind === "flashlight" || entry.token.kind === "evidence") {
        const hinted = this.hintedTargetIds.has(entry.token.controllerId);
        const evidenceLit =
          entry.token.kind === "evidence" &&
          (bottomLight === "steady_on" || bottomLight === "flash_then_off");
        const presentation = hinted ? "hinted" : evidenceLit ? "highlighted" : "normal";
        this.applyTokenGraphicsState(
          entry.graphics,
          entry.token,
          presentation,
          hinted ? 5 : evidenceLit ? 4 : entry.token.kind === "evidence" ? 3 : 2
        );
        this.syncArtSpriteState(entry.artSprite, presentation);
      }
    }
    this.drawBottomLight(bottomLight);
    this.drawFlashlightBeam();
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
  } else if (token.shapeToken === "generated_overlap") {
    drawGeneratedOverlap(graphics, token.size.width, token.size.height);
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

function clipFlashlightBeamToFragmentFloor(
  source: M01GreyboxPoint,
  target: M01GreyboxPoint
): { source: M01GreyboxPoint; target: M01GreyboxPoint } | null {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  let enter = 0;
  let exit = 1;

  const clip = (edgeDirection: number, edgeDistance: number): boolean => {
    if (edgeDirection === 0) {
      return edgeDistance >= 0;
    }

    const ratio = edgeDistance / edgeDirection;
    if (edgeDirection < 0) {
      if (ratio > exit) {
        return false;
      }
      enter = Math.max(enter, ratio);
      return true;
    }

    if (ratio < enter) {
      return false;
    }
    exit = Math.min(exit, ratio);
    return true;
  };

  const visible =
    clip(-dx, source.x - FRAGMENT_FLOOR.minX) &&
    clip(dx, FRAGMENT_FLOOR.maxX - source.x) &&
    clip(-dy, source.y - FRAGMENT_FLOOR.minY) &&
    clip(dy, FRAGMENT_FLOOR.maxY - source.y);

  if (!visible) {
    return null;
  }

  return {
    source: {
      x: source.x + enter * dx,
      y: source.y + enter * dy
    },
    target: {
      x: source.x + exit * dx,
      y: source.y + exit * dy
    }
  };
}

function clampPointToFragmentFloor(point: M01GreyboxPoint): M01GreyboxPoint {
  return {
    x: Math.max(FRAGMENT_FLOOR.minX, Math.min(FRAGMENT_FLOOR.maxX, point.x)),
    y: Math.max(FRAGMENT_FLOOR.minY, Math.min(FRAGMENT_FLOOR.maxY, point.y))
  };
}

function colorForBeam(color: M01BaseColor): Color {
  const colors: Record<M01BaseColor, Color> = {
    red: new Color(215, 88, 72, 46),
    yellow: new Color(226, 188, 88, 54),
    blue: new Color(82, 132, 188, 48)
  };

  return colors[color];
}

function colorForBeamStroke(color: M01BaseColor): Color {
  const colors: Record<M01BaseColor, Color> = {
    red: new Color(185, 82, 66, 72),
    yellow: new Color(190, 148, 48, 76),
    blue: new Color(66, 108, 156, 72)
  };

  return colors[color];
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
  const colors: Record<string, [number, number, number]> = {
    hidden: [182, 180, 166],
    red: [180, 92, 70],
    blue: [88, 119, 132],
    yellow: [188, 158, 87],
    purple: [139, 105, 156],
    green: [92, 145, 112],
    orange: [199, 126, 75]
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
