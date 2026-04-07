/**
 * Unit tests for formatPrice() in PriceAlertList.tsx
 *
 * Run: cd src/wj-client && npm test -- --watchAll=false --testPathPatterns="formatPrice"
 */

// Import the helper via a named export (see Step 3 — we'll export it)
import { formatPrice } from "../components/PriceAlertList";

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
