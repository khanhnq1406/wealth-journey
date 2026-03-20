"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export interface ErrorStateProps {
  /**
   * Error title/headline
   */
  title?: string;

  /**
   * Error description or message
   */
  message?: string;

  /**
   * Error code (optional)
   */
  code?: string | number;

  /**
   * Primary action button (e.g., Retry)
   */
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };

  /**
   * Secondary action (e.g., Go back, Contact support)
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };

  /**
   * Whether to show the error details
   * @default false
   */
  showDetails?: boolean;

  /**
   * Additional error details (technical info)
   */
  details?: string;

  /**
   * Error severity for styling
   * @default "error"
   */
  severity?: "error" | "warning" | "critical";

  /**
   * Variant for layout
   * @default "default"
   */
  variant?: "default" | "card" | "inline" | "compact";

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Custom icon
   */
  icon?: React.ReactNode;
}

export function ErrorState({
  title,
  message,
  code,
  primaryAction,
  secondaryAction,
  showDetails = false,
  details,
  severity = "error",
  variant = "default",
  className,
  icon,
}: ErrorStateProps) {
  const t = useTranslations("uiFeedback.errorState");
  const tCommon = useTranslations("common");
  const resolvedTitle = title ?? t("somethingWentWrong");
  const severityConfig = {
    error: {
 bg: "bg-red-50",
 border: "border-red-200",
 iconBg: "bg-red-100",
 iconColor: "text-red-600",
 textColor: "text-red-900",
 subtextColor: "text-red-700",
    },
    warning: {
 bg: "bg-yellow-50",
 border: "border-yellow-200",
 iconBg: "bg-yellow-100",
 iconColor: "text-yellow-600",
 textColor: "text-yellow-900",
 subtextColor: "text-yellow-700",
    },
    critical: {
 bg: "bg-red-100",
 border: "border-red-300",
 iconBg: "bg-red-200",
 iconColor: "text-red-700",
 textColor: "text-red-900",
 subtextColor: "text-red-800",
    },
  };

  const config = severityConfig[severity];

  const defaultIcon = (
    <svg
      className="w-full h-full"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );

  const variantClasses = {
    default: cn(
      "text-center py-12 px-4",
      config.bg
    ),
    card: cn(
      "rounded-xl border p-6 sm:p-8 text-center",
      config.bg,
      config.border
    ),
    inline: cn(
      "flex items-start gap-4 p-4 rounded-lg border",
      config.bg,
      config.border,
      "text-left"
    ),
    compact: cn(
      "flex items-center gap-3 p-3 rounded-lg",
      config.bg,
      config.border
    ),
  };

  const content = (
    <div className={cn(variantClasses[variant], className)}>
      {/* Icon */}
      {icon && (
        <div className={cn(
          "flex items-center justify-center",
          variant === "inline" || variant === "compact"
            ? "flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14"
            : "mx-auto w-14 h-14 sm:w-16 sm:h-16 mb-4",
          config.iconBg,
          "rounded-full"
        )}>
          <div className={cn("w-8 h-8 sm:w-10 sm:h-10", config.iconColor)}>
            {icon}
          </div>
        </div>
      )}

      {/* Content */}
      <div className={cn(
        "flex-1",
        variant === "inline" || variant === "compact" ? "text-left" : "text-center"
      )}>
        {/* Title and Code */}
        <div className="flex items-center justify-center gap-2">
          {resolvedTitle && (
            <h3 className={cn(
              "font-semibold",
              config.textColor,
              variant === "compact" ? "text-base" : "text-lg sm:text-xl"
            )}>
              {resolvedTitle}
            </h3>
          )}
          {code && (
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-xs font-mono",
              config.iconBg,
              config.iconColor
            )}>
              {code}
            </span>
          )}
        </div>

        {/* Message */}
        {message && (
          <p className={cn(
            "mt-2",
            config.subtextColor,
            variant === "compact" ? "text-sm" : "text-sm sm:text-base"
          )}>
            {message}
          </p>
        )}

        {/* Details */}
        {showDetails && details && (
          <details className="mt-4 text-left">
            <summary className={cn(
              "cursor-pointer text-sm font-medium",
              config.iconColor,
              "hover:underline"
            )}>
              {tCommon("showDetails")}
            </summary>
            <pre className={cn(
              "mt-2 p-3 rounded-lg text-xs overflow-x-auto",
 "bg-white/50",
              config.textColor
            )}>
              {details}
            </pre>
          </details>
        )}
      </div>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className={cn(
          "flex items-center gap-3 mt-6",
          (variant === "inline" || variant === "compact") && "mt-0 ml-auto"
        )}>
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className={cn(
                "inline-flex items-center justify-center gap-2",
                "px-4 py-2 text-sm font-medium rounded-lg",
                severity === "critical"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-v2-red-primary text-white hover:bg-v2-red-dark",
                "active:scale-[0.98]",
                "transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-red-primary focus-visible:ring-offset-2"
              )}
            >
              {primaryAction.icon && (
                <span className="w-4 h-4 flex-shrink-0">{primaryAction.icon}</span>
              )}
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className={cn(
                "inline-flex items-center justify-center",
                "px-4 py-2 text-sm font-medium rounded-lg",
                config.subtextColor,
 "hover:bg-white/50",
                "transition-all duration-200"
              )}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return content;
}

