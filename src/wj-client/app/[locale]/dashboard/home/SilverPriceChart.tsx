"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatPriceValue } from "../prices/helpers";
import { LineChart } from "@/components/charts/LineChart";
import { BaseCard } from "@/components/BaseCard";
import { Select } from "@/components/select/Select";
import type { SelectOption } from "@/components/select/Select";
import { useQueryGetSilverChart } from "@/utils/generated/hooks";
import { formatCurrencyCompact } from "@/utils/currency-formatter";
import type { PriceItem } from "@/gen/protobuf/v1/investment";

interface SilverPriceChartProps {
  prices: PriceItem[];
}

// Map period tab keys to days for API
const DAYS_MAP: Record<string, number> = {
  "24h": 1,
  week: 7,
  month: 30,
  year: 365,
};

// Format timestamp for X-axis display based on period
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

export function SilverPriceChart({ prices }: SilverPriceChartProps) {
  const t = useTranslations("dashboard.home");
  const [selectedType, setSelectedType] = useState<string>(
    prices[0]?.typeCode || "",
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string>("24h");
  const [market, setMarket] = useState<"domestic" | "global">("domestic");
  const [silverUnit, setSilverUnit] = useState<"C" | "L" | "KG">("L");

  const periods = [
    { key: "24h", label: t("period.24h") },
    { key: "week", label: t("period.week") },
    { key: "month", label: t("period.month") },
    { key: "year", label: t("period.year") },
  ];

  const unitOptions = [
    { key: "C" as const, label: t("unitC") },
    { key: "L" as const, label: t("unitL") },
    { key: "KG" as const, label: t("unitKG") },
  ];

  const selectedPrice =
    prices.find((p) => p.typeCode === selectedType) || prices[0];
  const days = DAYS_MAP[selectedPeriod] || 7;
  const isGlobal = market === "global";
  const currency = isGlobal ? "USD" : selectedPrice?.currency || "VND";

  const { data, isLoading, isError, refetch } = useQueryGetSilverChart(
    {
      market,
      type: isGlobal ? "" : silverUnit,
      days,
    },
    {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  // Build chart data
  const chartData = (data?.data || []).map((point) => ({
    time: formatXAxis(point.timestamp, selectedPeriod),
    buy: point.buy,
    sell: point.sell,
  }));

  // Y-axis formatter — chart values are raw major-unit prices (not smallest unit),
  // so multiply USD by 100 to match formatCurrencyCompact's cents expectation.
  const yFormatter = (value: number) =>
    isGlobal
      ? formatCurrencyCompact(value * 100, "USD")
      : formatCurrencyCompact(value, "VND");

  // Chart series
  const chartSeries = isGlobal
    ? [
        {
          dataKey: "buy",
          name: t("price"),
          color: "#8B929E",
          chartType: "line" as const,
          showDots: false,
        },
      ]
    : [
        {
          dataKey: "buy",
          name: t("buy"),
          color: "#4B5563",
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

  // Suppress unused variable warning — selectedType is kept for future type selector support
  void selectedType;
  void currency;

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden"
    >
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("silverChartTitle")}
          </h3>
          <div className="flex items-center gap-2">
            {/* Market toggle */}
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
            {/* Unit type selector — domestic only */}
            {!isGlobal && (
              <Select<"C" | "L" | "KG">
                options={unitOptions.map((u): SelectOption<"C" | "L" | "KG"> => ({
                  value: u.key,
                  label: u.label,
                }))}
                value={silverUnit}
                onChange={setSilverUnit}
                disableInput
                clearable={false}
                className="w-24"
              />
            )}
          </div>
        </div>

        {/* Current prices row */}
        {selectedPrice && (
          <div className="flex items-center gap-6 mt-3">
            {!isGlobal && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#4B5563]" />
                  <span className="font-jetbrains text-[12px] text-v2-text-secondary">
                    {t("buy")}
                  </span>
                  <span className="font-jetbrains font-semibold text-[13px] text-v2-text-primary">
                    {formatPriceValue(
                      selectedPrice.buy,
                      selectedPrice.currency || "VND",
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-v2-green-positive" />
                  <span className="font-jetbrains text-[12px] text-v2-text-secondary">
                    {t("sell")}
                  </span>
                  <span className="font-jetbrains font-semibold text-[13px] text-v2-text-primary">
                    {formatPriceValue(
                      selectedPrice.sell,
                      selectedPrice.currency || "VND",
                    )}
                  </span>
                </div>
              </>
            )}
            {isGlobal && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#8B929E]" />
                <span className="font-jetbrains text-[12px] text-v2-text-secondary">
                  {t("price")}
                </span>
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
                  ? "bg-v2-silver-dark text-white"
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
              <div className="w-5 h-5 border-2 border-[#4B5563] border-t-transparent rounded-full animate-spin" />
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
                className="px-3 py-1 text-[12px] font-vietnam text-[#4B5563] border border-[#4B5563] rounded-lg"
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
    </BaseCard>
  );
}
