"use client";

import { memo, useMemo, useState } from "react";
import { useQueryGetFinancialReport } from "@/utils/generated/hooks";
import { ChartSkeleton } from "@/components/loading/Skeleton";
import { ExpandableTable } from "./ExpandableTable";

interface FinancialTableProps {
  walletIds?: number[];
  selectedYear?: number;
}

export const FinancialTable = memo(function FinancialTable({
  walletIds,
  selectedYear = new Date().getFullYear(),
}: FinancialTableProps) {
  const [expandedWallets, setExpandedWallets] = useState<Set<number>>(
    new Set(),
  );

  // Fetch financial report data from backend
  const { data: reportData, isLoading: reportLoading } =
    useQueryGetFinancialReport(
      {
        year: selectedYear,
        walletIds: walletIds ?? [],
      },
      {
        refetchOnMount: "always",
        enabled: !!selectedYear,
      },
    );

  // Toggle wallet expansion
  const toggleWallet = (walletId: number) => {
    setExpandedWallets((prev) => {
      const next = new Set(prev);
      if (next.has(walletId)) {
        next.delete(walletId);
      } else {
        next.add(walletId);
      }
      return next;
    });
  };

  // Process data for display
  const monthlyData = useMemo(() => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    if (!reportData?.walletData) {
      return {
        months,
        wallets: [],
        totals: months.map(() => ({
          income: 0,
          expense: 0,
          balance: 0,
        })),
      };
    }

    // Transform wallet data from API to display format
    const wallets = reportData.walletData.map((wallet) => {
      let runningBalance = 0;
      const monthlyDataWithBalance = wallet.monthlyData.map((monthData) => {
        // Use display amounts (in user's preferred currency) if available
        const income = monthData.displayIncome?.amount ?? monthData.income?.amount ?? 0;
        const expense = monthData.displayExpense?.amount ?? monthData.expense?.amount ?? 0;
        runningBalance += income - expense;
        return {
          income,
          expense,
          balance: runningBalance,
        };
      });

      return {
        id: wallet.walletId,
        walletName: wallet.walletName,
        balance: {
          amount: runningBalance,
        },
        isExpanded: expandedWallets.has(wallet.walletId),
        monthlyData: monthlyDataWithBalance,
      };
    });

    // Transform totals from API to display format and calculate balance
    let runningTotalBalance = 0;
    const totals = reportData.totals.map((monthData) => {
      // Use display amounts (in user's preferred currency) if available
      const income = monthData.displayIncome?.amount ?? monthData.income?.amount ?? 0;
      const expense = monthData.displayExpense?.amount ?? monthData.expense?.amount ?? 0;
      runningTotalBalance += income - expense;
      return {
        income,
        expense,
        balance: runningTotalBalance,
      };
    });

    return {
      months,
      wallets,
      totals,
    };
  }, [reportData, expandedWallets]);

  if (reportLoading) {
    return (
      <div className="w-full h-[calc(100vh-180px)] sm:h-[calc(100vh-220px)] flex items-center justify-center">
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-180px)] sm:h-[calc(100vh-220px)]">
      <ExpandableTable
        months={monthlyData.months}
        wallets={monthlyData.wallets}
        totals={monthlyData.totals}
        onToggleWallet={toggleWallet}
      />
    </div>
  );
});
