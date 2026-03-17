"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import type { MarketTypeItem } from "@/features/market-prices/hooks/usePublicMarketTypes";

interface LandingSilverPriceTableProps {
  types: MarketTypeItem[];
  isLoading?: boolean;
  updatedTime?: string;
}

export function LandingSilverPriceTable({
  types,
  isLoading,
  updatedTime,
}: LandingSilverPriceTableProps) {
  const t = useTranslations("landing.priceTeaser");

  if (isLoading) {
    return (
      <BaseCard
        padding="none"
        className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden"
      >
        <div className="px-5 py-3">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("silverTableTitle")}
          </h3>
        </div>
        <div className="px-5 py-8 text-center font-vietnam text-[13px] text-v2-text-tertiary animate-pulse">
          {t("loadingTypes")}
        </div>
      </BaseCard>
    );
  }

  return (
    <BaseCard padding="none" className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("silverTableTitle")}
          </h3>
          {updatedTime && (
            <span className="font-jetbrains text-[11px] text-v2-text-tertiary">
              {t("updatedTime", { time: updatedTime })}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-v2-silver-light">
              <th className="text-left px-5 py-3.5 font-vietnam font-bold text-[14px] tracking-normal text-v2-silver-dark border-x border-white/30 first:border-l-0">
                {t("silverType")}
              </th>
              <th className="text-right px-5 py-3.5 font-jetbrains font-black text-[15px] uppercase tracking-[1px] text-v2-silver-dark border-x border-white/30">
                <div>{t("buy")}</div>
                <div className="font-normal text-[10px] tracking-normal opacity-70">{t("buyUnit")}</div>
              </th>
              <th className="text-right px-5 py-3.5 font-jetbrains font-black text-[15px] uppercase tracking-[1px] text-v2-silver-dark border-x border-white/30 last:border-r-0">
                <div>{t("sell")}</div>
                <div className="font-normal text-[10px] tracking-normal opacity-70">{t("sellUnit")}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((item, index) => (
              <tr
                key={item.code}
                className={`border-b border-v2-border-light ${index % 2 === 0 ? "bg-white" : "bg-v2-bg-surface-tint"}`}
              >
                <td className="px-5 py-3 font-vietnam font-bold text-[14px] text-v2-silver-dark border-x border-v2-border-light first:border-l-0">
                  {item.name || item.code}
                </td>
                <td className="px-5 py-3 text-right font-vietnam text-[12px] text-v2-text-secondary border-x border-v2-border-light">
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
                <td className="px-5 py-3 text-right font-vietnam text-[12px] text-v2-text-secondary border-x border-v2-border-light last:border-r-0">
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
            {types.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-5 py-8 text-center font-vietnam text-[13px] text-v2-text-tertiary"
                >
                  {t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </BaseCard>
  );
}
