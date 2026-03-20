"use client";

import { useTranslations } from "next-intl";
import { LoadingSpinnerIcon } from "@/components/icons";

type LoadingSpinnerProps = {
  text?: string;
};

export const LoadingSpinner = ({ text }: LoadingSpinnerProps) => {
  const t = useTranslations("uiFeedback.loading");
  const resolvedText = text ?? t("loadingText");

  return (
    <div className="flex items-center gap-2">
      <LoadingSpinnerIcon size="md" className="text-v2-gold-primary" />
      <span className="text-v2-gold-primary">{resolvedText}</span>
    </div>
  );
};
