export type PointerId = string | number;

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export interface DragSession {
  readonly pointerId: PointerId;
  readonly entityId: string;
  readonly startPosition: Point2;
  readonly previousPosition: Point2;
  readonly currentPosition: Point2;
  readonly delta: Point2;
  readonly totalDelta: Point2;
}

export interface DragState {
  readonly active?: DragSession;
}

export interface BeginDragInput {
  readonly pointerId: PointerId;
  readonly entityId: string;
  readonly position: Point2;
}

export interface DragPointerInput {
  readonly pointerId: PointerId;
  readonly position: Point2;
}

export type IgnoredDragReason = "no_active_session" | "pointer_mismatch";

export interface DragOutcome {
  readonly type: "ended" | "canceled" | "ignored";
  readonly reason?: IgnoredDragReason;
  readonly session?: DragSession;
}

export interface DragTransition {
  readonly state: DragState;
  readonly outcome: DragOutcome;
}

const ZERO_DELTA: Point2 = { x: 0, y: 0 };

export function beginDragSession(input: BeginDragInput): DragState {
  const position = copyPoint(input.position);

  return {
    active: {
      pointerId: input.pointerId,
      entityId: input.entityId,
      startPosition: position,
      previousPosition: position,
      currentPosition: position,
      delta: ZERO_DELTA,
      totalDelta: ZERO_DELTA
    }
  };
}

export function moveDragSession(state: DragState, input: DragPointerInput): DragState {
  if (!state.active || state.active.pointerId !== input.pointerId) {
    return state;
  }

  return {
    active: moveSessionTo(state.active, input.position)
  };
}

export function endDragSession(state: DragState, input: DragPointerInput): DragTransition {
  if (!state.active) {
    return {
      state,
      outcome: {
        type: "ignored",
        reason: "no_active_session"
      }
    };
  }

  if (state.active.pointerId !== input.pointerId) {
    return {
      state,
      outcome: {
        type: "ignored",
        reason: "pointer_mismatch"
      }
    };
  }

  const session = moveSessionTo(state.active, input.position);

  return {
    state: {},
    outcome: {
      type: "ended",
      session
    }
  };
}

export function cancelDragSession(state: DragState, pointerId: PointerId): DragTransition {
  if (!state.active) {
    return {
      state,
      outcome: {
        type: "ignored",
        reason: "no_active_session"
      }
    };
  }

  if (state.active.pointerId !== pointerId) {
    return {
      state,
      outcome: {
        type: "ignored",
        reason: "pointer_mismatch"
      }
    };
  }

  return {
    state: {},
    outcome: {
      type: "canceled",
      session: state.active
    }
  };
}

function moveSessionTo(session: DragSession, position: Point2): DragSession {
  const currentPosition = copyPoint(position);

  return {
    ...session,
    previousPosition: session.currentPosition,
    currentPosition,
    delta: subtract(currentPosition, session.currentPosition),
    totalDelta: subtract(currentPosition, session.startPosition)
  };
}

function copyPoint(point: Point2): Point2 {
  return {
    x: point.x,
    y: point.y
  };
}

function subtract(to: Point2, from: Point2): Point2 {
  return {
    x: to.x - from.x,
    y: to.y - from.y
  };
}
