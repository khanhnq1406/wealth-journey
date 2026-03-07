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
          <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-bg rounded-full flex items-center justify-center font-semibold text-sm">
            1
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm text-gray-700">
              {t("iosTapShare")}{" "}
              <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-gray-100 rounded font-mono text-xs">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-bg rounded-full flex items-center justify-center font-semibold text-sm">
            2
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm text-gray-700">
              {t("iosScrollDown")}{" "}
              <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-gray-100 rounded font-medium text-xs">
                {t("iosAddToHomeScreen")}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-bg rounded-full flex items-center justify-center font-semibold text-sm">
            3
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm text-gray-700">
              {t("iosTapAdd")} <span className="font-medium">{t("iosAdd")}</span> {t("iosToConfirm")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "android") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 mb-4">
          {t("androidDescription")}
        </p>
        {onInstall && (
          <Button
            onClick={onInstall}
            variant="primary"
            fullWidth={true}
          >
            {t("androidInstallButton")}
          </Button>
        )}
        <div className="text-xs text-gray-500 text-center">
          {t("androidOr")}
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-600">
      <p>{t("genericInstallTitle")}</p>
      <ol className="list-decimal list-inside space-y-2 mt-3">
        <li>{t("genericStep1")}</li>
        <li>{t("genericStep2")}</li>
      </ol>
    </div>
  );
}
