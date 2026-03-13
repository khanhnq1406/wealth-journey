"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function ConnectionStatus() {
  const [isSecure, setIsSecure] = useState(true);
  const t = useTranslations("connectionStatus");

  useEffect(() => {
    // Check if the connection is secure (HTTPS)
    queueMicrotask(() => setIsSecure(window.location.protocol === "https:"));
  }, []);

  if (!isSecure) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-danger-50 border border-danger-200 rounded-lg">
        <svg
          className="w-4 h-4 text-danger-600"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
            clipRule="evenodd"
          />
          <path d="M10 13a1 1 0 011-1v2a1 1 0 11-2 0z" />
        </svg>
        <span className="text-xs font-medium text-danger-700">
          {t("unsecure")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-success-50 border border-success-200 rounded-lg">
      <svg
        className="w-4 h-4 text-success-600"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-xs font-medium text-success-700">
        {t("secure")}
      </span>
    </div>
  );
}
