"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatPriceValue } from "../prices/helpers";
import type { PriceItem } from "@/gen/protobuf/v1/investment";

interface SilverPriceChartProps {
  prices: PriceItem[];
}

export function SilverPriceChart({ prices }: SilverPriceChartProps) {
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

  return (
    <div className="bg-white rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden">
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-sora font-semibold text-[16px] text-v2-text-primary">
            {t("silverChartTitle")}
          </h3>
          {prices.length > 0 && (
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="font-sora text-[13px] text-v2-text-secondary bg-v2-bg-primary border border-v2-border rounded-lg px-3 py-1.5"
            >
              {prices.map((p) => (
                <option key={p.typeCode} value={p.typeCode}>
                  {p.name || p.typeCode}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedPrice && (
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#4B5563]" />
              <span className="font-ibm-mono text-[12px] text-v2-text-secondary">{t("buy")}</span>
              <span className="font-ibm-mono font-semibold text-[13px] text-v2-text-primary">
                {formatPriceValue(selectedPrice.buy, selectedPrice.currency || "VND")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-v2-green-positive" />
              <span className="font-ibm-mono text-[12px] text-v2-text-secondary">{t("sell")}</span>
              <span className="font-ibm-mono font-semibold text-[13px] text-v2-text-primary">
                {formatPriceValue(selectedPrice.sell, selectedPrice.currency || "VND")}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-1 mt-4">
          {periods.map((period) => (
            <button
              key={period.key}
              onClick={() => setSelectedPeriod(period.key)}
              className={`px-4 py-1.5 rounded-[10px] text-[12px] font-sora font-medium transition-colors ${
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

      <div className="px-5 pb-5">
        <div className="h-[200px] bg-v2-bg-surface-tint rounded-xl flex items-center justify-center">
          <p className="font-sora text-[13px] text-v2-text-tertiary">{t("comingSoon")}</p>
        </div>
      </div>
    </div>
  );
}
