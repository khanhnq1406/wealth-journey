"use client";

import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown } from "lucide-react";

interface NetWorthDisplayProps {
  totalNetWorth: number;
  currency: string;
  todayPnlPercent?: number;
  todayPnl?: number;
  weekPnlPercent?: number;
  weekPnl?: number;
  monthPnlPercent?: number;
  monthPnl?: number;
  userName?: string;
}

export function NetWorthDisplay({
  totalNetWorth,
  currency,
  todayPnlPercent = 0,
  todayPnl = 0,
  weekPnlPercent = 0,
  weekPnl = 0,
  monthPnlPercent = 0,
  monthPnl = 0,
  userName,
}: NetWorthDisplayProps) {
  const t = useTranslations("dashboard.home");

  // Greeting logic
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greeting.morning");
    if (hour < 18) return t("greeting.afternoon");
    return t("greeting.evening");
  })();

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("vi-VN").format(Number(amount));
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(2)}%`;
  };

  const PnlValue = ({
    percent,
    amount,
    label,
  }: {
    percent: number;
    amount: number;
    label: string;
  }) => {
    const isPositive = percent >= 0;
    return (
      <div className="text-center">
        <p
          className={`font-jetbrains font-bold text-[14px] ${isPositive ? "text-v2-green-positive" : "text-v2-red-negative"}`}
        >
          {formatPercent(percent)}
        </p>
        <p className="font-jetbrains font-medium text-[12px] text-v2-text-secondary">
          {formatAmount(amount)} {currency}
        </p>
        <p className="font-jetbrains font-medium text-[11px] text-v2-text-tertiary tracking-[1px] mt-1">
          {label}
        </p>
      </div>
    );
  };

  return (
    <div>
      {/* Mobile version */}
      <div className="sm:hidden">
        <p className="font-vietnam font-medium text-v2-text-secondary text-[15px]">
          {greeting}
          {userName ? `, ${userName}` : ""}
        </p>
        <p className="font-jetbrains font-semibold text-[11px] tracking-[2px] text-v2-text-tertiary mt-3">
          {t("totalNetWorthLabel")}
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="font-vietnam font-extrabold text-[32px] tracking-[-1.5px] text-v2-text-primary">
            {formatAmount(totalNetWorth)}
          </p>
          <span className="font-jetbrains text-[12px] font-medium text-v2-text-tertiary bg-v2-bg-primary rounded-md px-1.5 py-0.5">
            {currency}
          </span>
        </div>
        {monthPnlPercent !== 0 && (
          <div
            className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-lg text-[12px] font-jetbrains font-medium ${
              monthPnlPercent >= 0
                ? "bg-v2-green-light text-v2-green-positive"
                : "bg-v2-red-light text-v2-red-negative"
            }`}
          >
            {monthPnlPercent >= 0 ? (
              <TrendingUp size={14} />
            ) : (
              <TrendingDown size={14} />
            )}
            {formatPercent(monthPnlPercent)} 30D
          </div>
        )}
      </div>

      {/* Desktop version */}
      <div className="hidden sm:flex items-center justify-between bg-white rounded-[20px] border border-v2-border-light shadow-v2-card p-6">
        <div>
          <p className="font-jetbrains font-semibold text-[11px] tracking-[2px] text-v2-text-tertiary">
            {t("totalNetWorthLabel")}
          </p>
          <div className="flex items-baseline gap-3 mt-1">
            <p className="font-vietnam font-bold text-[42px] tracking-[-1.5px] text-v2-text-primary">
              {formatAmount(totalNetWorth)}
            </p>
            <span className="font-jetbrains text-[14px] font-medium text-v2-text-tertiary">
              {currency}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <PnlValue
            percent={todayPnlPercent}
            amount={todayPnl}
            label={t("pnlToday")}
          />
          <PnlValue
            percent={weekPnlPercent}
            amount={weekPnl}
            label={t("pnl7d")}
          />
          <PnlValue
            percent={monthPnlPercent}
            amount={monthPnl}
            label={t("pnl30d")}
          />
        </div>
      </div>
    </div>
  );
}
