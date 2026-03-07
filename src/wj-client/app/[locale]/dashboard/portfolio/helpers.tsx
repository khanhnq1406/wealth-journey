import { InvestmentType } from "@/gen/protobuf/v1/investment";
import { formatCurrency as formatCurrencyUtil } from "@/utils/currency-formatter";
import {
  isGoldType,
  getGoldTypeLabel as getGoldTypeLabelUtil,
  formatGoldQuantityDisplay,
  formatGoldPriceDisplay,
  getGoldUnitLabel,
} from "@/features/investment/utils/gold-calculator";
import {
  isSilverType,
  getSilverTypeLabel,
  formatSilverQuantity as formatSilverQuantityUtil,
  formatSilverPrice as formatSilverPriceUtil,
  getSilverMarketPriceUnit,
  SilverUnit,
} from "@/features/investment/utils/silver-calculator";

// Formatting helpers
export const formatCurrency = (amount: number, currency: string = "VND"): string => {
  return formatCurrencyUtil(amount, currency);
};

export const formatQuantity = (
  quantity: number,
  type: InvestmentType,
  purchaseUnit?: string,
): string => {
  // Gold types have special formatting with unit display (tael/oz)
  if (isGoldType(type)) {
    return formatGoldQuantity(quantity, type);
  }

  // Silver types have special formatting with unit display (lượng/kg/oz)
  if (isSilverType(type) && purchaseUnit) {
    return formatSilverQuantityUtil(quantity, type, purchaseUnit as SilverUnit);
  }

  // Match backend precision: Crypto: 8 decimals, Stocks/ETFs/Mutual Funds/Bonds/Commodities/Other: 4 decimals
  let decimals = 4; // Default for most investment types
  if (type === InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY) {
    decimals = 8;
  }
  return (quantity / Math.pow(10, decimals)).toFixed(decimals);
};

export const formatPercent = (value: number): string => {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};

// Format prices with appropriate decimals based on investment type
export const formatPrice = (price: number, type: InvestmentType, currency: string = "VND", priceUnit?: string, symbol?: string): string => {
  // Gold types: show price per unit (₫/lượng for VND gold, $/oz for USD gold)
  if (isGoldType(type)) {
    return formatGoldPrice(price, currency, undefined, type);
  }

  // Silver types: show price per unit
  // Use symbol to determine correct market price unit (tael for *_xL, kg for *_xKG, oz for XAGUSD)
  if (isSilverType(type)) {
    const marketUnit = getSilverMarketPriceUnit(type, symbol);
    return formatSilverPriceUtil(price, currency, marketUnit, type);
  }

  // Use the multi-currency formatter from utils for other types
  return formatCurrencyUtil(price, currency);
};

export const getInvestmentTypeLabel = (type: InvestmentType, t?: (key: string) => string): string => {
  // Use gold calculator utility for gold types
  if (isGoldType(type)) {
    return getGoldTypeLabelUtil(type);
  }

  // Use silver calculator utility for silver types
  if (isSilverType(type)) {
    return getSilverTypeLabel(type);
  }

  if (t) {
    switch (type) {
      case InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY:
        return t("typeOptions.cryptocurrency");
      case InvestmentType.INVESTMENT_TYPE_STOCK:
        return t("typeOptions.stock");
      case InvestmentType.INVESTMENT_TYPE_ETF:
        return t("typeOptions.etf");
      case InvestmentType.INVESTMENT_TYPE_MUTUAL_FUND:
        return t("typeOptions.mutualFund");
      case InvestmentType.INVESTMENT_TYPE_BOND:
        return t("typeOptions.bond");
      case InvestmentType.INVESTMENT_TYPE_COMMODITY:
        return t("typeOptions.commodity");
      case InvestmentType.INVESTMENT_TYPE_OTHER:
        return t("typeLabels.other");
      default:
        return t("typeLabels.other");
    }
  }

  switch (type) {
    case InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY:
      return "Crypto";
    case InvestmentType.INVESTMENT_TYPE_STOCK:
      return "Stock";
    case InvestmentType.INVESTMENT_TYPE_ETF:
      return "ETF";
    case InvestmentType.INVESTMENT_TYPE_MUTUAL_FUND:
      return "Mutual Fund";
    case InvestmentType.INVESTMENT_TYPE_BOND:
      return "Bond";
    case InvestmentType.INVESTMENT_TYPE_COMMODITY:
      return "Commodity";
    case InvestmentType.INVESTMENT_TYPE_OTHER:
      return "Other";
    default:
      return "Unknown";
  }
};

