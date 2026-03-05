"use client";

import { useState } from "react";
import { BaseCard } from "@/components/BaseCard";
import { Wallets } from "./Walllets";
import { Balance } from "./Balance";
import { Dominance } from "./Dominance";
import { MonthlyDominance } from "./MonthlyDominance";
import { AccountBalance } from "./AccountBalance";
import { User } from "./User";
import { TotalBalance } from "./TotalBalance";
import { FunctionalButton } from "./FunctionalButtons";
import {
  useQueryListWallets,
  useQueryGetAvailableYears,
  EVENT_WalletGetBalanceHistory,
  EVENT_WalletGetMonthlyDominance,
} from "@/utils/generated/hooks";
import { BaseModal } from "@/components/modals/BaseModal";
import { CreateWalletForm } from "@/features/wallet/forms/CreateWalletForm";
import { AddTransactionForm } from "@/features/transaction/forms/AddTransactionForm";
import { TransferMoneyForm } from "@/features/wallet/forms/TransferMoneyForm";
import { useQueryClient } from "@tanstack/react-query";
import {
  EVENT_WalletListWallets,
  EVENT_WalletGetTotalBalance,
  EVENT_TransactionListTransactions,
} from "@/utils/generated/hooks";

type ModalType = "add-transaction" | "transfer-money" | "create-wallet" | null;

export default function Home() {
  const queryClient = useQueryClient();
  const [modalType, setModalType] = useState<ModalType>(null);
  // Mobile collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    analytics: false,
    quickActions: false,
  });

  const getListWallets = useQueryListWallets(
    {
      pagination: { page: 1, pageSize: 10, orderBy: "", order: "" },
    },
    { refetchOnMount: "always" },
  );

  // Fetch available years once and pass to child components
  const { data: availableYearsData } = useQueryGetAvailableYears(
    {},
    { refetchOnMount: "always" },
  );

  // Use available years from API, or default to current year if no transactions
  const availableYears = availableYearsData?.years?.length
    ? availableYearsData.years
    : [new Date().getFullYear()];

  const handleModalClose = () => setModalType(null);

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0] as string;
        return [
          EVENT_WalletListWallets,
          EVENT_WalletGetTotalBalance,
          EVENT_TransactionListTransactions,
          EVENT_WalletGetBalanceHistory,
          EVENT_WalletGetMonthlyDominance,
        ].includes(key);
      },
    });
    handleModalClose();
  };

  const getModalTitle = () => {
    switch (modalType) {
      case "add-transaction":
        return "Add Transaction";
      case "transfer-money":
        return "Transfer Money";
      case "create-wallet":
        return "Create Wallet";
      default:
        return "";
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="lg:grid lg:grid-cols-[70%_30%] lg:divide-x-2 lg:min-h-0 !border-l-0">
      {/* Mobile-optimized header with Total Balance */}
      {/* Top Section: Always visible - Most important */}
      <div className="lg:hidden bg-gradient-to-b from-primary-50 to-neutral-50 px-3 py-4 mb-2 rounded-lg">
        <div className="w-full max-w-md mx-auto">
          <TotalBalance />
        </div>
      </div>

      {/* Main content area - mobile-optimized spacing */}
      <div className="flex justify-center px-3 py-2 lg:py-4 lg:px-4 pb-20 lg:pb-4 ">
        <div className="w-full max-w-4xl">
          {/* Top Section: My Wallets - always visible (highest priority) */}
          <section className="mb-3 lg:mb-4">
            <h2 className="text-base sm:text-lg lg:text-xl font-bold text-neutral-800 mb-2">
              My Wallets
            </h2>
            <BaseCard mobileOptimized>
              <Wallets getListWallets={getListWallets} />
            </BaseCard>
          </section>

          {/* Mobile Quick Actions Section - Horizontal scroll for buttons */}
          <section className="mb-3 lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setModalType("add-transaction")}
                className="flex-shrink-0 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium shadow-sm active:shadow-md transition-shadow"
              >
                + Add Transaction
              </button>
              <button
                onClick={() => setModalType("transfer-money")}
                className="flex-shrink-0 px-4 py-2 bg-white text-neutral-700 rounded-lg text-sm font-medium shadow-sm active:shadow-md transition-shadow border border-neutral-200"
              >
                Transfer
              </button>
              <button
                onClick={() => setModalType("create-wallet")}
                className="flex-shrink-0 px-4 py-2 bg-white text-neutral-700 rounded-lg text-sm font-medium shadow-sm active:shadow-md transition-shadow border border-neutral-200"
              >
                New Wallet
              </button>
            </div>
          </section>

          {/* Middle Section: Balance Trend - Always visible but compact on mobile */}
          <section className="mb-3 lg:mb-4">
            <h2 className="text-base sm:text-lg lg:text-xl font-bold text-neutral-800 mb-2">
              Balance Trend
            </h2>
            <BaseCard mobileOptimized>
              <Balance availableYears={availableYears} />
            </BaseCard>
          </section>

          {/* Bottom Section: Analytics - Collapsible on mobile, always visible on desktop */}
          {/* <details
            className="lg:open group mb-3 lg:mb-4"
            open={expandedSections.analytics}
          >
            <summary
              className="cursor-pointer list-none"
              onClick={(e) => {
                // Only toggle manually on mobile to prevent double-toggle
                if (window.innerWidth < 1024) {
                  e.preventDefault();
                  toggleSection("analytics");
                }
              }}
            >
              <h2 className="text-base sm:text-lg lg:text-xl font-bold text-neutral-800 mb-2 flex items-center justify-between">
                Analytics
                <svg
                  className={`w-5 h-5 lg:hidden transition-transform ${
                    expandedSections.analytics ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </h2>
            </summary>
            {expandedSections.analytics || window.innerWidth >= 1024 ? ( */}
          <div className="space-y-3 lg:space-y-4">
            {/* Dominance */}
            <div>
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-neutral-700 mb-2">
                Dominance
              </h3>
              <BaseCard mobileOptimized noMobileMargin>
                <Dominance availableYears={availableYears} />
              </BaseCard>
            </div>

            {/* Monthly Dominance */}
            <div>
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-neutral-700 mb-2">
                Monthly Dominance
              </h3>
              <BaseCard mobileOptimized noMobileMargin>
                <MonthlyDominance availableYears={availableYears} />
              </BaseCard>
            </div>

            {/* Account Balance */}
            <div>
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-neutral-700 mb-2">
                Account Balance
              </h3>
              <BaseCard mobileOptimized noMobileMargin>
                <AccountBalance availableYears={availableYears} />
              </BaseCard>
            </div>
          </div>
          {/* ) : null}
          </details> */}
        </div>
      </div>

      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden lg:block px-4">
        <div className="grid divide-y-2 sticky top-4">
          <User />
          <TotalBalance />
          <FunctionalButton onOpenModal={(type) => setModalType(type)} />
        </div>
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
