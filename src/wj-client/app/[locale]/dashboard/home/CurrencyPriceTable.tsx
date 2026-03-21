"use client";

import { useTranslations } from "next-intl";
import { formatPriceValue } from "../prices/helpers";
import { BaseCard } from "@/components/BaseCard";
import type { PriceItem } from "@/gen/protobuf/v1/investment";
import {
  InlinePriceEdit,
  OverrideIndicator,
} from "@/features/market-prices/components/InlinePriceEdit";

interface CurrencyPriceTableProps {
  prices: PriceItem[];
  updatedTime?: string;
  isAdmin?: boolean;
  isLoading?: boolean;
}

export function CurrencyPriceTable({
  prices,
  updatedTime,
  isAdmin = false,
  isLoading = false,
}: CurrencyPriceTableProps) {
  const t = useTranslations("dashboard.home");

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-roboto font-semibold text-[16px] text-v2-text-primary">
            {t("currencyPriceTitle")}
          </h3>
          {updatedTime && (
            <span className="font-roboto text-[11px] text-v2-text-tertiary">
              {t("updated", { time: updatedTime })}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-v2-currency-light">
              <th className="text-left px-5 py-3.5 font-roboto font-bold text-[14px] tracking-normal text-v2-currency-dark border-x border-white/30 first:border-l-0">
                {t("currencyType")}
              </th>
              <th className="text-right px-5 py-3.5 font-roboto font-black text-[15px] uppercase tracking-[1px] text-v2-currency-dark border-x border-white/30">
                {t("buy")}
              </th>
              <th className="text-right px-5 py-3.5 font-roboto font-black text-[15px] uppercase tracking-[1px] text-v2-currency-dark border-x border-white/30 last:border-r-0">
                {t("sell")}
              </th>
              {isAdmin && <th className="w-10 border-x border-white/30 last:border-r-0" />}
            </tr>
          </thead>
          <tbody>
            {prices.map((item, index) => (
              <tr
                key={item.typeCode || index}
                className={`border-b border-v2-border-light ${index % 2 === 0 ? "bg-v2-bg-surface" : "bg-v2-bg-surface-tint"}`}
              >
                <td className="px-5 py-3 font-roboto font-bold text-[14px] text-v2-currency-dark border-x border-v2-border-light first:border-l-0">
                  {item.name || item.typeCode}
                  <OverrideIndicator
                    item={item}
                    category="currency"
                    isAdmin={isAdmin}
                  />
                </td>
                <td className="px-5 py-3 text-right font-roboto font-medium text-[13px] text-v2-red-negative border-x border-v2-border-light">
                  {formatPriceValue(item.buy, "VND", { divide: false })}
                </td>
                <td className="px-5 py-3 text-right font-roboto font-medium text-[13px] text-v2-green-positive border-x border-v2-border-light last:border-r-0">
                  {formatPriceValue(item.sell, "VND", { divide: false })}
                </td>
                {isAdmin && (
                  <td className="px-2 py-3 border-x border-v2-border-light last:border-r-0">
                    <InlinePriceEdit item={item} category="currency" />
                  </td>
                )}
              </tr>
            ))}
            {prices.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 4 : 3}
                  className="px-5 py-8 text-center font-roboto text-[13px] text-v2-text-tertiary"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-v2-currency-dark border-t-transparent rounded-full animate-spin" />
                      {t("loading")}
                    </div>
                  ) : (
                    t("noData")
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </BaseCard>
  );
}
