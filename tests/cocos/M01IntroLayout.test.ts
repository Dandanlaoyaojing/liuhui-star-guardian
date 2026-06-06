import { describe, expect, it } from "vitest";

import { M01_STANDARD_PIECE_DISPLAY_SIZE } from "../../assets/scripts/cocos/M01GreyboxLayout.ts";
import {
  areM01IntroBasketPileOffsetsSeparated,
  countM01IntroBasketVisiblePileOffsets,
  isM01IntroBasketPileInsideInnerCavity,
  M01_INTRO_BASKET_EFFECTIVE_COLLIDER_SIZE,
  M01_INTRO_BASKET_INNER_CAVITY,
  M01_INTRO_BASKET_INNER_CAVITY_WALLS,
  M01_INTRO_BASKET_PILE_OFFSETS,
  M01_INTRO_BASKET_TARGET_PIECE_COUNT,
  M01_INTRO_BASKET_VISIBLE_PIECE_COUNT_RANGE
} from "../../assets/scripts/cocos/M01IntroLayout.ts";

describe("M01IntroLayout", () => {
  it("defines a real basket inner cavity with a floor and two sloped side walls", () => {
    expect(M01_INTRO_BASKET_INNER_CAVITY_WALLS.map((wall) => wall.id)).toEqual([
      "bottom",
      "left",
      "right"
    ]);
    expect(M01_INTRO_BASKET_INNER_CAVITY.floorY).toBeLessThan(
      M01_INTRO_BASKET_INNER_CAVITY.frontOcclusionY
    );
    expect(M01_INTRO_BASKET_INNER_CAVITY.floorY).toBeLessThan(
      M01_INTRO_BASKET_INNER_CAVITY.wallTopY
    );
    expect(M01_INTRO_BASKET_INNER_CAVITY.topHalfWidth).toBeGreaterThan(
      M01_INTRO_BASKET_INNER_CAVITY.bottomHalfWidth
    );
  });

  it("stages all 9 basket fragments as separated physical pieces inside the cavity", () => {
    expect(M01_INTRO_BASKET_PILE_OFFSETS).toHaveLength(M01_INTRO_BASKET_TARGET_PIECE_COUNT);
    expect(isM01IntroBasketPileInsideInnerCavity()).toBe(true);
    expect(areM01IntroBasketPileOffsetsSeparated()).toBe(true);
    expect(M01_INTRO_BASKET_EFFECTIVE_COLLIDER_SIZE).toBeGreaterThan(
      M01_STANDARD_PIECE_DISPLAY_SIZE.width
    );
  });

  it("only leaves the upper 4-5 basket fragments visible above the front wall", () => {
    const visibleCount = countM01IntroBasketVisiblePileOffsets(
      M01_STANDARD_PIECE_DISPLAY_SIZE.width
    );

    expect(visibleCount).toBeGreaterThanOrEqual(M01_INTRO_BASKET_VISIBLE_PIECE_COUNT_RANGE.min);
    expect(visibleCount).toBeLessThanOrEqual(M01_INTRO_BASKET_VISIBLE_PIECE_COUNT_RANGE.max);
    expect(M01_INTRO_BASKET_TARGET_PIECE_COUNT - visibleCount).toBeGreaterThanOrEqual(4);
  });
});
