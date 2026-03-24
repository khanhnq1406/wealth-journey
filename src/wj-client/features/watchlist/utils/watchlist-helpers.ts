// Utility functions for watchlist feature
import { WatchlistItem } from "@/gen/protobuf/v1/watchlist";
import { InvestmentType } from "@/gen/protobuf/v1/investment";

const GOLD_SILVER_TYPES: number[] = [
  InvestmentType.INVESTMENT_TYPE_GOLD_VND,
  InvestmentType.INVESTMENT_TYPE_GOLD_USD,
  InvestmentType.INVESTMENT_TYPE_SILVER_VND,
  InvestmentType.INVESTMENT_TYPE_SILVER_USD,
];

const CURRENCY_TYPE = InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY;

/**
 * Maps InvestmentType numeric values to human-readable display strings.
 */
export function getAssetTypeLabel(assetType: number): string {
  switch (assetType) {
    case InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY:
      return "Crypto";
    case InvestmentType.INVESTMENT_TYPE_STOCK:
      return "Stock";
    case InvestmentType.INVESTMENT_TYPE_ETF:
      return "ETF";
    case InvestmentType.INVESTMENT_TYPE_GOLD_VND:
    case InvestmentType.INVESTMENT_TYPE_GOLD_USD:
      return "Gold";
    case InvestmentType.INVESTMENT_TYPE_SILVER_VND:
    case InvestmentType.INVESTMENT_TYPE_SILVER_USD:
      return "Silver";
    case InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY:
      return "Currency";
    default:
      return "Asset";
  }
}

/**
 * Formats a watchlist item's price for display.
 * Gold/Silver: use buyPrice if available, else sellPrice, else "N/A".
 * Others: use currentPrice.
 * USD prices are stored as cents (×100), VND as ×1000.
 */
export function formatWatchlistPrice(item: WatchlistItem): string {
  const isGoldSilver = GOLD_SILVER_TYPES.includes(item.assetType);
  const isCurrency = item.assetType === CURRENCY_TYPE;

  let rawPrice: number | undefined;
  if (isGoldSilver || isCurrency) {
    rawPrice = item.buyPrice || item.sellPrice || undefined;
  } else {
    rawPrice = item.currentPrice || undefined;
  }

  if (!rawPrice) return "N/A";

  const currency = item.currency || "USD";

  if (isCurrency) {
    // Currency prices from vangsaigon are raw VND — no divisor
    return new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0,
    }).format(rawPrice);
  }

  if (currency === "VND") {
    // VND stored × 1000
    const display = rawPrice / 1000;
    return new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0,
    }).format(display);
  }

  // USD stored × 100 (cents)
  const display = rawPrice / 100;
  return `$${display.toFixed(2)}`;
}

/**
 * Returns a "+1.23%" style change string, or null if no percent change data.
 */
export function formatWatchlistChange(item: WatchlistItem): string | null {
  const pct = item.priceChangePercent;
  if (pct == null) return null;

  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}
