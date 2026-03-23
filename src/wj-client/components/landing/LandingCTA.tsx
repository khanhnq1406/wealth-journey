"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function LandingCTA() {
  const t = useTranslations("landing");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section className="relative py-16 sm:py-20 bg-gradient-to-br from-v2-bg-dark via-v2-bg-primary to-v2-bg-surface overflow-hidden">
      {/* Background Pattern Overlay */}
      <div className="absolute inset-0 opacity-10">
        <svg
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          width="100"
          height="100"
          viewBox="0 0 100 100"
          fill="none"
        >
          <pattern
            id="cta-pattern"
            patternUnits="userSpaceOnUse"
            width="20"
            height="20"
          >
            <circle cx="10" cy="10" r="1.5" fill="white" />
          </pattern>
          <rect width="100" height="100" fill="url(#cta-pattern)" />
        </svg>
      </div>

      <motion.div
        ref={ref}
        className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-v2-gold-accent mb-6">
          {t("cta.startJourney")}
        </h2>
        <p className="text-lg text-v2-text-tertiary mb-10 max-w-2xl mx-auto">
          {t("cta.joinDescription")}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link
            href="/auth/register"
            className="w-full sm:w-auto px-8 py-4 bg-v2-gold-primary text-v2-bg-dark rounded-md hover:bg-v2-text-secondary transition-colors duration-200 font-semibold text-center focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-bg-dark"
          >
            {t("cta.getStartedForFree")}
          </Link>
          <Link
            href="/auth/login"
            className="w-full sm:w-auto px-8 py-4 border-2 border-v2-gold-primary text-v2-gold-primary rounded-md hover:bg-v2-gold-primary/10 transition-colors duration-200 font-semibold text-center focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-bg-dark"
          >
            {t("cta.signIn")}
          </Link>
        </div>

        {/* Feature Highlights */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex flex-col items-center">
            <div className="text-2xl mb-2">💳</div>
            <span className="text-sm text-v2-text-tertiary font-medium">{t("cta.multiWallet")}</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-2xl mb-2">📈</div>
            <span className="text-sm text-v2-text-tertiary font-medium">{t("cta.investments")}</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-2xl mb-2">🪙</div>
            <span className="text-sm text-v2-text-tertiary font-medium">{t("cta.goldCrypto")}</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-2xl mb-2">📊</div>
            <span className="text-sm text-v2-text-tertiary font-medium">{t("cta.analytics")}</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
