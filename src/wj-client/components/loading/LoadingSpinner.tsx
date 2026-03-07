"use client";

import { useTranslations } from "next-intl";
import { LoadingSpinnerIcon } from "@/components/icons";

type LoadingSpinnerProps = {
  text?: string;
};

export const LoadingSpinner = ({ text }: LoadingSpinnerProps) => {
  const t = useTranslations("feedback.loading");
  const resolvedText = text ?? t("loadingText");

  return (
    <div className="flex items-center gap-2">
      <LoadingSpinnerIcon size="md" className="text-primary-500" />
      <span className="text-primary-500">{resolvedText}</span>
    </div>
  );
};
