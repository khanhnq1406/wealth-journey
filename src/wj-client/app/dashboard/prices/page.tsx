"use client";

import { useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { BaseCard } from "@/components/BaseCard";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { TanStackTable } from "@/components/table/TanStackTable";
import { MobileTable, MobileColumnDef } from "@/components/table/MobileTable";
import { SymbolAutocomplete } from "@/components/forms/SymbolAutocomplete";
import {
  useQueryGetMarketPrices,
  useQueryGetMarketPrice,
} from "@/utils/generated/hooks";
import { InvestmentType } from "@/gen/protobuf/v1/investment";
import { formatPriceValue, formatChangeValue, PriceItem } from "./helpers";

type Tab = "gold" | "silver" | "symbol";

const TABS: { key: Tab; label: string }[] = [
  { key: "gold", label: "Gold" },
  { key: "silver", label: "Silver" },
  { key: "symbol", label: "Symbol Lookup" },
];

function ChangeCell({
  value,
  currency,
}: {
  value: number | null | undefined;
  currency: string;
}) {
  if (!value) return <span className="text-gray-400">—</span>;
  const isUp = value > 0;
  return (
    <span
      className={`flex items-center gap-0.5 ${isUp ? "text-green-600" : "text-lred"}`}
    >
      <svg
        aria-hidden="true"
        className="w-3 h-3 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={isUp ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"}
        />
      </svg>
      <span>{formatChangeValue(value, currency)}</span>
    </span>
  );
}

// ─── TanStack Table columns (desktop) ─────────────────────────────────────────

const columnHelper = createColumnHelper<PriceItem>();

const tanstackColumns = [
  columnHelper.display({
    id: "name",
    header: "Type",
    cell: ({ row }) => (
      <div>
        <span className="font-medium text-gray-900 dark:text-dark-text">
          {row.original.name || row.original.typeCode}
        </span>
        <span className="ml-1.5 text-xs text-gray-400">
          {row.original.currency}
        </span>
      </div>
    ),
  }),
  columnHelper.accessor("buy", {
    header: "Buy",
    cell: ({ row }) => (
      <span className="font-medium text-gray-900 dark:text-dark-text">
        {formatPriceValue(row.original.buy, row.original.currency)}
      </span>
    ),
  }),
  columnHelper.accessor("sell", {
    header: "Sell",
    cell: ({ row }) => (
      <span className="text-gray-500 dark:text-gray-400">
        {formatPriceValue(row.original.sell, row.original.currency)}
      </span>
    ),
  }),
  columnHelper.accessor("changeBuy", {
    header: "Change",
    cell: ({ row }) => (
      <ChangeCell
        value={row.original.changeBuy}
        currency={row.original.currency}
      />
    ),
  }),
];

// ─── MobileTable columns (mobile fallback) ─────────────────────────────────────

const mobileColumns: MobileColumnDef<PriceItem>[] = [
  {
    id: "name",
    header: "Type",
    cell: ({ row }) => (
      <div>
        <span className="font-medium text-gray-900 dark:text-dark-text">
          {row.name || row.typeCode}
        </span>
        <span className="ml-1.5 text-xs text-gray-400">{row.currency}</span>
      </div>
    ),
  },
  {
    id: "buy",
    header: "Buy",
    cell: ({ row }) => (
      <span className="font-medium text-gray-900 dark:text-dark-text">
        {formatPriceValue(row.buy, row.currency)}
      </span>
    ),
  },
  {
    id: "sell",
    header: "Sell",
    cell: ({ row }) => (
      <span className="text-gray-500 dark:text-gray-400">
        {formatPriceValue(row.sell, row.currency)}
      </span>
    ),
  },
  {
    id: "change",
    header: "Change",
    cell: ({ row }) => (
      <ChangeCell value={row.changeBuy} currency={row.currency} />
    ),
  },
];

interface SymbolLookupTabProps {
  symbolInput: string;
  onSymbolInputChange: (val: string) => void;
  querySymbol: string;
  onSearch: (sym: string) => void;
}

