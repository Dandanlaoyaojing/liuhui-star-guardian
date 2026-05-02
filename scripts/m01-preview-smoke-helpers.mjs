const CANVAS_SIZE = { width: 960, height: 640 };
const FREE_DROP_Y_OFFSET = 92;

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

export function buildRealInputPlan(config) {
  const flashlight = findById(config.flashlights ?? [], "flashlight_red", "flashlight");
  const revealFragment = findById(config.fragments ?? [], "fragment_circle_blue_1", "fragment");
  const freePlacementFragment = findById(
    config.fragments ?? [],
    "fragment_circle_yellow_1",
    "fragment"
  );
  const firstStagedFragment = findById(config.fragments ?? [], "fragment_circle_red_1", "fragment");
  const secondStagedFragment = findById(config.fragments ?? [], "fragment_triangle_blue_1", "fragment");
  const evidence = findById(config.evidence ?? [], "evidence_purple_upper_left", "evidence");
  const freeDropPosition = {
    x: 0,
    y: clamp(revealFragment.position.y + FREE_DROP_Y_OFFSET, -CANVAS_SIZE.height / 2 + 24, 0)
  };

  return {
    canvasSize: CANVAS_SIZE,
    flashlightId: flashlight.id,
    flashlightPosition: flashlight.position,
    revealFragmentId: revealFragment.id,
    revealFragmentPosition: revealFragment.position,
    expectedObservedColor: "purple",
    freePlacement: {
      fragmentId: freePlacementFragment.id,
      fragmentPosition: freePlacementFragment.position,
      dropPosition: freeDropPosition
    },
    stageEvidence: {
      evidenceId: evidence.id,
      evidencePosition: evidence.position,
      fragmentIds: [firstStagedFragment.id, secondStagedFragment.id]
    }
  };
}

export function localPointToPagePoint(canvasBox, canvasSize, localPoint) {
  return {
    x: canvasBox.x + canvasBox.width / 2 + (localPoint.x / canvasSize.width) * canvasBox.width,
    y: canvasBox.y + canvasBox.height / 2 - (localPoint.y / canvasSize.height) * canvasBox.height
  };
}
