"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useMemo } from "react";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
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

export default function LandingInvestmentFeatures() {
  const t = useTranslations("landing");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  const investmentFeatures = useMemo(
    () => [
      {
        title: t("investmentFeatures.allAssets"),
        description: t("investmentFeatures.allAssetsDesc"),
        items: [
          { icon: "📈", label: t("investmentFeatures.stocks") },
          { icon: "🏛️", label: t("investmentFeatures.etfs") },
          { icon: "💼", label: t("investmentFeatures.mutualFunds") },
          { icon: "₿", label: t("investmentFeatures.cryptocurrency") },
          { icon: "🥇", label: t("investmentFeatures.gold") },
          { icon: "🥈", label: t("investmentFeatures.silver") },
        ],
      },
      {
        title: t("investmentFeatures.powerfulAnalytics"),
        description: t("investmentFeatures.powerfulAnalyticsDesc"),
        items: [
          { icon: "📉", label: t("investmentFeatures.fifoCostBasis") },
          { icon: "📈", label: t("investmentFeatures.realizedPnl") },
          { icon: "💹", label: t("investmentFeatures.unrealizedPnl") },
          { icon: "🎯", label: t("investmentFeatures.assetAllocation") },
          { icon: "📊", label: t("investmentFeatures.performanceTracking") },
          { icon: "⚡", label: t("investmentFeatures.realTimeUpdates") },
        ],
      },
      {
        title: t("investmentFeatures.goldSilverSupport"),
        description: t("investmentFeatures.goldSilverSupportDescLong"),
        items: [
          { icon: "🇻🇳", label: t("investmentFeatures.sjcGold") },
          { icon: "🌍", label: t("investmentFeatures.worldGold") },
          { icon: "🥈", label: t("investmentFeatures.silver") },
          { icon: "⚖️", label: t("investmentFeatures.maceGramOunce") },
          { icon: "💱", label: t("investmentFeatures.multiCurrency") },
          { icon: "🏷️", label: t("investmentFeatures.livePricing") },
        ],
      },
    ],
    [t],
  );

  return (
    <section
      id="investment-tracking"
      className="py-16 sm:py-20 bg-gradient-to-br from-v2-red-50 via-white to-v2-red-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            <span className="text-v2-red-primary">{t("investmentFeatures.allInOneTitle")}</span> {t("investmentFeatures.investmentTrackingTitle")}
          </h2>
          <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto px-4">
            {t("investmentFeatures.whyJuggle")}
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {investmentFeatures.map((feature) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              className="bg-white rounded-xl p-6 sm:p-8 shadow-md hover:shadow-xl transition-shadow duration-300"
            >
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                {feature.description}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {feature.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 sm:p-3 bg-neutral-50 rounded-lg hover:bg-v2-red-50 transition-colors duration-200"
                  >
                    <span className="text-lg sm:text-xl">{item.icon}</span>
                    <span className="text-xs sm:text-sm font-medium text-gray-700">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Call-out section */}
        <motion.div
          className="mt-12 sm:mt-16 bg-v2-red-primary rounded-xl p-6 sm:p-8 text-center text-white"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={
            isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }
          }
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h3 className="text-xl sm:text-2xl font-bold mb-3">
            {t("investmentFeatures.onePortfolio")}
          </h3>
          <p className="text-sm sm:text-base text-v2-red-100 max-w-3xl mx-auto leading-relaxed">
            {t("investmentFeatures.fifoAccounting")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
