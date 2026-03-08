"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { store } from "@/features/auth/store/store";
import {
  useQueryListWallets,
  useQueryGetMarketPrices,
  useQueryGetAggregatedPortfolioSummary,
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
import { useCurrency } from "@/contexts/CurrencyContext";
import { NetWorthDisplay } from "./NetWorthDisplay";
import { PNLCard } from "./PNLCard";
import { GoldPriceTable } from "./GoldPriceTable";
import { GoldPriceChart } from "./GoldPriceChart";
import { SilverPriceTable } from "./SilverPriceTable";
import { SilverPriceChart } from "./SilverPriceChart";
import { WalletsSection } from "./WalletsSection";

type ModalType = "add-transaction" | "transfer-money" | "create-wallet" | null;

export default function Home() {
  const tModal = useTranslations("modals.titles");
  const queryClient = useQueryClient();
  const [modalType, setModalType] = useState<ModalType>(null);
  const user = store.getState().setAuthReducer;
  const { currency } = useCurrency();

  // Data fetching
  const { data: walletsData } = useQueryListWallets(
    { pagination: { page: 1, pageSize: 20, orderBy: "", order: "" } },
    { refetchOnMount: "always" },
  );

  const { data: marketPrices } = useQueryGetMarketPrices(
    {},
    { staleTime: 5 * 60 * 1000 },
  );

  const { data: portfolioSummary } = useQueryGetAggregatedPortfolioSummary(
    {},
    { staleTime: 5 * 60 * 1000 },
  );

  // Calculate net worth: cash (wallets) + investments (portfolio)
  const totalCash = walletsData?.wallets?.reduce(
    (sum, w) => sum + (w.balance || 0),
    0,
  ) ?? 0;
  const totalPortfolioValue = portfolioSummary?.totalValue ?? 0;
  const totalNetWorth = totalCash + totalPortfolioValue;

  // PNL data
  const totalPnl = portfolioSummary?.totalPnl ?? 0;
  const totalPnlPercent = portfolioSummary?.totalPnlPercent ?? 0;

  // Gold/silver prices
  const goldPrices = marketPrices?.gold ?? [];
  const silverPrices = marketPrices?.silver ?? [];

  // Format update time
  const formatUpdateTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  };

  // Wallets for WalletsSection
  const wallets = (walletsData?.wallets ?? []).map((w) => ({
    id: w.id ?? 0,
    walletName: w.walletName ?? "",
    balance: w.balance ?? 0,
    currency: w.currency ?? "VND",
    type: w.type ?? 0,
  }));

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
    handleModalClose();
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
    <div className="bg-v2-bg-primary min-h-full">
      {/* Mobile Layout */}
      <div className="sm:hidden px-4 py-4 pb-24 space-y-6">
        {/* 1. Net Worth */}
        <NetWorthDisplay
          totalNetWorth={totalNetWorth}
          currency={currency}
          monthPnlPercent={totalPnlPercent}
          monthPnl={totalPnl}
          userName={user.fullname}
        />

        {/* 2. PNL Card */}
        <PNLCard
          monthPnl={totalPnl}
          monthPnlPercent={totalPnlPercent}
          currency={currency}
        />

        {/* 3. Gold Price Table */}
        <GoldPriceTable
          prices={goldPrices}
          updatedTime={formatUpdateTime()}
        />

        {/* 4. Gold Price Chart */}
        <GoldPriceChart prices={goldPrices} />

        {/* 5. Silver Price Table */}
        <SilverPriceTable
          prices={silverPrices}
          updatedTime={formatUpdateTime()}
        />

        {/* 6. Silver Price Chart */}
        <SilverPriceChart prices={silverPrices} />

        {/* 7. Wallets */}
        <WalletsSection wallets={wallets} />
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:block px-8 py-6 space-y-6">
        {/* Row 1: Net Worth full-width bar */}
        <NetWorthDisplay
          totalNetWorth={totalNetWorth}
          currency={currency}
          todayPnlPercent={totalPnlPercent}
          todayPnl={totalPnl}
          weekPnlPercent={totalPnlPercent}
          weekPnl={totalPnl}
          monthPnlPercent={totalPnlPercent}
          monthPnl={totalPnl}
          userName={user.fullname}
        />

        {/* Row 2: PNL Chart + Wallets */}
        <div className="flex gap-6">
          <div className="flex-1">
            <PNLCard
              todayPnl={totalPnl}
              todayPnlPercent={totalPnlPercent}
              weekPnl={totalPnl}
              weekPnlPercent={totalPnlPercent}
              monthPnl={totalPnl}
              monthPnlPercent={totalPnlPercent}
              currency={currency}
            />
          </div>
          <div className="w-[340px] shrink-0">
            <div className="bg-white rounded-[20px] border border-v2-border-light shadow-v2-card p-5">
              <WalletsSection wallets={wallets} />
            </div>
          </div>
        </div>

        {/* Row 3: Gold Table + Gold Chart */}
        <div className="grid grid-cols-2 gap-6">
          <GoldPriceTable
            prices={goldPrices}
            updatedTime={formatUpdateTime()}
          />
          <GoldPriceChart prices={goldPrices} />
        </div>

        {/* Row 4: Silver Table + Silver Chart */}
        <div className="grid grid-cols-2 gap-6">
          <SilverPriceTable
            prices={silverPrices}
            updatedTime={formatUpdateTime()}
          />
          <SilverPriceChart prices={silverPrices} />
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
