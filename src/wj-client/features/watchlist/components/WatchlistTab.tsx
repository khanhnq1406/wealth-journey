"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { BaseCard } from "@/components/BaseCard";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { EmptyState } from "@/components/feedback/EmptyState";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { MobileTable, MobileColumnDef } from "@/components/table/MobileTable";
import {
  useQueryListWatchlist,
  useMutationDeleteWatchlistItem,
} from "@/utils/generated/hooks";
import { WatchlistItem } from "@/gen/protobuf/v1/watchlist";
import { AssetTypeBadge } from "@/features/watchlist/components/AssetTypeBadge";
import {
  formatWatchlistPrice,
  formatWatchlistChange,
} from "@/features/watchlist/utils/watchlist-helpers";

interface WatchlistTabProps {
  onAddClick: () => void;
}

function ChangeDisplay({ item }: { item: WatchlistItem }) {
  const change = formatWatchlistChange(item);
  if (!change) return <span className="text-v2-text-tertiary">—</span>;

  const isUp = item.priceChangePercent >= 0;
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
          d={
            isUp
              ? "M5 10l7-7m0 0l7 7m-7-7v18"
              : "M19 14l-7 7m0 0l-7-7m7 7V3"
          }
        />
      </svg>
      <span className="tabular-nums">{change}</span>
    </span>
  );
}

function DeleteButton({
  item,
  onDeleted,
}: {
  item: WatchlistItem;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const deleteMutation = useMutationDeleteWatchlistItem({
    onSuccess: () => {
      onDeleted();
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Failed to remove from watchlist";
      setError(msg);
    },
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => deleteMutation.mutate({ id: item.id })}
        disabled={deleteMutation.isPending}
        className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-v2-text-tertiary hover:text-v2-red-negative hover:bg-v2-red-negative/10 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={`Remove ${item.symbol} from watchlist`}
      >
        {deleteMutation.isPending ? (
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
        ) : (
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
      {error && (
        <span className="text-xs text-v2-red-negative max-w-[120px] text-right">
          {error}
        </span>
      )}
    </div>
  );
}

export function WatchlistTab({ onAddClick }: WatchlistTabProps) {
  const listQuery = useQueryListWatchlist({}, { refetchOnMount: "always" });
  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  const handleDeleted = () => {
    listQuery.refetch();
  };

  // Mobile columns
  const mobileColumns: MobileColumnDef<WatchlistItem>[] = [
    {
      id: "symbol",
      header: "Symbol",
      showInCollapsed: true,
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-v2-gold-accent">{row.symbol}</span>
          {row.name && (
            <span className="ml-1.5 text-xs text-v2-text-tertiary">
              {row.name}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "price",
      header: "Price",
      showInCollapsed: true,
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">
          {formatWatchlistPrice(row)}
        </span>
      ),
    },
    {
      id: "change",
      header: "Change",
      showInCollapsed: false,
      cell: ({ row }) => <ChangeDisplay item={row} />,
    },
    {
      id: "type",
      header: "Type",
      showInCollapsed: false,
      cell: ({ row }) => <AssetTypeBadge assetType={row.assetType} />,
    },
    {
      id: "note",
      header: "Note",
      showInCollapsed: false,
      cell: ({ row }) =>
        row.note ? (
          <span className="text-sm text-v2-text-secondary">{row.note}</span>
        ) : (
          <span className="text-v2-text-tertiary">—</span>
        ),
    },
  ];

  if (listQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <EmptyState
        title="Failed to load watchlist"
        description="Could not fetch your watchlist. Please try again."
        primaryAction={{ label: "Retry", onClick: () => listQuery.refetch() }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-v2-text-secondary">
          {total} {total === 1 ? "symbol" : "symbols"} tracked
        </p>
        {/* Desktop add button */}
        <div className="hidden sm:block">
          <Button
            type={ButtonType.PRIMARY}
            onClick={onAddClick}
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
            Add Symbol
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Your watchlist is empty"
          description="Add symbols to track market prices in one place."
          primaryAction={{ label: "Add Symbol", onClick: onAddClick }}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-v2-border-light">
                  <th className="text-left py-2 px-3 font-semibold text-v2-text-secondary">
                    Symbol
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-v2-text-secondary">
                    Price
                  </th>
                  <th className="text-right py-2 px-3 font-semibold text-v2-text-secondary">
                    Change
                  </th>
                  <th className="text-center py-2 px-3 font-semibold text-v2-text-secondary">
                    Type
                  </th>
                  <th className="text-left py-2 px-3 font-semibold text-v2-text-secondary">
                    Note
                  </th>
                  <th className="py-2 px-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-v2-border-light last:border-0 hover:bg-v2-bg-surface-tint transition-colors duration-150"
                  >
                    <td className="py-3 px-3">
                      <div>
                        <span className="font-bold text-v2-gold-accent">
                          {item.symbol}
                        </span>
                        {item.name && (
                          <span className="block text-xs text-v2-text-tertiary mt-0.5">
                            {item.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold">
                      {formatWatchlistPrice(item)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex justify-end">
                        <ChangeDisplay item={item} />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <AssetTypeBadge assetType={item.assetType} />
                    </td>
                    <td className="py-3 px-3 text-v2-text-secondary max-w-[160px] truncate">
                      {item.note || (
                        <span className="text-v2-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <DeleteButton item={item} onDeleted={handleDeleted} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden">
            <MobileTable<WatchlistItem>
              data={items}
              columns={mobileColumns}
              getKey={(item) => item.id}
              expandable
              expandButtonLabel="Details"
              collapseButtonLabel="Less"
              renderActions={(item) => (
                <DeleteButton item={item} onDeleted={handleDeleted} />
              )}
            />
          </div>
        </>
      )}

      {/* Mobile floating add button */}
      <div className="sm:hidden fixed right-4 flex flex-col items-end" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)", zIndex: 40 }}>
        <button
          type="button"
          onClick={onAddClick}
          className="w-14 h-14 bg-v2-red-primary text-white rounded-full border-2 border-v2-gold-primary flex items-center justify-center hover:bg-v2-red-dark active:scale-95 transition-all duration-200"
          style={{ boxShadow: "0 0 12px rgba(220, 38, 38, 0.4)" }}
          aria-label="Add symbol to watchlist"
        >
          <svg
            aria-hidden="true"
            className="w-6 h-6"
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
        </button>
      </div>
    </div>
  );
}
