"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { BaseModal } from "@/components/modals/BaseModal";

export type ShareMethod = "link" | "email" | "pdf" | "social";

export interface ShareOptions {
  method: ShareMethod;
  emailRecipients?: string[];
  includeCharts?: boolean;
  dateRange?: string;
  format?: "summary" | "detailed";
  message?: string;
}

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (options: ShareOptions) => void | Promise<void>;
  reportTitle?: string;
  reportUrl?: string;
  summaryData?: {
    totalBalance?: string;
    monthlyIncome?: string;
    monthlyExpenses?: string;
    period?: string;
  };
}

/**
 * Share Report Dialog Component
 *
 * Features:
 * - Generate shareable link
 * - Email report option
 * - Print/PDF export
 * - Social media share (summary card image)
 * - Copy to clipboard
 * - QR code generation
 * - Custom message option
 * - Mobile-friendly responsive design
 * - Dark mode support
 *
 * Usage:
 * ```tsx
 * <ShareDialog
 *   isOpen={isShareOpen}
 *   onClose={() => setIsShareOpen(false)}
 *   onShare={async (options) => {
 *     console.log('Sharing with options:', options);
 *   }}
 *   reportTitle="Monthly Financial Report"
 *   reportUrl="https://wealthjourney.app/reports/123"
 *   summaryData={{
 *     totalBalance: "$45,230.00",
 *     monthlyIncome: "$8,500.00",
 *     monthlyExpenses: "$3,200.00",
 *     period: "January 2026"
 *   }}
 * />
 * ```
 */
