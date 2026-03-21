"use client";

/**
 * Enhanced Portfolio Page with Pull-to-Refresh and Mobile-First Layout
 *
 * Phase 5 Refactoring: Data visualization and mobile-optimized analytics
 *
 * Features:
 * - Pull-to-refresh for price updates
 * - Enhanced PortfolioSummary with animations and charts
 * - Enhanced InvestmentCard with expandable details
 * - Mobile-first responsive layout
 * - Touch-friendly interactions
 */

import { useState, useMemo, useCallback, startTransition } from "react";
import { useTranslations } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import {
  StatsCardSkeleton,
  TableSkeleton,
} from "@/components/loading/Skeleton";
import {
  useQueryListUserInvestments,
  useQueryGetAggregatedPortfolioSummary,
  useMutationUpdatePrices,
  EVENT_InvestmentListUserInvestments,
  EVENT_InvestmentGetAggregatedPortfolioSummary,
} from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { InvestmentType, PnlPeriod } from "@/gen/protobuf/v1/investment";
import { FormSelect, SelectOption } from "@/components/forms/FormSelect";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  AddInvestmentForm,
  InvestmentDetailModal,
  preloadInvestmentDetailModal,
} from "@/components/lazy/OptimizedComponents";
import { BaseModal } from "@/components/modals/BaseModal";
import { PortfolioSummaryEnhanced } from "./components/PortfolioSummaryEnhanced";
import { InvestmentCardEnhanced } from "./components/InvestmentCardEnhanced";
import {
  EmptyInvestmentsState,
  UpdateProgressBanner,
  UpdateSuccessBanner,
} from "./components";
import { TabType } from "@/features/investment/components/InvestmentDetailModal";

const ModalType = {
  ADD_INVESTMENT: "ADD_INVESTMENT",
  INVESTMENT_DETAIL: "INVESTMENT_DETAIL",
} as const;

// These will be populated with translations inside the component
const TYPE_FILTER_KEYS = [
  { value: "0", key: "typeOptions.allTypes" },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY),
    key: "typeOptions.cryptocurrency",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_STOCK),
    key: "typeOptions.stock",
  },
  { value: String(InvestmentType.INVESTMENT_TYPE_ETF), key: "typeOptions.etf" },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_MUTUAL_FUND),
    key: "typeOptions.mutualFund",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_BOND),
    key: "typeOptions.bond",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_COMMODITY),
    key: "typeOptions.commodity",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_GOLD_VND),
    key: "typeOptions.goldVietnam",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_GOLD_USD),
    key: "typeOptions.goldWorld",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_CASH),
    key: "typeOptions.cash",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_FOREIGN_CURRENCY),
    key: "typeOptions.foreignCurrency",
  },
  {
    value: String(InvestmentType.INVESTMENT_TYPE_OTHER),
    key: "typeOptions.other",
  },
] as const;

const SORT_KEYS = [
  { value: "name", key: "sortOptions.nameAZ" },
  { value: "value", key: "sortOptions.valueHighLow" },
  { value: "pnl", key: "sortOptions.pnlHighLow" },
  { value: "pnlPercent", key: "sortOptions.pnlPercentHighLow" },
] as const;

