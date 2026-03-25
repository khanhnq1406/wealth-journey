"use client";

import { useTranslations } from "next-intl";

import { AlertStatus } from "@/gen/protobuf/v1/investment";

interface AlertStatusBadgeProps {
  status: AlertStatus;
}

export function AlertStatusBadge({ status }: AlertStatusBadgeProps) {
  const t = useTranslations("priceAlerts");

  if (status === AlertStatus.ALERT_STATUS_ACTIVE) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-v2-green-light text-v2-green-positive">
        <span className="w-1.5 h-1.5 rounded-full bg-v2-green-positive inline-block" />
        {t("statusActive")}
      </span>
    );
  }

  if (status === AlertStatus.ALERT_STATUS_TRIGGERED) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-v2-gold-primary/20 text-v2-gold-accent">
        <span className="w-1.5 h-1.5 rounded-full bg-v2-gold-accent inline-block" />
        {t("statusTriggered")}
      </span>
    );
  }

  if (status === AlertStatus.ALERT_STATUS_PAUSED) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-v2-red-light text-v2-red-negative">
        <span className="w-1.5 h-1.5 rounded-full bg-v2-red-negative inline-block" />
        {t("statusPaused")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-v2-border-light text-v2-text-tertiary">
      {t("statusUnknown")}
    </span>
  );
}
