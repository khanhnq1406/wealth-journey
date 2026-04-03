"use client";

import { useTranslations } from "next-intl";
import { TabBar } from "@/components/navigation/TabBar";

export type FinanceTab = "transaction" | "report" | "budget";

export const FINANCE_TABS: FinanceTab[] = ["transaction", "report", "budget"];

interface FinanceTabBarProps {
  activeTab: FinanceTab;
  onTabChange: (tab: FinanceTab) => void;
}

export function FinanceTabBar({ activeTab, onTabChange }: FinanceTabBarProps) {
  const t = useTranslations("finance.tabs");

  const tabs = FINANCE_TABS.map((tab) => ({
    id: tab,
    label: t(tab),
  }));

  return (
    <TabBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      sticky
      ariaLabel="Finance sections"
    />
  );
}
