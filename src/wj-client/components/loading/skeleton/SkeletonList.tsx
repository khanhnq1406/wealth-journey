"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";
import { SkeletonText } from "./SkeletonText";
import { useTranslations } from "next-intl";

export interface SkeletonListItemProps {
  /**
   * Whether to show avatar/icon
   * @default false
   */
  showAvatar?: boolean;

  /**
   * Whether to show thumbnail image
   * @default false
   */
  showThumbnail?: boolean;

  /**
   * Number of text lines
   * @default 2
   */
  lines?: number;

  /**
   * Whether to show action buttons
   * @default false
   */
  showActions?: boolean;

  /**
   * Item height (for consistent sizing)
   */
  height?: "sm" | "md" | "lg";

  /**
   * Animation variant
   * @default "shimmer"
   */
  variant?: "shimmer" | "pulse";

  /**
   * Additional class name
   */
  className?: string;
}

export function SkeletonListItem({
  showAvatar = false,
  showThumbnail = false,
  lines = 2,
  showActions = false,
  height = "md",
  variant = "shimmer",
  className,
}: SkeletonListItemProps) {
  const heightClasses = {
    sm: "py-2 px-3",
    md: "py-3 px-4",
    lg: "py-4 px-5",
  };

  const avatarSize = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const thumbnailSize = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  };

  return (
    <div
      className={cn(
 "flex items-center gap-3 sm:gap-4 bg-white",
 "border-b border-gray-200 last:border-b-0",
        heightClasses[height],
        className
      )}
      aria-hidden="true"
      role="presentation"
    >
      {/* Thumbnail */}
      {showThumbnail && (
        <div
          className={cn(
 "flex-shrink-0 rounded-lg bg-gray-200 animate-shimmer",
            thumbnailSize[height]
          )}
        />
      )}

      {/* Avatar */}
      {showAvatar && !showThumbnail && (
        <div
          className={cn(
 "flex-shrink-0 rounded-full bg-gray-200 animate-shimmer",
            avatarSize[height]
          )}
        />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <SkeletonText lines={lines} variant={variant} />
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-2 flex-shrink-0">
 <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gray-200 animate-shimmer" />
 <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gray-200 animate-shimmer" />
        </div>
      )}

      {/* Value/Amount */}
      {!showActions && (
        <div className="flex-shrink-0 w-16 sm:w-20">
          <SkeletonText lines={1} width="100%" height="h-5" variant={variant} />
        </div>
      )}
    </div>
  );
}

export interface SkeletonListProps {
  /**
   * Number of items to display
   * @default 5
   */
  count?: number;

  /**
   * Item configuration
   */
  itemProps?: SkeletonListItemProps;

  /**
   * Whether items are contained in a card
   * @default false
   */
  card?: boolean;

  /**
   * Additional class name
   */
  className?: string;
}

export function SkeletonList({
  count = 5,
  itemProps,
  card = false,
  className,
}: SkeletonListProps) {
  const t = useTranslations("skeleton");
  const listContent = (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonListItem key={index} {...itemProps} />
      ))}
    </>
  );

  if (card) {
    return (
      <div
        className={cn(
 "bg-white rounded-xl border border-gray-200 overflow-hidden",
          className
        )}
        aria-busy="true"
        aria-label={t("loading")}
      >
        {listContent}
      </div>
    );
  }

  return (
    <div
 className={cn("divide-y divide-gray-200", className)}
      aria-busy="true"
      aria-label={t("loading")}
    >
      {listContent}
    </div>
  );
}

/**
 * SkeletonTable - Table skeleton for data tables
 */
export interface SkeletonTableProps {
  /**
   * Number of rows
   * @default 5
   */
  rows?: number;

  /**
   * Number of columns
   * @default 4
   */
  columns?: number;

  /**
   * Whether to show header
   * @default true
   */
  showHeader?: boolean;

  /**
   * Animation variant
   * @default "shimmer"
   */
  variant?: "shimmer" | "pulse";

  /**
   * Additional class name
   */
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
  variant = "shimmer",
  className,
}: SkeletonTableProps) {
  const t = useTranslations("skeleton");
  return (
    <div
      className={cn(
 "bg-white rounded-xl border border-gray-200 overflow-hidden",
        className
      )}
      aria-busy="true"
      aria-label={t("loading")}
    >
      {/* Header */}
      {showHeader && (
 <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
          {Array.from({ length: columns }).map((_, index) => (
            <div
              key={index}
              className={cn(
 "h-4 bg-gray-200 rounded animate-shimmer",
                index === 0 ? "col-span-4" : index === columns - 1 ? "col-span-2" : "col-span-3"
              )}
            />
          ))}
        </div>
      )}

      {/* Rows */}
 <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-12 gap-4 px-4 py-3 sm:py-4"
          >
            {/* Mobile: Show fewer columns */}
            <div className="col-span-12 sm:hidden space-y-2">
 <div className="h-4 bg-gray-200 rounded animate-shimmer w-3/4" />
 <div className="h-3 bg-gray-200 rounded animate-shimmer w-1/2" />
            </div>

            {/* Desktop: Show all columns */}
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className={cn(
 "hidden sm:block h-4 bg-gray-200 rounded animate-shimmer",
                  colIndex === 0 ? "col-span-4" : colIndex === columns - 1 ? "col-span-2" : "col-span-3"
                )}
                style={{
                  width: colIndex === columns - 1 ? "60%" : "100%",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
