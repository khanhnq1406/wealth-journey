"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";

export interface SkeletonTextProps {
  /**
   * Number of lines to display
   * @default 1
   */
  lines?: number;

  /**
   * Width of the skeleton (can be a percentage or Tailwind class)
   * @default "100%"
   */
  width?: string;

  /**
   * Height of each line (Tailwind class)
   * @default "h-4"
   */
  height?: string;

  /**
   * Spacing between lines (Tailwind class)
   * @default "space-y-2"
   */
  spacing?: string;

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
   * Whether to start animation from random positions
   * @default false
   */
  randomDelay?: boolean;
}

export function SkeletonText({
  lines = 1,
  width = "100%",
  height = "h-4",
  spacing = "space-y-2",
  variant = "shimmer",
  className,
  randomDelay = false,
}: SkeletonTextProps) {
  const animationClass = variant === "shimmer" ? "animate-shimmer" : "animate-pulse";

  return (
    <div className={cn(spacing, className)} aria-hidden="true" role="presentation">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
 "rounded bg-gray-200",
            animationClass,
            height,
            index === lines - 1 && width !== "100%" ? "w-[var(--skeleton-width)]" : "w-full"
          )}
          style={
            index === lines - 1 && width !== "100%"
              ? ({
                  "--skeleton-width": width,
                  ...(randomDelay && {
                    animationDelay: `${(index * 0.1) % 0.5}s`,
                  }),
                } as React.CSSProperties)
              : { ...(randomDelay && { animationDelay: `${(index * 0.1) % 0.5}s` }) } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * SkeletonHeading - Larger text skeleton for headings
 */
export interface SkeletonHeadingProps {
  /**
   * Heading level (affects size)
   */
  level?: 1 | 2 | 3 | 4 | 5 | 6;

  /**
   * Width of the skeleton
   * @default "60%"
   */
  width?: string;

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

export function SkeletonHeading({
  level = 2,
  width = "60%",
  variant = "shimmer",
  className,
}: SkeletonHeadingProps) {
  const sizeClasses = {
    1: "h-8 sm:h-10",
    2: "h-7 sm:h-9",
    3: "h-6 sm:h-7",
    4: "h-5 sm:h-6",
    5: "h-4 sm:h-5",
    6: "h-4",
  };

  return (
    <SkeletonText
      lines={1}
      width={width}
      height={sizeClasses[level]}
      variant={variant}
      className={className}
    />
  );
}

/**
 * SkeletonParagraph - Multi-line text skeleton
 */
export interface SkeletonParagraphProps {
  /**
   * Number of lines
   * @default 3
   */
  lines?: number;

  /**
   * Width of the last line (to create visual variety)
   * @default "80%"
   */
  lastLineWidth?: string;

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

export function SkeletonParagraph({
  lines = 3,
  lastLineWidth = "80%",
  variant = "shimmer",
  className,
}: SkeletonParagraphProps) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true" role="presentation">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={cn(
 "h-4 rounded bg-gray-200",
            variant === "shimmer" ? "animate-shimmer" : "animate-pulse"
          )}
          style={{
            width: index === lines - 1 ? lastLineWidth : "100%",
            animationDelay: `${index * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
