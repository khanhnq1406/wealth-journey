"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import LandingErrorBoundary from "@/components/landing/LandingErrorBoundary";
import { OrnateHeading } from "@/components/decorative/OrnateHeading";
import { OrnateDivider } from "@/components/decorative/OrnateDivider";
import { GuideTOC } from "./GuideTOC";
import { GuideSection } from "./GuideSection";
import { store } from "@/features/auth/store/store";

// ---------------------------------------------------------------------------
// Section definitions — used for TOC and scroll spy
// ---------------------------------------------------------------------------

interface TocSection {
  id: string;
  label: string;
}

// All section IDs in document order (used by IntersectionObserver)
const ALL_SECTION_IDS = [
  "homepage",
  "net-worth",
  "wallets",
  "price-tables",
  "pnl-tracking",
  "investment",
  "adding-investments",
  "transaction-types",
  "fifo-accounting",
  "gold-silver",
  "price-alerts",
  "community",
  "creating-posts",
  "interactions",
  "sentiment-voting",
];

// ---------------------------------------------------------------------------
// Icon components (inline SVG, no external dependency)
// ---------------------------------------------------------------------------

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-5 h-5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-5 h-5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-5 h-5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function CurrencyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function TrendingIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function GoldIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-4 h-4 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tip card helper
// ---------------------------------------------------------------------------

function TipCard({ tip }: { tip: string }) {
  return (
    <div className="mt-3 p-3 rounded-lg bg-v2-gold-primary/10 border border-v2-border-light">
      <p className="text-sm text-v2-text-secondary">
        <span className="font-semibold text-v2-gold-accent">Tip: </span>
        {tip}
      </p>
    </div>
  );
}