export function ShareDialog({
  isOpen,
  onClose,
  onShare,
  reportTitle = "Financial Report",
  reportUrl = "",
  summaryData,
}: ShareDialogProps) {
  const t = useTranslations("share.dialog");
  const [method, setMethod] = useState<ShareMethod>("link");
  const [emailRecipients, setEmailRecipients] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [includeCharts, setIncludeCharts] = useState(true);
  const [format, setFormat] = useState<"summary" | "detailed">("summary");
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setMethod("link");
      setEmailRecipients("");
      setCustomMessage("");
      setIncludeCharts(true);
      setFormat("summary");
      setCopied(false);
    }
  }, [isOpen]);

  // Generate shareable link
  const shareableLink = reportUrl || (typeof window !== "undefined" ? window.location.href : "");

  // Handle copy to clipboard
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [shareableLink]);

  // Handle share
  const handleShare = useCallback(async () => {
    setIsSharing(true);

    try {
      const options: ShareOptions = {
        method,
        emailRecipients: emailRecipients ? emailRecipients.split(",").map((e) => e.trim()) : undefined,
        includeCharts,
        dateRange: summaryData?.period,
        format,
        message: customMessage || undefined,
      };

      await onShare(options);
      onClose();
    } catch (error) {
      console.error("Share failed:", error);
    } finally {
      setIsSharing(false);
    }
  }, [method, emailRecipients, includeCharts, summaryData?.period, format, customMessage, onShare, onClose]);

  // Handle social media share
  const handleSocialShare = useCallback((platform: "twitter" | "linkedin" | "facebook") => {
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out my financial report on congdongvang.com! ${reportTitle}`)}&url=${encodeURIComponent(shareableLink)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareableLink)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableLink)}`,
    };

    window.open(urls[platform], "_blank", "width=600,height=400");
  }, [shareableLink, reportTitle]);

  // Get share method info
  const getMethodInfo = (m: ShareMethod) => {
    const info = {
      link: {
        name: t("methodLink"),
        description: t("methodLinkDesc"),
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        ),
      },
      email: {
        name: t("methodEmail"),
        description: t("methodEmailDesc"),
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
      pdf: {
        name: t("methodPdf"),
        description: t("methodPdfDesc"),
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
      social: {
        name: t("methodSocial"),
        description: t("methodSocialDesc"),
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        ),
      },
    };
    return info[m];
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("title")}
      maxWidth="max-w-lg"
    >
      <div className="space-y-5">
        {/* Report Summary Card Preview */}
        {summaryData && (
          <div className="relative">
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{reportTitle}</h3>
                  <p className="text-primary-100 text-sm">{summaryData.period}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {summaryData.totalBalance && (
                  <div>
                    <p className="text-primary-200 text-xs">{t("balance")}</p>
                    <p className="font-semibold">{summaryData.totalBalance}</p>
                  </div>
                )}
                {summaryData.monthlyIncome && (
                  <div>
                    <p className="text-primary-200 text-xs">{t("income")}</p>
                    <p className="font-semibold text-success-300">{summaryData.monthlyIncome}</p>
                  </div>
                )}
                {summaryData.monthlyExpenses && (
                  <div>
                    <p className="text-primary-200 text-xs">{t("expenses")}</p>
                    <p className="font-semibold text-danger-300">{summaryData.monthlyExpenses}</p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-neutral-500 dark:text-dark-text-tertiary mt-2 text-center">
              {t("previewCaption")}
            </p>
          </div>
        )}

        {/* Share Method Selection */}
        <div>
          <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-3">
            {t("shareMethod")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["link", "email", "pdf", "social"] as ShareMethod[]).map((m) => {
              const info = getMethodInfo(m);
              const isSelected = method === m;

              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all text-center",
                    "hover:border-neutral-300 dark:hover:border-dark-border-light",
                    isSelected
                      ? "border-primary-500 dark:border-primary-600 bg-primary-50 dark:bg-primary-950"
                      : "border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-surface"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg",
                    isSelected ? "text-primary-600 dark:text-primary-400 bg-white dark:bg-dark-surface" : "text-neutral-600 dark:text-dark-text-secondary bg-neutral-100 dark:bg-dark-surface-hover"
                  )}>
                    {info.icon}
                  </div>
                  <div>
                    <span className={cn(
                      "block text-xs font-medium",
                      isSelected ? "text-primary-700 dark:text-primary-400" : "text-neutral-700 dark:text-dark-text-secondary"
                    )}>
                      {info.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Method-specific options */}
        {method === "link" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-2">
                {t("shareableLink")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareableLink}
                  readOnly
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg border text-sm",
                    "bg-neutral-100 dark:bg-dark-surface-hover",
                    "border-neutral-300 dark:border-dark-border",
                    "text-neutral-600 dark:text-dark-text-tertiary"
                  )}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCopyLink}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {t("copied")}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {t("copy")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {method === "email" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-2">
                {t("emailRecipients")}
              </label>
              <input
                type="text"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className={cn(
                  // IMPORTANT: Font size must be at least 16px (text-base) to prevent iOS auto-zoom
                  "w-full px-3 py-2 rounded-lg border text-base sm:text-sm",
                  "bg-white dark:bg-dark-surface-hover",
                  "border-neutral-300 dark:border-dark-border",
                  "text-neutral-900 dark:text-dark-text",
                  "focus:ring-2 focus:ring-primary-500 focus:border-transparent",
                  "placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary"
                )}
              />
              <p className="mt-1 text-xs text-neutral-500 dark:text-dark-text-tertiary">
                {t("separateEmails")}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-2">
                {t("customMessage")}
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={t("messagePlaceholder")}
                rows={3}
                className={cn(
                  // IMPORTANT: Font size must be at least 16px (text-base) to prevent iOS auto-zoom
                  "w-full px-3 py-2 rounded-lg border text-base sm:text-sm resize-none",
                  "bg-white dark:bg-dark-surface-hover",
                  "border-neutral-300 dark:border-dark-border",
                  "text-neutral-900 dark:text-dark-text",
                  "focus:ring-2 focus:ring-primary-500 focus:border-transparent",
                  "placeholder:text-neutral-400 dark:placeholder:text-dark-text-tertiary"
                )}
              />
            </div>
          </div>
        )}

        {method === "pdf" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-900 dark:text-dark-text mb-3">
                {t("reportFormat")}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormat("summary")}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                    format === "summary"
                      ? "border-primary-500 dark:border-primary-600 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-400"
                      : "border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-surface text-neutral-700 dark:text-dark-text-secondary"
                  )}
                >
                  {t("summary")}
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("detailed")}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                    format === "detailed"
                      ? "border-primary-500 dark:border-primary-600 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-400"
                      : "border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-surface text-neutral-700 dark:text-dark-text-secondary"
                  )}
                >
                  {t("detailed")}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-dark-border hover:bg-neutral-50 dark:hover:bg-dark-surface-hover cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={includeCharts}
                onChange={(e) => setIncludeCharts(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-300 dark:border-dark-border text-primary-600 dark:text-primary-500 focus:ring-primary-500 dark:focus:ring-primary-600"
              />
              <span className="text-sm font-medium text-neutral-900 dark:text-dark-text">
                {t("includeCharts")}
              </span>
            </label>
          </div>
        )}

        {method === "social" && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-dark-text-secondary">
              {t("shareSocial")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSocialShare("twitter")}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                  "border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-surface",
                  "hover:border-[#1DA1F2] hover:bg-[#1DA1F2]/5"
                )}
              >
                <svg className="w-6 h-6 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className="text-xs font-medium text-neutral-700 dark:text-dark-text-secondary">X / Twitter</span>
              </button>
              <button
                type="button"
                onClick={() => handleSocialShare("linkedin")}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                  "border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-surface",
                  "hover:border-[#0077B5] hover:bg-[#0077B5]/5"
                )}
              >
                <svg className="w-6 h-6 text-[#0077B5]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                <span className="text-xs font-medium text-neutral-700 dark:text-dark-text-secondary">LinkedIn</span>
              </button>
              <button
                type="button"
                onClick={() => handleSocialShare("facebook")}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                  "border-neutral-200 dark:border-dark-border bg-white dark:bg-dark-surface",
                  "hover:border-[#4267B2] hover:bg-[#4267B2]/5"
                )}
              >
                <svg className="w-6 h-6 text-[#4267B2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <span className="text-xs font-medium text-neutral-700 dark:text-dark-text-secondary">Facebook</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end mt-6 pt-4 border-t border-neutral-200 dark:border-dark-border">
        <Button
          type={ButtonType.SECONDARY}
          onClick={onClose}
          disabled={isSharing}
        >
          {t("cancel")}
        </Button>
        <Button
          type={ButtonType.PRIMARY}
          onClick={handleShare}
          loading={isSharing}
        >
          {isSharing ? t("sharing") : t("share")}
        </Button>
      </div>
    </BaseModal>
  );
}

/**
 * Quick share button component
 */
export function ShareButton({
  onShare,
  reportTitle,
  reportUrl,
  summaryData,
}: {
  onShare: (options: ShareOptions) => void | Promise<void>;
  reportTitle?: string;
  reportUrl?: string;
  summaryData?: ShareDialogProps["summaryData"];
}) {
  const t = useTranslations("share.dialog");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type={ButtonType.SECONDARY}
        onClick={() => setIsOpen(true)}
      >
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        {t("share")}
      </Button>

      <ShareDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onShare={onShare}
        reportTitle={reportTitle}
        reportUrl={reportUrl}
        summaryData={summaryData}
      />
    </>
  );
}
