"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

const SCROLL_AMOUNT = 120;

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const isPill = variant === "pill";
  const isSm = size === "sm";

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    if (isPill) return;
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });

    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [isPill, updateScrollState]);

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

  const tablistClasses = isPill
    ? cn(
        "flex gap-1 p-1 bg-v2-bg-dark rounded-lg border border-v2-border-light w-fit",
        className
      )
    : cn(
        "flex gap-2 px-1 overflow-x-auto scrollbar-hide border-b border-v2-border-light",
        className
      );

  const stickyWrapper = sticky
    ? "sticky top-0 z-[5] bg-v2-bg-surface border-b border-v2-border-light"
    : undefined;

  const tablist = (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={tablistClasses}
      ref={isPill ? undefined : scrollRef}
    >
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

  // Pill variant: no scroll hint wrapper
  if (isPill) {
    if (stickyWrapper) {
      return <div className={stickyWrapper}>{tablist}</div>;
    }
    return tablist;
  }

  // Underline variant: wrap in relative container for scroll hints
  const scrollHintWrapper = (
    <div className="relative">
      {tablist}

      {/* Left gradient + chevron */}
      {canScrollLeft && (
        <div className="absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-v2-bg-surface via-v2-bg-surface/80 to-transparent pointer-events-none flex items-center pl-1">
          <button
            aria-label="Scroll tabs left"
            tabIndex={-1}
            className="pointer-events-auto min-h-[32px] min-w-[32px] flex items-center justify-center text-v2-gold-accent hover:text-v2-bg-dark bg-v2-gold-primary/90 hover:bg-v2-gold-primary rounded-full shadow-md transition-colors"
            onClick={() =>
              scrollRef.current?.scrollBy({
                left: -SCROLL_AMOUNT,
                behavior: "smooth",
              })
            }
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Right gradient + chevron */}
      {canScrollRight && (
        <div className="absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-v2-bg-surface via-v2-bg-surface/80 to-transparent pointer-events-none flex items-center justify-end pr-1">
          <button
            aria-label="Scroll tabs right"
            tabIndex={-1}
            className="pointer-events-auto min-h-[32px] min-w-[32px] flex items-center justify-center text-v2-gold-accent hover:text-v2-bg-dark bg-v2-gold-primary/90 hover:bg-v2-gold-primary rounded-full shadow-md transition-colors"
            onClick={() =>
              scrollRef.current?.scrollBy({
                left: SCROLL_AMOUNT,
                behavior: "smooth",
              })
            }
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );

  if (stickyWrapper) {
    return <div className={stickyWrapper}>{scrollHintWrapper}</div>;
  }

  return scrollHintWrapper;
}
