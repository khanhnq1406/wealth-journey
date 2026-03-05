"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { ListTransactionsResponse } from "@/gen/protobuf/v1/transaction";
import {
  useQueryListTransactions,
  useQueryListCategories,
  useQueryListWallets,
  useQueryGetTotalBalance,
  useMutationDeleteTransaction,
} from "@/utils/generated/hooks";
import { SortField } from "@/gen/protobuf/v1/transaction";
import { TransactionType } from "@/gen/protobuf/v1/transaction";
import { formatCurrency } from "@/utils/currency-formatter";
import { useCurrency } from "@/contexts/CurrencyContext";
import { resources } from "@/app/constants";
import { useDebounce } from "@/hooks";
import Image from "next/image";
import { BaseModal } from "@/components/modals/BaseModal";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import {
  TransactionFilterModal,
  TransactionFilters,
} from "./TransactionFilterModal";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { TransactionCard, getDateGroupLabel } from "./TransactionCard";
import { QuickFilterChips, QuickFilterType } from "./QuickFilterChips";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { cn } from "@/lib/utils/cn";
import { ExportButton, ExportOptions } from "@/components/export/ExportDialog";
import { Button } from "@/components/Button";
import { useExportTransactions } from "@/features/transaction/hooks/useExportTransactions";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { useTranslations } from "next-intl";

// Date range helpers for quick filters
function getDateRangeForFilter(filter: QuickFilterType): {
  startDate?: number;
  endDate?: number;
  type?: TransactionType;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  switch (filter) {
    case "income":
      return { type: TransactionType.TRANSACTION_TYPE_INCOME };
    case "expense":
      return { type: TransactionType.TRANSACTION_TYPE_EXPENSE };
    case "today":
      return {
        startDate: Math.floor(today.getTime() / 1000),
        endDate: Math.floor(endOfDay.getTime() / 1000),
      };
    case "week":
      // Start of week (Sunday)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return {
        startDate: Math.floor(startOfWeek.getTime() / 1000),
        endDate: Math.floor(endOfDay.getTime() / 1000),
      };
    case "month":
      // Start of month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: Math.floor(startOfMonth.getTime() / 1000),
        endDate: Math.floor(endOfDay.getTime() / 1000),
      };
    default:
      return {};
  }
}

type ModalState = { type: "delete-confirmation"; transactionId: number } | null;

// Lazy load EditTransactionForm
const EditTransactionForm = dynamic(
  () =>
    import("@/components/lazy/OptimizedComponents").then(
      (mod) => mod.EditTransactionForm,
    ),
  { ssr: false },
);

// Lazy load ImportTransactionsForm
const ImportTransactionsForm = dynamic(
  () =>
    import("@/features/import/forms/ImportTransactionsForm").then(
      (mod) => mod.ImportTransactionsForm,
    ),
  { ssr: false },
);

