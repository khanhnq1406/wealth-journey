"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useMobile } from "@/hooks/useMobile";
import { InstallSteps } from "./InstallSteps";

const PWA_PROMPT_DISMISSED_KEY = "wealthjourney_pwa_prompt_dismissed";

interface PWAInstallPromptProps {
  /**
   * Show on landing page only (default: true)
   */
  landingPageOnly?: boolean;
  /**
   * Delay before showing prompt in milliseconds (default: 2000)
   */
  showDelay?: number;
}

export function PWAInstallPrompt({
  landingPageOnly = true,
  showDelay = 2000,
}: PWAInstallPromptProps) {
  const t = useTranslations("pwa.installPrompt");
  const tCommon = useTranslations("common");
  const { isInstalled, platform, canInstall, promptInstall } = usePWAInstall();
  const isMobile = useMobile();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has permanently dismissed
    try {
      const dismissed = localStorage.getItem(PWA_PROMPT_DISMISSED_KEY);
      if (dismissed === "true") {
        setIsDismissed(true);
        console.log('[PWA] Prompt permanently dismissed by user');
        return;
      }
    } catch (error) {
      // Handle localStorage access errors (e.g., private browsing mode)
      console.warn("localStorage access failed:", error);
    }

    console.log('[PWA] Conditions:', { isMobile, canInstall, isInstalled, isDismissed, platform });

    // Show prompt after delay if conditions are met
    const timer = setTimeout(() => {
      if (isMobile && canInstall && !isInstalled && !isDismissed) {
        console.log('[PWA] Showing install prompt');
        setIsVisible(true);
      } else {
        console.log('[PWA] Not showing prompt. Conditions not met.');
      }
    }, showDelay);

    return () => clearTimeout(timer);
  }, [isMobile, canInstall, isInstalled, isDismissed, showDelay, platform]);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleDismissPermanently = () => {
    try {
      localStorage.setItem(PWA_PROMPT_DISMISSED_KEY, "true");
      setIsDismissed(true);
      setIsVisible(false);
    } catch (error) {
      // Handle localStorage access errors (e.g., private browsing mode)
      console.warn("localStorage write failed:", error);
      // Still dismiss the prompt even if we can't persist the preference
      setIsDismissed(true);
      setIsVisible(false);
    }
  };

  const handleInstall = () => {
    if (platform === "android") {
      promptInstall();
    }
    // For iOS, steps are shown in InstallSteps component
  };

  if (!isVisible || !isMobile || isInstalled || isDismissed) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-prompt-title"
      >
        <div className="bg-white rounded-t-2xl shadow-v2-card max-w-2xl mx-auto">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-v2-border-light">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* App Icon */}
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-v2-red-primary rounded-2xl flex items-center justify-center shadow-v2-card">
                    <svg
                      className="w-8 h-8 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  </div>
                </div>
                {/* Title and Description */}
                <div className="flex-1">
                  <h2
                    id="pwa-prompt-title"
                    className="text-xl font-bold text-v2-text-primary mb-1"
                  >
                    {t("title")}
                  </h2>
                  <p className="text-sm text-v2-text-secondary">
                    {t("description")}
                  </p>
                </div>
              </div>
              {/* Close Button */}
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 -mt-1 -mr-1 p-2 text-v2-text-tertiary hover:text-v2-text-secondary transition-colors cursor-pointer"
                aria-label={tCommon("close")}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            {/* Benefits */}
            <div className="mb-6 grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="w-10 h-10 bg-v2-red-light rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="w-5 h-5 text-v2-red-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <p className="text-xs font-medium text-v2-text-secondary">{t("benefits.fast")}</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-v2-red-light rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="w-5 h-5 text-v2-red-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                </div>
                <p className="text-xs font-medium text-v2-text-secondary">{t("benefits.offline")}</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-v2-red-light rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg
                    className="w-5 h-5 text-v2-red-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                </div>
                <p className="text-xs font-medium text-v2-text-secondary">{t("benefits.homeScreenShort")}</p>
              </div>
            </div>

            {/* Installation Steps */}
            <div className="bg-v2-bg-primary rounded-xl p-5">
              <h3 className="text-sm font-semibold text-v2-text-primary mb-4">
                {t("howToInstall")}
              </h3>
              <InstallSteps platform={platform} onInstall={handleInstall} />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-v2-bg-primary rounded-b-2xl flex items-center justify-between gap-3">
            <button
              onClick={handleDismissPermanently}
              className="text-sm text-v2-text-tertiary hover:text-v2-text-secondary transition-colors font-medium cursor-pointer"
            >
              {t("dontShowAgain")}
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-sm font-medium text-v2-text-secondary hover:bg-v2-border-light rounded-lg transition-colors cursor-pointer"
            >
              {t("maybeLater")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
