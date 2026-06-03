export const M01_INTRO_BASKET_DISPLAY_SIZE = { width: 380, height: 260 } as const;

// Layout for the 9 real game pieces inside the basket (local to the basket node).
// A flat 4-3-2 spread across the shallow tray interior, visible from the 3/4
// overhead angle. Pieces are 56x56; this spread keeps them readable while still
// reading as one small pile.
export const M01_INTRO_BASKET_PILE_OFFSETS: ReadonlyArray<{ x: number; y: number }> = [
  // Back row (deeper into tray, higher Y in display)
  { x: -90, y: 22 },
  { x: -30, y: 26 },
  { x: 30, y: 26 },
  { x: 90, y: 22 },
  // Middle row
  { x: -60, y: 4 },
  { x: 0, y: 6 },
  { x: 60, y: 4 },
  // Front row (closer to viewer, lower Y)
  { x: -30, y: -16 },
  { x: 30, y: -16 }
];
