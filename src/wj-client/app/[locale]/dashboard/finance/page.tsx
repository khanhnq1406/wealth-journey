"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import { useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { FinanceTabBar, FinanceTab, FINANCE_TABS } from "./FinanceTabBar";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";

const TransactionContent = dynamic(
  () =>
    import("../transaction/page").then((mod) => mod.TransactionContent),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);

const ReportContent = dynamic(
  () => import("../report/page").then((mod) => mod.ReportContent),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);

const BudgetContent = dynamic(
  () => import("../budget/page").then((mod) => mod.BudgetContent),
  { ssr: false, loading: () => <TabLoadingFallback /> }
);

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <LoadingSpinner />
    </div>
  );
}

function FinancePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("nav");

  const rawTab = searchParams.get("tab");
  const activeTab: FinanceTab =
    rawTab && FINANCE_TABS.includes(rawTab as FinanceTab)
      ? (rawTab as FinanceTab)
      : "transaction";

  const handleTabChange = useCallback(
    (tab: FinanceTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`/dashboard/finance?${params.toString()}`);
    },
    [searchParams, router]
  );

  return (
    <div className="flex flex-col">
      <div className="px-4 sm:px-6 pt-4 pb-2">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
          {t("financePageTitle")}
        </h1>
      </div>

      <FinanceTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "transaction" && <TransactionContent />}
        {activeTab === "report" && <ReportContent />}
        {activeTab === "budget" && <BudgetContent />}
      </div>
    </div>
  );
}

export default function FinancePage() {
  return (
    <Suspense fallback={<TabLoadingFallback />}>
      <FinancePageInner />
    </Suspense>
  );
}