// Ordered list helper
function OrderedSteps({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="list-decimal list-inside space-y-1 mt-2 text-sm text-v2-text-secondary">
      {steps.map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// GuideContent — main client component
// ---------------------------------------------------------------------------

export function GuideContent() {
  const t = useTranslations("guide");

  // Auth state (checked once on mount, mirrors LandingNavbar pattern)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    const authState = store.getState().setAuthReducer.isAuthenticated;
    queueMicrotask(() => setIsAuthenticated(authState ?? false));
  }, []);

  // Scroll-spy active section
  const [activeSection, setActiveSection] = useState<string>("homepage");

  // Ref to avoid stale closure in IntersectionObserver
  const activeSectionRef = useRef(activeSection);
  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  // IntersectionObserver scroll spy
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    const observerOptions: IntersectionObserverInit = {
      threshold: 0.3,
      rootMargin: "-80px 0px -60% 0px",
    };

    ALL_SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        });
      }, observerOptions);

      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, []);

  // Build TOC sections array from translations
  const tocSections: TocSection[] = [
    { id: "homepage", label: t("toc.homepage") },
    { id: "net-worth", label: t("toc.netWorth") },
    { id: "wallets", label: t("toc.wallets") },
    { id: "price-tables", label: t("toc.priceTables") },
    { id: "pnl-tracking", label: t("toc.pnlTracking") },
    { id: "investment", label: t("toc.investment") },
    { id: "adding-investments", label: t("toc.addingInvestments") },
    { id: "transaction-types", label: t("toc.transactionTypes") },
    { id: "fifo-accounting", label: t("toc.fifoAccounting") },
    { id: "gold-silver", label: t("toc.goldSilver") },
    { id: "price-alerts", label: t("toc.priceAlerts") },
    { id: "community", label: t("toc.community") },
    { id: "creating-posts", label: t("toc.creatingPosts") },
    { id: "interactions", label: t("toc.interactions") },
    { id: "sentiment-voting", label: t("toc.sentimentVoting") },
  ];

  return (
    <LandingErrorBoundary>
      <LandingNavbar />

      <main
        id="main-content"
        className="bg-v2-bg-primary min-h-screen pt-16"
      >
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Page header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-v2-gold-accent mb-3">
              <OrnateHeading size="lg">{t("title")}</OrnateHeading>
            </h1>
            <p className="text-v2-text-tertiary text-base sm:text-lg max-w-2xl mx-auto">
              {t("subtitle")}
            </p>
          </div>

          {/* Mobile TOC — horizontal pill bar, hidden on lg+ */}
          <div className="lg:hidden sticky top-14 z-40 bg-v2-bg-primary py-2 -mx-4 px-4 border-b border-v2-border-light mb-6">
            <GuideTOC sections={tocSections} activeSection={activeSection} />
          </div>

          <div className="flex gap-8">
            {/* Desktop sidebar TOC — visible only on lg+ */}
            <aside className="hidden lg:block w-64 shrink-0">
              <GuideTOC sections={tocSections} activeSection={activeSection} />
            </aside>

            {/* Main article content */}
            <article className="flex-1 min-w-0 space-y-10">
              {/* ============================================================
                  HOMEPAGE SECTION
              ============================================================ */}
              <GuideSection
                id="homepage"
                title={t("homepage.title")}
                icon={<HomeIcon />}
                level="h2"
              >
                <p className="text-v2-text-secondary text-sm sm:text-base mb-6">
                  {t("homepage.description")}
                </p>

                <div className="space-y-8">
                  {/* Net Worth */}
                  <GuideSection
                    id="net-worth"
                    title={t("homepage.netWorth.title")}
                    icon={<CurrencyIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm">
                      {t("homepage.netWorth.description")}
                    </p>
                    <TipCard tip={t("homepage.netWorth.tip")} />
                  </GuideSection>

                  {/* Wallets */}
                  <GuideSection
                    id="wallets"
                    title={t("homepage.wallets.title")}
                    icon={<WalletIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm mb-4">
                      {t("homepage.wallets.description")}
                    </p>

                    <div className="space-y-4">
                      <div>
                        <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                          {t("homepage.wallets.createWallet.title")}
                        </h4>
                        <OrderedSteps
                          steps={t.raw(
                            "homepage.wallets.createWallet.steps"
                          ) as string[]}
                        />
                      </div>
                      <div>
                        <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                          {t("homepage.wallets.transferMoney.title")}
                        </h4>
                        <OrderedSteps
                          steps={t.raw(
                            "homepage.wallets.transferMoney.steps"
                          ) as string[]}
                        />
                      </div>
                    </div>
                    <TipCard tip={t("homepage.wallets.tip")} />
                  </GuideSection>

                  {/* Price Tables */}
                  <GuideSection
                    id="price-tables"
                    title={t("homepage.priceTables.title")}
                    icon={<TrendingIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm mb-3">
                      {t("homepage.priceTables.description")}
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-v2-text-secondary">
                      <li>{t("homepage.priceTables.goldTable")}</li>
                      <li>{t("homepage.priceTables.silverTable")}</li>
                      <li>{t("homepage.priceTables.currencyTable")}</li>
                      <li>{t("homepage.priceTables.staleIndicator")}</li>
                    </ul>
                    <TipCard tip={t("homepage.priceTables.tip")} />
                  </GuideSection>

                  {/* PNL Tracking */}
                  <GuideSection
                    id="pnl-tracking"
                    title={t("homepage.pnlTracking.title")}
                    icon={<ChartIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm mb-3">
                      {t("homepage.pnlTracking.description")}
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-v2-text-secondary">
                      <li>{t("homepage.pnlTracking.unrealized")}</li>
                      <li>{t("homepage.pnlTracking.realized")}</li>
                    </ul>
                    <TipCard tip={t("homepage.pnlTracking.tip")} />
                  </GuideSection>
                </div>
              </GuideSection>

              {/* ============================================================
                  INVESTMENT SECTION
              ============================================================ */}
              <GuideSection
                id="investment"
                title={t("investment.title")}
                icon={<ChartIcon />}
                level="h2"
              >
                <p className="text-v2-text-secondary text-sm sm:text-base mb-6">
                  {t("investment.description")}
                </p>

                <div className="space-y-8">
                  {/* Adding Investments */}
                  <GuideSection
                    id="adding-investments"
                    title={t("investment.addingInvestments.title")}
                    icon={<PlusIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm mb-3">
                      {t("investment.addingInvestments.description")}
                    </p>
                    <OrderedSteps
                      steps={t.raw(
                        "investment.addingInvestments.steps"
                      ) as string[]}
                    />

                    <div className="mt-4 space-y-3">
                      <div>
                        <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                          {t("investment.addingInvestments.symbolSearch.title")}
                        </h4>
                        <p className="text-v2-text-secondary text-sm">
                          {t(
                            "investment.addingInvestments.symbolSearch.description"
                          )}
                        </p>
                        <TipCard
                          tip={t(
                            "investment.addingInvestments.symbolSearch.tip"
                          )}
                        />
                      </div>
                      <div>
                        <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                          {t(
                            "investment.addingInvestments.customInvestments.title"
                          )}
                        </h4>
                        <p className="text-v2-text-secondary text-sm">
                          {t(
                            "investment.addingInvestments.customInvestments.description"
                          )}
                        </p>
                        <TipCard
                          tip={t(
                            "investment.addingInvestments.customInvestments.tip"
                          )}
                        />
                      </div>
                    </div>
                  </GuideSection>

                  {/* Transaction Types */}
                  <GuideSection
                    id="transaction-types"
                    title={t("investment.transactionTypes.title")}
                    icon={<TagIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm mb-3">
                      {t("investment.transactionTypes.description")}
                    </p>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-v2-bg-surface border border-v2-border-light">
                        <h4 className="text-v2-green-positive font-medium text-sm mb-1">
                          {t("investment.transactionTypes.buy.title")}
                        </h4>
                        <p className="text-v2-text-secondary text-sm">
                          {t("investment.transactionTypes.buy.description")}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-v2-bg-surface border border-v2-border-light">
                        <h4 className="text-v2-red-negative font-medium text-sm mb-1">
                          {t("investment.transactionTypes.sell.title")}
                        </h4>
                        <p className="text-v2-text-secondary text-sm">
                          {t("investment.transactionTypes.sell.description")}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-v2-bg-surface border border-v2-border-light">
                        <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                          {t("investment.transactionTypes.dividend.title")}
                        </h4>
                        <p className="text-v2-text-secondary text-sm">
                          {t(
                            "investment.transactionTypes.dividend.description"
                          )}
                        </p>
                      </div>
                    </div>
                    <TipCard tip={t("investment.transactionTypes.tip")} />
                  </GuideSection>

                  {/* FIFO Accounting */}
                  <GuideSection
                    id="fifo-accounting"
                    title={t("investment.fifoAccounting.title")}
                    icon={<BarChartIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm mb-3">
                      {t("investment.fifoAccounting.description")}
                    </p>

                    <div className="p-3 rounded-lg bg-v2-bg-surface border border-v2-border-light mb-3">
                      <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                        {t("investment.fifoAccounting.example.title")}
                      </h4>
                      <p className="text-v2-text-secondary text-sm">
                        {t("investment.fifoAccounting.example.description")}
                      </p>
                    </div>

                    <ul className="list-disc list-inside space-y-1 text-sm text-v2-text-secondary">
                      {(
                        t.raw("investment.fifoAccounting.benefits") as string[]
                      ).map((benefit, i) => (
                        <li key={i}>{benefit}</li>
                      ))}
                    </ul>
                  </GuideSection>

                  {/* Gold & Silver */}
                  <GuideSection
                    id="gold-silver"
                    title={t("investment.goldSilver.title")}
                    icon={<GoldIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm mb-3">
                      {t("investment.goldSilver.description")}
                    </p>
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-v2-bg-surface border border-v2-border-light">
                        <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                          {t("investment.goldSilver.goldVnd.title")}
                        </h4>
                        <p className="text-v2-text-secondary text-sm">
                          {t("investment.goldSilver.goldVnd.description")}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-v2-bg-surface border border-v2-border-light">
                        <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                          {t("investment.goldSilver.goldUsd.title")}
                        </h4>
                        <p className="text-v2-text-secondary text-sm">
                          {t("investment.goldSilver.goldUsd.description")}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-v2-bg-surface border border-v2-border-light">
                        <h4 className="text-v2-silver-primary font-medium text-sm mb-1">
                          {t("investment.goldSilver.silverVnd.title")}
                        </h4>
                        <p className="text-v2-text-secondary text-sm">
                          {t("investment.goldSilver.silverVnd.description")}
                        </p>
                      </div>
                    </div>
                    <TipCard tip={t("investment.goldSilver.tip")} />
                  </GuideSection>

                  {/* Price Alerts */}
                  <GuideSection
                    id="price-alerts"
                    title={t("investment.priceAlerts.title")}
                    icon={<BellIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm mb-3">
                      {t("investment.priceAlerts.description")}
                    </p>

                    <div className="mb-3">
                      <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                        {t("investment.priceAlerts.setup.title")}
                      </h4>
                      <OrderedSteps
                        steps={t.raw(
                          "investment.priceAlerts.setup.steps"
                        ) as string[]}
                      />
                    </div>

                    <div className="space-y-1 mb-3">
                      <p className="text-sm text-v2-green-positive">
                        {t("investment.priceAlerts.status.active")}
                      </p>
                      <p className="text-sm text-v2-gold-accent">
                        {t("investment.priceAlerts.status.triggered")}
                      </p>
                      <p className="text-sm text-v2-text-tertiary">
                        {t("investment.priceAlerts.status.paused")}
                      </p>
                    </div>

                    <TipCard tip={t("investment.priceAlerts.tip")} />
                  </GuideSection>
                </div>
              </GuideSection>

              {/* ============================================================
                  COMMUNITY SECTION
              ============================================================ */}
              <GuideSection
                id="community"
                title={t("community.title")}
                icon={<UsersIcon />}
                level="h2"
              >
                <p className="text-v2-text-secondary text-sm sm:text-base mb-6">
                  {t("community.description")}
                </p>

                <div className="space-y-8">
                  {/* Creating Posts */}
                  <GuideSection
                    id="creating-posts"
                    title={t("community.creatingPosts.title")}
                    icon={<ChatIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm mb-3">
                      {t("community.creatingPosts.description")}
                    </p>
                    <OrderedSteps
                      steps={t.raw("community.creatingPosts.steps") as string[]}
                    />

                    <div className="mt-3">
                      <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                        {t("community.creatingPosts.hashtags.title")}
                      </h4>
                      <p className="text-v2-text-secondary text-sm">
                        {t("community.creatingPosts.hashtags.description")}
                      </p>
                    </div>
                    <TipCard tip={t("community.creatingPosts.tip")} />
                  </GuideSection>

                  {/* Interactions */}
                  <GuideSection
                    id="interactions"
                    title={t("community.interactions.title")}
                    icon={<HeartIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm mb-3">
                      {t("community.interactions.description")}
                    </p>
                    <div className="space-y-2">
                      {[
                        "commenting",
                        "liking",
                        "following",
                        "savedPosts",
                      ].map((key) => (
                        <div
                          key={key}
                          className="p-3 rounded-lg bg-v2-bg-surface border border-v2-border-light"
                        >
                          <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                            {t(
                              `community.interactions.${key}.title` as Parameters<typeof t>[0]
                            )}
                          </h4>
                          <p className="text-v2-text-secondary text-sm">
                            {t(
                              `community.interactions.${key}.description` as Parameters<typeof t>[0]
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                    <TipCard tip={t("community.interactions.tip")} />
                  </GuideSection>

                  {/* Sentiment Voting */}
                  <GuideSection
                    id="sentiment-voting"
                    title={t("community.sentimentVoting.title")}
                    icon={<BarChartIcon />}
                    level="h3"
                  >
                    <p className="text-v2-text-secondary text-sm mb-3">
                      {t("community.sentimentVoting.description")}
                    </p>

                    <div className="mb-3">
                      <h4 className="text-v2-gold-accent font-medium text-sm mb-1">
                        {t("community.sentimentVoting.howToVote.title")}
                      </h4>
                      <OrderedSteps
                        steps={t.raw(
                          "community.sentimentVoting.howToVote.steps"
                        ) as string[]}
                      />
                    </div>

                    <p className="text-v2-text-tertiary text-sm italic mb-3">
                      {t("community.sentimentVoting.interpretation")}
                    </p>
                    <TipCard tip={t("community.sentimentVoting.tip")} />
                  </GuideSection>
                </div>
              </GuideSection>

              {/* ============================================================
                  CTA — bottom of page
              ============================================================ */}
              <div className="pt-8 pb-4">
                <OrnateDivider variant="ornate" className="mb-8" />
                <div className="text-center flex flex-col sm:flex-row gap-4 justify-center items-center">
                  {isAuthenticated ? (
                    <Link
                      href="/dashboard/home"
                      className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-v2-gold-primary text-v2-bg-dark font-semibold rounded-lg hover:bg-v2-gold-dark transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-bg-primary"
                    >
                      {t("cta.goToDashboard")}
                    </Link>
                  ) : (
                    <Link
                      href="/auth/register"
                      className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-v2-gold-primary text-v2-bg-dark font-semibold rounded-lg hover:bg-v2-gold-dark transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-bg-primary"
                    >
                      {t("cta.getStartedFree")}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-v2-border text-v2-gold-accent font-medium rounded-lg hover:bg-v2-maroon-600 transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-bg-primary"
                  >
                    {t("cta.backToTop")}
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>
      </main>

      <LandingFooter />
    </LandingErrorBoundary>
  );
}
