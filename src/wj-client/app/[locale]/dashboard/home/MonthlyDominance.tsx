"use client";

import { memo, useState, useMemo } from "react";
import { useQueryGetMonthlyDominance } from "@/utils/generated/hooks";
import { LineChart, ChartWrapper } from "@/components/charts";
import { chartColors } from "@/app/constants";
import { formatTickValue } from "@/utils/number-formatter";
import { formatCurrency } from "@/utils/currency-formatter";
import { useCurrency } from "@/contexts/CurrencyContext";

interface MonthlyDominanceProps {
  availableYears: number[];
}

export const MonthlyDominance = memo(function MonthlyDominance({
  availableYears,
}: MonthlyDominanceProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { currency } = useCurrency();

  // Fetch monthly dominance data for the selected year
  const { data: dominanceData, isLoading } = useQueryGetMonthlyDominance(
    { year: selectedYear },
    { refetchOnMount: "always" },
  );

  // Transform data into stacked area chart format
  const chartData = useMemo(() => {
    const walletData = dominanceData?.data ?? [];
    if (walletData.length === 0) return [];

    const monthNames = [
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

    // Build monthly data with each wallet's balance
    const monthlyData: Record<string, any>[] = monthNames.map((month) => ({
      month,
    }));

    walletData.forEach((wallet) => {
      wallet.monthlyBalances.forEach((balance: number, monthIndex: number) => {
        monthlyData[monthIndex][`wallet_${wallet.walletId}`] = balance;
        monthlyData[monthIndex][`wallet_name_${wallet.walletId}`] =
          wallet.walletName;
      });
    });

    return monthlyData;
  }, [dominanceData]);

  // Get wallet list from data
  const wallets = useMemo(() => dominanceData?.data ?? [], [dominanceData]);

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
        xAxisKey="month"
        series={wallets.map((wallet, index) => ({
          dataKey: `wallet_${wallet.walletId}`,
          name: wallet.walletName,
          chartType: "area",
          showArea: true,
          color: chartColors[index % chartColors.length],
          stackId: "1",
          curveType: "monotone",
        }))}
        yAxisFormatter={formatTickValue}
        tooltipFormatter={(value) => [formatCurrency(value, currency), ""]}
      />
    </ChartWrapper>
  );
});
