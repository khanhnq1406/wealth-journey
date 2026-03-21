"use client";

import { LineChart } from "@/components/charts/LineChart";
import { BaseCard } from "@/components/BaseCard";
import {
  useQueryGetHistoricalPortfolioValues,
  useQueryGetAggregatedPortfolioSummary,
} from "@/utils/generated/hooks";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { PnlPeriod } from "@/gen/protobuf/v1/investment";
import { parseAmount } from "@/utils/currency-formatter";
import Link from "next/link";
import { routes } from "@/app/constants";

interface PNLCardProps {
  currency: string;
}

type PeriodKey = "1d" | "1w" | "1m" | "all";

const PERIOD_TO_ENUM: Record<PeriodKey, PnlPeriod> = {
  "1d": PnlPeriod.PNL_PERIOD_1D,
  "1w": PnlPeriod.PNL_PERIOD_1W,
  "1m": PnlPeriod.PNL_PERIOD_1M,
  all: PnlPeriod.PNL_PERIOD_ALL,
};

const PERIOD_TO_CHART_DAYS: Record<PeriodKey, number> = {
  "1d": 1,
  "1w": 7,
  "1m": 30,
  all: 90,
};

export function PNLCard({ currency }: PNLCardProps) {
  const t = useTranslations("dashboard.home");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("1m");

  const periods: { key: PeriodKey; label: string }[] = [
    { key: "1d", label: t("1day") },
    { key: "1w", label: t("1week") },
    { key: "1m", label: t("1month") },
    { key: "all", label: t("allTime") },
  ];

  const periodEnum = PERIOD_TO_ENUM[selectedPeriod];
  const chartDays = PERIOD_TO_CHART_DAYS[selectedPeriod];

  const { data: summaryData } = useQueryGetAggregatedPortfolioSummary(
    { walletId: 0, typeFilter: 0, period: periodEnum },
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false },
  );

  const { data: histData, isLoading: histLoading } =
    useQueryGetHistoricalPortfolioValues(
      {
        walletId: 0,
        typeFilter: 0,
        days: chartDays,
        points: Math.min(chartDays, 30),
      },
      { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false },
    );

  const periodPnl = parseAmount(summaryData?.data?.periodPnl);
  const periodPnlPercent = Number(summaryData?.data?.periodPnlPercent ?? 0);
  const isApproximate = summaryData?.data?.periodPnlApproximate === true;

  const chartPoints = (histData?.data || []).map((point) => ({
    date: new Date(Number(point.timestamp) * 1000).toLocaleDateString("vi-VN", {
      month: "2-digit",
      day: "2-digit",
    }),
    value: parseAmount(point.displayTotalValue?.amount ?? point.totalValue),
  }));

  const firstValue = chartPoints[0]?.value ?? 0;
  const lastValue = chartPoints[chartPoints.length - 1]?.value ?? 0;
  const chartColor = lastValue >= firstValue ? "#16A34A" : "#DC2626";

  const yFormatter = (value: number) =>
    `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}M`;

  const formatAmount = (amount: number) => {
    const value = Number(amount);
    const sign = value >= 0 ? "+" : "";
    return `${sign}${new Intl.NumberFormat("vi-VN").format(value)}`;
  };

  const formatPercent = (percent: number) => {
    const value = Number(percent);
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const pnlLabelKey: Record<PeriodKey, string> = {
    "1d": "pnl1d",
    "1w": "pnl1w",
    "1m": "pnl1m",
    all: "pnlAll",
  };

  const isPositive = periodPnl >= 0;

  return (
    <BaseCard
      padding="none"
      noMobileMargin
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-roboto font-semibold text-[16px] text-v2-text-primary">
            {t("pnlTitle")}
          </h3>
          {/* Period tabs */}
          <div className="flex gap-1 bg-v2-bg-primary rounded-xl p-1">
            {periods.map((period) => (
              <button
                key={period.key}
                onClick={() => setSelectedPeriod(period.key)}
                className={`px-3 py-1.5 rounded-[10px] text-[12px] font-roboto font-medium transition-colors ${
                  selectedPeriod === period.key
                    ? "bg-v2-red-primary text-white"
                    : "text-v2-text-secondary hover:text-v2-text-primary"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* PnL display */}
        <div className="mt-4">
          <p
            className={`font-roboto font-bold text-[24px] ${
              isPositive ? "text-v2-green-positive" : "text-v2-red-negative"
            }`}
          >
            {formatAmount(periodPnl)} {currency}
          </p>
          <p
            className={`font-roboto font-bold text-[24px] ${
              isPositive ? "text-v2-green-positive" : "text-v2-red-negative"
            }`}
          >
            {formatPercent(periodPnlPercent)}
          </p>
          <p className="font-roboto font-medium text-[11px] text-v2-text-tertiary tracking-[1px] mt-1">
            {t(pnlLabelKey[selectedPeriod] as any)}
          </p>
          {isApproximate && selectedPeriod !== "all" && (
            <p className="font-roboto text-[10px] text-v2-text-tertiary mt-1">
              {t("pnlApproximate")}
            </p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-5">
        {histLoading && (
          <div className="h-[200px] bg-v2-bg-surface-tint rounded-xl flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-v2-red-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!histLoading && chartPoints.length === 0 && (
          <div className="h-[200px] bg-v2-bg-surface-tint rounded-xl flex flex-col items-center justify-center gap-3">
            <p className="font-roboto text-[13px] text-v2-text-tertiary text-center px-4">
              {t("pnlNoData")}
            </p>
            <Link
              href={routes.portfolio}
              className="font-roboto text-[13px] font-medium text-v2-red-primary underline underline-offset-2"
            >
              {t("pnlGoToPortfolio")}
            </Link>
          </div>
        )}
        {!histLoading && chartPoints.length > 0 && (
          <LineChart
            data={chartPoints}
            series={[
              {
                dataKey: "value",
                name: "Portfolio",
                color: chartColor,
                chartType: "area",
                showDots: false,
              },
            ]}
            xAxisKey="date"
            height={200}
            showGrid={true}
            showLegend={false}
            showTooltip={true}
            yAxisFormatter={yFormatter}
            animate={true}
            gridColor="rgba(241, 189, 97, 0.1)"
          />
        )}
      </div>
    </BaseCard>
  );
}
