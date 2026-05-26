import {
  _decorator,
  BoxCollider2D,
  Color,
  Component,
  Graphics,
  Node,
  RigidBody2D,
  ERigidBody2DType,
  Sprite,
  SpriteFrame,
  Size,
  UITransform,
  Vec2,
  resources
} from "cc";

const { ccclass } = _decorator;

const GROUND_SPRITE_PATH = "art/stage1-m01/runtime-sprites/surfaces/m01-ground-line/spriteFrame";
const GROUND_DISPLAY_WIDTH = 960;       // canvas width
const GROUND_DISPLAY_HEIGHT = 39;       // matches aspect of user-provided 1623x66 ground band
const GROUND_SOURCE_HEIGHT = 66;
const GROUND_SURFACE_INK_SOURCE_Y = 6;
const GROUND_SOURCE_TO_DISPLAY_SCALE = GROUND_DISPLAY_HEIGHT / GROUND_SOURCE_HEIGHT;

/**
 * Physics ground surface. The visible ground line spans the whole canvas, and
 * the side walls sit just outside the canvas edges so rolling pieces stay on stage.
 */
const PHYSICS_GROUND_Y = -270;

// Align the darkest hand-drawn horizon row in the PNG with the Box2D ground surface.
const GROUND_SPRITE_CENTER_Y =
  PHYSICS_GROUND_Y -
  (GROUND_DISPLAY_HEIGHT / 2 - GROUND_SURFACE_INK_SOURCE_Y * GROUND_SOURCE_TO_DISPLAY_SCALE);

const GROUND_COLLIDER_WIDTH = GROUND_DISPLAY_WIDTH;
const PHYSICS_SCREEN_LEFT_X = -GROUND_DISPLAY_WIDTH / 2;
const PHYSICS_SCREEN_RIGHT_X = GROUND_DISPLAY_WIDTH / 2;
const PHYSICS_WALL_MAX_Y = 360;
const WALL_THICKNESS = 40;     // thick enough to prevent tunneling at high fall velocity (~800 px/s at -640 gravity over 0.5s fall)
const M01_PHYSICS_GROUND_RESTITUTION = 0.12;
const M01_PHYSICS_WALL_RESTITUTION = 0.05;
const M01_PHYSICS_GROUND_FRICTION = 0.82;
const M01_PHYSICS_WALL_FRICTION = 0.25;
const DEBUG_VISUALIZE_WALLS = false;

@ccclass("M01PhysicsBoundary")
export class M01PhysicsBoundary extends Component {
  private spawned = false;

  /**
   * Spawn the ground + left/right walls synchronously. Must be called AFTER
   * PhysicsSystem2D.instance.enable = true and from a code path where the
   * host node is already part of the active scene hierarchy.
   * Safe to call multiple times — idempotent via the `spawned` flag.
   */
  spawnWalls(): void {
    if (this.spawned) return;
    this.spawned = true;
    this.spawnEdge(
      "M01PhysicsGround",
      0,
      PHYSICS_GROUND_Y - WALL_THICKNESS / 2,
      GROUND_COLLIDER_WIDTH,
      WALL_THICKNESS,
      M01_PHYSICS_GROUND_FRICTION,
      M01_PHYSICS_GROUND_RESTITUTION
    );
    this.spawnEdge(
      "M01PhysicsLeftWall",
      PHYSICS_SCREEN_LEFT_X - WALL_THICKNESS / 2,
      (PHYSICS_GROUND_Y + PHYSICS_WALL_MAX_Y) / 2,
      WALL_THICKNESS,
      PHYSICS_WALL_MAX_Y - PHYSICS_GROUND_Y,
      M01_PHYSICS_WALL_FRICTION,
      M01_PHYSICS_WALL_RESTITUTION
    );
    this.spawnEdge(
      "M01PhysicsRightWall",
      PHYSICS_SCREEN_RIGHT_X + WALL_THICKNESS / 2,
      (PHYSICS_GROUND_Y + PHYSICS_WALL_MAX_Y) / 2,
      WALL_THICKNESS,
      PHYSICS_WALL_MAX_Y - PHYSICS_GROUND_Y,
      M01_PHYSICS_WALL_FRICTION,
      M01_PHYSICS_WALL_RESTITUTION
    );
  }

  /**
   * Render a hand-drawn ink ground line sprite at the floor Y, spanning the
   * full canvas width (960). The PNG is a 1623x66 strip; the darkest ink row
   * is aligned to the Box2D surface at y=-270.
   */
  renderGroundLine(): void {
    const node = new Node("M01GroundLine");
    // Sprite center is below the surface so the hand-drawn ink row lands at PHYSICS_GROUND_Y.
    node.setPosition(0, GROUND_SPRITE_CENTER_Y, 0);
    this.node.addChild(node);

    const transform = node.addComponent(UITransform);
    transform.setContentSize(GROUND_DISPLAY_WIDTH, GROUND_DISPLAY_HEIGHT);

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    resources.load(GROUND_SPRITE_PATH, SpriteFrame, (error, spriteFrame) => {
      if (error || !spriteFrame) {
        return;
      }
      sprite.spriteFrame = spriteFrame;
    });
  }

  private spawnEdge(name: string, cx: number, cy: number, w: number, h: number, friction: number, restitution: number): void {
    const node = new Node(name);
    node.setPosition(cx, cy, 0);
    this.node.addChild(node);

    // UITransform first — some Cocos colliders read bounds from it
    const transform = node.addComponent(UITransform);
    transform.setContentSize(w, h);

    const body = node.addComponent(RigidBody2D);
    body.type = ERigidBody2DType.Static;
    body.gravityScale = 0;
    body.enabledContactListener = true;

    const collider = node.addComponent(BoxCollider2D);
    collider.size = new Size(w, h);
    collider.offset = new Vec2(0, 0);
    collider.friction = friction;
    collider.restitution = restitution;
    collider.apply();

    if (DEBUG_VISUALIZE_WALLS) {
      // Draw a semi-transparent overlay so we can see exactly where this wall is
      const g = node.addComponent(Graphics);
      g.lineWidth = 1;
      g.strokeColor = new Color(220, 60, 60, 200);
      g.fillColor = new Color(220, 60, 60, 40);
      g.rect(-w/2, -h/2, w, h);
      g.fill();
      g.stroke();
    }
  }
}
