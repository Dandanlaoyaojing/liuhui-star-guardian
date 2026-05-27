import {
  _decorator,
  CircleCollider2D,
  Component,
  Node,
  PhysicsSystem2D,
  PolygonCollider2D,
  RigidBody2D,
  ERigidBody2DType,
  Vec2
} from "cc";

import { createM01PhysicsRng } from "./M01PhysicsRandom.ts";
import { pickStableRotation, type M01PhysicsShape } from "./M01PhysicsRotation.ts";
import {
  areM01PhysicsCircleFragmentsVisuallySeparated,
  buildM01PhysicsCollider,
  resolveM01PhysicsColliderVisualPadding,
  visibleCircleRadius,
  type M01PhysicsFragmentSeparationSample
} from "./M01PhysicsCollider.ts";
import { M01PhysicsBoundary } from "./M01PhysicsBoundary.ts";

const { ccclass } = _decorator;

const M01_PHYSICS_FIXED_TIME_STEP = 1 / 60;
const M01_PHYSICS_FRAGMENT_RESTITUTION = 0.08;
const M01_PHYSICS_CIRCLE_FRICTION = 0.18;
const M01_PHYSICS_POLYGON_FRICTION = 0.6;
const M01_PHYSICS_LINEAR_DAMPING = 0.05;
const M01_PHYSICS_ANGULAR_DAMPING = 0.55;
const M01_PHYSICS_SKY_DRIFT_X = 5;
const M01_PHYSICS_SKY_DRIFT_Y = 4;
const M01_PHYSICS_SKY_PILE_OFFSETS = [
  { x: -1, y: -34 },
  { x: -0.33, y: -32 },
  { x: 0.33, y: -35 },
  { x: 1, y: -32 },
  { x: -0.64, y: 18 },
  { x: 0, y: 21 },
  { x: 0.64, y: 18 },
  { x: -0.31, y: 70 },
  { x: 0.31, y: 72 }
] as const;
const M01_PHYSICS_SETTLE_LINEAR_VELOCITY = 4;
const M01_PHYSICS_SETTLE_ANGULAR_VELOCITY = 6;
const M01_PHYSICS_SETTLE_STABLE_FRAMES = 18;
const M01_PHYSICS_SETTLE_MAX_Y = 80;

export interface M01PhysicsPileFragment {
  node: Node;
  shape: M01PhysicsShape;
  size: number;
}

export interface M01PhysicsPileOptions {
  fragments: M01PhysicsPileFragment[];
  seed: number;
  dropOriginX: number;
  dropOriginY: number;
  jitterX: number;
  settleTimeoutMs: number;
  onSettled: () => void;
  /**
   * When true, do NOT teleport fragments to the sky-pile offsets.
   * Just engage gravity on their current world positions (used when the intro
   * sequence has already placed pieces inside the basket and they should fall
   * from wherever they are right now).
   */
  releaseInPlace?: boolean;
}

@ccclass("M01PhysicsPile")
export class M01PhysicsPile extends Component {
  private options: M01PhysicsPileOptions | null = null;
  private settleDeadlineMs = 0;
  private settleCheckArmed = false;
  private stableSettleFrames = 0;
  private settled = false;

  /**
   * Initialize the physics world, spawn the boundary walls, and pre-attach
   * RigidBody2D + collider to every fragment while the nodes are active.
   * Boundary walls and fragment bodies are registered in the same synchronous
   * frame so the box2d world is consistent before the sky-pile release.
   */
  preparePhysicsWorld(
    fragments: M01PhysicsPileFragment[],
    boundary: M01PhysicsBoundary | null = null
  ): void {
    PhysicsSystem2D.instance.enable = true;
    PhysicsSystem2D.instance.gravity = new Vec2(0, -640);
    PhysicsSystem2D.instance.fixedTimeStep = M01_PHYSICS_FIXED_TIME_STEP;
    PhysicsSystem2D.instance.debugDrawFlags = 0;

    if (boundary) {
      boundary.spawnWalls();
    }

    for (const frag of fragments) {
      this.attachBody(frag);
      this.attachCollider(frag);
    }
  }

  /**
   * Release all fragments from the top edge together. They enter the canvas as
   * ordinary dynamic bodies, so the visible descent is driven by gravity.
   */
  startDrop(options: M01PhysicsPileOptions): void {
    this.options = options;
    this.settleCheckArmed = false;
    this.stableSettleFrames = 0;
    this.settled = false;

    if (options.releaseInPlace) {
      this.engagePiecesInPlace();
    } else {
      const rng = createM01PhysicsRng(options.seed);
      const order = this.shuffleIndices(options.fragments.length, rng);
      this.releaseAllPiecesFromSky(order, rng);
    }

    this.settleDeadlineMs = Date.now() + options.settleTimeoutMs;
    this.settleCheckArmed = true;
  }

