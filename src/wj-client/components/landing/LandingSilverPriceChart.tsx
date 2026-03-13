"use client";

import { useTranslations, useLocale } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { TradingViewChart } from "@/components/charts/TradingViewChart";

export function LandingSilverPriceChart() {
  const t = useTranslations("landing.priceTeaser");
  const locale = useLocale();

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden h-full"
    >
      <div className="p-5 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("silverChartTitle")}
          </h3>
        </div>

        {/* TradingView Chart — fully interactive, no login wall */}
        <div className="flex-1 min-h-[300px]">
          <TradingViewChart
            symbol="TVC:SILVER"
            height={350}
            locale={locale}
            theme="light"
            allowSymbolChange={false}
          />
        </div>
      </div>
    </BaseCard>
  );
}
