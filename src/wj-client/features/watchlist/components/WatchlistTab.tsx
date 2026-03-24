"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { EmptyState } from "@/components/feedback/EmptyState";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { MobileTable, MobileColumnDef } from "@/components/table/MobileTable";
import {
  useQueryListWatchlist,
  useMutationDeleteWatchlistItem,
  useMutationReorderWatchlist,
} from "@/utils/generated/hooks";
import { WatchlistItem } from "@/gen/protobuf/v1/watchlist";
import { AssetTypeBadge } from "@/features/watchlist/components/AssetTypeBadge";
import {
  formatWatchlistPrice,
  formatWatchlistChange,
} from "@/features/watchlist/utils/watchlist-helpers";
import { DraggableWatchlistTable } from "@/features/watchlist/components/DraggableWatchlistTable";

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
  const t = useTranslations("prices.watchlist");
  const listQuery = useQueryListWatchlist({}, { refetchOnMount: "always" });
  const serverItems = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  // Local ordered copy for optimistic drag-and-drop updates
  const [orderedItems, setOrderedItems] = useState<WatchlistItem[]>(serverItems);

  // Sync local order whenever server data refreshes
  useEffect(() => {
    setOrderedItems(serverItems);
  }, [serverItems]);

  const deleteMutation = useMutationDeleteWatchlistItem({
    onSuccess: () => {
      listQuery.refetch();
    },
  });

  const reorderMutation = useMutationReorderWatchlist({
    onError: () => {
      // Revert to server order on failure
      setOrderedItems(serverItems);
    },
  });

  const handleReorder = (newOrder: WatchlistItem[]) => {
    setOrderedItems(newOrder);
    reorderMutation.mutate({ itemIds: newOrder.map((it) => it.id) });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id });
  };

  const handleDeleted = () => {
    listQuery.refetch();
  };

  // Use ordered items for rendering (falls back to server items before first reorder)
  const items = orderedItems.length > 0 ? orderedItems : serverItems;

  // Mobile columns
  const mobileColumns: MobileColumnDef<WatchlistItem>[] = [
    {
      id: "symbol",
      header: t("column.symbol"),
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
      header: t("column.price"),
      showInCollapsed: true,
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">
          {formatWatchlistPrice(row)}
        </span>
      ),
    },
    {
      id: "change",
      header: t("column.change"),
      showInCollapsed: false,
      cell: ({ row }) => <ChangeDisplay item={row} />,
    },
    {
      id: "type",
      header: t("column.type"),
      showInCollapsed: false,
      cell: ({ row }) => <AssetTypeBadge assetType={row.assetType} />,
    },
    {
      id: "note",
      header: t("column.note"),
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
        title={t("errorTitle")}
        description={t("errorDescription")}
        primaryAction={{ label: t("retry"), onClick: () => listQuery.refetch() }}
      />
    );
  }

  const addIcon = (
    <svg
      aria-hidden="true"
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-v2-text-secondary">
          {t("symbolsTracked", { count: total })}
        </p>
        {/* Add button — visible on all screen sizes */}
        <Button
          type={ButtonType.PRIMARY}
          onClick={onAddClick}
          fullWidth={false}
          leftIcon={addIcon}
        >
          {t("addSymbol")}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          primaryAction={{ label: t("addSymbol"), onClick: onAddClick }}
        />
      ) : (
        <>
          {/* Desktop draggable table */}
          <div className="hidden sm:block">
            <DraggableWatchlistTable
              items={items}
              onReorder={handleReorder}
              onDelete={handleDelete}
              isDeleting={deleteMutation.isPending}
            />
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden">
            <MobileTable<WatchlistItem>
              data={items}
              columns={mobileColumns}
              getKey={(item) => item.id}
              expandable
              expandButtonLabel={t("details")}
              collapseButtonLabel={t("less")}
              renderActions={(item) => (
                <DeleteButton item={item} onDeleted={handleDeleted} />
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}
