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
  M01BlendColor,
  M01BottomLightState,
  M01MemoryGearConfig
} from "../levels/stage1/M01MemoryGearController.ts";
import { buildToolCardPreview } from "../ui/ToolCardView.ts";
import {
  buildM01GreyboxStaticArtPlan,
  buildM01GreyboxTargetOverlapEvidencePlan,
  getM01GreyboxTargetReferenceCardResource,
  getM01GreyboxToolCardFrameResource,
  getM01GreyboxRuntimeSpriteResourceForToken
} from "./M01GreyboxArt.ts";
import { ObservedResetScheduler } from "./ObservedResetScheduler.ts";
import { formatM01GreyboxText, type M01GreyboxTextOverrides } from "./M01GreyboxText.ts";

const { ccclass, property } = _decorator;
const CLICK_DRAG_THRESHOLD = 6;
const DEFAULT_FLASHLIGHT_BEAM_REACH = 170;
const FRAGMENT_INPUT_HIT_SIZE = 64;
const TARGET_PATTERN_POSITION_TOLERANCE = 1;
const TARGET_PATTERN_ROTATION_TOLERANCE = 1;
const VALIDATION_FAILURE_FLASH_COUNT = 2;
const FRAGMENT_FLOOR = {
  minX: 200,
  maxX: 440,
  minY: -260,
  maxY: 120
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

  @property({ type: Boolean })
  enableArtPreview = false;

  @property({ type: Boolean })
  showArtPreviewDebugUnderlay = false;

  private session: M01GreyboxSession | null = null;
  private config: M01MemoryGearConfig | null = null;
  private layout: M01GreyboxLayout | null = null;
  private greyboxRoot: Node | null = null;
  private toolCardRoot: Node | null = null;
  private targetReferenceZoomRoot: Node | null = null;
  private flashlightButtonPickerRoot: Node | null = null;
  private hintButtonRoot: Node | null = null;
  private rotateButtonRoot: Node | null = null;
  private feedbackLabel: Label | null = null;
  private activeDragNode: Node | null = null;
  private activeDragToken: M01GreyboxTokenNode | null = null;
  private bottomLightGraphics: Graphics | null = null;
  private flashlightBeamGraphics: Graphics | null = null;
  private manualTargetBlendGraphics: Graphics | null = null;
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
  private validationFlashVisible = true;
  private validationLightResetTimeout: ReturnType<typeof setTimeout> | undefined;
  private validationFailureReturnTimeout: ReturnType<typeof setTimeout> | undefined;
  private readonly validationFailureFlashTimeouts: Array<ReturnType<typeof setTimeout>> = [];
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
  private readonly artSpriteResourcePaths = new Map<Sprite, string>();
  private readonly weakSnappedFragmentsByEvidence = new Map<string, string[]>();
  private readonly tokenPositions = new Map<string, M01GreyboxPoint>();
  private readonly tokenRotations = new Map<string, number>();
  private hintedTargetIds = new Set<string>();

  start(): void {
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
      this.flashlightButtonPickerRoot = null;
      this.hintButtonRoot = null;
      this.rotateButtonRoot = null;
      this.feedbackLabel = null;
      this.manualTargetBlendGraphics = null;
      this.weakSnappedFragmentsByEvidence.clear();
      this.tokenPositions.clear();
      this.tokenRotations.clear();
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
      this.validationFlashVisible = true;
      this.enableArtPreview = this.enableArtPreview || shouldEnableM01ArtPreviewFromUrl();
      this.renderGreybox(this.layout);
      this.restoreManualTargetDraft();
      this.exposeManualTargetTools();
      this.syncVisualState();
      this.setStatus(this.layout.statusText);
    });
  }

  onDestroy(): void {
    this.hideManualTargetTools();
    this.clearValidationLightReset();
    this.clearFailedCandidateReturn();
    this.clearObservedColorReset();
    this.unbindGlobalPointerInput();
    this.dragState = {};
    this.clearActiveDrag();
  }

  update(): void {
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
    this.artSpriteResourcePaths.clear();
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
    this.rotateButtonRoot = this.addRotateButton(this.greyboxRoot);
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

  private addRotateButton(parent: Node): Node {
    const buttonNode = new Node("M01Rotate90Button");
    buttonNode.setPosition(328, 156, 0);
    parent.addChild(buttonNode);

    const transform = buttonNode.addComponent(UITransform);
    transform.setContentSize(86, 34);

    const graphics = buttonNode.addComponent(Graphics);
    graphics.lineWidth = 2;
    graphics.strokeColor = new Color(44, 43, 38, 255);
    graphics.fillColor = new Color(239, 231, 203, 230);
    graphics.rect(-43, -17, 86, 34);
    graphics.fill();
    graphics.stroke();

    this.addButtonLabel(buttonNode, "旋转90°");
    buttonNode.on("touch-end", (event: EventTouch) => {
      this.stopTouchPropagation(event);
      this.suppressRootClickOnce();
      this.rotateHeldFragmentClockwise();
    }, this);
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
    this.syncArtSpriteState(sprite, "normal", token);
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

      if (layer.id === "singleFlashlightTool") {
        layerNode.on("touch-end", (event: EventTouch) => {
          this.stopTouchPropagation(event);
          this.openFlashlightButtonPicker();
        }, this);
      }
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

  private openFlashlightButtonPicker(): void {
    if (!this.greyboxRoot || !this.layout) {
      return;
    }

    this.closeFlashlightButtonPicker();

    const pickerRoot = new Node("M01FlashlightButtonPicker");
    pickerRoot.setPosition(270, 82, 0);
    this.greyboxRoot.addChild(pickerRoot);
    this.flashlightButtonPickerRoot = pickerRoot;

    const transform = pickerRoot.addComponent(UITransform);
    transform.setContentSize(164, 70);
    pickerRoot.on("touch-end", (event: EventTouch) => this.stopTouchPropagation(event), this);

    const background = pickerRoot.addComponent(Graphics);
    background.lineWidth = 2;
    background.strokeColor = new Color(44, 43, 38, 190);
    background.fillColor = new Color(248, 241, 220, 226);
    background.rect(-82, -35, 164, 70);
    background.fill();
    background.stroke();

    const options: Array<{ color: M01BaseColor; x: number }> = [
      { color: "red", x: -46 },
      { color: "yellow", x: 0 },
      { color: "blue", x: 46 }
    ];

    for (const option of options) {
      this.addFlashlightPickerButton(pickerRoot, option.color, option.x);
    }
  }

  private closeFlashlightButtonPicker(): void {
    if (!this.flashlightButtonPickerRoot) {
      return;
    }

    this.flashlightButtonPickerRoot.destroy();
    this.flashlightButtonPickerRoot = null;
  }

  private addFlashlightPickerButton(parent: Node, color: M01BaseColor, x: number): void {
    const buttonNode = new Node(`M01FlashlightPickerButton_${color}`);
    buttonNode.setPosition(x, 0, 0);
    parent.addChild(buttonNode);

    const transform = buttonNode.addComponent(UITransform);
    transform.setContentSize(40, 40);

    const graphics = buttonNode.addComponent(Graphics);
    graphics.lineWidth = 2;
    graphics.strokeColor = new Color(44, 43, 38, 215);
    graphics.fillColor = colorForFlashlightPickerButton(color);
    graphics.circle(0, 0, 18);
    graphics.fill();
    graphics.stroke();

    graphics.fillColor = new Color(255, 246, 214, 84);
    graphics.circle(-5, 6, 7);
    graphics.fill();

    buttonNode.on("touch-end", (event: EventTouch) => {
      this.stopTouchPropagation(event);
      this.selectFlashlightFromPicker(`flashlight_${color}`);
    }, this);
  }

  private selectFlashlightFromPicker(flashlightId: string): void {
    if (!this.session || !this.layout) {
      return;
    }

    const token = this.layout.flashlights.find(
      (candidate) => candidate.controllerId === flashlightId
    );
    const selected = this.session.selectFlashlight(flashlightId);
    this.setStatus(selected.status);
    this.clearHintTargets();
    this.syncFeedbackFromSession();
    this.closeFlashlightButtonPicker();

    if (!selected.accepted || !token) {
      this.syncVisualState();
      return;
    }

    this.activateFixedFlashlightBeam(token, selected);
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

    if (token.kind === "flashlight" && this.enableArtPreview) {
      node.on("touch-end", (event: EventTouch) => {
        this.stopTouchPropagation(event);
        this.openFlashlightButtonPicker();
      }, this);
      return;
    }

    if (token.kind === "filter" || token.kind === "flashlight" || token.kind === "fragment") {
      node.on("touch-start", (event: EventTouch) => this.beginTokenDrag(event, node, token), this);
      node.on("touch-move", (event: EventTouch) => this.moveTokenDrag(event, node), this);
      node.on("touch-end", (event: EventTouch) => this.endTokenDrag(event, node, token), this);
      node.on("touch-cancel", (event: EventTouch) => this.cancelTokenDrag(event, node, token), this);
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
    if (hitToken?.kind === "fragment") {
      this.suspendHeldFlashlightInteraction();
      return;
    }
    this.suppressHeldFlashlightFollow = Boolean(
      hitToken && hitToken.controllerId !== this.heldFlashlightId
    );
  }

  private beginTokenDrag(event: M01GreyboxPointerEvent, node: Node, token: M01GreyboxTokenNode): void {
    if (!this.layout) {
      return;
    }
    if (token.kind === "flashlight" && token.controllerId === this.heldFlashlightId) {
      return;
    }
    if (token.kind === "fragment") {
      this.suspendHeldFlashlightInteraction();
    } else if (token.kind !== "flashlight") {
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
    this.redrawAndPersistManualTargetDraft();
  }

  private moveActivePointerDrag(event: M01GreyboxPointerEvent): void {
    if (this.activeDragNode) {
      this.moveTokenDrag(event, this.activeDragNode);
      return;
    }

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
    this.scanFlashlightBeamAtTarget(this.flashlightBeamTarget);
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
      pointerId: this.pointerIdForActiveDragEvent(event),
      position: this.eventToLocalPoint(event)
    });

    const active = this.dragState.active;
    if (active) {
      node.setPosition(active.currentPosition.x, active.currentPosition.y, 0);
      if (this.activeDragToken) {
        this.tokenPositions.set(this.activeDragToken.controllerId, active.currentPosition);
      }
      this.redrawAndPersistManualTargetDraft();
    }
  }

  private endActivePointerDrag(event: M01GreyboxPointerEvent): void {
    if (this.activeDragNode && this.activeDragToken) {
      this.endTokenDrag(event, this.activeDragNode, this.activeDragToken);
      this.suppressHeldFlashlightFollow = false;
      return;
    }

    if (this.flashlightBeamGesturePointerId !== undefined) {
      this.releaseHeldFlashlightAfterBeamGesture();
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
      this.releaseHeldFlashlightAfterBeamGesture();
    }
    this.suppressHeldFlashlightFollow = false;
  }

  private endTokenDrag(event: M01GreyboxPointerEvent, node: Node, token: M01GreyboxTokenNode): void {
    if (token.kind === "flashlight" && token.controllerId === this.heldFlashlightId) {
      if (this.flashlightBeamLit) {
        this.releaseHeldFlashlightAfterBeamGesture();
      }
      this.clearActiveDrag();
      return;
    }
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
    if (token.kind === "flashlight" && token.controllerId === this.heldFlashlightId) {
      this.clearActiveDrag();
      return;
    }
    const transition = cancelDragSession(this.dragState, this.pointerIdForActiveDragEvent(event));
    this.dragState = transition.state;
    this.resetTokenNode(node, token);
    this.clearActiveDrag();
  }

  private clearActiveDrag(): void {
    this.activeDragNode = null;
    this.activeDragToken = null;
  }

  private suspendHeldFlashlightInteraction(): void {
    this.releaseHeldFlashlightAfterBeamGesture();
    this.flashlightBeamTarget = undefined;
    this.drawFlashlightBeam();
  }

  private releaseHeldFlashlightAfterBeamGesture(): void {
    this.heldFlashlightId = undefined;
    this.heldFlashlightPointerId = undefined;
    this.flashlightBeamAnchor = undefined;
    this.flashlightBeamGesturePointerId = undefined;
    this.flashlightBeamLit = false;
    this.suppressHeldFlashlightFollow = false;
    this.drawFlashlightBeam();
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
    this.redrawAndPersistManualTargetDraft();
  }

  private handleFlashlightClick(
    node: Node,
    token: M01GreyboxTokenNode,
    _position: M01GreyboxPoint,
    _pointerId: string | number
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

    node.setPosition(token.position.x, token.position.y, 0);
    this.tokenPositions.set(token.controllerId, token.position);
    this.activateFixedFlashlightBeam(token, selected);
  }

  private stopTouchPropagation(event: EventTouch): void {
    (event as EventTouch & { propagationStopped?: boolean }).propagationStopped = true;
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

    if (action.type === "select_flashlight") {
      this.resetTokenNode(node, token);
      const selected = this.session.selectFlashlight(action.flashlightId);
      if (selected.accepted) {
        this.activateFixedFlashlightBeam(token, selected);
      }
      this.setStatus(selected.status);
      this.clearHintTargets();
      this.syncFeedbackFromSession();
      this.syncVisualState();
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
      this.clearHintTargets();
      this.syncFeedbackFromSession();
      this.syncVisualState();
      node.setPosition(action.position.x, action.position.y, 0);
      node.setRotationFromEuler(0, 0, action.rotation);
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
      this.clearHintTargets();
      this.syncFeedbackFromSession();
      this.syncVisualState();
      node.setPosition(freePosition.x, freePosition.y, 0);
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
      return;
    }

    this.handleTokenDrop(entry.node, entry.token, position);
  }

  private activateFixedFlashlightBeam(
    token: M01GreyboxTokenNode,
    selected: ReturnType<M01GreyboxSession["selectFlashlight"]>
  ): void {
    if (!selected.accepted) {
      return;
    }

    const source = this.tokenPositions.get(token.controllerId) ?? token.position;
    this.heldFlashlightId = undefined;
    this.heldFlashlightPointerId = undefined;
    this.flashlightBeamGesturePointerId = undefined;
    this.suppressHeldFlashlightFollow = false;
    this.activeFlashlightId = selected.activeFlashlightId;
    this.activeFlashlightColor = selected.activeFlashlightColor;
    this.flashlightBeamAnchor = source;
    this.flashlightBeamLit = true;
    this.flashlightBeamTarget = undefined;
    this.flashlightBeamTarget = this.getFlashlightBeamTarget();
    this.tokenPositions.set(token.controllerId, source);
    this.clearObservedColorReset();
    const revealed = this.revealAllFragmentsWithActiveFlashlight();
    this.syncVisualState();
    this.scheduleObservedColorResets(revealed);
  }

  private revealAllFragmentsWithActiveFlashlight(): ReturnType<
    M01GreyboxSession["revealFragments"]
  > {
    if (!this.session || !this.layout) {
      return [];
    }

    return this.session.revealFragments(
      this.layout.fragments.map((fragment) => fragment.controllerId)
    );
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

  private scheduleObservedColorReset(
    revealed: ReturnType<M01GreyboxSession["revealFragment"]> | undefined
  ): void {
    if (!revealed?.accepted) {
      return;
    }

    this.observedColorResetScheduler.schedule(revealed.fragmentId, M01_OBSERVED_REVEAL_MS);
  }

  private scheduleObservedColorResets(
    revealed: ReturnType<M01GreyboxSession["revealFragments"]>
  ): void {
    for (const result of revealed) {
      this.scheduleObservedColorReset(result);
    }
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
      if (this.rotateButtonRoot) {
        this.rotateButtonRoot.active = false;
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
    node.setPosition(token.position.x, token.position.y, 0);
    node.setRotationFromEuler(0, 0, this.tokenRotations.get(token.controllerId) ?? 0);
    this.tokenPositions.set(token.controllerId, token.position);
    this.redrawAndPersistManualTargetDraft();
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
        const presentation =
          view.validationColor && !this.validationFlashVisible ? "normal" : view.presentation;
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
        this.syncArtSpriteState(entry.artSprite, presentation, entry.token);
      }
    }
    this.drawBottomLight(bottomLight);
    this.drawFlashlightBeam();
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
    sprite.color = colorForArtSprite(presentation, token);
  }

  private syncArtSpriteFrame(
    sprite: Sprite,
    token?: M01GreyboxTokenNode,
    colorTokenOverride?: M01BlendColor
  ): void {
    if (!token) {
      return;
    }

    const resource = getM01GreyboxRuntimeSpriteResourceForToken(token, colorTokenOverride);
    if (!resource) {
      return;
    }

    if (this.artSpriteResourcePaths.get(sprite) === resource.resourcesLoadPath) {
      return;
    }

    this.artSpriteResourcePaths.set(sprite, resource.resourcesLoadPath);
    sprite.node.name = `M01ArtSprite_${resource.id}`;

    resources.load(resource.resourcesLoadPath, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame) {
        this.artSpriteResourcePaths.delete(sprite);
        this.setFeedback(
          this.formatText("loadFailed", { reason: error?.message ?? resource.resourcesLoadPath })
        );
        this.markArtPreviewUnderlayFallback(token.controllerId);
        sprite.node.active = false;
        return;
      }
      sprite.node.active = true;
      sprite.spriteFrame = spriteFrame;
    });
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
    blue: new Color(74, 112, 206, 52)
  };

  return colors[color];
}

