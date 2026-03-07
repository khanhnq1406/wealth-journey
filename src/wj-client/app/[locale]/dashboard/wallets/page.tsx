"use client";

import { useState } from "react";
import { useQueryListWallets } from "@/utils/generated/hooks";
import { CardSkeleton } from "@/components/loading/Skeleton";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { WalletGrid } from "./WalletGrid";
import { Wallet } from "@/gen/protobuf/v1/wallet";
import { BaseModal } from "@/components/modals/BaseModal";
import { CreateWalletForm } from "@/features/wallet/forms/CreateWalletForm";
import { EditWalletForm } from "@/features/wallet/forms/EditWalletForm";
import { DeleteWalletModal } from "@/features/wallet/components/DeleteWalletModal";
import {
  EVENT_WalletListWallets,
  EVENT_WalletGetTotalBalance,
} from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { WalletListView } from "./WalletListView";
import { WalletCardEnhanced } from "./WalletCardEnhanced";
import { TransferMoneyForm } from "@/features/wallet/forms/TransferMoneyForm";
import { cn } from "@/lib/utils/cn";
import { useTranslations } from "next-intl";

type ViewMode = "grid" | "list";
type ModalState =
  | { type: "create-wallet" }
  | { type: "edit-wallet"; wallet: Wallet }
  | { type: "delete-wallet"; wallet: Wallet }
  | { type: "transfer"; fromWallet?: Wallet; toWallet?: Wallet }
  | null;

export default function WalletsPage() {
  const t = useTranslations("wallet");
  const tCommon = useTranslations("common");
  const tModals = useTranslations("modals");
  const queryClient = useQueryClient();
  const [modalState, setModalState] = useState<ModalState>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterType, setFilterType] = useState<"all" | "basic" | "investment">(
    "all",
  );

  const getListWallets = useQueryListWallets(
    { pagination: { page: 1, pageSize: 100, orderBy: "", order: "" } },
    { refetchOnMount: "always" },
  );

  const handleCreateWallet = () => {
    setModalState({ type: "create-wallet" });
  };

  const handleEditWallet = (wallet: Wallet) => {
    setModalState({ type: "edit-wallet", wallet });
  };

  const handleDeleteWallet = (wallet: Wallet) => {
    setModalState({ type: "delete-wallet", wallet });
  };

  const handleTransfer = (fromWallet: Wallet, toWallet?: Wallet) => {
    setModalState({ type: "transfer", fromWallet, toWallet });
  };

  const handleCloseModal = () => {
    setModalState(null);
  };

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [EVENT_WalletListWallets] });
    queryClient.invalidateQueries({ queryKey: [EVENT_WalletGetTotalBalance] });
    handleCloseModal();
  };

  const getModalTitle = () => {
    switch (modalState?.type) {
      case "create-wallet":
        return tModals("titles.createWallet");
      case "edit-wallet":
        return tModals("titles.editWallet");
      case "transfer":
        return tModals("titles.transferMoney");
      case "delete-wallet":
        return "";
      default:
        return "";
    }
  };

  if (getListWallets.isLoading) {
    return (
      <div className="flex flex-col gap-3 sm:gap-4 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="h-8 w-32 bg-neutral-200 rounded animate-pulse" />
          <div className="h-10 w-40 bg-neutral-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton lines={4} showAction={true} />
          <CardSkeleton lines={4} showAction={true} />
          <CardSkeleton lines={4} showAction={true} />
        </div>
      </div>
    );
  }

  if (getListWallets.error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-danger-600">{t("errorLoading")}</div>
        <Button
          type={ButtonType.PRIMARY}
          onClick={() => getListWallets.refetch()}
          className="w-fit px-5"
        >
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  const wallets = getListWallets.data?.wallets ?? [];

  return (
    <div className="flex flex-col gap-3 sm:gap-4 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
      {/* Header */}
      <div className="flex flex-col gap-4">
        {/* Title and Create Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-neutral-900 dark:text-dark-text">
            {t("title")}
          </h1>
          <Button
            type={ButtonType.PRIMARY}
            onClick={handleCreateWallet}
            fullWidth={false}
            className="px-4 py-2 rounded-md drop-shadow-round"
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="hidden sm:inline">{t("createNewWallet")}</span>
              <span className="sm:hidden">{t("newWallet")}</span>
            </div>
          </Button>
        </div>

        {/* Controls Bar - View Toggle & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-dark-surface-hover rounded-lg p-1 self-start">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 min-h-[40px]",
                viewMode === "grid"
                  ? "bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text shadow-sm"
                  : "text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text",
              )}
              aria-label={t("viewMode.grid")}
              aria-pressed={viewMode === "grid"}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 min-h-[40px]",
                viewMode === "list"
                  ? "bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text shadow-sm"
                  : "text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text",
              )}
              aria-label={t("viewMode.list")}
              aria-pressed={viewMode === "list"}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            {[
              { value: "all" as const, label: t("filterTypes.all") },
              { value: "basic" as const, label: t("filterTypes.cash") },
              { value: "investment" as const, label: t("filterTypes.investment") },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setFilterType(filter.value)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[40px]",
                  filterType === filter.value
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 dark:bg-dark-surface-hover text-gray-700 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-surface-active",
                )}
                aria-pressed={filterType === filter.value}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Wallet Display - Grid or List View */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {wallets
            .filter((w) => {
              if (filterType === "basic") return w.type === 0 || !w.type;
              if (filterType === "investment") return w.type === 1;
              return true;
            })
            .map((wallet) => (
              <WalletCardEnhanced
                key={wallet.id}
                wallet={wallet}
                onEdit={handleEditWallet}
                onDelete={handleDeleteWallet}
                onTransfer={handleTransfer}
              />
            ))}
        </div>
      ) : (
        <WalletListView
          wallets={wallets.filter((w) => {
            if (filterType === "basic") return w.type === 0 || !w.type;
            if (filterType === "investment") return w.type === 1;
            return true;
          })}
          onEdit={handleEditWallet}
          onDelete={handleDeleteWallet}
          onTransfer={handleTransfer}
          filterType={filterType}
        />
      )}

      {/* Create Wallet Modal */}
      {modalState?.type === "create-wallet" && (
        <BaseModal
          isOpen={modalState.type === "create-wallet"}
          onClose={handleCloseModal}
          title={getModalTitle()}
        >
          <CreateWalletForm onSuccess={handleModalSuccess} />
        </BaseModal>
      )}

      {/* Edit Wallet Modal */}
      {modalState?.type === "edit-wallet" && (
        <BaseModal
          isOpen={modalState.type === "edit-wallet"}
          onClose={handleCloseModal}
          title={getModalTitle()}
        >
          <EditWalletForm
            wallet={modalState.wallet}
            onSuccess={handleModalSuccess}
          />
        </BaseModal>
      )}

      {/* Transfer Money Modal */}
      {modalState?.type === "transfer" && (
        <BaseModal
          isOpen={modalState.type === "transfer"}
          onClose={handleCloseModal}
          title={getModalTitle()}
        >
          <TransferMoneyForm onSuccess={handleModalSuccess} />
        </BaseModal>
      )}

      {/* Delete Wallet Modal */}
      {modalState?.type === "delete-wallet" && (
        <div className="fixed inset-0 bg-modal flex justify-center items-center z-50">
          <div className="bg-white dark:bg-dark-surface rounded-lg p-6 max-w-md w-full mx-4">
            <DeleteWalletModal
              wallet={modalState.wallet}
              onSuccess={handleModalSuccess}
              onCancel={handleCloseModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
