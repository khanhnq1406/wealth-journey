"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";

export interface SkeletonAvatarProps {
  /**
   * Avatar size
   * @default "md"
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

  /**
   * Avatar shape
   * @default "circle"
   */
  shape?: "circle" | "square" | "rounded";

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
   * Alt text for accessibility
   * @default "Loading avatar"
   */
  alt?: string;
}

export function SkeletonAvatar({
  size = "md",
  shape = "circle",
  variant = "shimmer",
  className,
  alt = "Loading avatar",
}: SkeletonAvatarProps) {
  const sizeClasses = {
    xs: "w-6 h-6",
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-20 h-20",
    "2xl": "w-24 h-24",
  };

  const shapeClasses = {
    circle: "rounded-full",
    square: "rounded-none",
    rounded: "rounded-lg",
  };

  const animationClass = variant === "shimmer" ? "animate-shimmer" : "animate-pulse";

  return (
    <div
      className={cn(
 "flex-shrink-0 bg-gray-200",
        sizeClasses[size],
        shapeClasses[shape],
        animationClass,
        className
      )}
      role="img"
      aria-label={alt}
      aria-busy="true"
    />
  );
}

/**
 * SkeletonAvatarGroup - Group of multiple avatars
 */
export interface SkeletonAvatarGroupProps {
  /**
   * Number of avatars to display
   * @default 3
   */
  count?: number;

  /**
   * Avatar size
   */
  size?: "xs" | "sm" | "md" | "lg";

  /**
   * Maximum avatars to show before showing "+N" indicator
   * @default 3
   */
  max?: number;

  /**
   * Spacing between avatars
   * @default "md"
   */
  spacing?: "sm" | "md" | "lg";

  /**
   * Animation variant
   */
  variant?: "shimmer" | "pulse";

  /**
   * Additional class name
   */
  className?: string;
}

export function SkeletonAvatarGroup({
  count = 3,
  size = "md",
  max = 3,
  spacing = "md",
  variant = "shimmer",
  className,
}: SkeletonAvatarGroupProps) {
  const spacingClasses = {
    sm: "-space-x-2",
    md: "-space-x-3",
    lg: "-space-x-4",
  };

  const visibleCount = Math.min(count, max);
  const showMore = count > max;

  return (
    <div className={cn("flex items-center", className)} aria-busy="true">
      <div className={cn("flex", spacingClasses[spacing])}>
        {Array.from({ length: visibleCount }).map((_, index) => (
          <SkeletonAvatar
            key={index}
            size={size}
            variant={variant}
 className="ring-2 ring-white"
          />
        ))}
      </div>

      {/* More indicator */}
      {showMore && (
        <div
          className={cn(
            "ml-2 flex items-center justify-center",
 "bg-gray-200 rounded-full",
            variant === "shimmer" ? "animate-shimmer" : "animate-pulse",
            size === "xs" && "w-5 h-5 text-xs",
            size === "sm" && "w-6 h-6 text-xs",
            size === "md" && "w-8 h-8 text-sm",
            size === "lg" && "w-10 h-10 text-base"
          )}
        >
 <span className="text-gray-500 font-medium">
            +{count - max}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * SkeletonProfile - Complete profile skeleton with avatar and details
 */
export interface SkeletonProfileProps {
  /**
   * Avatar size
   * @default "xl"
   */
  avatarSize?: "lg" | "xl" | "2xl";

  /**
   * Whether to show additional info lines
   * @default true
   */
  showInfo?: boolean;

  /**
   * Number of info lines
   * @default 2
   */
  infoLines?: number;

  /**
   * Layout direction
   * @default "vertical"
   */
  layout?: "vertical" | "horizontal";

  /**
   * Animation variant
   */
  variant?: "shimmer" | "pulse";

  /**
   * Additional class name
   */
  className?: string;
}

export function SkeletonProfile({
  avatarSize = "xl",
  showInfo = true,
  infoLines = 2,
  layout = "vertical",
  variant = "shimmer",
  className,
}: SkeletonProfileProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4",
        layout === "horizontal" ? "flex-row" : "flex-col sm:flex-row",
        className
      )}
      aria-busy="true"
    >
      <SkeletonAvatar size={avatarSize} variant={variant} />

      {showInfo && (
        <div className="flex-1 space-y-2 w-full">
          <div
            className={cn(
 "h-5 bg-gray-200 rounded animate-shimmer w-3/4 sm:w-1/2"
            )}
          />
          {Array.from({ length: infoLines }).map((_, index) => (
            <div
              key={index}
              className={cn(
 "h-4 bg-gray-200 rounded animate-shimmer",
                index === infoLines - 1 ? "w-1/2" : "w-full"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
