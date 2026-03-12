"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BaseCard } from "@/components/BaseCard";

export function LandingGoldPriceChart() {
  const t = useTranslations("landing.priceTeaser");

  const periods = [
    "period24h",
    "periodWeek",
    "periodMonth",
    "periodYear",
  ] as const;

  return (
    <BaseCard
      padding="none"
      className="rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-vietnam font-semibold text-[16px] text-v2-text-primary">
            {t("goldChartTitle")}
          </h3>
        </div>

        {/* Market toggle — disabled */}
        <div className="flex items-center gap-2 mb-3 opacity-50 pointer-events-none">
          <div className="flex items-center bg-v2-bg-surface-tint rounded-lg p-0.5">
            <button className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white shadow-sm text-v2-red-primary">
              {t("domesticMarket")}
            </button>
            <button className="px-2.5 py-1 rounded-md text-[11px] font-medium text-v2-text-secondary">
              {t("globalMarket")}
            </button>
          </div>
          {/* Gold code toggle placeholder */}
          <div className="flex items-center bg-v2-bg-surface-tint rounded-lg p-0.5">
            <button className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-white shadow-sm text-v2-text-primary">
              SJC
            </button>
            <button className="px-2.5 py-1 rounded-md text-[11px] font-medium text-v2-text-secondary">
              999
            </button>
          </div>
        </div>

        {/* Period tabs — disabled */}
        <div className="flex items-center gap-1 mb-4 opacity-50 pointer-events-none">
          {periods.map((period, i) => (
            <button
              key={period}
              className={`px-4 py-1.5 rounded-[10px] text-[12px] font-medium ${
                i === 0
                  ? "bg-v2-red-primary text-white"
                  : "bg-v2-bg-surface-tint text-v2-text-secondary"
              }`}
            >
              {t(period)}
            </button>
          ))}
        </div>

        {/* Chart area — axes only + login prompt */}
        <div className="relative" style={{ height: 400 }}>
          {/* SVG axes */}
          <svg
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Y axis */}
            <line
              x1="40"
              y1="10"
              x2="40"
              y2="370"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            {/* X axis */}
            <line
              x1="40"
              y1="370"
              x2="100%"
              y2="370"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            {/* Grid lines (horizontal) */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={i}
                x1="40"
                y1={10 + i * 90}
                x2="100%"
                y2={10 + i * 90}
                stroke="#f3f4f6"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            ))}
          </svg>

          {/* Login overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Link
              href="/auth/login"
              className="px-6 py-3 bg-v2-red-primary text-white font-vietnam font-semibold text-[14px] rounded-xl hover:bg-v2-red-dark transition-colors shadow-lg"
            >
              {t("chartLoginPrompt")}
            </Link>
          </div>
        </div>
      </div>
    </BaseCard>
  );
}