export default function TransactionPage() {
  const t = useTranslations("transaction");
  const tCommon = useTranslations("common");
  const tDelete = useTranslations("transaction.delete");
  const tDates = useTranslations("dates");
  const { currency } = useCurrency();
  const queryClient = useQueryClient();

  // State
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [isHideBalance, setHideBalance] = useState(false);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  // Additional filter states
  const [amountMin, setAmountMin] = useState<number>(0);
  const [amountMax, setAmountMax] = useState<number>(0);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    undefined,
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    undefined,
  );
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Fetch data
  const filter = useMemo(() => {
    const quickFilterParams = getDateRangeForFilter(quickFilter);
    // Determine decimal places based on currency (VND = 0, USD = 2, etc.)
    const currencyDecimals = currency === "VND" || currency === "JPY" ? 0 : 2;
    const multiplier = Math.pow(10, currencyDecimals);

    // Use custom date range if set, otherwise use quick filter date range
    let startDate = quickFilterParams.startDate;
    let endDate = quickFilterParams.endDate;

    // If custom date range is set (from modal), use it instead
    if (customStartDate) {
      startDate = Math.floor(customStartDate.getTime() / 1000);
    }
    if (customEndDate) {
      endDate = Math.floor(customEndDate.getTime() / 1000);
    }

    return {
      searchNote: debouncedSearchQuery || undefined,
      walletId: selectedWallet ? parseInt(selectedWallet) : undefined,
      categoryId: categoryFilter ? parseInt(categoryFilter) : undefined,
      type: quickFilterParams.type,
      startDate,
      endDate,
      minAmount: amountMin > 0 ? amountMin * multiplier : undefined,
      maxAmount: amountMax > 0 ? amountMax * multiplier : undefined,
    };
  }, [
    debouncedSearchQuery,
    selectedWallet,
    categoryFilter,
    quickFilter,
    amountMin,
    amountMax,
    currency,
    customStartDate,
    customEndDate,
  ]);

  const paginationConfig = useMemo(
    () => ({
      page: 1,
      pageSize: rowsPerPage,
      orderBy: sortField,
      order: sortOrder,
    }),
    [rowsPerPage, sortField, sortOrder],
  );

  const {
    data: transactionsData,
    isLoading,
    refetch,
    isFetching,
  } = useQueryListTransactions<ListTransactionsResponse>(
    {
      pagination: paginationConfig,
      filter,
      sortField: SortField.DATE,
      sortOrder: sortOrder,
    },
    { refetchOnMount: "always" },
  );

  const { data: categoriesData } = useQueryListCategories({
    pagination: { page: 1, pageSize: 100, orderBy: "id", order: "asc" },
  });

  const { data: walletsData } = useQueryListWallets({
    pagination: { page: 1, pageSize: 100, orderBy: "id", order: "asc" },
  });

  const { data: totalBalanceData, refetch: refetchTotalBalance } =
    useQueryGetTotalBalance({});

  const deleteTransactionMutation = useMutationDeleteTransaction({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ListTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["ListWallets"] });
      queryClient.invalidateQueries({ queryKey: ["ListCategories"] });
      queryClient.invalidateQueries({ queryKey: ["GetTotalBalance"] });
      setModalState(null);
    },
  });

  // Infinite scroll
  const { containerRef, isLoadingMore, loadMore, setIsLoadingMore } =
    useInfiniteScroll({
      threshold: 200,
      enabled: !isLoading && !isFetching,
      hasMore:
        transactionsData?.pagination && transactionsData.transactions
          ? transactionsData.transactions.length <
            transactionsData.pagination.totalCount
          : false,
    });

  // Load more handler
  useEffect(() => {
    if (isLoadingMore) {
      // Fetch more data by refetching
      refetch().then(() => {
        setIsLoadingMore(false);
      });
    }
  }, [isLoadingMore, refetch, setIsLoadingMore]);

  // Memoized helpers
  const getCategoryName = useMemo(() => {
    const categoryMap = new Map<number, string>();
    categoriesData?.categories?.forEach((cat) => {
      categoryMap.set(cat.id, cat.name);
    });
    return (id: number) => categoryMap.get(id) || tCommon("uncategorized");
  }, [categoriesData, tCommon]);

  const getWalletName = useMemo(() => {
    const walletMap = new Map<number, string>();
    walletsData?.wallets?.forEach((wallet) => {
      walletMap.set(wallet.id, wallet.walletName);
    });
    return (id: number) => walletMap.get(id) || tCommon("unknown");
  }, [walletsData, tCommon]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const transactions = transactionsData?.transactions || [];
    const groups: Record<string, typeof transactions> = {};

    transactions.forEach((transaction) => {
      const groupLabel = getDateGroupLabel(transaction.date, tDates);
      if (!groups[groupLabel]) {
        groups[groupLabel] = [];
      }
      groups[groupLabel].push(transaction);
    });

    return groups;
  }, [transactionsData, tDates]);

  // Handlers
  const handleDeleteTransaction = useCallback((transactionId: number) => {
    setModalState({ type: "delete-confirmation", transactionId });
  }, []);

  const handleEditTransaction = useCallback((transactionId: number) => {
    // Handle edit - could open a modal or navigate
    console.log("Edit transaction:", transactionId);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (modalState?.type === "delete-confirmation") {
      deleteTransactionMutation.mutate({
        transactionId: modalState.transactionId,
      });
    }
  }, [modalState, deleteTransactionMutation]);

  const handleCloseModal = useCallback(() => {
    setModalState(null);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    await refetchTotalBalance();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetch, refetchTotalBalance]);

  // Filter handlers
  const handleOpenFilterModal = useCallback(() => {
    setIsFilterModalOpen(true);
  }, []);

  const handleCloseFilterModal = useCallback(() => {
    setIsFilterModalOpen(false);
  }, []);

  const handleApplyFilters = useCallback((filters: TransactionFilters) => {
    setSelectedWallet(filters.walletId);
    setCategoryFilter(filters.categoryFilter);
    setSortField(filters.sortField);
    setSortOrder(filters.sortOrder);
    setSearchQuery(filters.searchQuery);
    // Handle amount range
    setAmountMin(filters.amountRange?.min || 0);
    setAmountMax(filters.amountRange?.max || 0);
    // Handle date range - convert string dates to Date objects
    if (filters.dateRange?.start) {
      setCustomStartDate(new Date(filters.dateRange.start));
    } else {
      setCustomStartDate(undefined);
    }
    if (filters.dateRange?.end) {
      // Set to end of the day
      const endDate = new Date(filters.dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      setCustomEndDate(endDate);
    } else {
      setCustomEndDate(undefined);
    }
    // Reset quick filter when using custom date range from modal
    if (filters.dateRange) {
      setQuickFilter("all");
    }
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedWallet(null);
    setCategoryFilter("");
    setSearchQuery("");
    setSortField("date");
    setSortOrder("desc");
    setAmountMin(0);
    setAmountMax(0);
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
    setQuickFilter("all");
  }, []);

  const handleRemoveSingleFilter = useCallback(
    (filterType: keyof TransactionFilters) => {
      switch (filterType) {
        case "walletId":
          setSelectedWallet(null);
          break;
        case "categoryFilter":
          setCategoryFilter("");
          break;
        case "searchQuery":
          setSearchQuery("");
          break;
        case "sortField":
        case "sortOrder":
          setSortField("date");
          setSortOrder("desc");
          break;
        case "amountRange":
          setAmountMin(0);
          setAmountMax(0);
          break;
        case "dateRange":
          setCustomStartDate(undefined);
          setCustomEndDate(undefined);
          setQuickFilter("all");
          break;
      }
    },
    [],
  );

  // Quick filter handler - Updates the quick filter state which is used in the filter useMemo
  const handleQuickFilterChange = useCallback((filter: QuickFilterType) => {
    setQuickFilter(filter);
    // Clear custom date range when using quick filters
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
  }, []);

  const handleHideBalance = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      setHideBalance((prev) => !prev);
    },
    [],
  );

  const handleImportSuccess = useCallback(() => {
    // Refresh transaction data after successful import
    queryClient.invalidateQueries({ queryKey: ["ListTransactions"] });
    queryClient.invalidateQueries({ queryKey: ["ListWallets"] });
    queryClient.invalidateQueries({ queryKey: ["GetTotalBalance"] });
    setShowImportModal(false);
  }, [queryClient]);

  // Handle export transactions
  const { exportTransactions, isExporting } = useExportTransactions({
    onError: (error) => {
      alert(error.message);
    },
    onSuccess: () => {
      console.log("Transactions exported successfully");
    },
  });

  const handleExportTransactions = useCallback(
    async (options: ExportOptions) => {
      await exportTransactions(options);
    },
    [exportTransactions],
  );

  // Prepare options
  const walletOptions = useMemo(
    () =>
      walletsData?.wallets?.map((w) => ({
        value: w.id.toString(),
        label: w.walletName,
      })) || [],
    [walletsData?.wallets],
  );

  const categoryOptions = useMemo(
    () =>
      categoriesData?.categories?.map((c) => ({
        value: c.id.toString(),
        label: c.name,
      })) || [],
    [categoriesData?.categories],
  );

  const sortOptions = useMemo(
    () => [
      { value: "date-desc", label: t("sortOptions.newestFirst") },
      { value: "date-asc", label: t("sortOptions.oldestFirst") },
      { value: "amount-desc", label: t("sortOptions.highestFirst") },
      { value: "amount-asc", label: t("sortOptions.lowestFirst") },
    ],
    [t],
  );

  const currentFilters: TransactionFilters = useMemo(
    () => ({
      walletId: selectedWallet,
      categoryFilter,
      sortField,
      sortOrder,
      searchQuery,
      amountRange: {
        min: amountMin > 0 ? amountMin : undefined,
        max: amountMax > 0 ? amountMax : undefined,
      },
      dateRange: {
        start: customStartDate?.toISOString().split("T")[0],
        end: customEndDate?.toISOString().split("T")[0],
      },
    }),
    [
      selectedWallet,
      categoryFilter,
      sortField,
      sortOrder,
      searchQuery,
      amountMin,
      amountMax,
      customStartDate,
      customEndDate,
    ],
  );

  // Calculate totals
  const totalBalance =
    totalBalanceData?.displayNetWorth?.amount ??
    totalBalanceData?.displayValue?.amount ??
    totalBalanceData?.data?.amount ??
    0;
  const formattedBalance = useMemo(() => {
    return formatCurrency(totalBalance, currency);
  }, [totalBalance, currency]);

  return (
    <div className="h-full flex flex-col">
      {/* Header with Balance */}
      <div className="flex-shrink-0 bg-primary-600 rounded-md sm:bg-transparent border-b sm:border-b-gray-300">
        <div className="p-3 sm:p-4 md:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-0">
            <h1 className="text-white sm:text-gray-900 text-2xl sm:text-3xl lg:text-4xl font-bold">
              {t("title")}
            </h1>

            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
              <div className="flex flex-col items-start sm:items-center">
                <p className="text-white sm:text-gray-400 text-xs sm:text-sm font-medium">
                  {t("totalBalance")}
                </p>
                <p className="text-white sm:text-gray-900 text-lg sm:text-xl lg:text-2xl font-semibold">
                  {isHideBalance ? "*****" : formattedBalance}
                </p>
              </div>

              <button
                className="w-10 h-10 sm:w-8 sm:h-8 flex-shrink-0"
                aria-label={t("filter.toggleBalanceVisibility")}
                onClick={handleHideBalance}
              >
                <div className="text-black">
                  {isHideBalance ? <EyeOffIcon /> : <EyeIcon />}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex-shrink-0">
        {/* Search Bar */}
        <div className="relative mb-3">
          <input
            type="text"
            name="search"
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-50 rounded-lg px-4 py-2.5 pl-10 pr-10 text-sm drop-shadow-round focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400 dark:bg-dark-surface-hover dark:text-dark-text"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={t("filter.clearSearch")}
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Quick Filters & Mobile Filter Button */}
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          {/* Quick Filter Chips */}

          {/* Export Button - Hidden on very small screens, visible on sm+ */}
          <div className="flex gap-2 justify-between items-center w-full sm:w-fit">
            <div className="flex-1 overflow-x-auto scrollbar-thin max-w-full overflow-auto">
              <QuickFilterChips
                activeFilter={quickFilter}
                onFilterChange={handleQuickFilterChange}
              />
            </div>
            <Button
              onClick={handleOpenFilterModal}
              className="w-fit h-fit"
              aria-label={t("filter.openFilters")}
              variant="ghost"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              {(selectedWallet || categoryFilter) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary-600 rounded-full" />
              )}
            </Button>
          </div>

          <Button
            variant="secondary"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2"
            aria-label={t("import.buttonLabel")}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="sm:inline">{t("import.buttonLabel")}</span>
          </Button>

          <ExportButton
            onExport={handleExportTransactions}
            categories={categoryOptions.map((c) => ({
              id: c.value,
              name: c.label,
            }))}
            isExporting={isExporting}
          />
        </div>
      </div>

      {/* Active Filter Chips */}
      <ActiveFilterChips
        filters={currentFilters}
        walletOptions={walletOptions}
        categoryOptions={categoryOptions}
        onRemoveFilter={handleRemoveSingleFilter}
        onClearAll={handleClearFilters}
      />

      {/* Transaction List with Pull-to-Refresh and Infinite Scroll */}
      <PullToRefresh
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        className="flex-1 min-h-0"
      >
        <div ref={containerRef} className="h-full overflow-auto">
          <div className="px-3 sm:px-6 pb-6">
            {isLoading &&
            (!transactionsData ||
              (transactionsData as any).transactions?.length === 0) ? (
              // Loading skeleton
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-dark-surface rounded-lg p-4 animate-pulse"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/3" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                      <div className="h-6 bg-gray-200 rounded w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : Object.keys(groupedTransactions).length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-dark-text-tertiary">
                <svg
                  className="w-16 h-16 mb-4 opacity-50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <p className="text-lg font-medium">{t("noTransactionsFound")}</p>
                <p className="text-sm">
                  {t("addFirstTransaction")}
                </p>
              </div>
            ) : (
              // Transaction list with groups
              <div className="space-y-4">
                {Object.entries(groupedTransactions).map(
                  ([groupLabel, transactions]) => (
                    <div key={groupLabel}>
                      {/* Group Header */}
                      <TransactionCard
                        transaction={null as any}
                        categoryName=""
                        walletName=""
                        currency=""
                        onEdit={() => {}}
                        onDelete={() => {}}
                        isGroupHeader={true}
                        groupLabel={groupLabel}
                      />

                      {/* Transactions in group */}
                      <div className="space-y-2">
                        {transactions.map((transaction) => (
                          <TransactionCard
                            key={transaction.id}
                            transaction={transaction}
                            categoryName={getCategoryName(
                              transaction.categoryId,
                            )}
                            walletName={getWalletName(transaction.walletId)}
                            currency={currency}
                            onEdit={handleEditTransaction}
                            onDelete={handleDeleteTransaction}
                          />
                        ))}
                      </div>
                    </div>
                  ),
                )}

                {/* Loading more indicator */}
                {isLoadingMore && (
                  <div className="flex justify-center py-4">
                    <svg
                      className="w-6 h-6 text-primary-600 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>

      {/* Delete Confirmation Modal */}
      {modalState?.type === "delete-confirmation" && (
        <ConfirmationDialog
          title={tDelete("title")}
          message={tDelete("confirmMessage")}
          confirmText={tDelete("confirmButton")}
          cancelText={tDelete("cancelButton")}
          onConfirm={handleConfirmDelete}
          onCancel={handleCloseModal}
          isLoading={deleteTransactionMutation.isPending}
          variant="danger"
        />
      )}

      {/* Mobile Filter Modal */}
      <TransactionFilterModal
        isOpen={isFilterModalOpen}
        onClose={handleCloseFilterModal}
        onApplyFilters={handleApplyFilters}
        currentFilters={currentFilters}
        walletOptions={walletOptions}
        categoryOptions={categoryOptions}
        sortOptions={sortOptions}
        onClearFilters={handleClearFilters}
      />

      {/* Import Transactions Modal */}
      {showImportModal && (
        <ImportTransactionsForm onSuccess={handleImportSuccess} />
      )}
    </div>
  );
}
