"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createColumnHelper } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { BaseCard } from "@/components/BaseCard";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { BaseModal } from "@/components/modals/BaseModal";
import { TanStackTable } from "@/components/table/TanStackTable";
import { MobileTable, MobileColumnDef } from "@/components/table/MobileTable";
import { SymbolAutocomplete } from "@/features/investment/components/SymbolAutocomplete";
import {
  useQueryGetMarketPrices,
  useQueryGetMarketPrice,
  useQueryListWatchlist,
  useMutationCreateWatchlistItem,
  useMutationDeleteWatchlistItem,
  EVENT_WatchlistListWatchlist,
} from "@/utils/generated/hooks";
import { useNotification } from "@/contexts/NotificationContext";
import { InvestmentType, SearchResult } from "@/gen/protobuf/v1/investment";
import { formatPriceValue, formatChangeValue, PriceItem } from "./helpers";
import { useAuth } from "@/features/auth/hooks/useAuth";
import {
  InlinePriceEdit,
  OverrideIndicator,
} from "@/features/market-prices/components/InlinePriceEdit";
import { SentimentCard } from "@/components/GoldSentimentCard";
import { OrnateHeading } from "@/components/decorative/OrnateHeading";
import { WatchlistTab } from "@/features/watchlist/components/WatchlistTab";
import { AddToWatchlistForm } from "@/features/watchlist/forms/AddToWatchlistForm";

type Tab = "watchlist" | "gold" | "silver" | "currency" | "symbol";

// Tab labels are provided via translations below

function ChangeCell({
  value,
  currency,
  divide = true,
}: {
  value: number | null | undefined;
  currency: string;
  divide?: boolean;
}) {
  if (!value) return <span className="text-v2-text-tertiary">—</span>;
  const isUp = value > 0;
  return (
    <span
      className={`flex items-center gap-0.5 ${isUp ? "text-v2-green-positive" : "text-v2-red-negative"}`}
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
      <span className="tabular-nums">{formatChangeValue(value, currency, { divide })}</span>
    </span>
  );
}

// ─── Star Toggle Button ────────────────────────────────────────────────────────

interface StarToggleButtonProps {
  symbol: string;
  name: string;
  assetType: InvestmentType;
  currency: string;
  watchlistItemId: number | undefined;
  onAddSuccess: () => void;
  onRemoveSuccess: () => void;
}

