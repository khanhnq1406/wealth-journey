"use client";

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

  const formatAmount = (amount: number) => {
    const sign = amount >= 0 ? "+" : "";
    return `${sign}${new Intl.NumberFormat("vi-VN").format(amount)}`;
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(2)}%`;
  };

  const metrics = [
    { label: t("pnlToday"), value: todayPnl, percent: todayPnlPercent },
    { label: t("pnl7d"), value: weekPnl, percent: weekPnlPercent },
    { label: t("pnl30d"), value: monthPnl, percent: monthPnlPercent },
  ];

  return (
    <div className="bg-white rounded-[20px] border border-v2-border-light shadow-v2-card overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-sora font-semibold text-[16px] text-v2-text-primary">
            {t("pnlTitle")}
          </h3>
          {/* Period tabs */}
          <div className="flex gap-1 bg-v2-bg-primary rounded-xl p-1">
            {periods.map((period) => (
              <button
                key={period.key}
                onClick={() => setSelectedPeriod(period.key)}
                className={`px-3 py-1.5 rounded-[10px] text-[12px] font-sora font-medium transition-colors ${
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
                  className={`font-ibm-mono font-bold text-[16px] ${
                    isPositive ? "text-v2-green-positive" : "text-v2-red-negative"
                  }`}
                >
                  {formatPercent(metric.percent)}
                </p>
                <p className="font-ibm-mono font-medium text-[12px] text-v2-text-secondary mt-0.5">
                  {formatAmount(metric.value)} {currency}
                </p>
                <p className="font-ibm-mono font-medium text-[11px] text-v2-text-tertiary tracking-[1px] mt-1">
                  {metric.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart placeholder */}
      <div className="px-5 pb-5">
        <div className="h-[200px] bg-v2-bg-surface-tint rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-v2-gold-light flex items-center justify-center mx-auto mb-2">
              <svg
                className="w-6 h-6 text-v2-gold-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </div>
            <p className="font-sora text-[13px] text-v2-text-tertiary">
              {t("comingSoon")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
