"use client";

import { memo, useState, useMemo } from "react";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { MultiSelect } from "@/components/select/MultiSelect";
import {
  useQueryListWallets,
  useQueryGetAvailableYears,
} from "@/utils/generated/hooks";

interface ReportControlsProps {
  onExport?: () => void;
  onYearChange?: (year: number) => void;
  onWalletsChange?: (walletIds: number[]) => void;
}

export const ReportControls = memo(function ReportControls({
  onExport,
  onYearChange,
  onWalletsChange,
}: ReportControlsProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWalletIds, setSelectedWalletIds] = useState<string[]>([]);

  // Fetch available years
  const { data: availableYearsData } = useQueryGetAvailableYears(
    {},
    { refetchOnMount: "always" },
  );

  const availableYears = availableYearsData?.years?.length
    ? availableYearsData.years
    : [new Date().getFullYear()];

  // Fetch wallets for the dropdown
  const { data: walletsData } = useQueryListWallets(
    { pagination: { page: 1, pageSize: 100, orderBy: "", order: "" } },
    { refetchOnMount: "always" },
  );

  // Convert wallet data to options for MultiSelect
  const walletOptions = useMemo(() => {
    return (
      walletsData?.wallets?.map((wallet) => ({
        value: wallet.id.toString(),
        label: wallet.walletName,
      })) ?? []
    );
  }, [walletsData]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    onYearChange?.(year);
  };

  const handleWalletsChange = (walletIdStrings: string[]) => {
    setSelectedWalletIds(walletIdStrings);
    const walletIds = walletIdStrings.map((id) => parseInt(id));
    onWalletsChange?.(walletIds);
  };

  const handleExport = () => {
    onExport?.();
  };

  return (
    <div className="flex sm:flex-row flex-col sm:items-center gap-4 mb-4 justify-between">
      <div className="flex sm:items-center gap-4 sm:flex-row flex-col">
        {/* Wallet Multi-Select */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Wallets:</label>
          <div className="w-64">
            <MultiSelect
              options={walletOptions}
              values={selectedWalletIds}
              onChange={handleWalletsChange}
              placeholder="All Wallets"
            />
          </div>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Year:</label>
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008148] focus:border-transparent"
            value={selectedYear}
            onChange={(e) => handleYearChange(parseInt(e.target.value))}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Export Button */}
      <Button
        type={ButtonType.SECONDARY}
        onClick={handleExport}
        className="w-fit px-4 py-2 text-sm"
      >
        Export to CSV
      </Button>
    </div>
  );
});
