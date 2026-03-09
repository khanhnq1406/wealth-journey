"use client";

import { LineChart } from "@/components/charts/LineChart";
import { useQueryGetHistoricalPortfolioValues } from "@/utils/generated/hooks";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface PNLCardProps {
  todayPnl?: number;
  todayPnlPercent?: number;
  weekPnl?: number;
  weekPnlPercent?: number;
  monthPnl?: number;
  monthPnlPercent?: number;
  currency: string;
}

export function PNLCard({
  todayPnl = 0,
  todayPnlPercent = 0,
  weekPnl = 0,
  weekPnlPercent = 0,
  monthPnl = 0,
  monthPnlPercent = 0,
  currency,
}: PNLCardProps) {
  const t = useTranslations("dashboard.home");
  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "90d">(
    "30d",
  );

  const periods = [
    { key: "7d" as const, label: t("7days") },
    { key: "30d" as const, label: t("30days") },
  ];

  const periodDays = selectedPeriod === "7d" ? 7 : 30;
  const periodPoints = selectedPeriod === "7d" ? 7 : 30;

  const { data: histData, isLoading: histLoading } = useQueryGetHistoricalPortfolioValues(
    { walletId: 0, typeFilter: 0, days: periodDays, points: periodPoints },
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  const chartPoints = (histData?.data || []).map((point) => ({
    date: new Date(Number(point.timestamp) * 1000).toLocaleDateString("vi-VN", {
      month: "2-digit",
      day: "2-digit",
    }),
    value: Number(point.totalValue) / 100,
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

  const metrics = [
    { label: t("pnlToday"), value: Number(todayPnl), percent: Number(todayPnlPercent) },
    { label: t("pnl7d"), value: Number(weekPnl), percent: Number(weekPnlPercent) },
    { label: t("pnl30d"), value: Number(monthPnl), percent: Number(monthPnlPercent) },
  ];

  return (
    <div className="bg-white rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("pnlTitle")}
          </h3>
          {/* Period tabs */}
          <div className="flex gap-1 bg-v2-bg-primary rounded-xl p-1">
            {periods.map((period) => (
              <button
                key={period.key}
                onClick={() => setSelectedPeriod(period.key)}
                className={`px-3 py-1.5 rounded-[10px] text-[12px] font-vietnam font-medium transition-colors ${
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

        {/* Metrics row */}
        <div className="flex items-center gap-6 mt-4">
          {metrics.map((metric) => {
            const isPositive = metric.value >= 0;
            return (
              <div key={metric.label}>
                <p
                  className={`font-jetbrains font-bold text-[16px] ${
                    isPositive ? "text-v2-green-positive" : "text-v2-red-negative"
                  }`}
                >
                  {formatPercent(metric.percent)}
                </p>
                <p className="font-jetbrains font-medium text-[12px] text-v2-text-secondary mt-0.5">
                  {formatAmount(metric.value)} {currency}
                </p>
                <p className="font-jetbrains font-medium text-[11px] text-v2-text-tertiary tracking-[1px] mt-1">
                  {metric.label}
                </p>
              </div>
            );
          })}
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
          <div className="h-[200px] bg-v2-bg-surface-tint rounded-xl flex items-center justify-center">
            <p className="font-vietnam text-[13px] text-v2-text-tertiary">{t("comingSoon")}</p>
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
            gridColor="#f3f4f6"
          />
        )}
      </div>
    </div>
  );
}
