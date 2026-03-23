"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";
import { SkeletonText } from "./SkeletonText";
import { useTranslations } from "next-intl";

export interface SkeletonCardProps {
  /**
   * Card size variant
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Whether to show header
   * @default true
   */
  showHeader?: boolean;

  /**
   * Whether to show avatar/icon
   * @default false
   */
  showAvatar?: boolean;

  /**
   * Number of content lines
   * @default 3
   */
  contentLines?: number;

  /**
   * Whether to show footer
   * @default false
   */
  showFooter?: boolean;

  /**
   * Animation variant
   * @default "shimmer"
   */
  variant?: "shimmer" | "pulse";

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Card aspect ratio (for image cards)
   */
  aspectRatio?: string;
}

export function SkeletonCard({
  size = "md",
  showHeader = true,
  showAvatar = false,
  contentLines = 3,
  showFooter = false,
  variant = "shimmer",
  className,
  aspectRatio,
}: SkeletonCardProps) {
  const sizeClasses = {
    sm: "p-4",
    md: "p-5 sm:p-6",
    lg: "p-6 sm:p-8",
  };

  const avatarSize = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  return (
    <div
      className={cn(
 "bg-v2-bg-surface rounded-xl border border-v2-border-light",
        sizeClasses[size],
        className
      )}
      aria-hidden="true"
      role="presentation"
    >
      {/* Image/Aspect Ratio placeholder */}
      {aspectRatio && (
        <div
 className="w-full bg-v2-bg-dark rounded-lg mb-4 animate-shimmer"
          style={{ aspectRatio }}
        />
      )}

      {/* Header */}
      {showHeader && (
        <div className="flex items-start gap-3 sm:gap-4 mb-4">
          {showAvatar && (
            <div
              className={cn(
 "flex-shrink-0 rounded-full bg-v2-bg-dark animate-shimmer",
                avatarSize[size]
              )}
            />
          )}
          <div className="flex-1 min-w-0">
            <SkeletonText lines={1} width="70%" height="h-5 sm:h-6" variant={variant} />
            <SkeletonText lines={1} width="40%" height="h-4" variant={variant} />
          </div>
        </div>
      )}

      {/* Content */}
      <SkeletonText lines={contentLines} variant={variant} />

      {/* Footer */}
      {showFooter && (
 <div className="mt-4 pt-4 border-t border-v2-border-light">
          <div className="flex items-center justify-between">
            <SkeletonText lines={1} width="30%" height="h-4" variant={variant} />
 <div className="w-20 h-8 rounded-lg bg-v2-bg-dark animate-shimmer" />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SkeletonCardGrid - Grid of skeleton cards
 */
export interface SkeletonCardGridProps {
  /**
   * Number of cards to display
   * @default 3
   */
  count?: number;

  /**
   * Grid columns on mobile
   * @default 1
   */
  cols?: 1 | 2;

  /**
   * Grid columns on desktop
   * @default 3
   */
  smCols?: 2 | 3 | 4;

  /**
   * Card size
   */
  cardSize?: "sm" | "md" | "lg";

  /**
   * Gap between cards
   * @default "md"
   */
  gap?: "sm" | "md" | "lg";

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Card props to pass through
   */
  cardProps?: Omit<SkeletonCardProps, "className">;
}

export function SkeletonCardGrid({
  count = 3,
  cols = 1,
  smCols = 3,
  cardSize = "md",
  gap = "md",
  className,
  cardProps,
}: SkeletonCardGridProps) {
  const t = useTranslations("skeleton");
  const gapClasses = {
    sm: "gap-3 sm:gap-4",
    md: "gap-4 sm:gap-6",
    lg: "gap-6 sm:gap-8",
  };

  const gridCols = {
    1: "grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
  };

  return (
    <div
      className={cn(
        "grid",
        cols === 2 ? "grid-cols-2" : "grid-cols-1",
        gridCols[smCols],
        gapClasses[gap],
        className
      )}
      aria-busy="true"
      aria-label={t("loading")}
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} size={cardSize} {...cardProps} />
      ))}
    </div>
  );
}
