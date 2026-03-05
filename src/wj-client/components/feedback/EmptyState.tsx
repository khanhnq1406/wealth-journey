"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export interface EmptyStateProps {
  /**
   * Icon to display
   */
  icon?: React.ReactNode;

  /**
   * Title/headline
   */
  title?: string;

  /**
   * Description text
   */
  description?: string;

  /**
   * Primary action button
   */
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };

  /**
   * Secondary action link/button
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };

  /**
   * Empty state variant for styling
   * @default "default"
   */
  variant?: "default" | "card" | "inline" | "minimal";

  /**
   * Size variant
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Content slot for custom content
   */
  children?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = "default",
  size = "md",
  className,
  children,
}: EmptyStateProps) {
  const t = useTranslations("feedback.emptyState");
  const resolvedTitle = title ?? t("noDataFound");
  const sizeClasses = {
    sm: {
      icon: "w-10 h-10 sm:w-12 sm:h-12",
      title: "text-base sm:text-lg",
      description: "text-sm",
      padding: "p-4 sm:p-6",
    },
    md: {
      icon: "w-14 h-14 sm:w-16 sm:h-16",
      title: "text-lg sm:text-xl",
      description: "text-sm sm:text-base",
      padding: "p-6 sm:p-8",
    },
    lg: {
      icon: "w-16 h-16 sm:w-20 sm:h-20",
      title: "text-xl sm:text-2xl",
      description: "text-base sm:text-lg",
      padding: "p-8 sm:p-12",
    },
  };

  const variantClasses = {
    default: "text-center",
    card: cn(
      "bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700",
      "text-center"
    ),
    inline: "flex items-center gap-4 text-left",
    minimal: "text-center py-8",
  };

  const defaultIcon = (
    <svg
      className="w-full h-full text-gray-400 dark:text-gray-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );

  const content = (
    <div className={cn(variantClasses[variant], sizeClasses[size].padding, className)}>
      {/* Icon */}
      {icon && (
        <div className={cn(
          "mx-auto flex items-center justify-center",
          sizeClasses[size].icon,
          variant === "inline" && "mx-0",
          "mb-4",
          variant === "inline" && "mb-0 flex-shrink-0"
        )}>
          {icon}
        </div>
      )}

      {/* Title and Description */}
      <div className={cn(
        variant === "inline" && "text-left",
        "flex-1"
      )}>
        {resolvedTitle && (
          <h3 className={cn(
            "font-semibold text-gray-900 dark:text-gray-100",
            sizeClasses[size].title
          )}>
            {resolvedTitle}
          </h3>
        )}
        {description && (
          <p className={cn(
            "mt-2 text-gray-500 dark:text-gray-400 max-w-sm mx-auto",
            sizeClasses[size].description,
            variant === "inline" && "mx-0 max-w-none"
          )}>
            {description}
          </p>
        )}
      </div>

      {/* Custom Content */}
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className={cn(
          "flex items-center justify-center gap-3 mt-6",
          variant === "inline" && "mt-0 justify-start"
        )}>
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className={cn(
                "inline-flex items-center justify-center gap-2",
                "px-4 py-2 text-sm font-medium rounded-lg",
                "bg-green-600 text-white",
                "hover:bg-green-700",
                "active:scale-[0.98]",
                "transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
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
                "text-gray-700 dark:text-gray-300",
                "hover:bg-gray-100 dark:hover:bg-gray-800",
                "active:bg-gray-200 dark:active:bg-gray-700",
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
 * Preset empty states for common scenarios
 */

export interface EmptyStatePresetProps {
  /**
   * Preset type
   */
  type: "no-results" | "no-transactions" | "no-wallets" | "no-investments" | "no-budgets" | "no-categories" | "no-data" | "error";

  /**
   * Custom title (overrides preset)
   */
  title?: string;

  /**
   * Custom description (overrides preset)
   */
  description?: string;

  /**
   * Primary action
   */
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };

  /**
   * Secondary action
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
}

const presetIcons = {
  "no-results": (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  "no-transactions": (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  "no-wallets": (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  "no-investments": (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  "no-budgets": (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  "no-categories": (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  "no-data": (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  "error": (
    <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
};

const presetTranslationKeys: Record<string, { title: string; description: string }> = {
  "no-results": { title: "noResultsFound", description: "noResultsDescription" },
  "no-transactions": { title: "noTransactionsYet", description: "noTransactionsDescription" },
  "no-wallets": { title: "noWalletsFound", description: "noWalletsDescription" },
  "no-investments": { title: "noInvestmentsYet", description: "noInvestmentsDescription" },
  "no-budgets": { title: "noBudgetsSet", description: "noBudgetsDescription" },
  "no-categories": { title: "noCategories", description: "noCategoriesDescription" },
  "no-data": { title: "noDataAvailable", description: "noDataDescription" },
  "error": { title: "noDataFound", description: "noDataDescription" },
};

export function EmptyStatePreset({
  type,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = "default",
  className,
}: EmptyStatePresetProps) {
  const t = useTranslations("feedback.emptyState");
  const keys = presetTranslationKeys[type];
  const icon = presetIcons[type];

  return (
    <EmptyState
      icon={icon}
      title={title || t(keys.title as any)}
      description={description || t(keys.description as any)}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      variant={variant}
      className={className}
    />
  );
}
