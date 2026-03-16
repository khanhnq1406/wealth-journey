"use client";

import { useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export type FinanceTab = "transaction" | "report" | "budget";

export const FINANCE_TABS: FinanceTab[] = ["transaction", "report", "budget"];

interface FinanceTabBarProps {
  activeTab: FinanceTab;
  onTabChange: (tab: FinanceTab) => void;
}

export function FinanceTabBar({ activeTab, onTabChange }: FinanceTabBarProps) {
  const t = useTranslations("finance.tabs");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          nextIndex = (index + 1) % FINANCE_TABS.length;
          break;
        case "ArrowLeft":
          nextIndex =
            (index - 1 + FINANCE_TABS.length) % FINANCE_TABS.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = FINANCE_TABS.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      onTabChange(FINANCE_TABS[nextIndex]);
      tabRefs.current[nextIndex]?.focus();
    },
    [onTabChange]
  );

  return (
    <div
      role="tablist"
      aria-label="Finance sections"
      className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
    >
      <div className="flex">
        {FINANCE_TABS.map((tab, index) => (
          <button
            key={tab}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`tabpanel-${tab}`}
            id={`tab-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => onTabChange(tab)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex-1 sm:flex-initial sm:px-6 py-3 text-sm font-medium transition-colors relative",
              "min-h-[44px]",
              activeTab === tab
                ? "text-bg font-semibold"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            )}
          >
            {t(tab)}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-bg transition-all duration-200" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