function StarToggleButton({
  symbol,
  name,
  assetType,
  currency,
  watchlistItemId,
  onAddSuccess,
  onRemoveSuccess,
}: StarToggleButtonProps) {
  const tw = useTranslations("prices.watchlist");
  const { toast } = useNotification();

  const addMutation = useMutationCreateWatchlistItem({
    onSuccess: () => {
      onAddSuccess();
    },
    onError: (error: { message: string }) => {
      const msg = error?.message ?? "";
      const lower = msg.toLowerCase();
      if (lower.includes("already") || lower.includes("duplicate")) {
        toast.warning(tw("form.errors.alreadyInWatchlist"));
      } else if (lower.includes("maximum") || lower.includes("limit")) {
        toast.warning(tw("form.errors.limitReached"));
      } else {
        toast.error(tw("form.errors.failedToAdd"));
      }
    },
  });

  const removeMutation = useMutationDeleteWatchlistItem({
    onSuccess: () => {
      onRemoveSuccess();
    },
    onError: () => {
      toast.error(tw("form.errors.failedToRemove"));
    },
  });

  const isInWatchlist = watchlistItemId !== undefined;
  const isPending = addMutation.isPending || removeMutation.isPending;

  const handleClick = () => {
    if (isPending) return;
    if (isInWatchlist) {
      removeMutation.mutate({ id: watchlistItemId });
    } else {
      addMutation.mutate({ symbol, name, assetType, currency, note: "" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={isInWatchlist ? tw("starRemove") : tw("starAdd")}
      aria-pressed={isInWatchlist}
      className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-v2-gold-primary disabled:cursor-not-allowed ${
        isInWatchlist
          ? "text-amber-400 hover:text-amber-500"
          : "text-gray-400 hover:text-v2-gold-accent"
      }`}
    >
      {isPending ? (
        <svg
          className="w-4 h-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      ) : isInWatchlist ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )}
    </button>
  );
}

// ─── TanStack Table columns (desktop) ─────────────────────────────────────────

const columnHelper = createColumnHelper<PriceItem>();

const TAB_TYPE_COLOR: Record<Tab, string> = {
  watchlist: "text-v2-gold-accent",
  gold: "text-v2-maroon-900",
  silver: "text-v2-maroon-900",
  currency: "text-v2-maroon-900",
  symbol: "text-v2-gold-accent",
};


function buildTanstackColumns(
  t: (key: string) => string,
  tab: Tab,
  isAdmin: boolean,
  watchedSymbolToId?: Map<string, number>,
  onStarAddSuccess?: () => void,
  onStarRemoveSuccess?: () => void,
) {
  const typeColor = TAB_TYPE_COLOR[tab];
  const showUnitLabel = tab !== "currency";
  const divideValues = tab !== "currency";
  const cols = [
    columnHelper.display({
      id: "name",
      header: t("table.type"),
      cell: ({ row }) => (
        <div className="flex items-center">
          <span className={`font-bold ${typeColor}`}>
            {row.original.name || row.original.typeCode}
          </span>
          <span className="ml-1.5 text-xs text-v2-maroon-800/60">
            {row.original.currency}
          </span>
          <OverrideIndicator
            item={row.original}
            category={tab}
            isAdmin={isAdmin}
          />
        </div>
      ),
    }),
    columnHelper.accessor("buy", {
      header: () => (
        <div>
          <span className="text-base font-black uppercase tracking-[1px]">{t("table.buy")}</span>
          {showUnitLabel && <div className="font-normal text-[10px] opacity-70">{t("table.buyUnit")}</div>}
        </div>
      ),
      cell: ({ row }) => (
        <span className="font-bold text-red-700 tabular-nums">
          {formatPriceValue(row.original.buy, row.original.currency, { divide: divideValues })}
        </span>
      ),
    }),
    columnHelper.accessor("sell", {
      header: () => (
        <div>
          <span className="text-base font-black uppercase tracking-[1px]">{t("table.sell")}</span>
          {showUnitLabel && <div className="font-normal text-[10px] opacity-70">{t("table.sellUnit")}</div>}
        </div>
      ),
      cell: ({ row }) => (
        <span className="font-bold text-green-700 tabular-nums">
          {formatPriceValue(row.original.sell, row.original.currency, { divide: divideValues })}
        </span>
      ),
    }),
    columnHelper.accessor("changeBuy", {
      header: t("table.change"),
      cell: ({ row }) => (
        <ChangeCell
          value={row.original.changeBuy}
          currency={row.original.currency}
          divide={divideValues}
        />
      ),
    }),
  ];

  if (isAdmin) {
    cols.push(
      columnHelper.display({
        id: "admin",
        header: "",
        cell: ({ row }) => (
          <InlinePriceEdit item={row.original} category={tab} />
        ),
      }),
    );
  }

  if (tab === "gold" || tab === "silver" || tab === "currency") {
    const assetType =
      tab === "gold"
        ? InvestmentType.INVESTMENT_TYPE_GOLD_VND
        : tab === "silver"
          ? InvestmentType.INVESTMENT_TYPE_SILVER_VND
          : InvestmentType.INVESTMENT_TYPE_OTHER;

    cols.push(
      columnHelper.display({
        id: "star",
        header: "",
        cell: ({ row }) => (
          <StarToggleButton
            symbol={row.original.typeCode}
            name={row.original.name || row.original.typeCode}
            assetType={assetType}
            currency={row.original.currency}
            watchlistItemId={watchedSymbolToId?.get(row.original.typeCode)}
            onAddSuccess={onStarAddSuccess ?? (() => {})}
            onRemoveSuccess={onStarRemoveSuccess ?? (() => {})}
          />
        ),
      }),
    );
  }

  return cols;
}

// ─── MobileTable columns (mobile fallback) ─────────────────────────────────────

function buildMobileColumns(
  t: (key: string) => string,
  tab: Tab,
  isAdmin: boolean,
  watchedSymbolToId?: Map<string, number>,
  onStarAddSuccess?: () => void,
  onStarRemoveSuccess?: () => void,
): MobileColumnDef<PriceItem>[] {
  const typeColor = TAB_TYPE_COLOR[tab];
  const showUnitLabel = tab !== "currency";
  const divideValues = tab !== "currency";
  const cols: MobileColumnDef<PriceItem>[] = [
    {
      id: "name",
      header: t("table.type"),
      cell: ({ row }) => (
        <div className="flex items-center">
          <span className={`font-bold ${typeColor}`}>
            {row.name || row.typeCode}
          </span>
          <span className="ml-1.5 text-xs text-v2-maroon-800/60">{row.currency}</span>
          <OverrideIndicator item={row} category={tab} isAdmin={isAdmin} />
        </div>
      ),
    },
    {
      id: "buy",
      header: (
        <div>
          <span className="text-base font-bold">{t("table.buy")}</span>
          {showUnitLabel && <span className="text-[10px] text-v2-maroon-800/60 ml-1">{t("table.buyUnit")}</span>}
        </div>
      ),
      cell: ({ row }) => (
        <span className="font-bold text-red-700 tabular-nums">
          {formatPriceValue(row.buy, row.currency, { divide: divideValues })}
        </span>
      ),
    },
    {
      id: "sell",
      header: (
        <div>
          <span className="text-base font-bold">{t("table.sell")}</span>
          {showUnitLabel && <span className="text-[10px] text-v2-maroon-800/60 ml-1">{t("table.sellUnit")}</span>}
        </div>
      ),
      cell: ({ row }) => (
        <span className="font-bold text-green-700 tabular-nums">
          {formatPriceValue(row.sell, row.currency, { divide: divideValues })}
        </span>
      ),
    },
    {
      id: "change",
      header: t("table.change"),
      cell: ({ row }) => (
        <ChangeCell value={row.changeBuy} currency={row.currency} divide={divideValues} />
      ),
    },
  ];

  if (isAdmin) {
    cols.push({
      id: "admin",
      header: "",
      cell: ({ row }) => <InlinePriceEdit item={row} category={tab} />,
    });
  }

  if (tab === "gold" || tab === "silver" || tab === "currency") {
    const assetType =
      tab === "gold"
        ? InvestmentType.INVESTMENT_TYPE_GOLD_VND
        : tab === "silver"
          ? InvestmentType.INVESTMENT_TYPE_SILVER_VND
          : InvestmentType.INVESTMENT_TYPE_OTHER;

    cols.push({
      id: "star",
      header: "",
      showInCollapsed: true,
      cell: ({ row }) => (
        <StarToggleButton
          symbol={row.typeCode}
          name={row.name || row.typeCode}
          assetType={assetType}
          currency={row.currency}
          watchlistItemId={watchedSymbolToId?.get(row.typeCode)}
          onAddSuccess={onStarAddSuccess ?? (() => {})}
          onRemoveSuccess={onStarRemoveSuccess ?? (() => {})}
        />
      ),
    });
  }

  return cols;
}

function mapQuoteTypeToInvestmentTypeLocal(quoteType: string): InvestmentType {
  switch (quoteType.toUpperCase()) {
    case "EQUITY":
      return InvestmentType.INVESTMENT_TYPE_STOCK;
    case "CRYPTOCURRENCY":
      return InvestmentType.INVESTMENT_TYPE_CRYPTOCURRENCY;
    case "ETF":
      return InvestmentType.INVESTMENT_TYPE_ETF;
    case "MUTUALFUND":
      return InvestmentType.INVESTMENT_TYPE_MUTUAL_FUND;
    case "BOND":
      return InvestmentType.INVESTMENT_TYPE_BOND;
    case "COMMODITY":
      return InvestmentType.INVESTMENT_TYPE_COMMODITY;
    default:
      return InvestmentType.INVESTMENT_TYPE_OTHER;
  }
}

interface SymbolLookupTabProps {
  symbolInput: string;
  onSymbolInputChange: (val: string, result?: SearchResult) => void;
  querySymbol: string;
  onSearch: (sym: string) => void;
  onWatchlistAdded: () => void;
}

function SymbolLookupTab({
  symbolInput,
  onSymbolInputChange,
  querySymbol,
  onSearch,
  onWatchlistAdded,
}: SymbolLookupTabProps) {
  const t = useTranslations("prices.symbolLookup");
  const tp = useTranslations("prices");
  const locale = useLocale();
  const [symbolMeta, setSymbolMeta] = useState<SearchResult | null>(null);
  const [addedToWatchlist, setAddedToWatchlist] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

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

  const addToWatchlistMutation = useMutationCreateWatchlistItem({
    onSuccess: () => {
      setAddedToWatchlist(true);
      setWatchlistError(null);
      onWatchlistAdded();
    },
    onError: (error: { message: string }) => {
      const msg = error.message || "";
      const lower = msg.toLowerCase();
      if (lower.includes("already") || lower.includes("duplicate")) {
        setWatchlistError(tp("watchlistAlreadyAdded"));
      } else if (lower.includes("maximum") || lower.includes("limit")) {
        setWatchlistError(tp("watchlistLimitReached"));
      } else {
        setWatchlistError(tp("watchlistFailedToAdd"));
      }
    },
  });

  const priceData = priceResp?.data;

  const handleSearch = () => {
    const sym = symbolInput.trim().toUpperCase();
    if (sym) {
      onSearch(sym);
      setAddedToWatchlist(false);
      setWatchlistError(null);
    }
  };

  const handleSymbolChange = (sym: string, result?: SearchResult) => {
    onSymbolInputChange(sym, result);
    if (result) setSymbolMeta(result);
    else setSymbolMeta(null);
    setAddedToWatchlist(false);
    setWatchlistError(null);
  };

  const handleAddToWatchlist = () => {
    if (!querySymbol) return;
    setWatchlistError(null);
    addToWatchlistMutation.mutate({
      symbol: querySymbol,
      name: symbolMeta?.name || querySymbol,
      assetType: symbolMeta
        ? mapQuoteTypeToInvestmentTypeLocal(symbolMeta.type || "")
        : InvestmentType.INVESTMENT_TYPE_OTHER,
      currency: symbolMeta?.currency || priceData?.currency || "USD",
      note: "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-v2-text-secondary mb-1">
            {t("symbolLabel")}
          </label>
          <SymbolAutocomplete
            value={symbolInput}
            onChange={handleSymbolChange}
            placeholder={t("searchPlaceholder")}
          />
        </div>
        <Button
          type={ButtonType.PRIMARY}
          onClick={handleSearch}
          disabled={!symbolInput}
          loading={isLoading}
          fullWidth={false}
        >
          {t("search")}
        </Button>
      </div>

      {(isError || (priceResp && !priceResp.success)) && (
        <p className="text-v2-red-negative text-sm">{t("failedToFetch")}</p>
      )}

      {priceData && querySymbol && (
        <div className="p-4 bg-v2-bg-dark rounded-lg border border-v2-border-light">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-bold text-v2-gold-accent">
                {querySymbol}
              </p>
              <p className="text-xs text-v2-text-tertiary mt-0.5">
                {priceData.timestamp
                  ? new Date(priceData.timestamp * 1000).toLocaleTimeString(
                      locale,
                    )
                  : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-v2-gold-accent">
                {priceData.currency === "VND"
                  ? formatPriceValue(priceData.price, "VND")
                  : `$${priceData.priceDecimal.toFixed(2)}`}
              </p>
              <p className="text-xs text-v2-text-tertiary">{priceData.currency}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-v2-border-light space-y-2">
            {addedToWatchlist ? (
              <p className="text-sm text-v2-green-positive flex items-center gap-1">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {tp("watchlistAddedSuccess")}
              </p>
            ) : (
              <Button
                type={ButtonType.PRIMARY}
                onClick={handleAddToWatchlist}
                loading={addToWatchlistMutation.isPending}
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                }
              >
                {tp("addToWatchlist")}
              </Button>
            )}
            {watchlistError && (
              <p className="text-sm text-v2-red-negative flex items-center gap-1">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {watchlistError}
              </p>
            )}
          </div>
        </div>
      )}

      {!querySymbol && (
        <p className="text-center text-v2-text-tertiary py-8 text-sm">
          {t("emptyState")}
        </p>
      )}
    </div>
  );
}

export default function PricesPage() {
  const t = useTranslations("prices");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;
  const [activeTab, setActiveTab] = useState<Tab>("watchlist");
  const [modalType, setModalType] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Watchlist state for star toggles — single query shared across all tabs
  // React Query deduplicates this with WatchlistTab's own useQueryListWatchlist call
  const watchlistQuery = useQueryListWatchlist({}, { staleTime: 60 * 1000 });
  const watchedItems = watchlistQuery.data?.items ?? [];
  const watchedSymbolToId = useMemo(
    () => new Map<string, number>(watchedItems.map((item) => [item.symbol, item.id])),
    [watchedItems],
  );

  const handleStarSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [EVENT_WatchlistListWatchlist] });
  }, [queryClient]);

  const tanstackColumns = useMemo(
    () =>
      buildTanstackColumns(
        t as (key: string) => string,
        activeTab,
        isAdmin,
        watchedSymbolToId,
        handleStarSuccess,
        handleStarSuccess,
      ),
    [t, activeTab, isAdmin, watchedSymbolToId, handleStarSuccess],
  );
  const mobileColumns = useMemo(
    () =>
      buildMobileColumns(
        t as (key: string) => string,
        activeTab,
        isAdmin,
        watchedSymbolToId,
        handleStarSuccess,
        handleStarSuccess,
      ),
    [t, activeTab, isAdmin, watchedSymbolToId, handleStarSuccess],
  );
  const [symbolInput, setSymbolInput] = useState("");
  const [querySymbol, setQuerySymbol] = useState("");

  const TABS: { key: Tab; label: string }[] = [
    { key: "watchlist", label: t("tabs.watchlist") },
    { key: "gold", label: t("tabs.gold") },
    { key: "silver", label: t("tabs.silver") },
    { key: "currency", label: t("tabs.currency") },
    { key: "symbol", label: t("tabs.symbolLookup") },
  ];

  const handleCloseModal = () => setModalType(null);

  const handleWatchlistSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [EVENT_WatchlistListWatchlist] });
    handleCloseModal();
  };

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
      ? new Date(ts).toLocaleTimeString(locale)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 text-center">
          <OrnateHeading size="lg">{t("title")}</OrnateHeading>
          {lastUpdated && (
            <p className="text-xs text-v2-text-tertiary mt-1">
              {t("lastUpdated", { time: lastUpdated })}
            </p>
          )}
        </div>
        {activeTab !== "symbol" && activeTab !== "watchlist" && (
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
            {tc("refresh")}
          </Button>
        )}
      </div>

      <BaseCard padding="none">
        {/* Tab bar */}
 <div className="flex border-b border-v2-border-light overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap px-3 py-2 font-medium text-sm sm:px-4 sm:text-base ${
                activeTab === tab.key
                  ? "border-b-2 border-v2-gold-primary text-v2-gold-accent"
                  : "text-v2-text-tertiary hover:text-v2-gold-accent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === "watchlist" && (
            <WatchlistTab onAddClick={() => setModalType("add-watchlist")} />
          )}

          {activeTab === "gold" && (
            <>
              {isError && (
                <p className="text-v2-red-negative text-sm text-center py-4">
                  {t("gold.failedToLoad")}
                </p>
              )}
              {/* Desktop: TanStack Table with cream parchment style */}
              <div className="hidden md:block">
                <TanStackTable<PriceItem>
                  data={data?.gold ?? []}
                  columns={tanstackColumns}
                  isLoading={isLoading}
                  loadingRowCount={8}
                  emptyMessage={t("gold.emptyMessage")}
                  emptyDescription={t("gold.emptyDescription")}
                  enableMobileExpansion={false}
                  className="price-table-override"
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
                  emptyMessage={t("gold.emptyMessage")}
                  emptyDescription={t("gold.emptyDescription")}
                  expandable
                  expandButtonLabel={tc("showDetails")}
                  collapseButtonLabel={tc("hideDetails")}
                />
              </div>
              {/* Gold Sentiment */}
              <div className="mt-4">
                <SentimentCard variant="home" asset="gold" />
              </div>
            </>
          )}

          {activeTab === "silver" && (
            <>
              {isError && (
                <p className="text-v2-red-negative text-sm text-center py-4">
                  {t("silver.failedToLoad")}
                </p>
              )}
              {/* Desktop: TanStack Table with cream parchment style */}
              <div className="hidden md:block">
                <TanStackTable<PriceItem>
                  data={data?.silver ?? []}
                  columns={tanstackColumns}
                  isLoading={isLoading}
                  loadingRowCount={4}
                  emptyMessage={t("silver.emptyMessage")}
                  emptyDescription={t("silver.emptyDescription")}
                  enableMobileExpansion={false}
                  className="price-table-override price-table-silver"
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
                  emptyMessage={t("silver.emptyMessage")}
                  emptyDescription={t("silver.emptyDescription")}
                  expandable
                  expandButtonLabel={tc("showDetails")}
                  collapseButtonLabel={tc("hideDetails")}
                />
              </div>
              {/* Silver Sentiment */}
              <div className="mt-4">
                <SentimentCard variant="home" asset="silver" />
              </div>
            </>
          )}

          {activeTab === "currency" && (
            <>
              {isError && (
                <p className="text-v2-red-negative text-sm text-center py-4">
                  {t("currency.failedToLoad")}
                </p>
              )}
              {/* Desktop: TanStack Table with cream parchment style */}
              <div className="hidden md:block">
                <TanStackTable<PriceItem>
                  data={data?.currency ?? []}
                  columns={tanstackColumns}
                  isLoading={isLoading}
                  loadingRowCount={6}
                  emptyMessage={t("currency.emptyMessage")}
                  emptyDescription={t("currency.emptyDescription")}
                  enableMobileExpansion={false}
                  className="price-table-override price-table-currency"
                />
              </div>
              {/* Mobile: card-based list */}
              <div className="md:hidden">
                <MobileTable<PriceItem>
                  data={data?.currency ?? []}
                  columns={mobileColumns}
                  isLoading={isLoading}
                  loadingRowCount={6}
                  getKey={(item) => item.typeCode}
                  emptyMessage={t("currency.emptyMessage")}
                  emptyDescription={t("currency.emptyDescription")}
                  expandable
                  expandButtonLabel={tc("showDetails")}
                  collapseButtonLabel={tc("hideDetails")}
                />
              </div>
            </>
          )}

          {activeTab === "symbol" && (
            <SymbolLookupTab
              symbolInput={symbolInput}
              onSymbolInputChange={(sym) => setSymbolInput(sym)}
              querySymbol={querySymbol}
              onSearch={setQuerySymbol}
              onWatchlistAdded={() =>
                queryClient.invalidateQueries({ queryKey: [EVENT_WatchlistListWatchlist] })
              }
            />
          )}
        </div>
      </BaseCard>

      <BaseModal
        isOpen={modalType !== null}
        onClose={handleCloseModal}
        title={t("tabs.watchlist")}
      >
        {modalType === "add-watchlist" && (
          <AddToWatchlistForm onSuccess={handleWatchlistSuccess} />
        )}
      </BaseModal>
    </div>
  );
}
