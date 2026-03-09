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
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5 },
  },
};

export default function LandingHowItWorks() {
  const t = useTranslations("landing");
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  const steps = useMemo(
    () => [
      {
        number: "01",
        name: t("howItWorks.step1TitleAlt"),
        description: t("howItWorks.step1Desc"),
      },
      {
        number: "02",
        name: t("howItWorks.step2TitleAlt"),
        description: t("howItWorks.step2Desc"),
      },
      {
        number: "03",
        name: t("howItWorks.step3TitleAlt"),
        description: t("howItWorks.step3Desc"),
      },
      {
        number: "04",
        name: t("howItWorks.step4TitleAlt"),
        description: t("howItWorks.step4Desc"),
      },
      {
        number: "05",
        name: t("howItWorks.step5TitleAlt"),
        description: t("howItWorks.step5Desc"),
      },
    ],
    [t],
  );

  return (
    <section id="how-it-works" className="py-16 sm:py-20 bg-neutral-50 [scroll-margin-top:5rem]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={ref}
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t("howItWorks.getStartedInMinutes")}
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t("howItWorks.getStartedDesc")}
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          className="space-y-8 max-w-3xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {steps.map((step) => (
            <motion.div
              key={step.number}
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-start gap-6 bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex-shrink-0 w-16 h-16 bg-v2-red-primary text-white rounded-full flex items-center justify-center text-xl font-bold shadow-lg">
                {step.number}
              </div>
              <div className="flex-1 pt-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {step.name}
                </h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