function colorForBeamStroke(color: M01BaseColor): Color {
  const colors: Record<M01BaseColor, Color> = {
    red: new Color(185, 82, 66, 72),
    yellow: new Color(190, 148, 48, 76),
    blue: new Color(66, 96, 188, 76)
  };

  return colors[color];
}

function colorForFlashlightPickerButton(color: M01BaseColor): Color {
  const colors: Record<M01BaseColor, Color> = {
    red: new Color(204, 95, 116, 235),
    yellow: new Color(225, 174, 73, 235),
    blue: new Color(80, 110, 206, 235)
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
    blue: [72, 104, 190],
    yellow: [188, 158, 87],
    purple: [139, 105, 156],
    green: [92, 145, 112],
    orange: [199, 126, 75]
  };
  const [r, g, b] = colors[colorToken] ?? [160, 154, 132];

  return new Color(r, g, b, alpha);
}

function colorForManualTargetBlendOverlay(colorToken: string): Color {
  const colors: Record<string, [number, number, number]> = {
    red: [180, 92, 70],
    blue: [72, 104, 190],
    yellow: [188, 158, 87],
    purple: [139, 105, 156],
    green: [92, 145, 112],
    orange: [199, 126, 75]
  };
  const [r, g, b] = colors[colorToken] ?? [150, 132, 118];

  return new Color(r, g, b, 232);
}

function colorForTargetOverlapEvidence(colorToken: string): Color {
  const colors: Record<string, [number, number, number]> = {
    purple: [139, 105, 156],
    green: [92, 145, 112],
    orange: [199, 126, 75]
  };
  const [r, g, b] = colors[colorToken] ?? [150, 132, 118];

  return new Color(r, g, b, 232);
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
  if (token.kind === "flashlight") {
    return presentation !== "normal";
  }
  if (token.kind === "evidence") {
    return false;
  }
  if (token.kind === "fragment") {
    return presentation !== "normal" && presentation !== "placed";
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

function colorForArtSprite(
  presentation:
    | M01GreyboxFragmentPresentation
    | M01GreyboxFilterPresentation
    | M01GreyboxRepairPresentation
    | "normal",
  token?: M01GreyboxTokenNode
): Color {
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
