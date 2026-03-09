"use client";

import { useQueryGetMarketPrice } from "@/utils/generated/hooks";
import { InvestmentType } from "@/gen/protobuf/v1/investment";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";

export interface MarketPriceDisplayProps {
  symbol: string;
  currency: string;
  investmentType: InvestmentType;
  className?: string;
}

export function MarketPriceDisplay({
  symbol,
  currency,
  investmentType,
  className = "",
}: MarketPriceDisplayProps) {
  // Fetch price with React Query (auto-cached, auto-deduplicated)
  const priceQuery = useQueryGetMarketPrice(
    { symbol, currency, type: investmentType },
    {
      enabled: !!symbol && symbol.length >= 2,
      staleTime: 15 * 60 * 1000, // 15 minutes
      retry: 1,
    }
  );

  const priceData = priceQuery.data?.data;

  // Don't render if no symbol
  if (!symbol || symbol.length < 2) return null;

  // Loading state
  if (priceQuery.isLoading) {
    return (
      <div className={`p-3 bg-blue-50 rounded-md ${className}`}>
        <div className="text-sm">
          <LoadingSpinner text="Fetching current price..." />
        </div>
      </div>
    );
  }

  // Error state
  if (priceQuery.isError || !priceData) {
    return (
      <div className={`p-3 bg-gray-50 rounded-md ${className}`}>
        <div className="text-sm text-gray-500">
          Price unavailable for {symbol}
        </div>
      </div>
    );
  }

  // Success - show price with freshness indicator
  const { text: freshnessText, colorClass: freshnessColor } =
    formatTimeAgo(priceData.timestamp);

  const formattedPrice = formatPriceDisplay(
    priceData.priceDecimal,
    currency,
    priceData.displayUnit
  );

  return (
    <div className={`p-3 bg-v2-green-light rounded-md border border-v2-border ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 mb-1">Current Market Price</div>
          <div className="text-lg font-semibold text-v2-green-positive">
            {formattedPrice}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-medium ${freshnessColor}`}>
            {freshnessText}
          </div>
          {priceData.isCached && (
            <div className="text-xs text-gray-400 mt-1">(Cached)</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to format time ago with color coding
function formatTimeAgo(timestamp: number): { text: string; colorClass: string } {
  const now = Date.now() / 1000; // Convert to seconds
  const ageInSeconds = now - timestamp;
  const ageInMinutes = ageInSeconds / 60;
  const ageInHours = ageInMinutes / 60;
  const ageInDays = ageInHours / 24;

  let text: string;
  let colorClass: string;

  if (ageInMinutes < 15) {
    text = "Just now";
    colorClass = "text-v2-green-positive";
  } else if (ageInMinutes < 60) {
    text = `${Math.floor(ageInMinutes)} min ago`;
    colorClass = "text-yellow-600";
  } else if (ageInHours < 24) {
    text = `${Math.floor(ageInHours)} hrs ago`;
    colorClass = "text-orange-600";
  } else {
    text = `${Math.floor(ageInDays)} days ago`;
    colorClass = "text-red-600";
  }

  return { text, colorClass };
}

// Helper function to format price with proper currency symbol and unit
function formatPriceDisplay(
  priceDecimal: number,
  currency: string,
  displayUnit: string
): string {
  // Format the number with proper decimals
  const formattedNumber = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceDecimal);

  // Get currency symbol
  const currencySymbol = getCurrencySymbol(currency);

  // Add unit suffix for gold/silver
  const unitSuffix = displayUnit !== "unit" ? `/${displayUnit}` : "";

  return `${currencySymbol}${formattedNumber}${unitSuffix}`;
}

// Helper function to get currency symbol
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    VND: "₫",
  };
  return symbols[currency] || currency + " ";
}
