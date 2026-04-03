"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils/cn";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface TabBarProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  variant?: "underline" | "pill";
  size?: "sm" | "md";
  fullWidthOnMobile?: boolean;
  sticky?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function TabBar<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  variant = "underline",
  size = "md",
  fullWidthOnMobile = true,
  sticky = false,
  className,
  ariaLabel,
}: TabBarProps<T>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const enabledIndexes = tabs
    .map((tab, i) => (!tab.disabled ? i : -1))
    .filter((i) => i !== -1);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const currentPos = enabledIndexes.indexOf(index);
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          nextIndex = enabledIndexes[(currentPos + 1) % enabledIndexes.length];
          break;
        case "ArrowLeft":
          nextIndex =
            enabledIndexes[
              (currentPos - 1 + enabledIndexes.length) % enabledIndexes.length
            ];
          break;
        case "Home":
          nextIndex = enabledIndexes[0];
          break;
        case "End":
          nextIndex = enabledIndexes[enabledIndexes.length - 1];
          break;
        default:
          return;
      }

      e.preventDefault();
      if (nextIndex !== null) {
        onTabChange(tabs[nextIndex].id);
        tabRefs.current[nextIndex]?.focus();
      }
    },
    [enabledIndexes, onTabChange, tabs]
  );

  const isPill = variant === "pill";
  const isSm = size === "sm";

  const tablistClasses = isPill
    ? cn(
        "flex gap-1 p-1 bg-v2-bg-dark rounded-lg border border-v2-border-light w-fit",
        className
      )
    : cn(
        "flex overflow-x-auto scrollbar-hide border-b border-v2-border-light",
        className
      );

  const stickyWrapper = sticky
    ? "sticky top-0 z-[5] bg-v2-bg-surface border-b border-v2-border-light"
    : undefined;

  const tablist = (
    <div role="tablist" aria-label={ariaLabel} className={tablistClasses}>
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;

        const buttonClasses = isPill
          ? cn(
              "min-h-[44px] px-4 rounded-md font-medium transition-colors cursor-pointer",
              "focus-visible:ring-2 focus-visible:ring-v2-gold-primary outline-none",
              isSm ? "py-1.5 text-xs" : "py-2 text-sm",
              isActive
                ? "bg-v2-gold-primary text-v2-bg-dark font-semibold"
                : "text-v2-text-tertiary hover:text-v2-gold-accent",
              tab.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
            )
          : cn(
              "whitespace-nowrap min-h-[44px] font-medium transition-colors relative cursor-pointer",
              "focus-visible:ring-2 focus-visible:ring-v2-gold-primary outline-none",
              isSm ? "py-2 text-xs" : "py-3 text-sm",
              fullWidthOnMobile
                ? "flex-1 sm:flex-initial sm:px-6"
                : "px-4 sm:px-6",
              isActive
                ? "border-b-2 border-v2-gold-primary text-v2-gold-accent font-semibold"
                : "text-v2-text-tertiary hover:text-v2-gold-accent",
              tab.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
            );

        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            id={`tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={buttonClasses}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  if (stickyWrapper) {
    return <div className={stickyWrapper}>{tablist}</div>;
  }

  return tablist;
}
