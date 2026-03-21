"use client";

import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown } from "lucide-react";
import Image from "next/image";

const textShadow = "0 1px 3px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.2)";
const textShadowLg = "0 2px 6px rgba(0,0,0,0.5), 0 0 12px rgba(0,0,0,0.25)";

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
    <div
      className={`text-center rounded-xl px-4 py-2 ${
        isPositive ? "bg-green-500/20" : "bg-red-500/20"
      }`}
    >
      <p
        className={`font-roboto font-bold text-[14px] ${isPositive ? "text-v2-text-tertiary" : "text-v2-text-tertiary"}`}
        style={{ textShadow }}
      >
        {formatAmount(amount)} {currency}
      </p>
      <p
        className={`font-roboto font-bold text-[14px] ${isPositive ? "text-v2-text-tertiary" : "text-v2-text-tertiary"}`}
        style={{ textShadow }}
      >
        {formatPercent(percent)}
      </p>
      <p
        className="font-roboto font-medium text-[11px] text-white/70 tracking-[1px] mt-1"
        style={{ textShadow }}
      >
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

  // PnL bar shared between mobile and desktop
  const pnlBar = monthPnlPercent !== 0 && (
    <div className="relative z-10 flex items-center justify-between px-5 py-3 bg-black/20">
      <div className="flex items-center gap-2">
        {isMonthPositive ? (
          <TrendingUp size={16} className="text-white/80" />
        ) : (
          <TrendingDown size={16} className="text-white/80" />
        )}
        <span
          className={`font-roboto font-bold text-[15px] ${
            isMonthPositive ? "text-v2-text-tertiary" : "text-v2-text-tertiary"
          }`}
          style={{ textShadow }}
        >
          {formatAmount(monthPnl)} {currency}
        </span>
      </div>
      <span
        className={`font-roboto font-bold text-[13px] px-3 py-1 rounded-full ${
          isMonthPositive
            ? "bg-green-500/20 text-v2-text-tertiary"
            : "bg-red-500/20 text-v2-text-tertiary"
        }`}
        style={{ textShadow }}
      >
        {formatPercent(monthPnlPercent)}
      </span>
    </div>
  );

  return (
    <div>
      {/* Mobile version — SJC gold bar card with embossed dragon */}
      <div
        className="sm:hidden relative overflow-hidden rounded-2xl"
        style={{
          boxShadow:
            "0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
        }}
      >
        <Image
          src="/dragon-gold-mobile-flat.webp"
          alt=""
          fill
          className="object-cover"
          aria-hidden="true"
          priority
        />

        <div className="relative z-10 p-5 pb-0">
          <p
            className="font-roboto font-medium text-white text-[15px]"
            style={{ textShadow }}
          >
            {greeting}
            {userName ? `, ${userName}` : ""}
          </p>
          <p
            className="font-roboto font-semibold text-[11px] tracking-[2px] text-white/80 mt-3"
            style={{ textShadow }}
          >
            {t("totalNetWorthLabel")}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <p
              className="font-roboto font-extrabold text-[32px] tracking-[-1.5px] text-white"
              style={{ textShadow: textShadowLg }}
            >
              {formatAmount(totalNetWorth)}
            </p>
            <span
              className="font-roboto text-[13px] font-bold text-white/80"
              style={{ textShadow }}
            >
              {currency}
            </span>
          </div>
        </div>

        <div className="mt-3">{pnlBar}</div>
      </div>

      {/* Desktop version — SJC gold bar card with embossed dragon */}
      <div
        className="hidden sm:block relative overflow-hidden rounded-2xl"
        style={{
          boxShadow:
            "0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
        }}
      >
        <Image
          src="/dragon-gold-mobile-flat.webp"
          alt=""
          fill
          className="object-cover"
          aria-hidden="true"
          priority
        />

        <div className="relative z-10 flex items-center justify-between p-6">
          <div>
            <p
              className="font-roboto font-semibold text-[11px] tracking-[2px] text-white/80"
              style={{ textShadow }}
            >
              {t("totalNetWorthLabel")}
            </p>
            <div className="flex items-baseline gap-3 mt-1">
              <p
                className="font-roboto font-bold text-[42px] tracking-[-1.5px] text-white"
                style={{ textShadow: textShadowLg }}
              >
                {formatAmount(totalNetWorth)}
              </p>
              <span
                className="font-roboto text-[15px] font-bold text-white/80"
                style={{ textShadow }}
              >
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
