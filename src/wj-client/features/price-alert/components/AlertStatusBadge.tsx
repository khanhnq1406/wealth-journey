"use client";

import { AlertStatus } from "@/gen/protobuf/v1/investment";

interface AlertStatusBadgeProps {
  status: AlertStatus;
}

export function AlertStatusBadge({ status }: AlertStatusBadgeProps) {
  if (status === AlertStatus.ALERT_STATUS_ACTIVE) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
        Active
      </span>
    );
  }

  if (status === AlertStatus.ALERT_STATUS_TRIGGERED) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
        Triggered
      </span>
    );
  }

  if (status === AlertStatus.ALERT_STATUS_PAUSED) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
        Paused
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-v2-border-light text-v2-text-tertiary">
      Unknown
    </span>
  );
}
