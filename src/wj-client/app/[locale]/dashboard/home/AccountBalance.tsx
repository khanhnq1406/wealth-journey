"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryGetBalanceHistory } from "@/utils/generated/hooks";
import { LineChart, ChartWrapper } from "@/components/charts";
import { formatTickValue } from "@/utils/number-formatter";
import { formatCurrency } from "@/utils/currency-formatter";
import { useCurrency } from "@/contexts/CurrencyContext";

interface AccountBalanceProps {
  availableYears?: number[];
}

export const AccountBalance = memo(function AccountBalance({
  availableYears = [new Date().getFullYear()],
}: AccountBalanceProps) {
  const t = useTranslations("dashboard.home");
  const tCommon = useTranslations("common");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { currency } = useCurrency();

  // Fetch balance history for total balance (walletId: 0 = all wallets)
  const { data: balanceHistory, isLoading } = useQueryGetBalanceHistory(
    {
      walletId: 0,
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
      isLoading={isLoading}
      yearSelector={{
        value: selectedYear,
        options: availableYears,
        onChange: setSelectedYear,
      }}
    >
      <LineChart
        data={chartData}
        xAxisKey="label"
        series={[
          {
            dataKey: "balance",
            name: t("totalBalance"),
            chartType: "area",
            showArea: true,
            color: "#5579eb",
          },
          {
            dataKey: "income",
            name: tCommon("income"),
            chartType: "line",
            color: "#35d3ac",
            strokeWidth: 2,
            showDots: false,
          },
          {
            dataKey: "expense",
            name: tCommon("expense"),
            chartType: "line",
            color: "#ff7188",
            strokeWidth: 2,
            showDots: false,
          },
        ]}
        yAxisFormatter={formatTickValue}
        tooltipFormatter={(value) => [formatCurrency(value, currency), ""]}
      />
    </ChartWrapper>
  );
});
