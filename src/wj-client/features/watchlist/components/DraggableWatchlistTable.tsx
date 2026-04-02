"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { WatchlistItem } from "@/gen/protobuf/v1/watchlist";
import { AssetTypeBadge } from "@/features/watchlist/components/AssetTypeBadge";
import {
  formatWatchlistPrice,
  formatWatchlistChange,
} from "@/features/watchlist/utils/watchlist-helpers";
import { SortableList } from "@/components/table/SortableList";

interface DraggableWatchlistTableProps {
  items: WatchlistItem[];
  onReorderCommit: (newOrder: WatchlistItem[]) => void;
  onDelete: (id: number) => void;
  isDeleting?: boolean;
}

// Grid columns for the row content (excluding the drag handle which is managed by SortableList)
const GRID_COLS = "grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr_48px]";

function ChangeCell({ item }: { item: WatchlistItem }) {
  const change = formatWatchlistChange(item);
  if (!change) return <span className="text-v2-text-tertiary">—</span>;
  const isUp = item.priceChangePercent >= 0;
  return (
    <span className={`flex items-center gap-0.5 ${isUp ? "text-v2-green-positive" : "text-v2-red-negative"}`}>
      <svg aria-hidden="true" className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d={isUp ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
      </svg>
      <span className="tabular-nums">{change}</span>
    </span>
  );
}

function RowContent({ item, t }: { item: WatchlistItem; t: ReturnType<typeof useTranslations> }) {
  return (
    <>
      <div className="py-3 px-3" role="cell">
        <span className="font-bold text-v2-gold-accent text-sm">{item.symbol}</span>
        {item.name && <span className="block text-xs text-v2-text-tertiary mt-0.5">{item.name}</span>}
      </div>
      <div className="py-3 px-3 tabular-nums font-semibold text-sm" role="cell">{formatWatchlistPrice(item)}</div>
      <div className="py-3 px-3 text-sm" role="cell"><ChangeCell item={item} /></div>
      <div className="py-3 px-3" role="cell"><AssetTypeBadge assetType={item.assetType} /></div>
      <div className="py-3 px-3 text-v2-text-secondary truncate italic text-sm" role="cell">
        {item.note || <span className="text-v2-text-tertiary not-italic">—</span>}
      </div>
    </>
  );
}

export function DraggableWatchlistTable({
  items,
  onReorderCommit,
  onDelete,
  isDeleting = false,
}: DraggableWatchlistTableProps) {
  const t = useTranslations("prices.watchlist.column");

  return (
    <div className="w-full" role="table">
      {/* Header row — aligned to match SortableList's 44px handle + grid content */}
      <div className="flex items-center border-b border-v2-border-light" role="row">
        {/* Spacer matching SortableList drag handle width */}
        <div className="w-[44px] flex-shrink-0" role="columnheader" />
        <div className={`flex-1 grid ${GRID_COLS}`}>
          <div className="py-2 px-3 font-semibold text-v2-text-secondary text-sm" role="columnheader">{t("symbol")}</div>
          <div className="py-2 px-3 font-semibold text-v2-text-secondary text-sm" role="columnheader">{t("price")}</div>
          <div className="py-2 px-3 font-semibold text-v2-text-secondary text-sm" role="columnheader">{t("change")}</div>
          <div className="py-2 px-3 font-semibold text-v2-text-secondary text-sm" role="columnheader">{t("type")}</div>
          <div className="py-2 px-3 font-semibold text-v2-text-secondary text-sm" role="columnheader">{t("note")}</div>
          <div className="py-2 px-3 w-12" role="columnheader" aria-label="Actions" />
        </div>
      </div>

      {/* Body — SortableList handles all DnD logic */}
      <SortableList<WatchlistItem>
        items={items}
        onReorder={onReorderCommit}
        renderItem={(item, isDragging) => (
          <div
            className={`grid ${GRID_COLS} items-center border-b border-v2-border-light last:border-0 bg-[var(--v2-bg-surface,transparent)] hover:bg-v2-bg-surface-tint transition-colors duration-150 cursor-default${isDragging ? " opacity-40" : ""}`}
            role="row"
          >
            <RowContent item={item} t={t} />
            <div className="py-3 px-3 w-12" role="cell">
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                disabled={isDeleting}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-v2-text-tertiary hover:text-v2-red-negative hover:bg-v2-red-negative/10 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                aria-label={`Remove ${item.symbol} from watchlist`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        renderOverlay={(item) => (
          <div
            className={`grid ${GRID_COLS} items-center border border-v2-border-light rounded bg-v2-bg-surface-tint cursor-grabbing`}
            role="row"
          >
            <RowContent item={item} t={t} />
            <div className="py-3 px-3 w-12" role="cell" />
          </div>
        )}
      />
    </div>
  );
}
