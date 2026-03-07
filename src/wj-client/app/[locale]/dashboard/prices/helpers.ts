import type { PriceItem } from "@/gen/protobuf/v1/investment";

// USD: multiplied by 100 (cents), so raw 280000 → display as $2,800.00
const USD_DIVISOR = 100;

export function formatPriceValue(
  value: number | null | undefined,
  currency: string,
): string {
  if (value === null || value === undefined) return "-";
  if (currency === "VND") {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return `$${(value / USD_DIVISOR).toFixed(2)}`;
}

export function formatChangeValue(value: number, currency: string): string {
  if (value === null || value === undefined) return "0";
  if (value === 0) return "";
  const abs = Math.abs(value);
  const formatted = formatPriceValue(abs, currency);
  return formatted;
}

export type { PriceItem };
