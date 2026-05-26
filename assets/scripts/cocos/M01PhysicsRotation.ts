export type M01PhysicsShape = "circle" | "triangle" | "hexagon";

/**
 * Pick a physically stable rest rotation in degrees for a given shape.
 * - Circle: any angle (rotationally symmetric)
 * - Triangle: one of 3 stable bases (each puts a flat edge down)
 * - Hexagon: one of 6 stable bases (each puts a flat edge down)
 * rng(): supplies a value in [0,1).
 */
export function pickStableRotation(shape: M01PhysicsShape, rng: () => number): number {
  if (shape === "circle") {
    return Math.floor(rng() * 360);
  }
  if (shape === "triangle") {
    const choices = [0, 120, 240];
    return choices[Math.floor(rng() * choices.length)];
  }
  const choices = [0, 60, 120, 180, 240, 300];
  return choices[Math.floor(rng() * choices.length)];
}