/**
 * Preset error states for common scenarios
 */

export interface ErrorStatePresetProps {
  /**
   * Preset type
   */
  type: "network" | "server" | "unauthorized" | "not-found" | "timeout" | "unknown";

  /**
   * Custom title
   */
  title?: string;

  /**
   * Custom message
   */
  message?: string;

  /**
   * Retry action
   */
  onRetry?: () => void;

  /**
   * Additional action
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };

  /**
   * Variant
   */
  variant?: "default" | "card" | "inline";

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Error details
   */
  details?: string;
}

const errorPresetIcons = {
  network: (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
  server: (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 01-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 01-2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
  unauthorized: (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  "not-found": (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
    </svg>
  ),
  timeout: (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  unknown: (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

const errorPresetTranslationKeys: Record<string, { title: string; message: string }> = {
  network: { title: "networkError", message: "networkErrorDescription" },
  server: { title: "serverError", message: "serverErrorDescription" },
  unauthorized: { title: "accessDenied", message: "accessDeniedDescription" },
  "not-found": { title: "notFound", message: "notFoundDescription" },
  timeout: { title: "requestTimeout", message: "requestTimeoutDescription" },
  unknown: { title: "unexpectedError", message: "unexpectedErrorDescription" },
};

export function ErrorStatePreset({
  type,
  title,
  message,
  onRetry,
  secondaryAction,
  variant = "default",
  className,
  details,
}: ErrorStatePresetProps) {
  const t = useTranslations("uiFeedback.errorState");
  const tCommon = useTranslations("common");
  const keys = errorPresetTranslationKeys[type];
  const icon = errorPresetIcons[type];

  return (
    <ErrorState
      icon={icon}
      title={title || t(keys.title as any)}
      message={message || t(keys.message as any)}
      primaryAction={onRetry ? {
        label: tCommon("tryAgain"),
        onClick: onRetry,
      } : undefined}
      secondaryAction={secondaryAction}
      variant={variant}
      className={className}
      details={details}
      showDetails={!!details}
    />
  );
}

/**
 * Inline error message component for form fields
 */
export interface InlineErrorProps {
  message: string;
  className?: string;
}

export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <div className={cn(
 "flex items-center gap-2 text-sm text-red-600",
      className
    )}>
      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <span>{message}</span>
    </div>
  );
}

/**
 * Warning state component (less severe than error)
 */
export interface WarningStateProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function WarningState({
  title,
  message,
  onDismiss,
  action,
  className,
}: WarningStateProps) {
  return (
    <div className={cn(
      "p-4 rounded-lg border",
 "bg-yellow-50",
 "border-yellow-200",
      className
    )}>
      <div className="flex items-start gap-3">
 <div className="flex-shrink-0 w-5 h-5 text-yellow-600 mt-0.5">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {title && (
 <h4 className="font-semibold text-yellow-900">
              {title}
            </h4>
          )}
 <p className="text-sm text-yellow-800 mt-1">
            {message}
          </p>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
 className="mt-2 text-sm font-medium text-yellow-700 hover:text-yellow-900 underline"
            >
              {action.label}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
 className="flex-shrink-0 text-yellow-500 hover:text-yellow-700"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
