/**
 * TDD tests for priceUpdatedAt staleness indicator logic.
 *
 * Tests the getPriceStaleClass helper that determines the dot color
 * based on how long ago the price was last updated from market data.
 */

import { getPriceStaleClass } from "../helpers";

describe("getPriceStaleClass", () => {
  // freeze time at a known epoch so offsets are deterministic
  const BASE_NOW = 1_700_000_000; // arbitrary fixed Unix seconds

  describe("null / zero (never updated)", () => {
    it("returns gray for undefined", () => {
      const result = getPriceStaleClass(undefined, BASE_NOW);
      expect(result).toBe("bg-v2-text-tertiary");
    });

    it("returns gray for 0", () => {
      const result = getPriceStaleClass(0, BASE_NOW);
      expect(result).toBe("bg-v2-text-tertiary");
    });
  });

  describe("< 15 minutes — green", () => {
    it("returns green for just now (0 seconds ago)", () => {
      const result = getPriceStaleClass(BASE_NOW, BASE_NOW);
      expect(result).toBe("bg-v2-green-positive");
    });

    it("returns green for 10 minutes ago", () => {
      const result = getPriceStaleClass(BASE_NOW - 600, BASE_NOW);
      expect(result).toBe("bg-v2-green-positive");
    });

    it("returns green for exactly 14 minutes 59 seconds ago", () => {
      const result = getPriceStaleClass(BASE_NOW - 899, BASE_NOW);
      expect(result).toBe("bg-v2-green-positive");
    });
  });

  describe("15–60 minutes — yellow", () => {
    it("returns yellow for exactly 15 minutes ago", () => {
      const result = getPriceStaleClass(BASE_NOW - 900, BASE_NOW);
      expect(result).toBe("bg-yellow-400");
    });

    it("returns yellow for 30 minutes ago", () => {
      const result = getPriceStaleClass(BASE_NOW - 1800, BASE_NOW);
      expect(result).toBe("bg-yellow-400");
    });

    it("returns yellow for 59 minutes 59 seconds ago", () => {
      const result = getPriceStaleClass(BASE_NOW - 3599, BASE_NOW);
      expect(result).toBe("bg-yellow-400");
    });
  });

  describe("1–24 hours — orange", () => {
    it("returns orange for exactly 1 hour ago", () => {
      const result = getPriceStaleClass(BASE_NOW - 3600, BASE_NOW);
      expect(result).toBe("bg-orange-400");
    });

    it("returns orange for 12 hours ago", () => {
      const result = getPriceStaleClass(BASE_NOW - 43200, BASE_NOW);
      expect(result).toBe("bg-orange-400");
    });

    it("returns orange for 23 hours 59 minutes 59 seconds ago", () => {
      const result = getPriceStaleClass(BASE_NOW - 86399, BASE_NOW);
      expect(result).toBe("bg-orange-400");
    });
  });

  describe("> 24 hours — red", () => {
    it("returns red for exactly 24 hours ago", () => {
      const result = getPriceStaleClass(BASE_NOW - 86400, BASE_NOW);
      expect(result).toBe("bg-v2-red-negative");
    });

    it("returns red for 48 hours ago", () => {
      const result = getPriceStaleClass(BASE_NOW - 172800, BASE_NOW);
      expect(result).toBe("bg-v2-red-negative");
    });
  });
});
