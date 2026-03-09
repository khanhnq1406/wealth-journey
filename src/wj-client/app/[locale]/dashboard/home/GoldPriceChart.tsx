"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatPriceValue } from "../prices/helpers";
import { LineChart } from "@/components/charts/LineChart";
import { useQueryGetGoldChart } from "@/utils/generated/hooks";
import type { PriceItem } from "@/gen/protobuf/v1/investment";

interface GoldPriceChartProps {
  prices: PriceItem[];
}

// Map period tab keys to API period strings
const PERIOD_MAP: Record<string, string> = {
  "24h": "24h",
  week: "15d",
  month: "1m",
  year: "1y",
};

// Map gold type codes to goldCode API param
function toGoldCode(typeCode: string): string {
  if (!typeCode) return "SJC";
  if (typeCode.startsWith("999")) return "999";
  // XAU and global types — signals global market
  if (typeCode === "XAU") return "XAU";
  return "SJC";
}

// Format timestamp for X-axis display
function formatXAxis(timestamp: number, period: string): string {
  const d = new Date(timestamp * 1000);
  if (period === "24h") {
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("vi-VN", { month: "2-digit", day: "2-digit" });
}

export function GoldPriceChart({ prices }: GoldPriceChartProps) {
  const t = useTranslations("dashboard.home");
  const [selectedType, setSelectedType] = useState<string>(prices[0]?.typeCode || "");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("24h");

  const periods = [
    { key: "24h", label: t("period.24h") },
    { key: "week", label: t("period.week") },
    { key: "month", label: t("period.month") },
    { key: "year", label: t("period.year") },
  ];

  const selectedPrice = prices.find((p) => p.typeCode === selectedType) || prices[0];

  // Determine market based on selected type
  const isGlobal = selectedType === "XAU";
  const market = isGlobal ? "global" : "domestic";
  const goldCode = isGlobal ? "" : toGoldCode(selectedType);
  const apiPeriod = PERIOD_MAP[selectedPeriod] || "24h";

  const { data, isLoading, isError, refetch } = useQueryGetGoldChart({
    market,
    goldCode,
    period: apiPeriod,
  }, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Build chart data
  const chartData = (data?.data || []).map((point) => ({
    time: formatXAxis(point.timestamp, selectedPeriod),
    buy: point.buy,
    sell: point.sell,
  }));

  // Y-axis formatter
  const yFormatter = (value: number) =>
    isGlobal
      ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : `₫${(value / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}K`;

  // Chart series: domestic shows buy+sell, global shows single price line
  const chartSeries = isGlobal
    ? [{ dataKey: "buy", name: t("price"), color: "#B8860B", chartType: "area" as const, showDots: false }]
    : [
        { dataKey: "buy", name: t("buy"), color: "#B91C1C", chartType: "area" as const, showDots: false },
        { dataKey: "sell", name: t("sell"), color: "#16A34A", chartType: "area" as const, showDots: false },
      ];

  return (
    <div className="bg-white rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("goldChartTitle")}
          </h3>
          <div className="flex items-center gap-2">
            {/* Market toggle: only show if XAU type is in prices */}
            {prices.some((p) => p.typeCode === "XAU") && (
              <div className="flex bg-v2-bg-primary rounded-lg p-0.5">
                <button
                  onClick={() => setSelectedType(prices.find((p) => p.typeCode !== "XAU")?.typeCode || "")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-vietnam font-medium transition-colors ${
                    !isGlobal ? "bg-white shadow-sm text-v2-text-primary" : "text-v2-text-secondary"
                  }`}
                >
                  {t("domestic")}
                </button>
                <button
                  onClick={() => setSelectedType("XAU")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-vietnam font-medium transition-colors ${
                    isGlobal ? "bg-white shadow-sm text-v2-text-primary" : "text-v2-text-secondary"
                  }`}
                >
                  {t("global")}
                </button>
              </div>
            )}
            {/* Gold type selector — domestic only */}
            {!isGlobal && prices.filter((p) => p.typeCode !== "XAU").length > 0 && (
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="font-vietnam text-[12px] text-v2-text-secondary bg-v2-bg-primary border border-v2-border rounded-lg px-2.5 py-1.5"
              >
                {prices
                  .filter((p) => p.typeCode !== "XAU")
                  .map((p) => (
                    <option key={p.typeCode} value={p.typeCode}>
                      {p.name || p.typeCode}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>

        {/* Current prices row */}
        {selectedPrice && (
          <div className="flex items-center gap-6 mt-3">
            {!isGlobal && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-v2-red-primary" />
                  <span className="font-jetbrains text-[12px] text-v2-text-secondary">{t("buy")}</span>
                  <span className="font-jetbrains font-semibold text-[13px] text-v2-text-primary">
                    {formatPriceValue(selectedPrice.buy, selectedPrice.currency || "VND")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-v2-green-positive" />
                  <span className="font-jetbrains text-[12px] text-v2-text-secondary">{t("sell")}</span>
                  <span className="font-jetbrains font-semibold text-[13px] text-v2-text-primary">
                    {formatPriceValue(selectedPrice.sell, selectedPrice.currency || "VND")}
                  </span>
                </div>
              </>
            )}
            {isGlobal && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#B8860B]" />
                <span className="font-jetbrains text-[12px] text-v2-text-secondary">{t("price")}</span>
                <span className="font-jetbrains font-semibold text-[13px] text-v2-text-primary">
                  {formatPriceValue(selectedPrice.buy, "USD")}
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
              <p className="font-vietnam text-[12px] text-v2-text-tertiary">{t("loading")}</p>
            </div>
          </div>
        )}
        {isError && (
          <div className="h-[200px] bg-v2-bg-surface-tint rounded-xl flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <p className="font-vietnam text-[13px] text-v2-text-secondary">{t("errorLoading")}</p>
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
            <p className="font-vietnam text-[13px] text-v2-text-tertiary">{t("noData")}</p>
          </div>
        )}
        {!isLoading && !isError && chartData.length > 0 && (
          <LineChart
            data={chartData}
            series={chartSeries}
            xAxisKey="time"
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
