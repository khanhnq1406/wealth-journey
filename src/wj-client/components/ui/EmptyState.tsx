"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { BaseCard } from "@/components/BaseCard";
import { cn } from "@/lib/utils/cn";

/**
 * EmptyState Component
 *
 * A component for displaying empty states (no data, no results, etc.).
 * Design system compliant with mobile-first approach.
 *
 * Features:
 * - Icon/illustration support with proper sizing
 * - Title and description with responsive typography
 * - Optional action buttons (single or multiple)
 * - Multiple size variants (sm, md, lg)
 * - Contained mode (with card wrapper)
 * - Dark mode support
 * - Touch-friendly buttons (min 44px)
 */

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: typeof ButtonType[keyof typeof ButtonType];
  icon?: React.ReactNode;
}

export interface EmptyStateProps {
  /** Title of the empty state */
  title: string;

  /** Description text */
  description?: string;

  /** Icon or illustration */
  icon?: React.ReactNode;

  /** Optional image URL (alternative to icon) */
  imageSrc?: string;

  /** Image alt text (required if imageSrc is provided) */
  imageAlt?: string;

  /** Action buttons */
  actions?: EmptyStateAction[];

  /** Action button label (deprecated - use actions instead) */
  actionLabel?: string;

  /** Action button click handler (deprecated - use actions instead) */
  onAction?: () => void;

  /** Size variant */
  size?: "sm" | "md" | "lg";

  /** Whether to wrap in a card */
  contained?: boolean;

  /** CSS class name */
  className?: string;

  /** Additional children content */
  children?: React.ReactNode;
}

const sizeStyles = {
  sm: {
    icon: "w-10 h-10 sm:w-12 sm:h-12",
    title: "text-base sm:text-lg",
    description: "text-xs sm:text-sm",
    padding: "py-6 sm:py-8",
  },
  md: {
    icon: "w-14 h-14 sm:w-16 sm:h-16",
    title: "text-lg sm:text-xl",
    description: "text-sm sm:text-base",
    padding: "py-8 sm:py-12",
  },
  lg: {
    icon: "w-16 h-16 sm:w-20 sm:h-20",
    title: "text-xl sm:text-2xl",
    description: "text-base sm:text-lg",
    padding: "py-10 sm:py-16",
  },
};

export function EmptyState({
  title,
  description,
  icon,
  imageSrc,
  imageAlt,
  actions = [],
  actionLabel,
  onAction,
  size = "md",
  contained = false,
  className = "",
  children,
}: EmptyStateProps) {
  const styles = sizeStyles[size];

  // Handle legacy actionLabel/onAction props
  const allActions = [...actions];
  if (actionLabel && onAction) {
    allActions.push({ label: actionLabel, onClick: onAction, variant: ButtonType.PRIMARY });
  }

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        "px-4 sm:px-6",
        styles.padding,
        className
      )}
    >
      {/* Icon or Image */}
      {(icon || imageSrc) && (
        <div
          className={cn(
            "mb-4 sm:mb-6 flex items-center justify-center",
 "text-neutral-400"
          )}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={imageAlt || title}
              className={cn(styles.icon, "object-contain")}
              loading="lazy"
            />
          ) : icon ? (
            <div className={styles.icon}>{icon}</div>
          ) : null}
        </div>
      )}

      {/* Title */}
      <h3
        className={cn(
 "font-semibold text-neutral-700 mb-2",
          styles.title
        )}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
 "text-neutral-500 max-w-md mx-auto mb-4 sm:mb-6",
            styles.description
          )}
        >
          {description}
        </p>
      )}

      {/* Action Buttons */}
      {allActions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-center justify-center w-full sm:w-auto">
          {allActions.map((action, index) => (
            <Button
              key={index}
              type={action.variant || ButtonType.PRIMARY}
              onClick={action.onClick}
              className="min-h-[44px] sm:min-h-[48px] px-4 sm:px-6"
              fullWidth={false}
            >
              {action.icon && (
                <span className="mr-2">{action.icon}</span>
              )}
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Additional content */}
      {children && (
        <div className="mt-4 sm:mt-6 w-full">{children}</div>
      )}
    </div>
  );

  if (contained) {
    return (
      <BaseCard className="w-full">
        {content}
      </BaseCard>
    );
  }

  return content;
}

/**
 * Preset empty states for common scenarios
 * Updated with design system styling and proper icons
 */
export const EmptyStates = {
  NoTransactions: (props: Omit<EmptyStateProps, "title" | "icon" | "description">) => {
    const t = useTranslations("emptyState");
    return (
      <EmptyState
        title={t("noTransactions.title")}
        description={t("noTransactions.description")}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        }
        {...props}
      />
    );
  },

  NoWallets: (props: Omit<EmptyStateProps, "title" | "icon" | "description">) => {
    const t = useTranslations("emptyState");
    return (
      <EmptyState
        title={t("noWallets.title")}
        description={t("noWallets.description")}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        }
        {...props}
      />
    );
  },

  NoInvestments: (props: Omit<EmptyStateProps, "title" | "icon" | "description">) => {
    const t = useTranslations("emptyState");
    return (
      <EmptyState
        title={t("noInvestments.title")}
        description={t("noInvestments.description")}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
        {...props}
      />
    );
  },

  NoResults: (props: Omit<EmptyStateProps, "title" | "icon" | "description">) => {
    const t = useTranslations("emptyState");
    return (
      <EmptyState
        title={t("noResults.title")}
        description={t("noResults.description")}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
        {...props}
      />
    );
  },

  NoBudgets: (props: Omit<EmptyStateProps, "title" | "icon" | "description">) => {
    const t = useTranslations("emptyState");
    return (
      <EmptyState
        title={t("noBudgets.title")}
        description={t("noBudgets.description")}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
        {...props}
      />
    );
  },

  NoCategories: (props: Omit<EmptyStateProps, "title" | "icon" | "description">) => {
    const t = useTranslations("emptyState");
    return (
      <EmptyState
        title={t("noCategories.title")}
        description={t("noCategories.description")}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        }
        {...props}
      />
    );
  },

  Error: (props: Omit<EmptyStateProps, "title" | "icon" | "description">) => {
    const t = useTranslations("emptyState");
    return (
      <EmptyState
        title={t("error.title")}
        description={t("error.description")}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-danger-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
        {...props}
      />
    );
  },

  NetworkError: (props: Omit<EmptyStateProps, "title" | "icon" | "description">) => {
    const t = useTranslations("emptyState");
    return (
      <EmptyState
        title={t("networkError.title")}
        description={t("networkError.description")}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        }
        {...props}
      />
    );
  },
};

export default EmptyState;
