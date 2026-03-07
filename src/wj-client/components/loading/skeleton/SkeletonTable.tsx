"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";
import { useTranslations } from "next-intl";

/**
 * SkeletonTable - Table skeleton for data tables
 * Note: This is also exported from SkeletonList.tsx for convenience
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
   * Whether to show footer
   * @default false
   */
  showFooter?: boolean;

  /**
   * Whether to show action column
   * @default false
   */
  showActions?: boolean;

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
   * Column widths (as array of grid span classes or percentages)
   */
  columnWidths?: Array<"narrow" | "medium" | "wide" | "auto">;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
  showFooter = false,
  showActions = false,
  variant = "shimmer",
  className,
  columnWidths,
}: SkeletonTableProps) {
  const getColSpan = (type: "narrow" | "medium" | "wide" | "auto") => {
    switch (type) {
      case "narrow":
        return "col-span-2";
      case "medium":
        return "col-span-3";
      case "wide":
        return "col-span-4";
      case "auto":
      default:
        return "col-span-3";
    }
  };

  const getHeaderColSpan = (type: "narrow" | "medium" | "wide" | "auto") => {
    switch (type) {
      case "narrow":
        return 2;
      case "medium":
        return 3;
      case "wide":
        return 4;
      case "auto":
      default:
        return 3;
    }
  };

  const t = useTranslations("skeleton");
  const totalColumns = columns + (showActions ? 1 : 0);
  const animationClass = variant === "shimmer" ? "animate-shimmer" : "animate-pulse";

  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden",
        className
      )}
      aria-busy="true"
      aria-label={t("loading")}
    >
      {/* Header */}
      {showHeader && (
        <div className="hidden sm:flex bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          {Array.from({ length: columns }).map((_, index) => {
            const colType = columnWidths?.[index] || "auto";
            return (
              <div
                key={`header-${index}`}
                className={cn(
                  "px-4 py-3",
                  getColSpan(colType)
                )}
              >
                <div className={cn(
                  "h-4 bg-gray-200 dark:bg-gray-600 rounded",
                  animationClass
                )} />
              </div>
            );
          })}
          {showActions && (
            <div className="px-4 py-3 col-span-2">
              <div className={cn(
                "h-4 bg-gray-200 dark:bg-gray-600 rounded",
                animationClass
              )} />
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="group"
          >
            {/* Mobile Row */}
            <div className="sm:hidden px-4 py-3 space-y-2">
              <div className={cn(
                "h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4",
                animationClass
              )} />
              <div className={cn(
                "h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2",
                animationClass
              )} />
            </div>

            {/* Desktop Row */}
            <div className="hidden sm:grid grid-cols-12 gap-0 px-4 py-3 sm:py-4 items-center">
              {Array.from({ length: columns }).map((_, colIndex) => {
                const colType = columnWidths?.[colIndex] || "auto";
                const colSpan = getHeaderColSpan(colType);
                return (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className={cn("col-span-" + colSpan)}
                  >
                    <div
                      className={cn(
                        "h-4 bg-gray-200 dark:bg-gray-700 rounded",
                        animationClass
                      )}
                      style={{
                        width: colIndex === columns - 1 && !showActions ? "70%" : "100%",
                      }}
                    />
                  </div>
                );
              })}

              {/* Action Buttons */}
              {showActions && (
                <div className="col-span-2 flex items-center gap-2 justify-end">
                  <div className={cn(
                    "w-8 h-8 rounded bg-gray-200 dark:bg-gray-700",
                    animationClass
                  )} />
                  <div className={cn(
                    "w-8 h-8 rounded bg-gray-200 dark:bg-gray-700",
                    animationClass
                  )} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {showFooter && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className={cn(
            "h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/4",
            animationClass
          )} />
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded bg-gray-200 dark:bg-gray-600",
              animationClass
            )} />
            <div className={cn(
              "w-8 h-8 rounded bg-gray-200 dark:bg-gray-600",
              animationClass
            )} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SkeletonTableRow - Single table row skeleton
 */
export interface SkeletonTableRowProps {
  /**
   * Number of columns
   * @default 4
   */
  columns?: number;

  /**
   * Whether to show actions
   * @default false
   */
  showActions?: boolean;

  /**
   * Column types
   */
  columnTypes?: Array<"narrow" | "medium" | "wide">;

  /**
   * Animation variant
   */
  variant?: "shimmer" | "pulse";

  /**
   * Additional class name
   */
  className?: string;
}

export function SkeletonTableRow({
  columns = 4,
  showActions = false,
  columnTypes,
  variant = "shimmer",
  className,
}: SkeletonTableRowProps) {
  const animationClass = variant === "shimmer" ? "animate-shimmer" : "animate-pulse";

  return (
    <div
      className={cn(
        "px-4 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0",
        className
      )}
    >
      {/* Mobile */}
      <div className="sm:hidden space-y-2">
        <div className={cn(
          "h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4",
          animationClass
        )} />
        <div className={cn(
          "h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2",
          animationClass
        )} />
      </div>

      {/* Desktop */}
      <div className="hidden sm:grid grid-cols-12 gap-4 items-center">
        {Array.from({ length: columns }).map((_, index) => {
          const type = columnTypes?.[index] || "medium";
          const colSpan = type === "narrow" ? 2 : type === "wide" ? 4 : 3;
          return (
            <div key={index} className={`col-span-${colSpan}`}>
              <div
                className={cn(
                  "h-4 bg-gray-200 dark:bg-gray-700 rounded",
                  animationClass
                )}
              />
            </div>
          );
        })}

        {showActions && (
          <div className="col-span-2 flex items-center justify-end gap-2">
            <div className={cn(
              "w-8 h-8 rounded bg-gray-200 dark:bg-gray-700",
              animationClass
            )} />
            <div className={cn(
              "w-8 h-8 rounded bg-gray-200 dark:bg-gray-700",
              animationClass
            )} />
          </div>
        )}
      </div>
    </div>
  );
}
