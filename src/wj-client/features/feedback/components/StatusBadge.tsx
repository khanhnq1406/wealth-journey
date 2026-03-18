"use client";

import { useTranslations } from "next-intl";

const statusConfig: Record<number, { key: string; className: string }> = {
  1: { key: "pending", className: "bg-yellow-100 text-yellow-800" },
  2: { key: "reviewed", className: "bg-blue-100 text-blue-800" },
  3: { key: "resolved", className: "bg-green-100 text-green-800" },
};

interface StatusBadgeProps {
  status: number;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const t = useTranslations("feedback");
  const config = statusConfig[status] || statusConfig[1];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {t(`status.${config.key}`)}
    </span>
  );
}
