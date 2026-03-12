"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatPriceValue } from "../prices/helpers";
import { LineChart } from "@/components/charts/LineChart";
import { BaseCard } from "@/components/BaseCard";
import { useQueryGetGoldChart } from "@/utils/generated/hooks";
import { formatCurrencyCompact } from "@/utils/currency-formatter";

// Map period tab keys to API period strings
const PERIOD_MAP: Record<string, string> = {
  "24h": "24h",
  week: "15d",
  month: "1M",
  year: "1y",
};

// Format timestamp for X-axis display
function formatXAxis(timestamp: number, period: string): string {
  const d = new Date(timestamp * 1000);
  if (period === "24h") {
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("vi-VN", { month: "2-digit", day: "2-digit" });
}

export function GoldPriceChart() {
  const t = useTranslations("dashboard.home");
  const [market, setMarket] = useState<"domestic" | "global">("domestic");
  const [goldCode, setGoldCode] = useState<string>("SJC");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("24h");

  const periods = [
    { key: "24h", label: t("period.24h") },
    { key: "week", label: t("period.week") },
    { key: "month", label: t("period.month") },
    { key: "year", label: t("period.year") },
  ];

  const isGlobal = market === "global";
  const apiPeriod = PERIOD_MAP[selectedPeriod] || "24h";

  const { data, isLoading, isError, refetch } = useQueryGetGoldChart(
    {
      market,
      goldCode: isGlobal ? "" : goldCode,
      period: apiPeriod,
    },
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  // Build chart data
  const chartPoints = data?.data || [];
  const chartData = chartPoints.map((point) => ({
    time: formatXAxis(point.timestamp, selectedPeriod),
    buy: point.buy,
    sell: point.sell,
  }));

  // Latest data point — drives the current prices row
  const latestPoint = chartPoints[chartPoints.length - 1];

  // Y-axis formatter — chart values are raw major-unit prices (not smallest unit),
  // so multiply USD by 100 to match formatCurrencyCompact's cents expectation.
  const yFormatter = (value: number) =>
    isGlobal
      ? formatCurrencyCompact(value * 100, "USD")
      : formatCurrencyCompact(value, "VND");

  // Chart series: domestic shows buy+sell, global shows single price line
  const chartSeries = isGlobal
    ? [
        {
          dataKey: "buy",
          name: t("price"),
          color: "#B8860B",
          chartType: "line" as const,
          showDots: false,
        },
      ]
    : [
        {
          dataKey: "buy",
          name: t("buy"),
          color: "#B91C1C",
          chartType: "line" as const,
          showDots: false,
        },
        {
          dataKey: "sell",
          name: t("sell"),
          color: "#16A34A",
          chartType: "line" as const,
          showDots: false,
        },
      ];

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("goldChartTitle")}
          </h3>
          <div className="flex items-center gap-2">
            {/* Market toggle — always visible */}
            <div className="flex bg-v2-bg-primary rounded-lg p-0.5">
              <button
                onClick={() => setMarket("domestic")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-vietnam font-medium transition-colors ${
                  !isGlobal
                    ? "bg-white shadow-sm text-v2-text-primary"
                    : "text-v2-text-secondary"
                }`}
              >
                {t("domestic")}
              </button>
              <button
                onClick={() => setMarket("global")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-vietnam font-medium transition-colors ${
                  isGlobal
                    ? "bg-white shadow-sm text-v2-text-primary"
                    : "text-v2-text-secondary"
                }`}
              >
                {t("global")}
              </button>
            </div>
            {/* Gold type toggle — domestic only (SJC or 999) */}
            {!isGlobal && (
              <div className="flex bg-v2-bg-primary rounded-lg p-0.5">
                {[
                  { value: "SJC", label: "SJC" },
                  { value: "999", label: "999" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGoldCode(opt.value)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-vietnam font-medium transition-colors ${
                      goldCode === opt.value
                        ? "bg-white shadow-sm text-v2-text-primary"
                        : "text-v2-text-secondary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Current prices row — latest data point from chart */}
        {latestPoint && (
          <div className="flex items-center gap-6 mt-3">
            {!isGlobal && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-v2-red-primary" />
                  <span className="font-jetbrains text-[12px] text-v2-text-secondary">
                    {t("buy")}
                  </span>
                  <span className="font-jetbrains font-semibold text-[13px] text-v2-text-primary">
                    {formatPriceValue(latestPoint.buy, "VND")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-v2-green-positive" />
                  <span className="font-jetbrains text-[12px] text-v2-text-secondary">
                    {t("sell")}
                  </span>
                  <span className="font-jetbrains font-semibold text-[13px] text-v2-text-primary">
                    {formatPriceValue(latestPoint.sell, "VND")}
                  </span>
                </div>
              </>
            )}
            {isGlobal && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#B8860B]" />
                <span className="font-jetbrains text-[12px] text-v2-text-secondary">
                  {t("price")}
                </span>
                <span className="font-jetbrains font-semibold text-[13px] text-v2-text-primary">
                  {formatPriceValue(latestPoint.buy, "USD")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Period tabs */}
        <div className="flex gap-1 mt-4">
          {periods.map((period) => (
            <button
              key={period.key}
              onClick={() => setSelectedPeriod(period.key)}
              className={`px-4 py-1.5 rounded-[10px] text-[12px] font-vietnam font-medium transition-colors ${
                selectedPeriod === period.key
                  ? "bg-v2-red-primary text-white"
                  : "bg-v2-bg-surface-tint text-v2-text-secondary"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="px-2 pb-5">
        {isLoading && (
          <div className="h-[200px] bg-v2-bg-surface-tint rounded-xl flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-v2-red-primary border-t-transparent rounded-full animate-spin" />
              <p className="font-vietnam text-[12px] text-v2-text-tertiary">
                {t("loading")}
              </p>
            </div>
          </div>
        )}
        {isError && (
          <div className="h-[200px] bg-v2-bg-surface-tint rounded-xl flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <p className="font-vietnam text-[13px] text-v2-text-secondary">
                {t("errorLoading")}
              </p>
              <button
                onClick={() => refetch()}
                className="px-3 py-1 text-[12px] font-vietnam text-v2-red-primary border border-v2-red-primary rounded-lg"
              >
                {t("retry")}
              </button>
            </div>
          </div>
        )}
        {!isLoading && !isError && chartData.length === 0 && (
          <div className="h-[200px] bg-v2-bg-surface-tint rounded-xl flex items-center justify-center">
            <p className="font-vietnam text-[13px] text-v2-text-tertiary">
              {t("noData")}
            </p>
          </div>
        )}
        {!isLoading && !isError && chartData.length > 0 && (
          <LineChart
            data={chartData}
            series={chartSeries}
            xAxisKey="time"
            height={400}
            showGrid={true}
            showLegend={false}
            showTooltip={true}
            yAxisFormatter={yFormatter}
            animate={true}
            gridColor="#f3f4f6"
          />
        )}
      </div>
    </BaseCard>
  );
}
