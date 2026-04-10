import { InvestmentType } from "@/gen/protobuf/v1/investment";
import { WatchlistItem } from "@/gen/protobuf/v1/watchlist";
import { formatWatchlistPrice } from "../utils/watchlist-helpers";

function makeItem(overrides: Partial<WatchlistItem>): WatchlistItem {
  return {
    id: 1,
    symbol: "TEST",
    name: "Test",
    assetType: InvestmentType.INVESTMENT_TYPE_STOCK,
    currency: "VND",
    note: "",
    sortOrder: 0,
    createdAt: 0,
    currentPrice: 0,
    buyPrice: 0,
    sellPrice: 0,
    priceChange: 0,
    priceChangePercent: 0,
    ...overrides,
  };
}

describe("formatWatchlistPrice", () => {
  describe("Gold VND — no divisor applied", () => {
    it("returns raw VND value without dividing by 1000", () => {
      const item = makeItem({
        assetType: InvestmentType.INVESTMENT_TYPE_GOLD_VND,
        currency: "VND",
        buyPrice: 93500000,
      });
      // Expected: 93,500,000 formatted as vi-VN (93.500.000), NOT 93.500
      const result = formatWatchlistPrice(item);
      expect(result).toBe("93.500.000");
    });

    it("falls back to sellPrice when buyPrice is 0", () => {
      const item = makeItem({
        assetType: InvestmentType.INVESTMENT_TYPE_GOLD_VND,
        currency: "VND",
        buyPrice: 0,
        sellPrice: 94000000,
      });
      expect(formatWatchlistPrice(item)).toBe("94.000.000");
    });
  });

  describe("Silver VND — no divisor applied", () => {
    it("returns raw VND value for silver", () => {
      const item = makeItem({
        assetType: InvestmentType.INVESTMENT_TYPE_SILVER_VND,
        currency: "VND",
        buyPrice: 1200000,
      });
      expect(formatWatchlistPrice(item)).toBe("1.200.000");
    });
  });

  describe("Gold USD — divides by 100 (cents)", () => {
    it("returns USD price divided by 100", () => {
      const item = makeItem({
        assetType: InvestmentType.INVESTMENT_TYPE_GOLD_USD,
        currency: "USD",
        buyPrice: 330000, // $3300.00
      });
      expect(formatWatchlistPrice(item)).toBe("$3300.00");
    });
  });

  describe("Currency (FOREIGN_CURRENCY) — no divisor applied", () => {
    it("returns raw VND currency rate", () => {
      const item = makeItem({
        assetType: InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY,
        currency: "VND",
        buyPrice: 25800000,
      });
      expect(formatWatchlistPrice(item)).toBe("25.800.000");
    });
  });

  describe("Stock — uses currentPrice, divides USD by 100", () => {
    it("returns USD stock price divided by 100", () => {
      const item = makeItem({
        assetType: InvestmentType.INVESTMENT_TYPE_STOCK,
        currency: "USD",
        currentPrice: 19000, // $190.00
      });
      expect(formatWatchlistPrice(item)).toBe("$190.00");
    });
  });

  describe("missing price", () => {
    it("returns N/A when all prices are 0", () => {
      const item = makeItem({
        assetType: InvestmentType.INVESTMENT_TYPE_GOLD_VND,
        currency: "VND",
        buyPrice: 0,
        sellPrice: 0,
        currentPrice: 0,
      });
      expect(formatWatchlistPrice(item)).toBe("N/A");
    });
  });
});