// Format timestamp as relative time with freshness indicator
export const formatTimeAgo = (
  timestamp: number,
  t?: (key: string, params?: Record<string, string | number>) => string,
  locale?: string,
): { text: string; colorClass: string } => {
  if (!timestamp) {
    return { text: t ? t("timeAgo.never") : "Never", colorClass: "text-gray-400" };
  }

  const date = new Date(timestamp * 1000); // Convert Unix timestamp (seconds to ms)
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  let text: string;
  let colorClass: string;

  if (diffMins < 1) {
    text = t ? t("timeAgo.justNow") : "Just now";
    colorClass = "text-green-600";
  } else if (diffMins < 5) {
    text = t ? t("timeAgo.minutesAgo", { count: diffMins }) : `${diffMins}m ago`;
    colorClass = "text-green-600";
  } else if (diffMins < 15) {
    text = t ? t("timeAgo.minutesAgo", { count: diffMins }) : `${diffMins}m ago`;
    colorClass = "text-green-600";
  } else if (diffMins < 60) {
    text = t ? t("timeAgo.minutesAgo", { count: diffMins }) : `${diffMins}m ago`;
    colorClass = "text-yellow-600";
  } else if (diffMins < 1440) {
    // Less than 24 hours
    const hours = Math.floor(diffMins / 60);
    text = t ? t("timeAgo.hoursAgo", { count: hours }) : `${hours}h ago`;
    colorClass = "text-orange-600";
  } else {
    text = date.toLocaleDateString(locale);
    colorClass = "text-red-600";
  }

  return { text, colorClass };
};

// Gold-specific formatting functions

/**
 * Format gold quantity for display with appropriate unit
 * @param storedQuantity - Quantity in storage format (base unit × 10000)
 * @param investmentType - The investment type
 * @returns Formatted quantity string (e.g., "2.0000 lượng" for VND gold)
 */
export function formatGoldQuantity(storedQuantity: number, investmentType: InvestmentType): string {
  if (!isGoldType(investmentType)) {
    // Use default formatting for non-gold investments
    const decimals = getDecimalsForType(investmentType);
    return (storedQuantity / Math.pow(10, decimals)).toFixed(decimals);
  }

  const { value, unit } = formatGoldQuantityDisplay(storedQuantity, investmentType, '');
  const unitLabel = getGoldUnitLabel(unit);

  return `${value.toFixed(4)} ${unitLabel}`;
}

/**
 * Format gold price for display with appropriate unit
 *
 * Backend storage format:
 * - VND gold: Price per gram in VND (not in cents, just main units)
 * - USD gold: Price per ounce in USD cents
 *
 * Display format:
 * - VND gold: Price per tael (multiply per-gram by 37.5)
 * - USD gold: Price per ounce (divide cents by 100)
 *
 * @param price - Price from backend (VND: per gram, USD: cents per ounce)
 * @param currency - Currency code
 * @param priceUnit - Unit of the price (if different from market default)
 * @returns Formatted price string (e.g., "85,000,000 ₫/lượng" for VND gold)
 */