export default function PortfolioPageEnhanced() {
  const t = useTranslations("investment");
  const TYPE_FILTER_OPTIONS: SelectOption[] = TYPE_FILTER_KEYS.map((opt) => ({
    value: opt.value,
    label: t(opt.key),
  }));
  const SORT_OPTIONS: SelectOption[] = SORT_KEYS.map((opt) => ({
    value: opt.value,
    label: t(opt.key),
  }));
  const { currency } = useCurrency();
  const [typeFilter, setTypeFilter] = useState<string>("0");
  const [sortBy, setSortBy] = useState<string>("name");
  const [modalType, setModalType] = useState<keyof typeof ModalType | null>(
    null,
  );
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<
    number | null
  >(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>();
  const [summaryPeriod, setSummaryPeriod] = useState<
    "1d" | "1w" | "1m" | "all"
  >("all");

  const typeFilterForApi = useMemo(() => {
    return parseInt(
      typeFilter,
      10,
    ) as (typeof InvestmentType)[keyof typeof InvestmentType];
  }, [typeFilter]);

  const summaryPeriodEnum = useMemo((): PnlPeriod => {
    switch (summaryPeriod) {
      case "1d":
        return PnlPeriod.PNL_PERIOD_1D;
      case "1w":
        return PnlPeriod.PNL_PERIOD_1W;
      case "1m":
        return PnlPeriod.PNL_PERIOD_1M;
      default:
        return PnlPeriod.PNL_PERIOD_ALL;
    }
  }, [summaryPeriod]);

  const getPortfolioSummary = useQueryGetAggregatedPortfolioSummary(
    {
      walletId: 0,
      typeFilter: typeFilterForApi,
      period: summaryPeriodEnum,
    },
    {
      refetchOnMount: "always",
    },
  );

  const getListInvestments = useQueryListUserInvestments(
    {
      walletId: 0,
      pagination: { page: 1, pageSize: 100, orderBy: "symbol", order: "asc" },
      typeFilter: typeFilterForApi,
    },
    {
      refetchOnMount: "always",
    },
  );

  // Sort investments
  const sortedInvestments = useMemo(() => {
    const investments = getListInvestments.data?.investments || [];
    return [...investments].sort((a, b) => {
      switch (sortBy) {
        case "value":
          return (
            (b.displayCurrentValue?.amount || b.currentValue || 0) -
            (a.displayCurrentValue?.amount || a.currentValue || 0)
          );
        case "pnl":
          return (
            (b.displayUnrealizedPnl?.amount || b.unrealizedPnl || 0) -
            (a.displayUnrealizedPnl?.amount || a.unrealizedPnl || 0)
          );
        case "pnlPercent":
          return (b.unrealizedPnlPercent || 0) - (a.unrealizedPnlPercent || 0);
        case "name":
        default:
          return a.symbol.localeCompare(b.symbol);
      }
    });
  }, [getListInvestments.data?.investments, sortBy]);

  const queryClient = useQueryClient();

  // Refetch all data
  const refetchAllData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [EVENT_InvestmentListUserInvestments],
      }),
      queryClient.invalidateQueries({
        queryKey: [EVENT_InvestmentGetAggregatedPortfolioSummary],
      }),
    ]);
  }, [queryClient]);

  // Update prices mutation
  const updatePricesMutation = useMutationUpdatePrices({
    onSuccess: async (data) => {
      setShowUpdateBanner(true);
      console.log(`Price update started: ${data.message}`);

      let pollAttempts = 0;
      const maxPollAttempts = 7;
      const pollInterval = 2000;

      const pollForUpdates = () => {
        pollAttempts++;
        console.log(
          `Checking for price updates (attempt ${pollAttempts}/${maxPollAttempts})...`,
        );

        refetchAllData();

        if (pollAttempts >= maxPollAttempts) {
          setShowUpdateBanner(false);
          setShowSuccessBanner(true);
          console.log("Price update polling complete. Showing success.");
          setTimeout(() => setShowSuccessBanner(false), 4000);
        } else {
          setTimeout(pollForUpdates, pollInterval);
        }
      };

      setTimeout(pollForUpdates, 2000);
    },
    onError: (error: any) => {
      setShowUpdateBanner(false);
      console.error(`Failed to update prices: ${error.message}`);
    },
  });

  const modalTitle = useMemo(() => {
    switch (modalType) {
      case ModalType.ADD_INVESTMENT:
        return t("modal.addInvestment");
      case ModalType.INVESTMENT_DETAIL:
        return t("modal.investmentDetails");
      default:
        return "";
    }
  }, [modalType, t]);

  const handleOpenModal = useCallback(
    (type: keyof typeof ModalType, investmentId?: number) => {
      startTransition(() => {
        if (investmentId) {
          setSelectedInvestmentId(investmentId);
        }
        setModalType(type);
      });
    },
    [],
  );

  const handleCloseModal = useCallback(() => {
    setModalType(null);
    setSelectedInvestmentId(null);
  }, []);

  const handleModalSuccess = useCallback(() => {
    startTransition(() => {
      refetchAllData();
      handleCloseModal();
    });
  }, [refetchAllData, handleCloseModal]);

  const handleRowHover = useCallback(() => {
    preloadInvestmentDetailModal();
  }, []);

  const handleRefreshPrices = useCallback(() => {
    updatePricesMutation.mutate({
      investmentIds: [],
      forceRefresh: true,
    });
  }, [updatePricesMutation]);

  const handleBuyMore = useCallback(
    (investmentId: number) => {
      handleOpenModal(ModalType.INVESTMENT_DETAIL, investmentId);
      setActiveTab("overview");
    },
    [handleOpenModal],
  );

  const handleSell = useCallback(
    (investmentId: number) => {
      handleOpenModal(ModalType.INVESTMENT_DETAIL, investmentId);
      setActiveTab("add-transaction");
    },
    [handleOpenModal],
  );

  const handleEdit = useCallback(
    (investmentId: number) => {
      handleOpenModal(ModalType.INVESTMENT_DETAIL, investmentId);
      setActiveTab("transactions");
    },
    [handleOpenModal],
  );

  // Loading state
  if (getListInvestments.isLoading || getListInvestments.isPending) {
    return (
      <div className="flex flex-col gap-6 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="h-8 w-48 bg-v2-maroon-800 rounded animate-pulse" />
          <div className="h-10 w-40 bg-v2-maroon-800 rounded animate-pulse" />
        </div>
        <StatsCardSkeleton cards={4} />
        <div className="bg-v2-maroon-800 rounded-lg shadow-card p-4 sm:p-6">
          <div className="h-6 w-32 bg-v2-maroon-800 rounded animate-pulse mb-4" />
          <TableSkeleton rows={5} showAvatar={false} />
        </div>
      </div>
    );
  }

  // Error state
  if (getListInvestments.error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-danger-600 text-center">
          <p className="text-lg font-semibold">{t("errorLoading")}</p>
          <p className="text-sm">{getListInvestments.error.message}</p>
        </div>
      </div>
    );
  }

  const portfolioSummary = getPortfolioSummary.data?.data;
  const investments = sortedInvestments;

  return (
    <>
      <div className="flex justify-center w-full">
        <div className="w-full max-w-7xl space-y-3 sm:space-y-4">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 py-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-v2-gold-accent">
              {t("page.title")}
            </h1>

            {/* Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="w-full sm:w-full md:w-40 flex items-center">
                <FormSelect
                  options={TYPE_FILTER_OPTIONS}
                  value={typeFilter}
                  onChange={(value) => {
                    startTransition(() => setTypeFilter(value));
                  }}
                  placeholder={t("filterByTypePlaceholder")}
                  containerClassName="!m-0"
                />
              </div>

              <div className="w-full sm:w-full md:w-40 flex items-center">
                <FormSelect
                  options={SORT_OPTIONS}
                  value={sortBy}
                  onChange={(value) => {
                    startTransition(() => setSortBy(value));
                  }}
                  placeholder={t("sortByPlaceholder")}
                  containerClassName="!m-0"
                />
              </div>
            </div>
          </div>

          {/* Portfolio Summary Cards */}
          {getPortfolioSummary.isLoading || getPortfolioSummary.isPending ? (
            <StatsCardSkeleton cards={4} />
          ) : portfolioSummary ? (
            <PortfolioSummaryEnhanced
              portfolioSummary={portfolioSummary}
              userCurrency={currency}
              onRefreshPrices={handleRefreshPrices}
              onAddInvestment={() => handleOpenModal(ModalType.ADD_INVESTMENT)}
              isRefreshing={updatePricesMutation.isPending || showUpdateBanner}
              selectedPeriod={summaryPeriod}
              onPeriodChange={setSummaryPeriod}
            />
          ) : null}

          {/* Update Banner */}
          {showUpdateBanner && <UpdateProgressBanner />}

          {/* Success Banner */}
          {showSuccessBanner && <UpdateSuccessBanner />}

          {/* Holdings - Mobile Card View */}
          <BaseCard className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-v2-gold-accent">
                {t("page.holdings")}
              </h2>
            </div>

            {getListInvestments.isLoading || getListInvestments.isPending ? (
              <TableSkeleton rows={5} showAvatar={false} />
            ) : investments.length === 0 ? (
              <EmptyInvestmentsState />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {investments.map((investment) => (
                  <InvestmentCardEnhanced
                    key={investment.id}
                    investment={investment}
                    userCurrency={currency}
                    onClick={(id) =>
                      handleOpenModal(ModalType.INVESTMENT_DETAIL, id)
                    }
                    // onRowHover={handleRowHover} // Not supported in InvestmentCardEnhanced
                    onBuyMore={handleBuyMore}
                    onSell={handleSell}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            )}
          </BaseCard>
        </div>
      </div>

      {/* Modals */}
      {modalType === ModalType.INVESTMENT_DETAIL && selectedInvestmentId && (
        <InvestmentDetailModal
          isOpen={modalType === ModalType.INVESTMENT_DETAIL}
          onClose={handleCloseModal}
          investmentId={selectedInvestmentId}
          onSuccess={handleModalSuccess}
          activeTabProp={activeTab}
        />
      )}

      <BaseModal
        isOpen={modalType !== null && modalType !== ModalType.INVESTMENT_DETAIL}
        onClose={handleCloseModal}
        title={modalTitle}
      >
        {modalType === ModalType.ADD_INVESTMENT && (
          <AddInvestmentForm onSuccess={handleModalSuccess} />
        )}
      </BaseModal>
    </>
  );
}
