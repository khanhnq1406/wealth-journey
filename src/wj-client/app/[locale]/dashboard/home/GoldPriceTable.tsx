"use client";

import { useTranslations } from "next-intl";
import { formatPriceValue } from "../prices/helpers";
import {
  useQueryGetGoldDisplayPrices,
} from "@/utils/generated/hooks";
import {
  formatUpdateTimestamp,
  getLatestTimestamp,
} from "@/features/market-prices/utils/format-update-time";

export function GoldPriceTable() {
  const t = useTranslations("dashboard.home");

  const { data, isLoading, isError } = useQueryGetGoldDisplayPrices({
    staleTime: 5 * 60 * 1000,
  });

  const prices = data?.prices ?? [];
  const updatedTime = formatUpdateTimestamp(getLatestTimestamp(prices));

  return (
    <div className="rounded-lg border-2 border-v2-gold-primary/30 overflow-hidden shadow-v2-card">
      {/* Gold gradient header bar */}
      <div className="bg-gradient-to-r from-v2-gold-primary via-v2-gold-light to-v2-gold-primary px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-roboto font-bold text-[16px] text-v2-maroon-900">
            {t("goldPriceTitle")}
          </h3>
          {prices.length > 0 && (
            <span className="font-roboto text-[11px] text-v2-maroon-800/70">
              {t("updated", { time: updatedTime })}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-b-lg">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-v2-gold-accent">
              <th className="text-left px-5 py-3.5 font-roboto font-bold text-[14px] tracking-normal text-v2-maroon-900 border-r border-v2-gold-primary/20">
                {t("goldType")}
              </th>
              <th className="text-right px-5 py-3.5 font-roboto font-black text-[15px] uppercase tracking-[1px] text-v2-maroon-900 border-r border-v2-gold-primary/20">
                <div>{t("buy")}</div>
                <div className="font-normal text-[10px] tracking-normal opacity-70">{t("buyUnit")}</div>
              </th>
              <th className="text-right px-5 py-3.5 font-roboto font-black text-[15px] uppercase tracking-[1px] text-v2-maroon-900">
                <div>{t("sell")}</div>
                <div className="font-normal text-[10px] tracking-normal opacity-70">{t("sellUnit")}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {prices.map((item, index) => (
              <tr
                key={item.typeCode || index}
                className={`border-b border-v2-gold-primary/10 ${index % 2 === 0 ? "bg-v2-cream-200" : "bg-v2-cream-300"}`}
              >
                <td className="px-5 py-3.5 font-roboto font-bold text-[14px] text-v2-maroon-900 border-r border-v2-gold-primary/10">
                  {item.displayName}
                </td>
                <td className="px-5 py-3.5 text-right font-roboto font-bold text-[14px] text-v2-red-negative tabular-nums border-r border-v2-gold-primary/10">
                  {item.isStale ? "--" : formatPriceValue(item.buy, item.currency || "VND")}
                </td>
                <td className="px-5 py-3.5 text-right font-roboto font-bold text-[14px] text-v2-green-positive tabular-nums">
                  {item.isStale ? "--" : formatPriceValue(item.sell, item.currency || "VND")}
                </td>
              </tr>
            ))}
            {prices.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-8 text-center font-roboto text-[13px] text-v2-maroon-800 bg-v2-cream-200"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-v2-gold-dark border-t-transparent rounded-full animate-spin" />
                      {t("loading")}
                    </div>
                  ) : isError ? (
                    t("noData")
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
