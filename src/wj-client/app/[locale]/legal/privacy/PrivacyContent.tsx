"use client";

import { useTranslations } from "next-intl";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import { OrnateHeading } from "@/components/decorative/OrnateHeading";
import { OrnateDivider } from "@/components/decorative/OrnateDivider";

const SECTIONS = [
  "introduction",
  "dataCollection",
  "dataUse",
  "dataStorage",
  "thirdParties",
  "userRights",
  "cookies",
  "changes",
  "contact",
] as const;

export function PrivacyContent() {
  const t = useTranslations("legal");

  return (
    <div className="min-h-screen bg-v2-bg-primary">
      <LandingNavbar />

      <main id="main-content" className="pt-14 sm:pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          {/* Header */}
          <div className="text-center mb-10">
            <OrnateHeading size="lg" className="justify-center mb-3">
              {t("privacy.title")}
            </OrnateHeading>
            <p className="text-v2-text-tertiary text-sm mt-4">
              {t("privacy.lastUpdated")}
            </p>
            <p className="text-v2-text-secondary mt-2 text-sm sm:text-base max-w-2xl mx-auto">
              {t("privacy.subtitle")}
            </p>
          </div>

          <OrnateDivider variant="ornate" className="my-8" />

          {/* Sections */}
          <div className="space-y-8">
            {SECTIONS.map((sectionKey) => (
              <section key={sectionKey} id={sectionKey}>
                <h2 className="text-lg sm:text-xl font-semibold text-v2-gold-accent mb-3">
                  {t(`privacy.sections.${sectionKey}.title`)}
                </h2>
                <p className="text-v2-text-secondary text-sm sm:text-base leading-relaxed">
                  {t(`privacy.sections.${sectionKey}.content`)}
                </p>
              </section>
            ))}
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
