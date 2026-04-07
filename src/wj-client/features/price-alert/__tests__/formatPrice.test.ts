/**
 * Unit tests for formatPrice() and formatTargetPrice() in PriceAlertList.tsx
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="formatPrice"
 */

// Import the helpers via named exports
import { formatPrice, formatTargetPrice } from "../components/PriceAlertList";

describe("formatPrice", () => {
  describe("USD (2 decimal places, divisor 100)", () => {
    it("formats BTC price correctly: 6847203 → $68,472.03", () => {
      expect(formatPrice(6847203, "USD")).toBe("$68,472.03");
    });

    it("formats AAPL price correctly: 17550 → $175.50", () => {
      expect(formatPrice(17550, "USD")).toBe("$175.50");
    });

    it("formats small USD price correctly: 100 → $1.00", () => {
      expect(formatPrice(100, "USD")).toBe("$1.00");
    });
  });

  describe("VND (0 decimal places, divisor 1)", () => {
    it("formats VND price correctly: 1500000 → 1.500.000 ₫", () => {
      const result = formatPrice(1500000, "VND");
      // vi-VN locale uses . as thousand separator
      expect(result).toContain("1.500.000");
      expect(result).toContain("₫");
    });

    it("formats small VND price correctly: 85000 → 85.000 ₫", () => {
      const result = formatPrice(85000, "VND");
      expect(result).toContain("85.000");
    });
  });

  describe("KWD (3 decimal places, divisor 1000)", () => {
    it("formats KWD price correctly: 1234 → 1.234 KWD", () => {
      // KWD uses 3 decimal places; divisor = 1000
      // 1234 / 1000 = 1.234
      const result = formatPrice(1234, "KWD");
      expect(result).toContain("1.234");
    });
  });

  describe("Zero / edge cases", () => {
    it("returns '-' for price = 0", () => {
      expect(formatPrice(0, "USD")).toBe("-");
    });

    it("returns '-' for price = 0 in VND", () => {
      expect(formatPrice(0, "VND")).toBe("-");
    });

    it("handles unknown currency (defaults to divisor 100)", () => {
      // SGD not in the explicit map → defaults to 100 (2 decimal places)
      const result = formatPrice(10000, "SGD");
      // 10000 / 100 = 100.00 SGD
      expect(result).toContain("100");
    });
  });
});

// ---------------------------------------------------------------------------
// formatTargetPrice — target prices stored as whole units (no divisor applied)
// User inputs $100,000 → stored as 100000 → must display as $100,000.00
// ---------------------------------------------------------------------------
describe("formatTargetPrice", () => {
  describe("USD — stored as whole dollars, no divisor", () => {
    it("displays $100,000 target correctly: 100000 → $100,000.00", () => {
      expect(formatTargetPrice(100000, "USD")).toBe("$100,000.00");
    });

    it("displays $50,000 target correctly: 50000 → $50,000.00", () => {
      expect(formatTargetPrice(50000, "USD")).toBe("$50,000.00");
    });

    it("displays $1 target correctly: 1 → $1.00", () => {
      expect(formatTargetPrice(1, "USD")).toBe("$1.00");
    });
  });

  describe("VND — no divisor, no decimals", () => {
    it("displays 85000 VND target correctly", () => {
      const result = formatTargetPrice(85000, "VND");
      expect(result).toContain("85.000");
      expect(result).toContain("₫");
    });
  });

  describe("Zero / edge cases", () => {
    it("returns '-' for target price = 0", () => {
      expect(formatTargetPrice(0, "USD")).toBe("-");
    });

    it("returns '-' for target price = 0 in VND", () => {
      expect(formatTargetPrice(0, "VND")).toBe("-");
    });
  });
});
