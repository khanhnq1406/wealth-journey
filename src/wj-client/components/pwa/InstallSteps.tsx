"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Platform } from "@/hooks/usePWAInstall";
import { Button } from "@/components/Button";

interface InstallStepsProps {
  platform: Platform;
  onInstall?: () => void;
}

export function InstallSteps({ platform, onInstall }: InstallStepsProps) {
  const t = useTranslations("pwa.installSteps");

  if (platform === "ios") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-v2-red-light text-v2-red-primary rounded-full flex items-center justify-center font-semibold text-sm">
            1
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm text-v2-text-secondary flex items-center gap-1">
              {t("iosTapShare")}{" "}
              <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-v2-bg-primary rounded">
                <svg
                  className="w-5 h-5 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16V3m0 0l-4 4m4-4l4 4"
                  />
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="11"
                    rx="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  />
                </svg>
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-v2-red-light text-v2-red-primary rounded-full flex items-center justify-center font-semibold text-sm">
            2
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm text-v2-text-secondary">
              {t("iosScrollDown")}{" "}
              <span className="inline-flex items-center gap-1.5 mx-1 px-1.5 py-0.5 bg-gray-100 rounded font-medium text-xs">
                {t("iosAddToHomeScreen")}
                <svg
                  className="w-4 h-4 text-v2-text-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                  <path strokeLinecap="round" d="M12 8v8m-4-4h8" />
                </svg>
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-v2-red-light text-v2-red-primary rounded-full flex items-center justify-center font-semibold text-sm">
            3
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm text-v2-text-secondary">
              {t("iosTapAdd")}{" "}
              <span className="font-medium">{t("iosAdd")}</span>{" "}
              {t("iosToConfirm")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "android") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-v2-text-secondary mb-4">
          {t("androidDescription")}
        </p>
        {onInstall && (
          <Button onClick={onInstall} variant="primary" fullWidth={true}>
            {t("androidInstallButton")}
          </Button>
        )}
        <div className="text-xs text-v2-text-tertiary text-center">
          {t("androidOr")}
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm text-v2-text-secondary">
      <p>{t("genericInstallTitle")}</p>
      <ol className="list-decimal list-inside space-y-2 mt-3">
        <li>{t("genericStep1")}</li>
        <li>{t("genericStep2")}</li>
      </ol>
    </div>
  );
}
