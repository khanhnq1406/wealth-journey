"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useQueryGetBalanceHistory,
  useQueryListWallets,
} from "@/utils/generated/hooks";
import { LineChart, ChartWrapper } from "@/components/charts";
import { formatTickValue } from "@/utils/number-formatter";
import { formatCurrency } from "@/utils/currency-formatter";
import { useCurrency } from "@/contexts/CurrencyContext";

interface BalanceProps {
  availableYears: number[];
}

export const Balance = memo(function Balance({ availableYears }: BalanceProps) {
  const t = useTranslations("dashboard.home");
  const tCommon = useTranslations("common");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWalletId, setSelectedWalletId] = useState<number | undefined>(
    undefined,
  );
  const { currency } = useCurrency();

  // Fetch wallets for the dropdown
  const { data: walletsData, isLoading: walletsLoading } = useQueryListWallets(
    {
      pagination: { page: 1, pageSize: 100, orderBy: "", order: "" },
    },
    { refetchOnMount: "always" },
  );

  // Fetch balance history - run in parallel with wallets query
  const { data: balanceHistory, isLoading: balanceLoading } =
    useQueryGetBalanceHistory(
      {
        walletId: selectedWalletId ?? 0,
        year: selectedYear,
        month: 0,
      },
      {
        refetchOnMount: "always",
      },
    );

  // Prepare chart data
  const chartData =
    balanceHistory?.data?.map((point) => ({
      label: point.label,
      balance: point.balance,
      income: point.income,
      expense: point.expense,
    })) ?? [];

  return (
    <ChartWrapper
      isLoading={walletsLoading || balanceLoading}
      yearSelector={{
        value: selectedYear,
        options: availableYears,
        onChange: setSelectedYear,
      }}
      walletSelector={{
        value: selectedWalletId,
        options:
          walletsData?.wallets?.map((w) => ({
            id: w.id,
            name: w.walletName,
          })) ?? [],
        onChange: setSelectedWalletId,
      }}
    >
      <LineChart
        data={chartData}
        xAxisKey="label"
        series={[
          {
            dataKey: "balance",
            name: t("totalBalance"),
            chartType: "line",
            color: "#5579eb",
            strokeWidth: 2,
          },
          {
            dataKey: "income",
            name: tCommon("income"),
            chartType: "bar",
            color: "#35d3ac",
          },
          {
            dataKey: "expense",
            name: tCommon("expense"),
            chartType: "bar",
            color: "#ff7188",
          },
        ]}
        yAxisFormatter={formatTickValue}
        tooltipFormatter={(value) => [formatCurrency(value, currency), ""]}
      />
    </ChartWrapper>
  );
});
