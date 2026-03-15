"use client";

import { useTranslations } from "next-intl";
import { formatPriceValue } from "../prices/helpers";
import { BaseCard } from "@/components/BaseCard";
import type { PriceItem } from "@/gen/protobuf/v1/investment";
import { InlinePriceEdit, OverrideIndicator } from "@/features/market-prices/components/InlinePriceEdit";

interface CurrencyPriceTableProps {
  prices: PriceItem[];
  updatedTime?: string;
  isAdmin?: boolean;
}

export function CurrencyPriceTable({
  prices,
  updatedTime,
  isAdmin = false,
}: CurrencyPriceTableProps) {
  const t = useTranslations("dashboard.home");

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("currencyPriceTitle")}
          </h3>
          {updatedTime && (
            <span className="font-jetbrains text-[11px] text-v2-text-tertiary">
              {t("updated", { time: updatedTime })}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div>
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[40%]" />
            <col className="w-[30%]" />
            <col className="w-[30%]" />
            {isAdmin && <col className="w-10" />}
          </colgroup>
          <thead>
            <tr className="bg-v2-currency-light">
              <th className="text-left px-3 py-2.5 sm:px-5 sm:py-3.5 font-vietnam font-bold text-[14px] tracking-normal text-v2-currency-dark">
                {t("currencyType")}
              </th>
              <th className="text-right px-3 py-2.5 sm:px-5 sm:py-3.5 font-jetbrains font-bold text-[12px] sm:text-[13px] uppercase tracking-normal sm:tracking-[1px] text-v2-currency-dark">
                {t("buy")}
              </th>
              <th className="text-right px-3 py-2.5 sm:px-5 sm:py-3.5 font-jetbrains font-bold text-[12px] sm:text-[13px] uppercase tracking-normal sm:tracking-[1px] text-v2-currency-dark">
                {t("sell")}
              </th>
              {isAdmin && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {prices.map((item, index) => (
              <tr
                key={item.typeCode || index}
                className={
                  index % 2 === 0 ? "bg-white" : "bg-v2-bg-surface-tint"
                }
              >
                <td className="px-3 py-2.5 sm:px-5 sm:py-3 font-vietnam font-bold text-[13px] sm:text-[14px] text-v2-currency-dark truncate">
                  {item.name || item.typeCode}
                  <OverrideIndicator item={item} category="currency" isAdmin={isAdmin} />
                </td>
                <td className="px-3 py-2.5 sm:px-5 sm:py-3 text-right font-jetbrains font-medium text-[12px] sm:text-[13px] text-v2-text-primary">
                  {formatPriceValue(item.buy, "VND")}
                </td>
                <td className="px-3 py-2.5 sm:px-5 sm:py-3 text-right font-jetbrains font-medium text-[12px] sm:text-[13px] text-v2-text-primary">
                  {formatPriceValue(item.sell, "VND")}
                </td>
                {isAdmin && (
                  <td className="px-2 py-3">
                    <InlinePriceEdit item={item} category="currency" />
                  </td>
                )}
              </tr>
            ))}
            {prices.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 4 : 3}
                  className="px-5 py-8 text-center font-vietnam text-[13px] text-v2-text-tertiary"
                >
                  {t("comingSoon")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </BaseCard>
  );
}
