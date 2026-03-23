"use client";

import { useTranslations, useLocale } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { TradingViewChart } from "@/components/charts/TradingViewChart";

export function SilverPriceChart() {
  const t = useTranslations("dashboard.home");
  const locale = useLocale();

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden h-full flex flex-col"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-2">
        <h3 className="font-roboto font-semibold text-[16px] text-v2-text-primary">
          {t("silverChartTitle")}
        </h3>
      </div>

      {/* TradingView Chart */}
      <div className="px-2 pb-2 flex-1 min-h-[500px]">
        <TradingViewChart
          symbol="TVC:SILVER"
          locale={locale}
          theme="dark"
        />
      </div>
    </BaseCard>
  );
}
