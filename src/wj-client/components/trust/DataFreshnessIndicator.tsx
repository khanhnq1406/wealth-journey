"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface DataFreshnessIndicatorProps {
  lastUpdated: Date;
  className?: string;
}

export function DataFreshnessIndicator({
  lastUpdated,
  className = "",
}: DataFreshnessIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState("");
  const t = useTranslations("dataFreshness");

  useEffect(() => {
    const updateTimeAgo = () => {
      const now = new Date();
      const diffInSeconds = Math.floor(
        (now.getTime() - lastUpdated.getTime()) / 1000
      );

      if (diffInSeconds < 60) {
        setTimeAgo(t("justNow"));
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        setTimeAgo(t(minutes > 1 ? "minutesAgo" : "minuteAgo", { count: minutes }));
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        setTimeAgo(t(hours > 1 ? "hoursAgo" : "hourAgo", { count: hours }));
      } else {
        const days = Math.floor(diffInSeconds / 86400);
        setTimeAgo(t(days > 1 ? "daysAgo" : "dayAgo", { count: days }));
      }
    };

    // Update immediately
    updateTimeAgo();

    // Update every minute
    const interval = setInterval(updateTimeAgo, 60000);

    return () => clearInterval(interval);
  }, [lastUpdated, t]);

  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-neutral-500 ${className}`}
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{t("updated", { timeAgo })}</span>
    </div>
  );
}
