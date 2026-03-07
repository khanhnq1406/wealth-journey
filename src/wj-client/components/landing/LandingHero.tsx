"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

// Dashboard Preview Component
function DashboardPreview() {
  const [origin, setOrigin] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="relative rounded-lg shadow-2xl overflow-hidden bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400"></div>
        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
        <div className="w-3 h-3 rounded-full bg-green-400"></div>
        <div className="flex-1 bg-gray-100 rounded-md h-6 mx-4 flex items-center px-3">
          <span className="text-xs text-gray-400">
            {origin ? `${origin}/dashboard/home` : "/dashboard/home"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-b-lg" />
        )}
        <Image
          src={"/dashboard.svg"}
          alt="dashboard"
          width={0}
          height={0}
          sizes="100vw"
          className="w-full h-full"
          priority
          loading="eager"
          onLoad={() => setImageLoaded(true)}
        />
      </div>
    </div>
  );
}

export default function LandingHero() {
  const t = useTranslations("landing");
  const prefersReducedMotion = useReducedMotion();

  // Create motion variants that respect reduced motion preferences
  const safeVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
      }
    : containerVariants;

  const safeItemVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
      }
    : itemVariants;

  return (
    <section className="relative pt-16 pb-8 sm:pt-24 sm:pb-16 md:pt-32 md:pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary-600/5 via-transparent to-primary-600/10"
        aria-hidden="true"
      />

      <motion.div
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        variants={safeVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="text-center">
          <motion.div variants={safeItemVariants}>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 px-2">
              {t("hero.title")}
            </h1>
          </motion.div>

          <motion.p
            variants={safeItemVariants}
            className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8 md:mb-10 max-w-3xl mx-auto px-4 leading-relaxed"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            variants={safeItemVariants}
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 px-4 sm:px-0"
          >
            <Link
              href="/auth/register"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 bg-primary-600 text-white rounded-md hover:bg-primary-500 transition-colors duration-200 font-medium text-center focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 min-h-[44px] flex items-center justify-center"
            >
              {t("hero.getStarted")}
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 border-2 border-primary-600 text-primary-600 rounded-md hover:bg-primary-600 hover:text-white transition-colors duration-200 font-medium text-center focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 min-h-[44px] flex items-center justify-center"
            >
              {t("hero.learnMore")}
            </a>
          </motion.div>

          {/* PWA Badge - Mobile Only */}
          <motion.div
            variants={safeItemVariants}
            className="mt-4 flex justify-center px-4 sm:hidden"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md border border-gray-200">
              <svg
                className="w-5 h-5 text-bg"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <div className="text-left">
                <div className="text-xs font-semibold text-gray-900">
                  {t("hero.installAsApp")}
                </div>
                <div className="text-[10px] text-gray-600">
                  {t("hero.availableOnPlatforms")}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={safeItemVariants}
            className="mt-8 sm:mt-10 md:mt-12 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 text-xs sm:text-sm text-gray-500 px-4"
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{t("hero.noCreditCard")}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{t("hero.secureOAuth")}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{t("hero.freeForeverPlan")}</span>
            </div>
          </motion.div>

          {/* All-in-One Stats Section */}
          <motion.div
            variants={safeItemVariants}
            className="mt-10 sm:mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto px-4"
          >
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-primary-600">
                6+
              </div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">
                {t("hero.assetClasses")}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                {t("hero.inOnePlatform")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-primary-600">
                12+
              </div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">
                {t("hero.currencies")}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                {t("hero.multiCurrency")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-primary-600">
                ∞
              </div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">
                {t("hero.unifiedView")}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                {t("hero.allAssetsTogether")}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-primary-600">
                100%
              </div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">
                {t("hero.freeForever")}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                {t("hero.noHiddenFees")}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Dashboard Preview */}
        {/* <motion.div variants={safeItemVariants} className="mt-10 sm:mt-12 md:mt-16 px-2 sm:px-4">
          <DashboardPreview />
        </motion.div> */}
      </motion.div>
    </section>
  );
}
