"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useTranslations } from "next-intl";

const checkIcon = (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4 },
  },
};

export default function LandingComparison() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const t = useTranslations("landing.comparison");

  const comparisons = [
    { key: "allInOne" },
    { key: "assetCoverage" },
    { key: "goldSilver" },
    { key: "marketData" },
    { key: "multiCurrency" },
    { key: "export" },
    { key: "pricing" },
  ] as const;

  return (
    <section className="py-16 sm:py-20 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto px-4">
            {t("description")}
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          className="max-w-5xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white rounded-xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-v2-red-primary text-white">
                  <th className="py-4 px-6 text-left font-semibold">{t("feature")}</th>
                  <th className="py-4 px-6 text-left font-semibold">{t("wealthJourney")}</th>
                  <th className="py-4 px-6 text-left font-semibold">{t("otherApps")}</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((item, idx) => (
                  <motion.tr
                    key={idx}
                    variants={itemVariants}
                    className="border-b border-gray-100 hover:bg-v2-red-50/30 transition-colors"
                  >
                    <td className="py-4 px-6 font-medium text-gray-900">
                      {t(`items.${item.key}.feature`)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-v2-red-primary flex-shrink-0">
                          {checkIcon}
                        </span>
                        <span className="text-gray-700">{t(`items.${item.key}.wj`)}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-500">{t(`items.${item.key}.others`)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-4">
            {comparisons.map((item, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="bg-white rounded-lg p-5 shadow-md"
              >
                <h3 className="font-bold text-gray-900 mb-3 text-base">
                  {t(`items.${item.key}.feature`)}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-v2-red-primary flex-shrink-0 mt-0.5">
                      {checkIcon}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-v2-red-primary mb-1">
                        congdongvang.com
                      </div>
                      <div className="text-sm text-gray-700">
                        {t(`items.${item.key}.wj`)}
                      </div>
                    </div>
                  </div>
                  <div className="pl-8 pt-2 border-l-2 border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 mb-1">
                      {t("otherApps")}
                    </div>
                    <div className="text-sm text-gray-500">{t(`items.${item.key}.others`)}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
