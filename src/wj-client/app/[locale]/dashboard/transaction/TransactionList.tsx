"use client";

import { useState, useMemo } from "react";
import {
  useQueryListTransactions,
  useQueryListCategories,
  useMutationDeleteTransaction,
} from "@/utils/generated/hooks";
import {
  SortField,
  CategoryType,
  TransactionType,
} from "@/gen/protobuf/v1/transaction";
import { TransactionFilter } from "./TransactionFilter";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { TransactionGroup } from "./TransactionGroup";
import { groupTransactionsByDate } from "@/lib/utils/transaction";
import { useDebounce } from "@/hooks";
import { useTranslations } from "next-intl";

type TransactionListProps = {
  onEditTransaction?: (transactionId: number) => void;
};

export const TransactionList = ({
  onEditTransaction,
}: TransactionListProps) => {
  const t = useTranslations("transaction");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  // Debounce search query to reduce API calls (500ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Fetch transactions with default sorting by date descending
  const {
    data: transactionsData,
    isLoading,
    refetch,
  } = useQueryListTransactions(
    {
      pagination: {
        page: 1,
        pageSize: 100,
        orderBy: "date",
        order: "desc",
      },
      filter: {
        searchNote: debouncedSearchQuery || undefined,
      },
      sortField: SortField.DATE,
      sortOrder: "desc",
    },
    {
      refetchOnMount: "always",
    },
  );

  // Fetch categories for filtering (needed for TransactionGroup to display category names)
  const { data: categoriesData } = useQueryListCategories({
    pagination: { page: 1, pageSize: 100, orderBy: "id", order: "asc" },
  });

  const deleteTransactionMutation = useMutationDeleteTransaction({
    onSuccess: () => {
      refetch();
    },
  });

  // Create a map of category ID to category type for efficient lookup
  const categoryTypeMap = useMemo(() => {
    const map = new Map<number, CategoryType>();
    categoriesData?.categories?.forEach((cat) => {
      map.set(cat.id, cat.type);
    });
    return map;
  }, [categoriesData]);

  // Filter transactions by type - now using the returned type field from backend
  const filteredTransactions = useMemo(() => {
    if (!transactionsData?.transactions) return [];

    return transactionsData.transactions.filter((transaction) => {
      if (filterType === "all") return true;

      // Use the type field returned by the backend
      const transactionType = transaction.type;

      if (filterType === "income") {
        return transactionType === TransactionType.TRANSACTION_TYPE_INCOME;
      } else {
        return transactionType === TransactionType.TRANSACTION_TYPE_EXPENSE;
      }
    });
  }, [transactionsData, filterType]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    return groupTransactionsByDate(filteredTransactions);
  }, [filteredTransactions]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (
    !transactionsData?.transactions ||
    transactionsData.transactions.length === 0
  ) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <svg
          className="w-16 h-16 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-lg font-medium">{t("noTransactionsFound")}</p>
        <p className="text-sm">{t("addFirstTransaction")}</p>
      </div>
    );
  }

  return (
    <div className="px-2 py-1">
      <TransactionFilter
        filterType={filterType}
        onFilterChange={setFilterType}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div
        className="mt-4 space-y-4"
        style={{ contentVisibility: "auto" }} // rendering-content-visibility optimization for long lists
      >
        {Object.entries(groupedTransactions).map(([date, transactions]) => (
          <TransactionGroup
            key={date}
            date={date}
            transactions={transactions}
            categoryTypeMap={categoryTypeMap}
            onDelete={deleteTransactionMutation.mutate}
            onEdit={(transactionId) => onEditTransaction?.(transactionId)}
          />
        ))}
      </div>
    </div>
  );
};
