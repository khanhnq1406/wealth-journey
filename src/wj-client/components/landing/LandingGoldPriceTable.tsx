"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MarketTypeItem } from "@/features/market-prices/hooks/usePublicMarketTypes";
import { GOLD_TABLE_FILTER } from "@/features/market-prices/constants/gold-filter";

interface LandingGoldPriceTableProps {
  types: MarketTypeItem[];
  isLoading?: boolean;
  updatedTime?: string;
}

export function LandingGoldPriceTable({
  types,
  isLoading,
  updatedTime,
}: LandingGoldPriceTableProps) {
  const t = useTranslations("landing.priceTeaser");

  // Filter and reorder to show only 9 configured gold types
  const filteredTypes = GOLD_TABLE_FILTER.map((filter) => {
    const match = types.find(
      (item) => item.code === filter.apiName || item.name === filter.apiName,
    );
    return match ? { ...match, displayName: filter.displayName } : null;
  }).filter(Boolean) as (MarketTypeItem & { displayName: string })[];

  if (isLoading) {
    return (
      <div className="rounded-lg border-2 border-v2-gold-primary/30 overflow-hidden shadow-v2-card">
        <div className="bg-gradient-to-r from-v2-gold-primary via-v2-gold-light to-v2-gold-primary px-5 py-3">
          <h3 className="font-roboto font-bold text-[16px] text-v2-maroon-900">
            {t("goldTableTitle")}
          </h3>
        </div>
        <div className="bg-v2-cream-200 px-5 py-8 text-center font-roboto text-[13px] text-v2-maroon-800 animate-pulse">
          {t("loadingTypes")}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-v2-gold-primary/30 overflow-hidden shadow-v2-card">
      {/* Gold gradient header bar */}
      <div className="bg-gradient-to-r from-v2-gold-primary via-v2-gold-light to-v2-gold-primary px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-roboto font-bold text-[16px] text-v2-maroon-900">
            {t("goldTableTitle")}
          </h3>
          {updatedTime && (
            <span className="font-roboto text-[11px] text-v2-maroon-800/70">
              {t("updatedTime", { time: updatedTime })}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
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
            {filteredTypes.map((item, index) => (
              <tr
                key={item.code}
                className={`border-b border-v2-gold-primary/10 ${index % 2 === 0 ? "bg-v2-cream-200" : "bg-v2-cream-300"}`}
              >
                <td className="px-5 py-3.5 font-roboto font-bold text-[14px] text-v2-maroon-900 border-r border-v2-gold-primary/10">
                  {item.displayName}
                </td>
                <td className="px-5 py-3.5 text-right font-roboto font-bold text-[14px] text-red-700 border-r border-v2-gold-primary/10">
                  {t.rich("loginPrompt", {
                    loginLink: (chunks) => (
                      <Link
                        href="/auth/login"
                        className="font-semibold text-v2-red-primary hover:underline"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </td>
                <td className="px-5 py-3.5 text-right font-roboto font-bold text-[14px] text-green-700">
                  {t.rich("loginPrompt", {
                    loginLink: (chunks) => (
                      <Link
                        href="/auth/login"
                        className="font-semibold text-v2-red-primary hover:underline"
                      >
                        {chunks}
                      </Link>
                    ),
                  })}
                </td>
              </tr>
            ))}
            {filteredTypes.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-8 text-center font-roboto text-[13px] text-v2-maroon-800 bg-v2-cream-200"
                >
                  {t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