  /**
   * Engage gravity on each fragment from its current world position.
   * Used when the intro sequence has already placed pieces inside the basket
   * (parented to the basket, body=Static), and the basket has just been tipped.
   * The intro is responsible for reparenting nodes back to greybox root and
   * preserving world positions BEFORE calling startDrop with releaseInPlace.
   */
  private engagePiecesInPlace(): void {
    if (!this.options) return;
    for (const frag of this.options.fragments) {
      frag.node.active = true;
      const body = frag.node.getComponent(RigidBody2D);
      if (body) {
        body.type = ERigidBody2DType.Dynamic;
        body.gravityScale = 1;
        body.linearVelocity = new Vec2(0, 0);
        body.angularVelocity = 0;
      }
    }
  }

  update(): void {
    if (!this.options || !this.settleCheckArmed || this.settled) {
      return;
    }

    if (this.allFragmentsAreSettled()) {
      this.stableSettleFrames += 1;
    } else {
      this.stableSettleFrames = 0;
    }

    if (
      this.stableSettleFrames >= M01_PHYSICS_SETTLE_STABLE_FRAMES ||
      Date.now() >= this.settleDeadlineMs
    ) {
      this.finishSettling();
    }
  }

  private shuffleIndices(n: number, rng: () => number): number[] {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private releaseAllPiecesFromSky(order: number[], rng: () => number): void {
    if (!this.options) return;

    order.forEach((fragIndex, skyIndex) => {
      if (!this.options) return;
      const pileOffset = this.resolveSkyPileOffset(skyIndex);
      const driftX = (rng() * 2 - 1) * M01_PHYSICS_SKY_DRIFT_X;
      const driftY = (rng() * 2 - 1) * M01_PHYSICS_SKY_DRIFT_Y;
      const x = this.options.dropOriginX + pileOffset.x * this.options.jitterX + driftX;
      const y = this.options.dropOriginY + pileOffset.y + driftY;
      this.releaseOnePieceFromSky(this.options.fragments[fragIndex], x, y, rng);
    });
  }

  private resolveSkyPileOffset(skyIndex: number): { x: number; y: number } {
    const baseOffset = M01_PHYSICS_SKY_PILE_OFFSETS[skyIndex % M01_PHYSICS_SKY_PILE_OFFSETS.length];
    const extraLayer = Math.floor(skyIndex / M01_PHYSICS_SKY_PILE_OFFSETS.length);
    return {
      x: baseOffset.x,
      y: baseOffset.y + extraLayer * 56
    };
  }

  private releaseOnePieceFromSky(
    frag: M01PhysicsPileFragment,
    x: number,
    y: number,
    rng: () => number
  ): void {
    if (!this.options) return;
    frag.node.active = true;
    frag.node.setPosition(x, y, 0);
    frag.node.setRotationFromEuler(0, 0, pickStableRotation(frag.shape, rng));

    const body = frag.node.getComponent(RigidBody2D);
    if (body) {
      body.type = ERigidBody2DType.Dynamic;
      body.allowSleep = false;
      body.linearVelocity = new Vec2(0, 0);
      body.angularVelocity = 0;
    }
  }

  private attachBody(frag: M01PhysicsPileFragment): void {
    let body = frag.node.getComponent(RigidBody2D);
    if (!body) {
      body = frag.node.addComponent(RigidBody2D);
    }
    body.type = ERigidBody2DType.Dynamic;
    body.gravityScale = 1;
    body.bullet = true;
    body.allowSleep = false;
    body.linearDamping = M01_PHYSICS_LINEAR_DAMPING;
    body.angularDamping = M01_PHYSICS_ANGULAR_DAMPING;
    body.linearVelocity = new Vec2(0, 0);
    body.angularVelocity = 0;
  }

  private attachCollider(frag: M01PhysicsPileFragment): void {
    const existing =
      frag.node.getComponent(PolygonCollider2D) ?? frag.node.getComponent(CircleCollider2D);
    if (existing) return;

    const spec = buildM01PhysicsCollider(
      frag.shape,
      frag.size + resolveM01PhysicsColliderVisualPadding(frag.shape)
    );
    if (spec.kind === "circle") {
      const c = frag.node.addComponent(CircleCollider2D);
      c.radius = spec.radius;
      c.friction = this.resolveColliderFriction(frag.shape);
      c.restitution = M01_PHYSICS_FRAGMENT_RESTITUTION;
      c.density = 1;
      c.apply();
    } else {
      const c = frag.node.addComponent(PolygonCollider2D);
      c.points = spec.points.map((p) => new Vec2(p.x, p.y));
      c.friction = this.resolveColliderFriction(frag.shape);
      c.restitution = M01_PHYSICS_FRAGMENT_RESTITUTION;
      c.density = 1;
      c.apply();
    }
  }

  private resolveColliderFriction(shape: M01PhysicsShape): number {
    return shape === "circle" ? M01_PHYSICS_CIRCLE_FRICTION : M01_PHYSICS_POLYGON_FRICTION;
  }

  private allFragmentsAreSettled(): boolean {
    const fragments = this.options?.fragments ?? [];
    if (fragments.length === 0) {
      return true;
    }

    const movementSettled = fragments.every((frag) => {
      const body = frag.node.getComponent(RigidBody2D);
      if (!body) {
        return false;
      }
      if (frag.node.position.y > M01_PHYSICS_SETTLE_MAX_Y) {
        return false;
      }

      const velocity = body.linearVelocity;
      const linearSpeed = Math.hypot(velocity.x, velocity.y);
      return (
        linearSpeed <= M01_PHYSICS_SETTLE_LINEAR_VELOCITY &&
        Math.abs(body.angularVelocity) <= M01_PHYSICS_SETTLE_ANGULAR_VELOCITY
      );
    });

    return movementSettled && this.allCircleFragmentsAreVisuallySeparated();
  }

  private finishSettling(): void {
    if (this.settled) {
      return;
    }

    this.settled = true;
    this.settleCheckArmed = false;
    this.separateOverlappingCircleFragments();
    for (const frag of this.options?.fragments ?? []) {
      const body = frag.node.getComponent(RigidBody2D);
      if (!body) {
        continue;
      }
      body.allowSleep = true;
      body.linearVelocity = new Vec2(0, 0);
      body.angularVelocity = 0;
    }
    this.options?.onSettled();
  }

  private allCircleFragmentsAreVisuallySeparated(): boolean {
    return areM01PhysicsCircleFragmentsVisuallySeparated(this.fragmentSeparationSamples());
  }

  private separateOverlappingCircleFragments(): void {
    const fragments = this.options?.fragments ?? [];
    for (let leftIndex = 0; leftIndex < fragments.length; leftIndex += 1) {
      const left = fragments[leftIndex];
      if (left.shape !== "circle") {
        continue;
      }
      for (let rightIndex = leftIndex + 1; rightIndex < fragments.length; rightIndex += 1) {
        const right = fragments[rightIndex];
        if (right.shape !== "circle") {
          continue;
        }

        const leftPosition = left.node.position;
        const rightPosition = right.node.position;
        const dx = rightPosition.x - leftPosition.x;
        const dy = rightPosition.y - leftPosition.y;
        const distance = Math.hypot(dx, dy);
        const minDistance =
          visibleCircleRadius(this.fragmentSeparationSample(left)) +
          visibleCircleRadius(this.fragmentSeparationSample(right));

        if (distance >= minDistance) {
          continue;
        }

        const directionX = distance > 0.001 ? dx / distance : 1;
        const directionY = distance > 0.001 ? dy / distance : 0;
        const separation = (minDistance - distance) / 2;
        left.node.setPosition(
          leftPosition.x - directionX * separation,
          leftPosition.y - directionY * separation,
          leftPosition.z
        );
        right.node.setPosition(
          rightPosition.x + directionX * separation,
          rightPosition.y + directionY * separation,
          rightPosition.z
        );
      }
    }
  }

  private fragmentSeparationSamples(): M01PhysicsFragmentSeparationSample[] {
    return (this.options?.fragments ?? []).map((fragment) =>
      this.fragmentSeparationSample(fragment)
    );
  }

  private fragmentSeparationSample(
    fragment: M01PhysicsPileFragment
  ): M01PhysicsFragmentSeparationSample {
    return {
      shape: fragment.shape,
      size: fragment.size,
      x: fragment.node.position.x,
      y: fragment.node.position.y
    };
  }

  onDestroy(): void {
    this.settled = true;
    this.settleCheckArmed = false;
  }
}