function SymbolLookupTab({
  symbolInput,
  onSymbolInputChange,
  querySymbol,
  onSearch,
}: SymbolLookupTabProps) {
  const {
    data: priceResp,
    isLoading,
    isError,
  } = useQueryGetMarketPrice(
    {
      symbol: querySymbol,
      currency: "USD",
      type: InvestmentType.INVESTMENT_TYPE_UNSPECIFIED,
    },
    {
      enabled: !!querySymbol,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
  );

  const priceData = priceResp?.data;

  const handleSearch = () => {
    const sym = symbolInput.trim().toUpperCase();
    if (sym) onSearch(sym);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1">
            Symbol
          </label>
          <SymbolAutocomplete
            value={symbolInput}
            onChange={(symbol) => onSymbolInputChange(symbol)}
            placeholder="Search symbol, e.g. AAPL, BTC..."
          />
        </div>
        <Button
          type={ButtonType.PRIMARY}
          onClick={handleSearch}
          disabled={!symbolInput}
          loading={isLoading}
          fullWidth={false}
        >
          Search
        </Button>
      </div>

      {(isError || (priceResp && !priceResp.success)) && (
        <p className="text-lred text-sm">
          Failed to fetch price. The symbol may not be supported or available.
        </p>
      )}

      {priceData && querySymbol && (
        <div className="p-4 bg-gray-50 dark:bg-dark-surface rounded-lg border border-gray-200 dark:border-dark-border">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-dark-text">
                {querySymbol}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {priceData.timestamp
                  ? new Date(priceData.timestamp * 1000).toLocaleTimeString()
                  : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-dark-text">
                {priceData.currency === "VND"
                  ? formatPriceValue(priceData.price, "VND")
                  : `$${priceData.priceDecimal.toFixed(2)}`}
              </p>
              <p className="text-xs text-gray-400">{priceData.currency}</p>
            </div>
          </div>
        </div>
      )}

      {!querySymbol && (
        <p className="text-center text-gray-400 py-8 text-sm">
          Search for a stock, crypto, or ETF symbol to see its current price.
        </p>
      )}
    </div>
  );
}

export default function PricesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("gold");
  const [symbolInput, setSymbolInput] = useState("");
  const [querySymbol, setQuerySymbol] = useState("");

  const { data, isLoading, isError, refetch, isFetching } =
    useQueryGetMarketPrices(
      {},
      {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    );

  const ts = data?.timestamp;
  const lastUpdated =
    ts && !Number.isNaN(new Date(ts).getTime())
      ? new Date(ts).toLocaleTimeString("vi-VN")
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-dark-text">
            Market Prices
          </h1>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>
        {activeTab !== "symbol" && (
          <Button
            type={ButtonType.PRIMARY}
            onClick={() => refetch()}
            loading={isFetching}
            fullWidth={false}
            leftIcon={
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            }
          >
            Refresh
          </Button>
        )}
      </div>

      <BaseCard padding="none">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200 dark:border-dark-border overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap px-3 py-2 font-medium text-sm sm:px-4 sm:text-base ${
                activeTab === tab.key
                  ? "border-b-2 border-primary-500 text-primary-500"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-dark-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === "gold" && (
            <>
              {isError && (
                <p className="text-lred text-sm text-center py-4">
                  Failed to load gold prices. Try refreshing.
                </p>
              )}
              {/* Desktop: TanStack Table */}
              <div className="hidden md:block">
                <TanStackTable<PriceItem>
                  data={data?.gold ?? []}
                  columns={tanstackColumns}
                  isLoading={isLoading}
                  loadingRowCount={8}
                  emptyMessage="No gold prices available"
                  emptyDescription="Could not fetch gold prices from the price provider."
                  enableMobileExpansion={false}
                />
              </div>
              {/* Mobile: card-based list */}
              <div className="md:hidden">
                <MobileTable<PriceItem>
                  data={data?.gold ?? []}
                  columns={mobileColumns}
                  isLoading={isLoading}
                  loadingRowCount={8}
                  getKey={(item) => item.typeCode}
                  emptyMessage="No gold prices available"
                  emptyDescription="Could not fetch gold prices from the price provider."
                  expandable
                />
              </div>
            </>
          )}

          {activeTab === "silver" && (
            <>
              {isError && (
                <p className="text-lred text-sm text-center py-4">
                  Failed to load silver prices. Try refreshing.
                </p>
              )}
              {/* Desktop: TanStack Table */}
              <div className="hidden md:block">
                <TanStackTable<PriceItem>
                  data={data?.silver ?? []}
                  columns={tanstackColumns}
                  isLoading={isLoading}
                  loadingRowCount={4}
                  emptyMessage="No silver prices available"
                  emptyDescription="Could not fetch silver prices from the price provider."
                  enableMobileExpansion={false}
                />
              </div>
              {/* Mobile: card-based list */}
              <div className="md:hidden">
                <MobileTable<PriceItem>
                  data={data?.silver ?? []}
                  columns={mobileColumns}
                  isLoading={isLoading}
                  loadingRowCount={4}
                  getKey={(item) => item.typeCode}
                  emptyMessage="No silver prices available"
                  emptyDescription="Could not fetch silver prices from the price provider."
                  expandable
                />
              </div>
            </>
          )}

          {activeTab === "symbol" && (
            <SymbolLookupTab
              symbolInput={symbolInput}
              onSymbolInputChange={setSymbolInput}
              querySymbol={querySymbol}
              onSearch={setQuerySymbol}
            />
          )}
        </div>
      </BaseCard>
    </div>
  );
}
