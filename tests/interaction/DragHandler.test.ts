import { describe, expect, it } from "vitest";
import {
  beginDragSession,
  cancelDragSession,
  endDragSession,
  moveDragSession,
  type DragState
} from "../../assets/scripts/interaction/DragHandler.ts";

describe("DragHandler", () => {
  it("tracks a drag lifecycle with stable pointer and entity ids", () => {
    const started = beginDragSession({
      pointerId: 7,
      entityId: "fragment-red-circle-1",
      position: { x: 10, y: 20 }
    });

    expect(started.active?.pointerId).toBe(7);
    expect(started.active?.entityId).toBe("fragment-red-circle-1");
    expect(started.active?.startPosition).toEqual({ x: 10, y: 20 });
    expect(started.active?.currentPosition).toEqual({ x: 10, y: 20 });

    const moved = moveDragSession(started, {
      pointerId: 7,
      position: { x: 24, y: 32 }
    });

    expect(moved.active?.previousPosition).toEqual({ x: 10, y: 20 });
    expect(moved.active?.currentPosition).toEqual({ x: 24, y: 32 });
    expect(moved.active?.delta).toEqual({ x: 14, y: 12 });
    expect(moved.active?.totalDelta).toEqual({ x: 14, y: 12 });

    const ended = endDragSession(moved, {
      pointerId: 7,
      position: { x: 30, y: 35 }
    });

    expect(ended.state.active).toBeUndefined();
    expect(ended.outcome.type).toBe("ended");
    expect(ended.outcome.session?.entityId).toBe("fragment-red-circle-1");
    expect(ended.outcome.session?.currentPosition).toEqual({ x: 30, y: 35 });
    expect(ended.outcome.session?.totalDelta).toEqual({ x: 20, y: 15 });
  });

  it("ignores move and end requests from a different pointer", () => {
    const started = beginDragSession({
      pointerId: "primary",
      entityId: "filter-red",
      position: { x: 0, y: 0 }
    });

    const movedByWrongPointer = moveDragSession(started, {
      pointerId: "secondary",
      position: { x: 100, y: 100 }
    });

    expect(movedByWrongPointer).toEqual(started);

    const endedByWrongPointer = endDragSession(started, {
      pointerId: "secondary",
      position: { x: 100, y: 100 }
    });

    expect(endedByWrongPointer.state).toEqual(started);
    expect(endedByWrongPointer.outcome).toEqual({
      type: "ignored",
      reason: "pointer_mismatch"
    });
  });

  it("cancels the active session without inventing a drop position", () => {
    const state: DragState = beginDragSession({
      pointerId: "touch-1",
      entityId: "fragment-yellow-hexagon-2",
      position: { x: 5, y: 8 }
    });

    const canceled = cancelDragSession(state, "touch-1");

    expect(canceled.state.active).toBeUndefined();
    expect(canceled.outcome.type).toBe("canceled");
    expect(canceled.outcome.session?.currentPosition).toEqual({ x: 5, y: 8 });
  });
});