export function formatGoldPrice(
  price: number,
  currency: string,
  priceUnit?: string,
  investmentType?: InvestmentType
): string {
  // Determine the display unit
  // For VND gold (type 8): use tael (lượng) regardless of display currency
  // For USD gold (type 9): use oz
  let unit: 'tael' | 'oz' = 'tael';

  if (investmentType === 9) { // GOLD_USD
    unit = 'oz';
  }

  // Use provided priceUnit if available (overrides default)
  if (priceUnit) {
    unit = priceUnit as 'tael' | 'oz';
  }

  const unitLabel = getGoldUnitLabel(unit);

  // Convert price from storage format to display format
  let priceForDisplay: number;

  if (currency === 'VND') {
    // Case 1: Native VND gold (price per gram in VND)
    // Convert to price per tael: multiply by 37.5
    priceForDisplay = price * 37.5;
  } else if (investmentType === 9) {
    // Case 2: Native USD gold (XAU) - price per ounce in cents
    // Convert cents to dollars
    priceForDisplay = price / 100;
  } else {
    // Case 3: VND gold with backend currency conversion to USD
    // Backend returns price per gram in USD cents
    // Convert cents to dollars, then gram to tael
    const pricePerGramInDollars = price / 100;
    priceForDisplay = pricePerGramInDollars * 37.5;
  }

  // Format price with currency
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceForDisplay);

  return `${formattedPrice}/${unitLabel}`;
}

/**
 * Get decimal precision for an investment type (for non-gold)
 */
function getDecimalsForType(type: InvestmentType): number {
  if (type === InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY) {
    return 8;
  } else if (
    type === InvestmentType.INVESTMENT_TYPE_STOCK ||
    type === InvestmentType.INVESTMENT_TYPE_ETF ||
    type === InvestmentType.INVESTMENT_TYPE_MUTUAL_FUND
  ) {
    return 4;
  }
  return 2;
}

/**
 * Check if an investment is gold type
 */
export function isGoldInvestment(type: InvestmentType): boolean {
  return isGoldType(type);
}

/**
 * Get display unit label for investment forms (full name)
 * Returns user-friendly labels like "Tael (lượng)", "Kg", "Ounce"
 * @param unit - The unit string ("tael", "kg", "oz", "gram")
 * @param investmentType - The investment type enum (optional, for context)
 */
export function getInvestmentUnitLabelFull(unit: string, investmentType?: InvestmentType): string {
  switch (unit) {
    case 'tael':
      return 'Tael (lượng)';
    case 'kg':
      return 'Kg';
    case 'oz':
      return 'Ounce';
    case 'gram':
      return 'Gram';
    default:
      return unit;
  }
}

/**
 * Check if an investment is a custom investment (no market data)
 * Custom investments have currentPrice = 0 and no market data API support
 */
export function isCustomInvestment(investment: {
  currentPrice: number;
  symbol: string;
  type: InvestmentType;
}): boolean {
  // If price is 0, assume it's custom
  // In future, could add explicit flag to investment model
  return investment.currentPrice === 0;
}

/**
 * Format price with custom investment handling
 */
export function formatInvestmentPrice(
  price: number,
  currency: string,
  isCustom: boolean,
): string {
  if (isCustom && price === 0) {
    return "Price not set";
  }

  return formatCurrency(price, currency);
}

/**
 * Format unrealized PNL with custom investment handling
 */
export function formatUnrealizedPNL(
  unrealizedPnl: number,
  unrealizedPnlPercent: number,
  currency: string,
  isCustom: boolean,
): { text: string; colorClass: string } {
  if (isCustom) {
    return {
      text: "N/A (Price not set)",
      colorClass: "text-gray-500",
    };
  }

  const sign = unrealizedPnl >= 0 ? "+" : "";
  const colorClass = unrealizedPnl >= 0 ? "text-green-600" : "text-red-600";

  return {
    text: `${sign}${formatCurrency(unrealizedPnl, currency)} (${sign}${unrealizedPnlPercent.toFixed(2)}%)`,
    colorClass,
  };
}

