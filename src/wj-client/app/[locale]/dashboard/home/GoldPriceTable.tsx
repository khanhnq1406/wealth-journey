"use client";

import { useTranslations } from "next-intl";
import { formatPriceValue } from "../prices/helpers";
import { BaseCard } from "@/components/BaseCard";
import type { PriceItem } from "@/gen/protobuf/v1/investment";
import { filterGoldPrices } from "@/features/market-prices/constants/gold-filter";
import {
  InlinePriceEdit,
  OverrideIndicator,
} from "@/features/market-prices/components/InlinePriceEdit";

interface GoldPriceTableProps {
  prices: PriceItem[];
  updatedTime?: string;
  isAdmin?: boolean;
  isLoading?: boolean;
}

export function GoldPriceTable({
  prices,
  updatedTime,
  isAdmin = false,
  isLoading = false,
}: GoldPriceTableProps) {
  const t = useTranslations("dashboard.home");

  // Filter and reorder to show only 9 configured gold types
  const filteredPrices = filterGoldPrices(prices);

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-3 ">
        <div className="flex items-center justify-between">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("goldPriceTitle")}
          </h3>
          {updatedTime && (
            <span className="font-jetbrains text-[11px] text-v2-text-tertiary">
              {t("updated", { time: updatedTime })}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-v2-gold-light">
              <th className="text-left px-5 py-3.5 font-vietnam font-bold text-[14px] tracking-normal text-v2-gold-dark border-x border-white/30 first:border-l-0">
                {t("goldType")}
              </th>
              <th className="text-right px-5 py-3.5 font-jetbrains font-black text-[15px] uppercase tracking-[1px] text-v2-gold-dark border-x border-white/30">
                <div>{t("buy")}</div>
                <div className="font-normal text-[10px] tracking-normal opacity-70">{t("buyUnit")}</div>
              </th>
              <th className="text-right px-5 py-3.5 font-jetbrains font-black text-[15px] uppercase tracking-[1px] text-v2-gold-dark border-x border-white/30 last:border-r-0">
                <div>{t("sell")}</div>
                <div className="font-normal text-[10px] tracking-normal opacity-70">{t("sellUnit")}</div>
              </th>
              {isAdmin && <th className="w-10 border-x border-white/30 last:border-r-0" />}
            </tr>
          </thead>
          <tbody>
            {filteredPrices.map((item, index) => (
              <tr
                key={item.typeCode || index}
                className={`border-b border-v2-border-light ${index % 2 === 0 ? "bg-white" : "bg-v2-bg-surface-tint"}`}
              >
                <td className="px-5 py-3 font-vietnam font-bold text-[14px] text-v2-gold-dark border-x border-v2-border-light first:border-l-0">
                  {item.displayName}
                  <OverrideIndicator
                    item={item}
                    category="gold"
                    isAdmin={isAdmin}
                  />
                </td>
                <td className="px-5 py-3 text-right font-jetbrains font-medium text-[13px] text-lred border-x border-v2-border-light">
                  {formatPriceValue(item.buy, item.currency || "VND")}
                </td>
                <td className="px-5 py-3 text-right font-jetbrains font-medium text-[13px] text-v2-green-positive border-x border-v2-border-light last:border-r-0">
                  {formatPriceValue(item.sell, item.currency || "VND")}
                </td>
                {isAdmin && (
                  <td className="px-2 py-3 border-x border-v2-border-light last:border-r-0">
                    <InlinePriceEdit item={item} category="gold" />
                  </td>
                )}
              </tr>
            ))}
            {filteredPrices.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 4 : 3}
                  className="px-5 py-8 text-center font-vietnam text-[13px] text-v2-text-tertiary"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-v2-gold-dark border-t-transparent rounded-full animate-spin" />
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
