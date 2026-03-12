"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BaseCard } from "@/components/BaseCard";

export function LandingSilverPriceChart() {
  const t = useTranslations("landing.priceTeaser");

  const periods = [
    "period24h",
    "periodWeek",
    "periodMonth",
    "periodYear",
  ] as const;

  // Silver unit selector options (C = chỉ, L = lượng, KG = kilogram)
  const unitLabels = ["C", "L", "KG"] as const;

  return (
    <BaseCard padding="none" className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden h-full">
      <div className="p-5 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("silverChartTitle")}
          </h3>
        </div>

        {/* Market toggle — disabled */}
        <div className="flex items-center gap-2 mb-3 opacity-50 pointer-events-none">
          <div className="flex items-center bg-v2-bg-surface-tint rounded-lg p-0.5">
            <button className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white shadow-sm text-v2-silver-dark">
              {t("domesticMarket")}
            </button>
            <button className="px-2.5 py-1 rounded-md text-[11px] font-medium text-v2-text-secondary">
              {t("globalMarket")}
            </button>
          </div>
          {/* Unit selector placeholder */}
          <div className="flex items-center bg-v2-bg-surface-tint rounded-lg p-0.5">
            {unitLabels.map((label, i) => (
              <button
                key={label}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
                  i === 0
                    ? "bg-white shadow-sm text-v2-silver-dark"
                    : "text-v2-text-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Period tabs — disabled */}
        <div className="flex items-center gap-1 mb-4 opacity-50 pointer-events-none">
          {periods.map((period, i) => (
            <button
              key={period}
              className={`px-4 py-1.5 rounded-[10px] text-[12px] font-medium ${
                i === 0
                  ? "bg-v2-silver-dark text-white"
                  : "bg-v2-bg-surface-tint text-v2-text-secondary"
              }`}
            >
              {t(period)}
            </button>
          ))}
        </div>

        {/* Chart area — axes only + login prompt */}
        <div className="relative flex-1 min-h-[200px] sm:min-h-[120px]">
          {/* SVG axes */}
          <svg
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Y axis */}
            <line
              x1="40"
              y1="3%"
              x2="40"
              y2="95%"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            {/* X axis */}
            <line
              x1="40"
              y1="95%"
              x2="100%"
              y2="95%"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            {/* Grid lines (horizontal) */}
            {[0, 1, 2].map((i) => {
              const y = `${3 + i * 31}%`;
              return (
                <line
                  key={i}
                  x1="40"
                  y1={y}
                  x2="100%"
                  y2={y}
                  stroke="#f3f4f6"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              );
            })}
          </svg>

          {/* Login overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Link
              href="/auth/login"
              className="px-6 py-3 bg-v2-silver-dark text-white font-vietnam font-semibold text-[14px] rounded-xl hover:opacity-80 transition-opacity shadow-lg"
            >
              {t("chartLoginPrompt")}
            </Link>
          </div>
        </div>
      </div>
    </BaseCard>
  );
}
