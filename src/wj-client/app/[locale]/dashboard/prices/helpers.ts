import type { PriceItem } from "@/gen/protobuf/v1/investment";

// USD: multiplied by 100 (cents), so raw 280000 → display as $2,800.00
const USD_DIVISOR = 100;
// VND: multiplied by 1000, so raw 8500000 → display as 8,500
const VND_DIVISOR = 1000;

export function formatPriceValue(
  value: number | null | undefined,
  currency: string,
  options?: { divide?: boolean },
): string {
  const divide = options?.divide ?? true;
  if (value === null || value === undefined || value === 0) return "--";
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      maximumFractionDigits: 0,
    }).format(divide ? value / VND_DIVISOR : value);
  }
  return `$${(divide ? value / USD_DIVISOR : value).toFixed(2)}`;
}

export function formatChangeValue(
  value: number | null | undefined,
  currency: string,
  options?: { divide?: boolean },
): string {
  if (value === null || value === undefined || value === 0) return "--";
  const abs = Math.abs(value);
  const formatted = formatPriceValue(abs, currency, options);
  return formatted;
}

export type { PriceItem };

// ─── Tab Visibility Logic ──────────────────────────────────────────────────────

export type TabKey = "priceAlerts" | "watchlist" | "gold" | "silver" | "currency" | "symbol";

export interface TabDef {
  key: TabKey;
  label: string;
}

export interface MarketPricesData {
  gold?: PriceItem[];
  silver?: PriceItem[];
  currency?: PriceItem[];
}

/**
 * Computes the list of visible tabs based on API data and fetch status.
 *
 * Rules:
 * - priceAlerts, watchlist, symbol are always visible
 * - gold/silver/currency are hidden only when isSuccess=true AND the array is empty
 * - During loading (isSuccess=false), all tabs remain visible to avoid layout shifts
 */
export function computeVisibleTabs(
  isSuccess: boolean,
  data: MarketPricesData | null | undefined,
  labels: Record<TabKey, string>,
): TabDef[] {
  const tabs: TabDef[] = [];
  tabs.push({ key: "priceAlerts", label: labels.priceAlerts });
  tabs.push({ key: "watchlist", label: labels.watchlist });
  if (!isSuccess || (data?.gold ?? []).length > 0) {
    tabs.push({ key: "gold", label: labels.gold });
  }
  if (!isSuccess || (data?.silver ?? []).length > 0) {
    tabs.push({ key: "silver", label: labels.silver });
  }
  if (!isSuccess || (data?.currency ?? []).length > 0) {
    tabs.push({ key: "currency", label: labels.currency });
  }
  tabs.push({ key: "symbol", label: labels.symbol });
  return tabs;
}
