"use client";

import { memo, useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";

export interface BaseCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  shadow?: "sm" | "md" | "lg" | "none";
  hover?: boolean;
  onClick?: () => void;
  /**
   * Mobile-optimized variant with reduced spacing and touch-friendly areas
   * - Tighter padding on mobile (p-3 vs p-4)
   * - Smaller border radius on mobile (rounded-md vs rounded-lg)
   * - Larger touch target when clickable (min-h-[44px])
   */
  mobileOptimized?: boolean;
  /**
   * Remove bottom margin on mobile for better stacking
   */
  noMobileMargin?: boolean;
  /**
   * Enable collapsible content with expand/collapse toggle
   * Shows a chevron icon that rotates when expanded
   */
  collapsible?: boolean;
  /**
   * Enable collapsible only on mobile (sm breakpoint and below)
   * Content is always expanded on desktop (md breakpoint and above)
   */
  collapsibleOnMobile?: boolean;
  /**
   * Initial collapsed state (default: false = expanded)
   * Only applies when collapsible or collapsibleOnMobile is true
   */
  defaultCollapsed?: boolean;
  /**
   * Custom header element to show when collapsed
   * If not provided, children will be used as the header
   */
  collapsedHeader?: React.ReactNode;
  /**
   * Accessibility label for the collapse toggle button
   */
  collapseAriaLabel?: string;
}

export const BaseCard = memo(function BaseCard({
  children,
  className,
  padding = "md",
  shadow = "md",
  hover = false,
  onClick,
  mobileOptimized = false,
  noMobileMargin = false,
  collapsible = false,
  collapsibleOnMobile = false,
  defaultCollapsed = false,
  collapsedHeader,
  collapseAriaLabel = "Toggle content",
}: BaseCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed((prev) => !prev);
  }, []);

  const paddingClasses = {
    none: "",
    sm: mobileOptimized ? "p-2 sm:p-3 lg:p-4" : "p-3 sm:p-4",
    md: mobileOptimized ? "p-2 sm:p-3 lg:p-5" : "p-4 sm:p-6",
    lg: mobileOptimized ? "p-3 sm:p-4 lg:p-6" : "p-6 sm:p-8",
  };

  const shadowClasses = {
    none: "",
    sm: "shadow-sm",
    md: "shadow-card",
    lg: "shadow-lg",
  };

  const isCollapsible = collapsible || collapsibleOnMobile;
  const shouldCollapse = isCollapsible && (
    collapsibleOnMobile ? isCollapsed : true
  );

  return (
    <div
      className={cn(
        "bg-v2-bg-surface text-white",
        "border border-v2-border-light border-t-2 border-t-v2-gold-primary",
        mobileOptimized ? "rounded-sm sm:rounded-md lg:rounded-lg" : "rounded-lg",
        paddingClasses[padding],
        shadowClasses[shadow],
        // Mobile-specific optimizations
        noMobileMargin ? "" : "mb-2 sm:mb-3 lg:mb-4",
        // Hover effect with transition
        hover && "hover:bg-v2-bg-surface-tint hover:shadow-card-hover cursor-pointer transition-shadow duration-200",
        // Clickable cards get larger touch target on mobile
        onClick && "cursor-pointer active:shadow-card-active",
        "transition-colors duration-200",
        className
      )}
      onClick={onClick}
    >
      {isCollapsible ? (
        <div className="space-y-3">
          {/* Collapsible Header */}
          <div
            className={cn(
              "flex items-center justify-between gap-2",
              // Touch-friendly minimum height
              "min-h-[44px]",
              // Smooth transition
              "transition-all duration-200"
            )}
          >
            <div className="flex-1 min-w-0">
              {collapsedHeader || children}
            </div>
            <button
              type="button"
              onClick={handleToggle}
              aria-label={collapseAriaLabel}
              aria-expanded={!shouldCollapse}
              className={cn(
                "flex items-center justify-center",
                "min-h-[44px] min-w-[44px]",
                "text-v2-text-secondary hover:text-v2-gold-primary",
                "active:text-v2-gold-accent",
                "transition-colors duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-bg-surface",
                "rounded-md",
                // Hide chevron on desktop when collapsibleOnMobile
                collapsibleOnMobile && "md:hidden"
              )}
            >
              <svg
                className={cn(
                  "w-5 h-5 transition-transform duration-200 flex-shrink-0",
                  shouldCollapse ? "-rotate-90" : "rotate-0"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          {/* Collapsible Content */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-200 ease-in-out",
              // Mobile-only collapse: hide on mobile, show on desktop
              collapsibleOnMobile && "md:block",
              // Full collapse: respect collapsed state
              collapsible && !collapsibleOnMobile && !shouldCollapse && "block",
              // Hidden states
              (collapsibleOnMobile && isCollapsed) || (collapsible && !collapsibleOnMobile && shouldCollapse)
                ? "hidden"
                : ""
            )}
          >
            {/* Only render full children if this is the content area */}
            {collapsedHeader && children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
});
