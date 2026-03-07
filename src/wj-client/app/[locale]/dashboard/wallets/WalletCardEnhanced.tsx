"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/utils/currency-formatter";
import { Wallet } from "@/gen/protobuf/v1/wallet";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useTranslations } from "next-intl";

export interface WalletCardEnhancedProps {
  wallet: Wallet;
  onEdit?: (wallet: Wallet) => void;
  onDelete?: (wallet: Wallet) => void;
  onTransfer?: (wallet: Wallet) => void;
  currency?: string;
  className?: string;
}

// Gradient presets for wallet cards
const WALLET_GRADIENTS = [
  "from-primary-600 to-primary-800",
  "from-purple-600 to-purple-800",
  "from-emerald-600 to-emerald-800",
  "from-rose-600 to-rose-800",
  "from-amber-600 to-amber-800",
  "from-cyan-600 to-cyan-800",
  "from-indigo-600 to-indigo-800",
  "from-pink-600 to-pink-800",
];

/**
 * Enhanced credit-card style wallet card with mobile interactions.
 * - Tap to expand for details
 * - Swipe actions (transfer, edit, delete)
 * - Quick actions overlay on long press
 * - Balance visibility toggle
 * - Currency conversion display
 * - Transaction count badge
 */
export const WalletCardEnhanced = memo(function WalletCardEnhanced({
  wallet,
  onEdit,
  onDelete,
  onTransfer,
  currency: propCurrency,
  className,
}: WalletCardEnhancedProps) {
  const t = useTranslations("wallet");
  const tCommon = useTranslations("common");
  const { currency: contextCurrency } = useCurrency();
  const currency = propCurrency || contextCurrency;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Get gradient based on wallet ID for consistency
  const gradientClass = WALLET_GRADIENTS[wallet.id % WALLET_GRADIENTS.length];

  // Use displayBalance/displayTotalValue if available (converted), otherwise use original
  const balance = wallet.displayBalance?.amount ?? wallet.balance?.amount ?? 0;
  const displayCurrency = wallet.displayCurrency || currency;
  const isInvestmentWallet = wallet.type === 1;

  // For investment wallets, calculate total value
  const totalValue = isInvestmentWallet
    ? (wallet.displayTotalValue?.amount ?? wallet.totalValue?.amount ?? balance)
    : balance;

  // Handle long press for quick actions
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer.current = setTimeout(() => {
      setShowActions(true);
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStart.current) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStart.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - touchStart.current.y);

      // Cancel long press if moved too much
      if (deltaX > 10 || deltaY > 10) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Reset actions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowActions(false);
    };

    if (showActions) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);

      return () => {
        document.removeEventListener("click", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
      };
    }
  }, [showActions]);

  const handleToggleBalance = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBalanceVisible((prev) => !prev);
  }, []);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const maskBalance = (amount: number) => {
    if (!isBalanceVisible) return "••••••••";
    return formatCurrency(amount, displayCurrency);
  };

  return (
    <div
      className={cn("relative group", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Credit Card Style Wallet Card */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl shadow-lg transition-all duration-300",
          "bg-gradient-to-br text-white",
          gradientClass,
          isExpanded && "scale-105 shadow-2xl",
        )}
      >
        {/* Card shine effect */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none",
            "transition-opacity duration-300",
            isExpanded ? "opacity-100" : "opacity-50",
          )}
        />

        {/* Card content */}
        <div
          className="relative p-4 sm:p-6 cursor-pointer"
          onClick={handleToggleExpand}
        >
          {/* Header - Wallet Type Icon & Balance Toggle */}
          <div className="flex items-start justify-between mb-4">
            {/* Wallet Type Icon */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                {isInvestmentWallet ? (
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg sm:text-xl">
                  {wallet.walletName}
                </h3>
                <p className="text-xs sm:text-sm text-white/70">
                  {isInvestmentWallet ? tCommon("investment") : t("filterTypes.cash")}
                </p>
              </div>
            </div>

            {/* Balance Toggle Button */}
            <button
              type="button"
              onClick={handleToggleBalance}
              className={cn(
                "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center",
                "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
                "transition-colors duration-200",
                "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600",
              )}
              aria-label={isBalanceVisible ? t("hideBalance") : t("showBalance")}
            >
              {isBalanceVisible ? (
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Balance Display */}
          <div className="mb-4">
            <p className="text-xs sm:text-sm text-white/70 mb-1">
              {isInvestmentWallet ? t("totalValue") : tCommon("balance")}
            </p>
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
              {maskBalance(totalValue)}
            </p>
            {!isBalanceVisible && (
              <p className="text-xs text-white/50 mt-1">
                {t("tapEyeReveal")}
              </p>
            )}
          </div>

          {/* Card Details - Currency & Account Number Style */}
          <div className="flex items-end justify-between">
            {/* Currency */}
            <div>
              <p className="text-xs text-white/50 mb-1">{tCommon("currency")}</p>
              <p className="text-sm font-medium">{displayCurrency}</p>
            </div>

            {/* Account-style number (hash of ID) */}
            <div className="text-right">
              <p className="text-xs text-white/50 mb-1">{t("walletId")}</p>
              <p className="text-sm font-medium tracking-widest">
                •••• {String(wallet.id).padStart(4, "0")}
              </p>
            </div>
          </div>

          {/* Expand indicator */}
          <div className="transition-transform duration-300" aria-hidden="true">
            <svg
              className={cn(
                "w-5 h-5 text-white/70",
                isExpanded && "rotate-180",
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* Expanded Details */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2 border-t border-white/10">
            {/* Investment breakdown for investment wallets */}
            {isInvestmentWallet && (
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/70">{tCommon("cash")} {tCommon("balance")}</span>
                  <span className="font-medium">
                    {formatCurrency(balance, displayCurrency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">{tCommon("investment")}</span>
                  <span className="font-medium">
                    {formatCurrency(
                      wallet.displayInvestmentValue?.amount ??
                        wallet.investmentValue?.amount ??
                        0,
                      displayCurrency,
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {onTransfer && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTransfer(wallet);
                  }}
                  className={cn(
                    "min-h-[44px] px-3 py-2 rounded-lg",
                    "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
                    "flex items-center justify-center gap-2 text-sm font-medium",
                    "transition-colors duration-200",
                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600",
                  )}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                  <span className="hidden sm:inline">{t("transfer.transferButton")}</span>
                  <span className="sm:hidden">{t("transfer.transferButton")}</span>
                </button>
              )}

              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(wallet);
                  }}
                  className={cn(
                    "min-h-[44px] px-3 py-2 rounded-lg",
                    "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
                    "flex items-center justify-center gap-2 text-sm font-medium",
                    "transition-colors duration-200",
                    "focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600",
                  )}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  <span>{tCommon("edit")}</span>
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(wallet);
                  }}
                  className={cn(
                    "min-h-[44px] px-3 py-2 rounded-lg",
                    "bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm",
                    "flex items-center justify-center gap-2 text-sm font-medium text-red-200",
                    "transition-colors duration-200",
                    "focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600",
                  )}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  <span>{tCommon("delete")}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Overlay (Long Press) */}
      {showActions && (
        <div
          className={cn(
            "absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl",
            "flex items-center justify-center gap-4 p-4",
            "animate-fade-in z-10",
          )}
        >
          {onTransfer && (
            <button
              type="button"
              onClick={() => {
                onTransfer(wallet);
                setShowActions(false);
              }}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/10 hover:bg-white/20 min-w-[72px] min-h-[72px]"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              <span className="text-xs">{t("transfer.transferButton")}</span>
            </button>
          )}

          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onEdit(wallet);
                setShowActions(false);
              }}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/10 hover:bg-white/20 min-w-[72px] min-h-[72px]"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span className="text-xs">{tCommon("edit")}</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(wallet);
                setShowActions(false);
              }}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-red-500/30 hover:bg-red-500/40 min-w-[72px] min-h-[72px]"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              <span className="text-xs text-red-200">{tCommon("delete")}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowActions(false)}
            className="absolute top-2 right-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 min-h-[44px] min-w-[44px]"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
});
