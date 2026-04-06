"use client";

import { useTranslations } from "next-intl";
import { TrendingUp, TrendingDown, Share2 } from "lucide-react";
import Image from "next/image";

const textShadow = "0 1px 3px rgba(0,0,0,0.5), 0 0 8px rgba(0,0,0,0.25)";
const textShadowLg = "0 2px 8px rgba(0,0,0,0.5), 0 0 16px rgba(0,0,0,0.3)";

const goldGradient =
  "linear-gradient(135deg, #B8862D 0%, #D4A843 20%, #F5D38E 40%, #E8C36A 55%, #D4A843 70%, #B8862D 85%, #9A7023 100%)";

const lightEffect =
  "radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 40%, transparent 70%)";

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
  onShareClick?: () => void;
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
        isPositive ? "bg-green-500/15" : "bg-red-400/15"
      }`}
    >
      <p
        className="font-roboto font-bold text-[14px] text-v2-text-tertiary"
        style={{ textShadow }}
      >
        {formatAmount(amount)} {currency}
      </p>
      <p
        className={`font-roboto font-bold text-[14px] ${isPositive ? "text-green-400" : "text-red-400"}`}
        style={{ textShadow }}
      >
        {formatPercent(percent)}
      </p>
      <p
        className="font-roboto font-medium text-[11px] text-v2-text-tertiary/60 tracking-[1px] mt-1"
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
  onShareClick,
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

  // Share button shared between mobile and desktop
  const shareButton = onShareClick ? (
    <button
      type="button"
      onClick={onShareClick}
      aria-label={t("sharePnl.buttonAriaLabel")}
      className="absolute bottom-3 right-3 z-20 sm:top-3 sm:bottom-auto flex items-center justify-center min-h-[44px] min-w-[44px] w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 transition-colors focus-visible:ring-2 focus-visible:ring-v2-gold-primary cursor-pointer"
    >
      <Share2 size={18} className="text-v2-text-tertiary" />
    </button>
  ) : null;

  // PnL bar shared between mobile and desktop
  const pnlBar = (
    <div className="relative z-10 flex items-center justify-between px-5 py-3 bg-v2-maroon-900/15">
      <div className="flex items-center gap-2">
        {isMonthPositive ? (
          <TrendingUp size={16} className="text-v2-text-tertiary/70" />
        ) : (
          <TrendingDown size={16} className="text-v2-text-tertiary/70" />
        )}
        <span
          className="font-roboto font-bold text-[15px] text-v2-text-tertiary"
          style={{ textShadow }}
        >
          {formatAmount(monthPnl)} {currency}
        </span>
      </div>
      <span
        className={`font-roboto font-bold text-[13px] px-3 py-1 rounded-full ${
          isMonthPositive
            ? "bg-green-500/15 text-green-400"
            : "bg-red-400/15 text-red-400"
        }`}
        style={{ textShadow }}
      >
        {formatPercent(monthPnlPercent)}
      </span>
    </div>
  );

  return (
    <div className="relative z-0 isolate">
      {/* Mobile version — gold gradient card with transparent dragon */}
      <div
        data-pnl-card
        className="sm:hidden relative overflow-hidden rounded-2xl"
        style={{
          background: goldGradient,
          boxShadow:
            "0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
        }}
      >
        {/* Gradient light effect overlay */}
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: lightEffect }}
          aria-hidden="true"
        />

        {/* Dragon watermark — right side */}
        <div className="absolute z-[2] right-4 pointer-events-none h-full">
          <Image
            src="/sjc3d.webp"
            alt="sjc"
            width={300}
            height={110}
            className="object-contain w-full h-full opacity-80"
            aria-hidden="true"
            priority
          />
        </div>

        {/* Dark transparent overlay to highlight text */}
        <div
          className="absolute inset-0 z-[3]"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.05) 100%)",
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 p-5 pb-0">
          <p
            className="font-roboto font-medium text-v2-text-tertiary text-[15px]"
            style={{ textShadow }}
          >
            {greeting}
            {userName ? `, ${userName}` : ""}
          </p>
          <p
            className="font-roboto font-semibold text-[11px] tracking-[2px] text-v2-text-tertiary mt-3"
            style={{ textShadow }}
          >
            {t("totalNetWorthLabel")}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <p
              className="font-roboto font-extrabold text-[32px] tracking-[-1.5px] text-v2-text-tertiary"
              style={{ textShadow: textShadowLg }}
            >
              {formatAmount(totalNetWorth)}
            </p>
            <span
              className="font-roboto text-[13px] font-bold text-v2-text-tertiary"
              style={{ textShadow }}
            >
              {currency}
            </span>
          </div>
        </div>

        <div className="mt-3">{pnlBar}</div>
        {shareButton}
      </div>

      {/* Desktop version — gold gradient card with transparent dragon */}
      <div
        data-pnl-card
        className="hidden sm:block relative overflow-hidden rounded-2xl"
        style={{
          background: goldGradient,
          boxShadow:
            "0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
        }}
      >
        {/* Gradient light effect overlay */}
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: lightEffect }}
          aria-hidden="true"
        />

        {/* Dragon watermark — right side */}
        <div className="absolute top-1/2 -translate-y-1/2 z-[2] pointer-events-none opacity-80 w-full">
          <Image
            src="/sjc3d.webp"
            alt="sjc"
            width={320}
            height={130}
            className="object-contain h-32 w-full"
            aria-hidden="true"
            priority
          />
        </div>

        {/* Dark transparent overlay to highlight text */}
        <div
          className="absolute inset-0 z-[3]"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.05) 100%)",
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center justify-between p-6">
          <div>
            <p
              className="font-roboto font-semibold text-[11px] tracking-[2px] text-v2-text-tertiary/70"
              style={{ textShadow }}
            >
              {t("totalNetWorthLabel")}
            </p>
            <div className="flex items-baseline gap-3 mt-1">
              <p
                className="font-roboto font-bold text-[42px] tracking-[-1.5px] text-v2-text-tertiary"
                style={{ textShadow: textShadowLg }}
              >
                {formatAmount(totalNetWorth)}
              </p>
              <span
                className="font-roboto text-[15px] font-bold text-v2-text-tertiary/70"
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
        {shareButton}
      </div>
    </div>
  );
}
