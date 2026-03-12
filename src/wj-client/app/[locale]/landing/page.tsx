"use client";

import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingErrorBoundary from "@/components/landing/LandingErrorBoundary";
import { LandingGoldPriceTable } from "@/components/landing/LandingGoldPriceTable";
import { LandingGoldPriceChart } from "@/components/landing/LandingGoldPriceChart";
import { LandingSilverPriceTable } from "@/components/landing/LandingSilverPriceTable";
import { LandingSilverPriceChart } from "@/components/landing/LandingSilverPriceChart";
import { usePublicMarketTypes } from "@/features/market-prices/hooks/usePublicMarketTypes";
import { formatUpdateTimestamp } from "@/features/market-prices/utils/format-update-time";
import { useTranslations } from "next-intl";

export default function LandingPage() {
  const { data, isLoading, isError, refetch } = usePublicMarketTypes();
  const t = useTranslations("landing.priceTeaser");

  const goldTypes = data?.gold ?? [];
  const silverTypes = data?.silver ?? [];

  // Update timestamps from API
  const goldUpdatedTime = data?.goldUpdatedAt
    ? formatUpdateTimestamp(data.goldUpdatedAt)
    : undefined;
  const silverUpdatedTime = data?.silverUpdatedAt
    ? formatUpdateTimestamp(data.silverUpdatedAt)
    : undefined;

  return (
    <LandingErrorBoundary>
      <div className="landing-scroll-container min-h-screen bg-neutral-50">
        <LandingNavbar />
        <main id="main-content" className="pt-14 sm:pt-16">
          {/* Error state */}
          {isError && (
            <div className="px-4 sm:px-8 py-8 text-center">
              <p className="font-vietnam text-v2-text-secondary mb-3">
                {t("errorLoadingTypes")}
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-v2-red-primary text-white rounded-lg font-vietnam text-[13px] hover:bg-v2-red-dark transition-colors"
              >
                {t("retry")}
              </button>
            </div>
          )}

          {/* Mobile Layout */}
          <div className="sm:hidden px-4 py-4 pb-24 space-y-6">
            <LandingGoldPriceTable types={goldTypes} isLoading={isLoading} updatedTime={goldUpdatedTime} />
            <LandingGoldPriceChart />
            <LandingSilverPriceTable types={silverTypes} isLoading={isLoading} updatedTime={silverUpdatedTime} />
            <LandingSilverPriceChart />
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:block px-8 py-6 space-y-6">
            {/* Row 1: Gold Table + Gold Chart */}
            <div className="grid grid-cols-2 gap-6 [&>*]:!mb-0">
              <LandingGoldPriceTable types={goldTypes} isLoading={isLoading} updatedTime={goldUpdatedTime} />
              <LandingGoldPriceChart />
            </div>
            {/* Row 2: Silver Table + Silver Chart */}
            <div className="grid grid-cols-2 gap-6 [&>*]:!mb-0">
              <LandingSilverPriceTable
                types={silverTypes}
                isLoading={isLoading}
                updatedTime={silverUpdatedTime}
              />
              <LandingSilverPriceChart />
            </div>
          </div>
        </main>
      </div>
    </LandingErrorBoundary>
  );
}
