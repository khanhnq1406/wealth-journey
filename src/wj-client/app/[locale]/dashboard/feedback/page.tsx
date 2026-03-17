"use client";

import { useTranslations } from "next-intl";

export default function FeedbackPage() {
  const t = useTranslations("feedback");
  return (
    <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
      <h1 className="text-lg sm:text-xl font-bold font-vietnam text-v2-text-primary">
        {t("title")}
      </h1>
    </div>
  );
}
