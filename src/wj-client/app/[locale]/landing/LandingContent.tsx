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
import { OrnateDivider } from "@/components/decorative/OrnateDivider";

export function LandingContent() {
  return (
    <LandingErrorBoundary>
      <div className="landing-scroll-container min-h-screen bg-v2-bg-primary">
        <LandingNavbar />
        <main id="main-content" className="pt-14 sm:pt-16">
          {/* Mobile Layout */}
          <div className="sm:hidden px-4 py-4 pb-8 space-y-6">
            <LandingGoldPriceTable />
            <LandingGoldPriceChart />
            <SentimentCard variant="landing" asset="gold" />
            <OrnateDivider variant="ornate" className="my-6" />
            <LandingSilverPriceTable />
            <LandingSilverPriceChart />
            <SentimentCard variant="landing" asset="silver" />
            <OrnateDivider variant="ornate" className="my-6" />
            <LandingCurrencyPriceTable />
            <LandingDollarIndexChart />
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:block px-8 py-6 space-y-6">
            {/* Row 1: Gold Table + Gold Chart */}
            <div className="grid grid-cols-2 gap-6 [&>*]:!mb-0">
              <LandingGoldPriceTable />
              <LandingGoldPriceChart />
            </div>
            {/* Gold Sentiment Survey */}
            <SentimentCard variant="landing" asset="gold" />
            <OrnateDivider variant="ornate" className="my-6" />
            {/* Row 2: Silver Table + Silver Chart */}
            <div className="grid grid-cols-2 gap-6 [&>*]:!mb-0">
              <LandingSilverPriceTable />
              <LandingSilverPriceChart />
            </div>
            {/* Silver Sentiment Survey */}
            <SentimentCard variant="landing" asset="silver" />
            <OrnateDivider variant="ornate" className="my-6" />
            {/* Row 3: Currency Table + Dollar Index Chart */}
            <div className="grid grid-cols-2 gap-6 [&>*]:!mb-0">
              <LandingCurrencyPriceTable />
              <LandingDollarIndexChart />
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    </LandingErrorBoundary>
  );
}
