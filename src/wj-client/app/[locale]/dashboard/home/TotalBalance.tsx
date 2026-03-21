"use client";

import { ButtonType, resources } from "@/app/constants";
import { BaseCard } from "@/components/BaseCard";
import { Button } from "@/components/Button";
import { TotalBalanceSkeleton } from "@/components/loading/Skeleton";
import { formatCurrency, getCurrencySymbol } from "@/utils/currency-formatter";
import { useQueryGetTotalBalance } from "@/utils/generated/hooks";
import { memo, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils/cn";

const displayImgList = [`${resources}/unhide.svg`, `${resources}/hide.svg`];

export const TotalBalance = memo(function TotalBalance() {
  const t = useTranslations("dashboard.home");
  const [isHide, setHide] = useState(false);
  const [displayImg, setDisplayImg] = useState(displayImgList[0]);
  const { currency } = useCurrency();

  const getTotalBalance = useQueryGetTotalBalance({});

  const balanceData = useMemo(() => {
    const netWorth =
      getTotalBalance.data?.displayNetWorth?.amount ||
      getTotalBalance.data?.netWorth?.amount ||
      0;
    const totalCash =
      getTotalBalance.data?.displayValue?.amount ||
      getTotalBalance.data?.data?.amount ||
      0;
    const totalInvestments =
      getTotalBalance.data?.displayTotalInvestments?.amount || 0;
    const displayCurrency = getTotalBalance.data?.displayCurrency || currency;

    return {
      netWorth: formatCurrency(netWorth, displayCurrency),
      totalCash: formatCurrency(totalCash, displayCurrency),
      totalInvestments: formatCurrency(totalInvestments, displayCurrency),
      displayCurrency,
    };
  }, [getTotalBalance.data, currency]);

  const handleHideBalance = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setHide(!isHide);
    setDisplayImg(displayImgList[Number(!isHide)]);
  };

  if (getTotalBalance.isLoading) {
    return (
      <div className="py-5">
        <BaseCard>
          <TotalBalanceSkeleton />
        </BaseCard>
      </div>
    );
  }

  const displayBalance = getTotalBalance.error
    ? `0 ${getCurrencySymbol(currency)}`
    : balanceData.netWorth;

  return (
    <div>
      <BaseCard className="mt-2 sm:mt-3 lg:mt-4">
        <div className="flex items-center justify-between py-5 flex-wrap px-5">
          <div className="flex-1">
            <div className="text-v2-text-secondary font-semibold mb-2">
              {t("totalNetWorth")}
            </div>
            <div className="font-bold text-2xl break-all mb-3 text-v2-gold-accent">
              {isHide ? "*****" : displayBalance}
            </div>
            {!isHide && (
              <div className="flex justify-between text-sm text-v2-text-tertiary mt-2">
                <span>{t("cashLabel", { amount: balanceData.totalCash })}</span>
                <span>{t("investmentsLabel", { amount: balanceData.totalInvestments })}</span>
              </div>
            )}
          </div>
          <div>
            <Button
              className={cn(
                "!p-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center",
                "transition-colors duration-200",
              )}
              variant="ghost"
              onClick={handleHideBalance}
            >
              {isHide ? (
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
                  className="w-6 h-6"
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
            </Button>
          </div>
        </div>
      </BaseCard>
    </div>
  );
});
