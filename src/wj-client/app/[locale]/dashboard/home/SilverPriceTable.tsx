"use client";

import { useTranslations } from "next-intl";
import { formatPriceValue } from "../prices/helpers";
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
    <div className="rounded-lg border-2 border-v2-silver-primary/30 overflow-hidden shadow-v2-card">
      {/* Silver gradient header bar */}
      <div className="bg-gradient-to-r from-v2-silver-primary via-gray-300 to-v2-silver-primary px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-roboto font-bold text-[16px] text-v2-maroon-900">
            {t("silverPriceTitle")}
          </h3>
          {updatedTime && (
            <span className="font-roboto text-[11px] text-v2-maroon-800/70">
              {t("updated", { time: updatedTime })}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-300/60">
              <th className="text-left px-5 py-3.5 font-roboto font-bold text-[14px] tracking-normal text-v2-maroon-900 border-r border-v2-silver-primary/20">
                {t("silverType")}
              </th>
              <th className="text-right px-5 py-3.5 font-roboto font-black text-[15px] uppercase tracking-[1px] text-v2-maroon-900 border-r border-v2-silver-primary/20">
                <div>{t("buy")}</div>
                <div className="font-normal text-[10px] tracking-normal opacity-70">{t("buyUnit")}</div>
              </th>
              <th className="text-right px-5 py-3.5 font-roboto font-black text-[15px] uppercase tracking-[1px] text-v2-maroon-900">
                <div>{t("sell")}</div>
                <div className="font-normal text-[10px] tracking-normal opacity-70">{t("sellUnit")}</div>
              </th>
              {isAdmin && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {prices.map((item, index) => (
              <tr
                key={item.typeCode || index}
                className={`border-b border-v2-silver-primary/10 ${index % 2 === 0 ? "bg-v2-cream-200" : "bg-v2-cream-300"}`}
              >
                <td className="px-5 py-3.5 font-roboto font-bold text-[14px] text-v2-maroon-900 border-r border-v2-silver-primary/10">
                  {item.name || item.typeCode}
                  <OverrideIndicator
                    item={item}
                    category="silver"
                    isAdmin={isAdmin}
                  />
                </td>
                <td className="px-5 py-3.5 text-right font-roboto font-bold text-[14px] text-red-700 tabular-nums border-r border-v2-silver-primary/10">
                  {formatPriceValue(item.buy, item.currency || "VND")}
                </td>
                <td className="px-5 py-3.5 text-right font-roboto font-bold text-[14px] text-green-700 tabular-nums">
                  {formatPriceValue(item.sell, item.currency || "VND")}
                </td>
                {isAdmin && (
                  <td className="px-2 py-3.5">
                    <InlinePriceEdit item={item} category="silver" />
                  </td>
                )}
              </tr>
            ))}
            {prices.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 4 : 3}
                  className="px-5 py-8 text-center font-roboto text-[13px] text-v2-maroon-800 bg-v2-cream-200"
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
    </div>
  );
}
