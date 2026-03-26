/**
 * Tests for prices/helpers.ts — formatPriceValue and formatChangeValue
 *
 * TDD: write tests first, then update implementation to pass.
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="helpers"
 */

import { formatPriceValue, formatChangeValue } from "../helpers";

// ---------------------------------------------------------------------------
// formatPriceValue
// ---------------------------------------------------------------------------

describe("formatPriceValue", () => {
  describe("zero/null/undefined → '--'", () => {
    it("returns '--' for value 0 with VND", () => {
      expect(formatPriceValue(0, "VND")).toBe("--");
    });

    it("returns '--' for value 0 with USD", () => {
      expect(formatPriceValue(0, "USD")).toBe("--");
    });

    it("returns '--' for null", () => {
      expect(formatPriceValue(null, "VND")).toBe("--");
    });

    it("returns '--' for undefined", () => {
      expect(formatPriceValue(undefined, "VND")).toBe("--");
    });
  });

  describe("non-zero values → formatted string", () => {
    it("formats VND value with divisor by default", () => {
      // 8500000 / 1000 = 8500 displayed in vi-VN format
      const result = formatPriceValue(8500000, "VND");
      expect(result).toMatch(/8[.,]500/);
    });

    it("formats USD value with divisor by default", () => {
      // 280000 / 100 = $2800.00
      const result = formatPriceValue(280000, "USD");
      expect(result).toBe("$2800.00");
    });

    it("formats VND value without divisor when divide=false", () => {
      const result = formatPriceValue(8500, "VND", { divide: false });
      expect(result).toMatch(/8[.,]500/);
    });
  });
});

// ---------------------------------------------------------------------------
// formatChangeValue
// ---------------------------------------------------------------------------

describe("formatChangeValue", () => {
  describe("zero/null/undefined → '--'", () => {
    it("returns '--' for value 0", () => {
      expect(formatChangeValue(0, "VND")).toBe("--");
    });

    it("returns '--' for null", () => {
      expect(formatChangeValue(null, "VND")).toBe("--");
    });

    it("returns '--' for undefined", () => {
      expect(formatChangeValue(undefined, "VND")).toBe("--");
    });
  });

  describe("non-zero values → formatted absolute value", () => {
    it("formats positive VND change", () => {
      const result = formatChangeValue(100000, "VND");
      expect(result).toMatch(/100/);
    });

    it("formats negative VND change as absolute value (no sign)", () => {
      const result = formatChangeValue(-100000, "VND");
      expect(result).toMatch(/100/);
      expect(result).not.toContain("-");
    });

    it("formats positive USD change", () => {
      const result = formatChangeValue(500, "USD");
      expect(result).toBe("$5.00");
    });
  });
});
