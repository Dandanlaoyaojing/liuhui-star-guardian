import { describe, expect, it, vi } from "vitest";

import { ObservedResetScheduler } from "../../assets/scripts/cocos/ObservedResetScheduler.ts";

describe("ObservedResetScheduler", () => {
  it("uses safe default timer wrappers", () => {
    vi.useFakeTimers();
    try {
      let expired = 0;
      const scheduler = new ObservedResetScheduler(() => {
        expired += 1;
      });

      scheduler.schedule("fragment_a", 2_000);
      vi.advanceTimersByTime(2_000);

      expect(expired).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("expires overlapping fragment reveals independently", () => {
    vi.useFakeTimers();
    try {
      const expired: string[] = [];
      const scheduler = new ObservedResetScheduler(
        () => {
          expired.push("tick");
        },
        setTimeout,
        clearTimeout
      );

      scheduler.schedule("fragment_a", 2_000);
      vi.advanceTimersByTime(1_000);
      scheduler.schedule("fragment_b", 2_000);

      vi.advanceTimersByTime(999);
      expect(expired).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(expired).toEqual(["tick"]);

      vi.advanceTimersByTime(999);
      expect(expired).toEqual(["tick"]);

      vi.advanceTimersByTime(1);
      expect(expired).toEqual(["tick", "tick"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("replaces an existing timer only for the same fragment", () => {
    vi.useFakeTimers();
    try {
      const expired: string[] = [];
      const scheduler = new ObservedResetScheduler(
        () => {
          expired.push("tick");
        },
        setTimeout,
        clearTimeout
      );

      scheduler.schedule("fragment_a", 2_000);
      scheduler.schedule("fragment_a", 2_000);
      expect(scheduler.getPendingKeys()).toEqual(["fragment_a"]);

      vi.advanceTimersByTime(1_999);
      expect(expired).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(expired).toEqual(["tick"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
