"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/lib/navigation";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { FinanceTabBar, FinanceTab, FINANCE_TABS } from "./FinanceTabBar";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { Button } from "@/components/Button";
import { BaseModal } from "@/components/modals/BaseModal";
import { AddTransactionForm } from "@/features/transaction/forms/AddTransactionForm";
import { TransferMoneyForm } from "@/features/wallet/forms/TransferMoneyForm";
import { CreateWalletForm } from "@/features/wallet/forms/CreateWalletForm";
import { PlusIcon } from "@/components/icons/ui";
import { TransferIcon } from "@/components/icons/finance";
import {
  EVENT_WalletListWallets,
  EVENT_WalletGetTotalBalance,
  EVENT_TransactionListTransactions,
} from "@/utils/generated/hooks";

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

type ModalType = "add-transaction" | "transfer-money" | "create-wallet" | null;

function FinancePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("nav");
  const tActions = useTranslations("finance.actions");
  const tModal = useTranslations("modals.titles");
  const queryClient = useQueryClient();
  const [modalType, setModalType] = useState<ModalType>(null);

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

  const handleModalClose = () => setModalType(null);

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0] as string;
        return [
          EVENT_WalletListWallets,
          EVENT_WalletGetTotalBalance,
          EVENT_TransactionListTransactions,
        ].includes(key);
      },
    });
    setModalType(null);
  };

  const getModalTitle = () => {
    switch (modalType) {
      case "add-transaction":
        return tModal("addTransaction");
      case "transfer-money":
        return tModal("transferMoney");
      case "create-wallet":
        return tModal("createWallet");
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col">
      <div className="px-4 sm:px-6 pt-4 pb-2">
        <h1 className="text-lg sm:text-xl font-bold text-v2-gold-accent">
          {t("financePageTitle")}
        </h1>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 overflow-x-auto pb-2 px-4 sm:px-6">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<PlusIcon className="w-4 h-4" />}
          fullWidth={false}
          onClick={() => setModalType("add-transaction")}
          className="whitespace-nowrap min-h-[44px]"
        >
          {tActions("addTransaction")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<TransferIcon className="w-4 h-4" />}
          fullWidth={false}
          onClick={() => setModalType("transfer-money")}
          className="whitespace-nowrap min-h-[44px]"
        >
          {tActions("transferMoney")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<PlusIcon className="w-4 h-4" />}
          fullWidth={false}
          onClick={() => setModalType("create-wallet")}
          className="whitespace-nowrap min-h-[44px]"
        >
          {tActions("createWallet")}
        </Button>
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

      {/* Modals */}
      <BaseModal
        isOpen={modalType !== null}
        onClose={handleModalClose}
        title={getModalTitle()}
      >
        {modalType === "add-transaction" && (
          <AddTransactionForm onSuccess={handleModalSuccess} />
        )}
        {modalType === "transfer-money" && (
          <TransferMoneyForm onSuccess={handleModalSuccess} />
        )}
        {modalType === "create-wallet" && (
          <CreateWalletForm onSuccess={handleModalSuccess} />
        )}
      </BaseModal>
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
