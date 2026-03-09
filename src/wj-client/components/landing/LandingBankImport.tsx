"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useMemo } from "react";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
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

export default function LandingBankImport() {
  const t = useTranslations("landing");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  const supportedFormats = useMemo(
    () => [
      {
        icon: "📄",
        format: t("bankImport.csvFormat"),
        description: t("bankImport.csvDesc"),
        maxSize: "10MB",
      },
      {
        icon: "📊",
        format: t("bankImport.excelFormat"),
        description: t("bankImport.excelDesc"),
        maxSize: "10MB",
      },
      {
        icon: "📋",
        format: t("bankImport.pdfFormat"),
        description: t("bankImport.pdfDesc"),
        maxSize: "20MB",
      },
    ],
    [t],
  );

  const importFeatures = useMemo(
    () => [
      {
        icon: (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        ),
        title: t("bankImport.smartDuplicate"),
        description: t("bankImport.smartDuplicateDesc"),
      },
      {
        icon: (
          <svg
            className="w-6 h-6"
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
        ),
        title: t("bankImport.autoCategorization"),
        description: t("bankImport.autoCategorisationDesc"),
      },
      {
        icon: (
          <svg
            className="w-6 h-6"
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
        ),
        title: t("bankImport.multiCurrencySupport"),
        description: t("bankImport.multiCurrencyDesc"),
      },
      {
        icon: (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        ),
        title: t("bankImport.reviewEdit"),
        description: t("bankImport.reviewEditDesc"),
      },
      {
        icon: (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"
            />
          </svg>
        ),
        title: t("bankImport.twentyFourHourUndo"),
        description: t("bankImport.twentyFourHourUndoDesc"),
      },
      {
        icon: (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        ),
        title: t("bankImport.lightningFast"),
        description: t("bankImport.lightningFastDesc"),
      },
    ],
    [t],
  );

  const steps = useMemo(
    () => [
      {
        number: 1,
        title: t("bankImport.uploadStatement"),
        description: t("bankImport.uploadStatementDesc"),
        icon: "📤",
      },
      {
        number: 2,
        title: t("bankImport.reviewConfirm"),
        description: t("bankImport.reviewConfirmDesc"),
        icon: "✅",
      },
      {
        number: 3,
        title: t("bankImport.importComplete"),
        description: t("bankImport.importCompleteDesc"),
        icon: "🎉",
      },
    ],
    [t],
  );

  return (
    <section
      id="bank-import"
      className="py-16 sm:py-20 bg-gradient-to-br from-v2-red-50 via-white to-v2-red-50 [scroll-margin-top:5rem]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          ref={ref}
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center justify-center px-4 py-2 mb-4 text-sm font-medium text-v2-red-primary bg-v2-red-100 rounded-full">
            <span className="mr-2">⚡</span>
            {t("bankImport.bulkImport")}
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t("bankImport.stopTyping")}
          </h2>
          <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto px-4">
            {t("bankImport.stopTypingDesc")}
          </p>
        </motion.div>

        {/* Supported Formats */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 max-w-3xl mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={
            isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }
          }
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {supportedFormats.map((format, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow duration-300 text-center"
            >
              <div className="text-4xl mb-2">{format.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {format.format}
              </h3>
              <p className="text-sm text-gray-600 mb-1">{format.description}</p>
              <p className="text-xs text-v2-red-primary font-medium">
                {t("bankImport.maxSize", { size: format.maxSize })}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Supported Banks */}
        {/* <motion.div
          className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-6">
            Pre-Built Templates for Vietnamese Banks
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {supportedBanks.map((bank, index) => (
              <div
                key={index}
                className="flex flex-col items-center p-4 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors duration-200"
              >
                <div className="text-3xl mb-2">{bank.logo}</div>
                <div className="text-sm font-semibold text-gray-900 text-center">
                  {bank.name}
                </div>
                <div className="text-xs text-gray-500">{bank.code}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-600 mt-4">
            Don't see your bank? Use <span className="font-semibold text-v2-red-primary">Custom Format</span> with automatic column detection.
          </p>
        </motion.div> */}

        {/* Key Features Grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {importFeatures.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-white rounded-lg p-6 shadow-md hover:shadow-xl transition-shadow duration-300"
            >
              <div className="w-12 h-12 bg-v2-red-primary/10 rounded-lg flex items-center justify-center text-v2-red-primary mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* How It Works Steps */}
        <motion.div
          className="bg-gradient-to-br from-v2-red-primary via-v2-red-dark to-v2-red-dark rounded-2xl p-8 sm:p-12 text-white"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={
            isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }
          }
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h3 className="text-2xl sm:text-3xl font-bold text-center mb-10">
            {t("bankImport.howBankImportWorks")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-3xl mb-4">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -left-2 w-8 h-8 bg-white text-v2-red-primary rounded-full flex items-center justify-center font-bold text-sm">
                    {step.number}
                  </div>
                  <h4 className="text-lg font-semibold mb-2">{step.title}</h4>
                  <p className="text-sm text-v2-red-100 leading-relaxed">
                    {step.description}
                  </p>
                </div>
                {/* {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 -right-3 w-6 h-0.5 bg-white/30" />
                )} */}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Statistics */}
        <motion.div
          className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="text-center p-6 bg-white rounded-xl shadow-md">
            <div className="text-3xl sm:text-4xl font-extrabold text-v2-red-primary mb-2">
              10,000
            </div>
            <div className="text-sm text-gray-600">
              {t("bankImport.maxTransactions")}
            </div>
          </div>
          <div className="text-center p-6 bg-white rounded-xl shadow-md">
            <div className="text-3xl sm:text-4xl font-extrabold text-v2-red-primary mb-2">
              99%
            </div>
            <div className="text-sm text-gray-600">
              {t("bankImport.duplicateAccuracy")}
            </div>
          </div>
          <div className="text-center p-6 bg-white rounded-xl shadow-md">
            <div className="text-3xl sm:text-4xl font-extrabold text-v2-red-primary mb-2">
              &lt;10min
            </div>
            <div className="text-sm text-gray-600">
              {t("bankImport.importSpeed")}
            </div>
          </div>
          <div className="text-center p-6 bg-white rounded-xl shadow-md">
            <div className="text-3xl sm:text-4xl font-extrabold text-v2-red-primary mb-2">
              24hrs
            </div>
            <div className="text-sm text-gray-600">{t("bankImport.undoWindow")}</div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <p className="text-gray-700 mb-6 text-lg">
            {t("bankImport.ctaText")}
          </p>
          <a
            href="/auth/register"
            className="inline-block px-8 py-4 bg-v2-red-primary text-white rounded-lg hover:bg-v2-red-dark transition-colors duration-200 font-semibold text-lg focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2"
          >
            {t("bankImport.getStartedFree")}
          </a>
        </motion.div>
      </div>
    </section>
  );
}
