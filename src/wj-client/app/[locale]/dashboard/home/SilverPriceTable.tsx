"use client";

import { useTranslations } from "next-intl";
import { formatPriceValue } from "../prices/helpers";
import { BaseCard } from "@/components/BaseCard";
import type { PriceItem } from "@/gen/protobuf/v1/investment";
import {
  InlinePriceEdit,
  OverrideIndicator,
} from "@/features/market-prices/components/InlinePriceEdit";

interface SilverPriceTableProps {
  prices: PriceItem[];
  updatedTime?: string;
  isAdmin?: boolean;
  isLoading?: boolean;
}

export function SilverPriceTable({
  prices,
  updatedTime,
  isAdmin = false,
  isLoading = false,
}: SilverPriceTableProps) {
  const t = useTranslations("dashboard.home");

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden"
    >
      <div className="px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("silverPriceTitle")}
          </h3>
          {updatedTime && (
            <span className="font-jetbrains text-[11px] text-v2-text-tertiary">
              {t("updated", { time: updatedTime })}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-v2-silver-light">
              <th className="text-left px-5 py-3.5 font-vietnam font-bold text-[14px] tracking-normal text-v2-silver-dark">
                {t("silverType")}
              </th>
              <th className="text-right px-5 py-3.5 font-jetbrains font-black text-[15px] uppercase tracking-[1px] text-v2-silver-dark">
                {t("buy")}
              </th>
              <th className="text-right px-5 py-3.5 font-jetbrains font-black text-[15px] uppercase tracking-[1px] text-v2-silver-dark">
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
                <td className="px-5 py-3 font-vietnam font-bold text-[14px] text-v2-silver-dark">
                  {item.name || item.typeCode}
                  <OverrideIndicator
                    item={item}
                    category="silver"
                    isAdmin={isAdmin}
                  />
                </td>
                <td className="px-5 py-3 text-right font-jetbrains font-medium text-[13px] text-lred">
                  {formatPriceValue(item.buy, item.currency || "VND")}
                </td>
                <td className="px-5 py-3 text-right font-jetbrains font-medium text-[13px] text-v2-green-positive">
                  {formatPriceValue(item.sell, item.currency || "VND")}
                </td>
                {isAdmin && (
                  <td className="px-2 py-3">
                    <InlinePriceEdit item={item} category="silver" />
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
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-v2-silver-dark border-t-transparent rounded-full animate-spin" />
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
