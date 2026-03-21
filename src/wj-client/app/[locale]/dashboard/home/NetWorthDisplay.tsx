"use client";

import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown } from "lucide-react";
import Image from "next/image";

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

// PnL Value component - defined outside to prevent re-renders
interface PnlValueProps {
  percent: number;
  amount: number;
  label: string;
  currency: string;
}

function PnlValue({ percent, amount, label, currency }: PnlValueProps) {
  const isPositive = percent >= 0;
  const formatAmount = (value: number) => {
    return new Intl.NumberFormat("vi-VN").format(Number(value));
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="text-center">
      <p
        className={`font-roboto font-bold text-[14px] ${isPositive ? "text-emerald-700" : "text-red-800"}`}
      >
        {formatAmount(amount)} {currency}
      </p>
      <p
        className={`font-roboto font-bold text-[14px] ${isPositive ? "text-emerald-700" : "text-red-800"}`}
      >
        {formatPercent(percent)}
      </p>
      <p className="font-roboto font-medium text-[11px] text-[#8B6914] tracking-[1px] mt-1">
        {label}
      </p>
    </div>
  );
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

  const isMonthPositive = monthPnlPercent >= 0;

  return (
    <div>
      {/* Mobile version — gold gradient card with dragon watermark */}
      <div
        className="sm:hidden relative overflow-hidden rounded-2xl p-5 pb-4"
        style={{
          background:
            "linear-gradient(135deg, #F5D38E 0%, #D4A245 30%, #C5923A 60%, #B8862D 100%)",
          boxShadow:
            "0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* Dragon watermark background */}
        <div className="absolute top-0 right-0 w-[65%] h-full pointer-events-none opacity-40">
          <Image
            src="/dragon-watermark.svg"
            alt=""
            fill
            className="object-cover object-right"
            aria-hidden="true"
            priority
          />
        </div>

        {/* Content layer */}
        <div className="relative z-10">
          <p className="font-roboto font-medium text-[#5C3D0E] text-[15px]">
            {greeting}
            {userName ? `, ${userName}` : ""}
          </p>
          <p className="font-roboto font-semibold text-[11px] tracking-[2px] text-[#8B6914] mt-3">
            {t("totalNetWorthLabel")}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="font-roboto font-extrabold text-[32px] tracking-[-1.5px] text-[#3D2600]">
              {formatAmount(totalNetWorth)}
            </p>
            <span className="font-roboto text-[13px] font-bold text-[#5C3D0E]">
              {currency}
            </span>
          </div>
          {monthPnlPercent !== 0 && (
            <div
              className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-[13px] font-roboto font-bold ${
                isMonthPositive
                  ? "bg-emerald-900/20 text-emerald-800"
                  : "bg-red-900/20 text-red-900"
              }`}
              style={{
                backdropFilter: "blur(4px)",
              }}
            >
              {isMonthPositive ? (
                <TrendingUp size={15} />
              ) : (
                <TrendingDown size={15} />
              )}
              {formatPercent(monthPnlPercent)} 30D
            </div>
          )}
        </div>
      </div>

      {/* Desktop version — gold gradient card with dragon watermark */}
      <div
        className="hidden sm:block relative overflow-hidden rounded-2xl p-6"
        style={{
          background:
            "linear-gradient(135deg, #F5D38E 0%, #D4A245 30%, #C5923A 60%, #B8862D 100%)",
          boxShadow:
            "0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* Dragon watermark background */}
        <div className="absolute top-0 right-0 w-[50%] h-full pointer-events-none opacity-40">
          <Image
            src="/dragon-watermark.svg"
            alt=""
            fill
            className="object-cover object-right"
            aria-hidden="true"
            priority
          />
        </div>

        {/* Content layer */}
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="font-roboto font-semibold text-[11px] tracking-[2px] text-[#8B6914]">
              {t("totalNetWorthLabel")}
            </p>
            <div className="flex items-baseline gap-3 mt-1">
              <p className="font-roboto font-bold text-[42px] tracking-[-1.5px] text-[#3D2600]">
                {formatAmount(totalNetWorth)}
              </p>
              <span className="font-roboto text-[15px] font-bold text-[#5C3D0E]">
                {currency}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <PnlValue
              percent={todayPnlPercent}
              amount={todayPnl}
              label={t("pnlToday")}
              currency={currency}
            />
            <PnlValue
              percent={weekPnlPercent}
              amount={weekPnl}
              label={t("pnl7d")}
              currency={currency}
            />
            <PnlValue
              percent={monthPnlPercent}
              amount={monthPnl}
              label={t("pnl30d")}
              currency={currency}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
