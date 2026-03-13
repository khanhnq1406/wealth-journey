"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { store } from "@/features/auth/store/store";
import {
  useQueryListWallets,
  useQueryGetMarketPrices,
  useQueryGetAggregatedPortfolioSummary,
} from "@/utils/generated/hooks";
import { PnlPeriod } from "@/gen/protobuf/v1/investment";
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
import { parseAmount } from "@/utils/currency-formatter";
import {
  formatUpdateTimestamp,
  getLatestTimestamp,
} from "@/features/market-prices/utils/format-update-time";
import { NetWorthDisplay } from "./NetWorthDisplay";
import { PNLCard } from "./PNLCard";
import { GoldPriceTable } from "./GoldPriceTable";
import { GoldPriceChart } from "./GoldPriceChart";
import { SilverPriceTable } from "./SilverPriceTable";
import { SilverPriceChart } from "./SilverPriceChart";
import { CurrencyPriceTable } from "./CurrencyPriceTable";
import { DollarIndexChart } from "./DollarIndexChart";
import { WalletsSection } from "./WalletsSection";
import { BaseCard } from "@/components/BaseCard";

type ModalType = "add-transaction" | "transfer-money" | "create-wallet" | null;

export default function Home() {
  const tModal = useTranslations("modals.titles");
  const queryClient = useQueryClient();
  const [modalType, setModalType] = useState<ModalType>(null);
  const user = store.getState().setAuthReducer;
  const { currency } = useCurrency();
  const pnlRef = useRef<HTMLDivElement>(null);
  const [pnlHeight, setPnlHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = pnlRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setPnlHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    { walletId: 0, typeFilter: 0, period: PnlPeriod.PNL_PERIOD_ALL },
    { staleTime: 5 * 60 * 1000 },
  );

  const { data: summary1D } = useQueryGetAggregatedPortfolioSummary(
    { walletId: 0, typeFilter: 0, period: PnlPeriod.PNL_PERIOD_1D },
    { staleTime: 5 * 60 * 1000 },
  );

  const { data: summary1W } = useQueryGetAggregatedPortfolioSummary(
    { walletId: 0, typeFilter: 0, period: PnlPeriod.PNL_PERIOD_1W },
    { staleTime: 5 * 60 * 1000 },
  );

  const { data: summary1M } = useQueryGetAggregatedPortfolioSummary(
    { walletId: 0, typeFilter: 0, period: PnlPeriod.PNL_PERIOD_1M },
    { staleTime: 5 * 60 * 1000 },
  );

  // Calculate net worth: cash (wallets) + investments (portfolio)
  // Note: protobuf int64 values arrive as strings from protojson — must parseAmount()
  const totalCash =
    walletsData?.wallets?.reduce(
      (sum, w) => sum + parseAmount(w.balance?.amount),
      0,
    ) ?? 0;
  const totalPortfolioValue = parseAmount(portfolioSummary?.data?.totalValue);
  const totalNetWorth = totalCash + totalPortfolioValue;

  // PNL data — period-scoped values for NetWorthDisplay
  const todayPnl = parseAmount(summary1D?.data?.periodPnl);
  const todayPnlPercent = Number(summary1D?.data?.periodPnlPercent ?? 0);
  const weekPnl = parseAmount(summary1W?.data?.periodPnl);
  const weekPnlPercent = Number(summary1W?.data?.periodPnlPercent ?? 0);
  const monthPnl = parseAmount(summary1M?.data?.periodPnl);
  const monthPnlPercent = Number(summary1M?.data?.periodPnlPercent ?? 0);

  // Gold/silver/currency prices
  const goldPrices = marketPrices?.gold ?? [];
  const silverPrices = marketPrices?.silver ?? [];
  const currencyPrices = marketPrices?.currency ?? [];

  // Update timestamps from API data
  const goldUpdatedTime = formatUpdateTimestamp(getLatestTimestamp(goldPrices));
  const silverUpdatedTime = formatUpdateTimestamp(
    getLatestTimestamp(silverPrices),
  );
  const currencyUpdatedTime = formatUpdateTimestamp(
    getLatestTimestamp(currencyPrices),
  );

  // Wallets for WalletsSection
  const wallets = (walletsData?.wallets ?? []).map((w) => ({
    id: w.id ?? 0,
    walletName: w.walletName ?? "",
    balance: parseAmount(w.balance?.amount),
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
          monthPnlPercent={monthPnlPercent}
          monthPnl={monthPnl}
          userName={user.fullname ?? undefined}
        />

        {/* 2. PNL Card */}
        <PNLCard currency={currency} />

        {/* 3. Gold Price Table */}
        <GoldPriceTable prices={goldPrices} updatedTime={goldUpdatedTime} />

        {/* 4. Gold Price Chart */}
        <GoldPriceChart />

        {/* 5. Silver Price Table */}
        <SilverPriceTable
          prices={silverPrices}
          updatedTime={silverUpdatedTime}
        />

        {/* 6. Silver Price Chart */}
        <SilverPriceChart />

        {/* 7. Currency Price Table */}
        <CurrencyPriceTable prices={currencyPrices} updatedTime={currencyUpdatedTime} />

        {/* 8. Dollar Index Chart */}
        <DollarIndexChart />

        {/* 9. Wallets */}
        <WalletsSection wallets={wallets} />
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:block px-8 py-6 space-y-6">
        {/* Row 1: Net Worth full-width bar */}
        <NetWorthDisplay
          totalNetWorth={totalNetWorth}
          currency={currency}
          todayPnlPercent={todayPnlPercent}
          todayPnl={todayPnl}
          weekPnlPercent={weekPnlPercent}
          weekPnl={weekPnl}
          monthPnlPercent={monthPnlPercent}
          monthPnl={monthPnl}
          userName={user.fullname ?? undefined}
        />

        {/* Row 2: PNL Chart + Wallets */}
        <div className="flex gap-6 items-start">
          {/* PNL card — measured to set wallets height */}
          <div ref={pnlRef} className="flex-1">
            <PNLCard currency={currency} />
          </div>
          {/* Wallets — same height as PNL, scrolls inside */}
          <div
            className="w-[340px] shrink-0 overflow-hidden"
            style={pnlHeight ? { height: pnlHeight } : undefined}
          >
            <BaseCard
              padding="none"
              noMobileMargin
              className="h-full rounded-[20px] border border-v2-border-light shadow-v2-card p-5 flex flex-col"
            >
              <WalletsSection wallets={wallets} />
            </BaseCard>
          </div>
        </div>

        {/* Row 3: Gold Table + Gold Chart */}
        <div className="grid grid-cols-2 gap-6">
          <GoldPriceTable
            prices={goldPrices}
            updatedTime={goldUpdatedTime}
          />
          <GoldPriceChart />
        </div>

        {/* Row 4: Silver Table + Silver Chart */}
        <div className="grid grid-cols-2 gap-6">
          <SilverPriceTable
            prices={silverPrices}
            updatedTime={silverUpdatedTime}
          />
          <SilverPriceChart />
        </div>

        {/* Row 5: Currency Table + Dollar Index Chart */}
        <div className="grid grid-cols-2 gap-6">
          <CurrencyPriceTable prices={currencyPrices} updatedTime={currencyUpdatedTime} />
          <DollarIndexChart />
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
