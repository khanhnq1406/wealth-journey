"use client";

import { useTranslations, useLocale } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { TradingViewChart } from "@/components/charts/TradingViewChart";

export function LandingGoldPriceChart() {
  const t = useTranslations("landing.priceTeaser");
  const locale = useLocale();

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden h-full flex flex-col"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-2">
        <h3 className="font-roboto font-semibold text-[16px] text-v2-text-primary">
          {t("goldChartTitle")}
        </h3>
      </div>

      {/* TradingView Chart — fully interactive, no login wall */}
      <div className="px-2 pb-2 flex-1 min-h-[430px]">
        <TradingViewChart
          symbol="TVC:GOLD"
          locale={locale}
          theme="dark"
          allowSymbolChange={false}
        />
      </div>
    </BaseCard>
  );
}
