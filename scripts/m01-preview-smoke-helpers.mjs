const CANVAS_SIZE = { width: 960, height: 640 };
const FREE_DROP_Y_OFFSET = 92;
const EVIDENCE_WORK_AREA_CENTER = { x: 0, y: 0 };
const EVIDENCE_WORK_AREA_SCALE = 0.85;
const FLASHLIGHT_BUTTON_POSITIONS = {
  yellow: { x: 360, y: 42 },
  blue: { x: 358, y: 30 },
  red: { x: 359, y: 53 }
};
const FLASHLIGHT_BEAM_ANCHOR_POSITION = { x: 360, y: 110 };
const FLASHLIGHT_CHECK_ORDER = ["yellow", "blue", "red"];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findById(items, id, label) {
  const item = items.find((candidate) => candidate.id === id);
  assert(item, `Missing ${label}: ${id}`);
  return item;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function centerOfPoints(points) {
  const bounds = points.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      maxX: Math.max(current.maxX, point.x),
      minY: Math.min(current.minY, point.y),
      maxY: Math.max(current.maxY, point.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  };
}

function buildEvidenceWorkPositions(evidenceItems) {
  const sourceCenter = centerOfPoints(evidenceItems.map((evidence) => evidence.position));

  return Object.fromEntries(
    evidenceItems.map((evidence) => [
      evidence.id,
      {
        x:
          EVIDENCE_WORK_AREA_CENTER.x +
          (evidence.position.x - sourceCenter.x) * EVIDENCE_WORK_AREA_SCALE,
        y:
          EVIDENCE_WORK_AREA_CENTER.y +
          (evidence.position.y - sourceCenter.y) * EVIDENCE_WORK_AREA_SCALE
      }
    ])
  );
}

function blendPigmentColors(a, b) {
  if (a === b) {
    return a;
  }

  const key = [a, b].sort().join("+");
  const blends = {
    "blue+red": "purple",
    "blue+yellow": "green",
    "red+yellow": "orange"
  };
  return blends[key];
}

export function buildRealInputPlan(config) {
  const flashlight = findById(config.flashlights ?? [], "flashlight_red", "flashlight");
  const revealFragment = findById(config.fragments ?? [], "fragment_circle_blue_1", "fragment");
  const revealFragmentIds = (config.fragments ?? []).map((fragment) => fragment.id);
  const expectedObservedColorsByFragment = Object.fromEntries(
    (config.fragments ?? []).map((fragment) => [
      fragment.id,
      blendPigmentColors(fragment.hiddenColor, flashlight.color)
    ])
  );
  const flashlightChecks = FLASHLIGHT_CHECK_ORDER.map((color) => {
    const checkFlashlight = findById(
      config.flashlights ?? [],
      `flashlight_${color}`,
      "flashlight"
    );
    return {
      flashlightId: checkFlashlight.id,
      flashlightColor: checkFlashlight.color,
      buttonPosition: FLASHLIGHT_BUTTON_POSITIONS[color],
      expectedObservedColorsByFragment: Object.fromEntries(
        (config.fragments ?? []).map((fragment) => [
          fragment.id,
          blendPigmentColors(fragment.hiddenColor, checkFlashlight.color)
        ])
      )
    };
  });
  const flashlightBeamTargetPosition = {
    x:
      (config.fragments ?? []).reduce((sum, fragment) => sum + fragment.position.x, 0) /
      Math.max((config.fragments ?? []).length, 1),
    y:
      (config.fragments ?? []).reduce((sum, fragment) => sum + fragment.position.y, 0) /
      Math.max((config.fragments ?? []).length, 1)
  };
  const evidence = config.evidence?.[0];
  assert(evidence, "Missing first completion evidence.");
  const [firstStagedFragment, secondStagedFragment] = evidence.solution.fragmentIds.map((fragmentId) =>
    findById(config.fragments ?? [], fragmentId, "fragment")
  );
  const solutionFragmentIds = new Set(
    (config.evidence ?? []).flatMap((candidate) => candidate.solution.fragmentIds)
  );
  const freePlacementFragment = (config.fragments ?? []).find(
    (fragment) => fragment.id !== revealFragment.id && !solutionFragmentIds.has(fragment.id)
  );
  assert(freePlacementFragment, "Need at least one decoy fragment for free-placement smoke.");
  const evidenceWorkPositions = buildEvidenceWorkPositions(config.evidence ?? []);
  const flashlightPosition = { x: 359, y: 53 };
  const flashlightButtonRedPosition = FLASHLIGHT_BUTTON_POSITIONS.red;
  const completionEvidence = (config.evidence ?? []).map((candidate) => ({
    evidenceId: candidate.id,
    evidencePosition: evidenceWorkPositions[candidate.id],
    fragmentIds: [...candidate.solution.fragmentIds]
  }));
  const completionTargetPieces = config.targetPattern?.locked
    ? (config.targetPattern.pieces ?? [])
        .filter((piece) => piece.fragmentId)
        .map((piece) => ({
          fragmentId: piece.fragmentId,
          targetPosition: piece.position,
          targetRotation: piece.rotation ?? 0
        }))
    : [];
  const freeDropPosition = {
    x: 0,
    y: clamp(revealFragment.position.y + FREE_DROP_Y_OFFSET, -CANVAS_SIZE.height / 2 + 24, 0)
  };

  return {
    canvasSize: CANVAS_SIZE,
    flashlightId: flashlight.id,
    flashlightPosition,
    flashlightBeamAnchorPosition: FLASHLIGHT_BEAM_ANCHOR_POSITION,
    flashlightButtonRedPosition,
    flashlightChecks,
    flashlightBeamTargetPosition,
    revealFragmentIds,
    revealFragmentId: revealFragment.id,
    revealFragmentPosition: revealFragment.position,
    expectedObservedColor: "purple",
    expectedObservedColorsByFragment,
    freePlacement: {
      fragmentId: freePlacementFragment.id,
      fragmentPosition: freePlacementFragment.position,
      dropPosition: freeDropPosition
    },
    completionTargetPieces,
    completionEvidence,
    expectedToolCardTitle: config.toolCard?.front?.toolName,
    stageEvidence: {
      evidenceId: evidence.id,
      evidencePosition: evidenceWorkPositions[evidence.id],
      fragmentIds: [firstStagedFragment.id, secondStagedFragment.id],
      targetPieces: completionTargetPieces.filter((piece) =>
        evidence.solution.fragmentIds.includes(piece.fragmentId)
      )
    }
  };
}

export function localPointToPagePoint(canvasBox, canvasSize, localPoint) {
  return {
    x: canvasBox.x + canvasBox.width / 2 + (localPoint.x / canvasSize.width) * canvasBox.width,
    y: canvasBox.y + canvasBox.height / 2 - (localPoint.y / canvasSize.height) * canvasBox.height
  };
}
