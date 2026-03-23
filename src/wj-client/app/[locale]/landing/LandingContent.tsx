"use client";

import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingErrorBoundary from "@/components/landing/LandingErrorBoundary";
import { LandingGoldPriceTable } from "@/components/landing/LandingGoldPriceTable";
import { LandingGoldPriceChart } from "@/components/landing/LandingGoldPriceChart";
import { LandingSilverPriceTable } from "@/components/landing/LandingSilverPriceTable";
import { LandingSilverPriceChart } from "@/components/landing/LandingSilverPriceChart";
import { LandingCurrencyPriceTable } from "@/components/landing/LandingCurrencyPriceTable";
import { LandingDollarIndexChart } from "@/components/landing/LandingDollarIndexChart";
import LandingFooter from "@/components/landing/LandingFooter";
import { SentimentCard } from "@/components/GoldSentimentCard";
import {
  usePublicMarketTypes,
  PublicMarketTypesResponse,
} from "@/features/market-prices/hooks/usePublicMarketTypes";
import { formatUpdateTimestamp } from "@/features/market-prices/utils/format-update-time";
import { useTranslations } from "next-intl";
import { OrnateDivider } from "@/components/decorative/OrnateDivider";

interface LandingContentProps {
  initialData: PublicMarketTypesResponse | null;
}

export function LandingContent({ initialData }: LandingContentProps) {
  const { data, isLoading, isError, refetch } = usePublicMarketTypes();
  const t = useTranslations("landing.priceTeaser");

  // Use client-side data if available, otherwise fall back to SSR initial data
  const effectiveData = data ?? initialData;

  const goldTypes = effectiveData?.gold ?? [];
  const silverTypes = effectiveData?.silver ?? [];
  const currencyTypes = effectiveData?.currency ?? [];

  // Update timestamps from API
  const goldUpdatedTime = effectiveData?.goldUpdatedAt
    ? formatUpdateTimestamp(effectiveData.goldUpdatedAt)
    : undefined;
  const silverUpdatedTime = effectiveData?.silverUpdatedAt
    ? formatUpdateTimestamp(effectiveData.silverUpdatedAt)
    : undefined;
  const currencyUpdatedTime = effectiveData?.currencyUpdatedAt
    ? formatUpdateTimestamp(effectiveData.currencyUpdatedAt)
    : undefined;

  // Show loading only if no data at all (neither SSR nor client)
  const showLoading = isLoading && !effectiveData;

  return (
    <LandingErrorBoundary>
      <div className="landing-scroll-container min-h-screen bg-v2-bg-primary">
        <LandingNavbar />
        <main id="main-content" className="pt-14 sm:pt-16">
          {/* Error state */}
          {isError && !effectiveData && (
            <div className="px-4 sm:px-8 py-8 text-center">
              <p className="font-roboto text-v2-text-secondary mb-3">
                {t("errorLoadingTypes")}
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-v2-red-primary text-white rounded-lg font-roboto text-[13px] hover:bg-v2-red-dark transition-colors"
              >
                {t("retry")}
              </button>
            </div>
          )}

          {/* Mobile Layout */}
          <div className="sm:hidden px-4 py-4 pb-8 space-y-6">
            <LandingGoldPriceTable
              types={goldTypes}
              isLoading={showLoading}
              updatedTime={goldUpdatedTime}
            />
            <LandingGoldPriceChart />
            <SentimentCard variant="landing" asset="gold" />
            <OrnateDivider variant="ornate" className="my-6" />
            <LandingSilverPriceTable
              types={silverTypes}
              isLoading={showLoading}
              updatedTime={silverUpdatedTime}
            />
            <LandingSilverPriceChart />
            <SentimentCard variant="landing" asset="silver" />
            <OrnateDivider variant="ornate" className="my-6" />
            <LandingCurrencyPriceTable
              types={currencyTypes}
              isLoading={showLoading}
              updatedTime={currencyUpdatedTime}
            />
            <LandingDollarIndexChart />
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:block px-8 py-6 space-y-6">
            {/* Row 1: Gold Table + Gold Chart */}
            <div className="grid grid-cols-2 gap-6 [&>*]:!mb-0">
              <LandingGoldPriceTable
                types={goldTypes}
                isLoading={showLoading}
                updatedTime={goldUpdatedTime}
              />
              <LandingGoldPriceChart />
            </div>
            {/* Gold Sentiment Survey */}
            <SentimentCard variant="landing" asset="gold" />
            <OrnateDivider variant="ornate" className="my-6" />
            {/* Row 2: Silver Table + Silver Chart */}
            <div className="grid grid-cols-2 gap-6 [&>*]:!mb-0">
              <LandingSilverPriceTable
                types={silverTypes}
                isLoading={showLoading}
                updatedTime={silverUpdatedTime}
              />
              <LandingSilverPriceChart />
            </div>
            {/* Silver Sentiment Survey */}
            <SentimentCard variant="landing" asset="silver" />
            <OrnateDivider variant="ornate" className="my-6" />
            {/* Row 3: Currency Table + Dollar Index Chart */}
            <div className="grid grid-cols-2 gap-6 [&>*]:!mb-0">
              <LandingCurrencyPriceTable
                types={currencyTypes}
                isLoading={showLoading}
                updatedTime={currencyUpdatedTime}
              />
              <LandingDollarIndexChart />
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </LandingErrorBoundary>
  );
}
