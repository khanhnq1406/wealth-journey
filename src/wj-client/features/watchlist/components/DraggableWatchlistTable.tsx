"use client";

import { Reorder } from "framer-motion";
import { GripVertical, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { WatchlistItem } from "@/gen/protobuf/v1/watchlist";
import { AssetTypeBadge } from "@/features/watchlist/components/AssetTypeBadge";
import {
  formatWatchlistPrice,
  formatWatchlistChange,
} from "@/features/watchlist/utils/watchlist-helpers";

interface DraggableWatchlistTableProps {
  items: WatchlistItem[];
  onReorder: (newOrder: WatchlistItem[]) => void;
  onDelete: (id: number) => void;
  isDeleting?: boolean;
}

// Grid column definition — shared by header and each row
// drag-handle | symbol | price | change | type | note | actions
const GRID_COLS = "grid-cols-[32px_1fr_auto_auto_auto_1fr_48px]";

function ChangeCell({ item }: { item: WatchlistItem }) {
  const change = formatWatchlistChange(item);
  if (!change) return <span className="text-v2-text-tertiary">—</span>;

  const isUp = item.priceChangePercent >= 0;
  return (
    <span
      className={`flex items-center justify-end gap-0.5 ${
        isUp ? "text-v2-green-positive" : "text-v2-red-negative"
      }`}
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

export function DraggableWatchlistTable({
  items,
  onReorder,
  onDelete,
  isDeleting = false,
}: DraggableWatchlistTableProps) {
  const t = useTranslations("prices.watchlist.column");

  return (
    <div className="w-full overflow-x-auto" role="table">
      {/* Header row */}
      <div
        className={`grid ${GRID_COLS} border-b border-v2-border-light`}
        role="row"
      >
        <div className="py-2 px-2 w-8" role="columnheader" aria-label="Drag to reorder" />
        <div className="py-2 px-3 font-semibold text-v2-text-secondary text-sm" role="columnheader">
          {t("symbol")}
        </div>
        <div className="py-2 px-3 font-semibold text-v2-text-secondary text-sm text-right" role="columnheader">
          {t("price")}
        </div>
        <div className="py-2 px-3 font-semibold text-v2-text-secondary text-sm text-right" role="columnheader">
          {t("change")}
        </div>
        <div className="py-2 px-3 font-semibold text-v2-text-secondary text-sm text-center" role="columnheader">
          {t("type")}
        </div>
        <div className="py-2 px-3 font-semibold text-v2-text-secondary text-sm" role="columnheader">
          {t("note")}
        </div>
        <div className="py-2 px-3 w-12" role="columnheader" aria-label="Actions" />
      </div>

      {/* Draggable rows */}
      <Reorder.Group
        as="div"
        axis="y"
        values={items}
        onReorder={onReorder}
        role="rowgroup"
      >
        {items.map((item) => (
          <Reorder.Item
            key={item.id}
            as="div"
            value={item}
            className={`grid ${GRID_COLS} items-center border-b border-v2-border-light last:border-0 hover:bg-v2-bg-surface-tint transition-colors duration-150 cursor-default`}
            style={{ position: "relative" }}
            whileDrag={{
              zIndex: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            }}
            role="row"
          >
            {/* Drag handle */}
            <div className="py-3 px-2 w-8" role="cell">
              <span
                className="flex items-center justify-center min-w-[44px] min-h-[44px] cursor-grab active:cursor-grabbing text-v2-text-tertiary hover:text-v2-text-secondary transition-colors duration-150"
                style={{ touchAction: "none" }}
                aria-label="Drag to reorder"
              >
                <GripVertical className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>

            {/* Symbol + Name */}
            <div className="py-3 px-3" role="cell">
              <span className="font-bold text-v2-gold-accent text-sm">
                {item.symbol}
              </span>
              {item.name && (
                <span className="block text-xs text-v2-text-tertiary mt-0.5">
                  {item.name}
                </span>
              )}
            </div>

            {/* Price */}
            <div className="py-3 px-3 text-right tabular-nums font-semibold text-sm" role="cell">
              {formatWatchlistPrice(item)}
            </div>

            {/* Change */}
            <div className="py-3 px-3 text-right text-sm" role="cell">
              <ChangeCell item={item} />
            </div>

            {/* Asset type badge */}
            <div className="py-3 px-3 text-center" role="cell">
              <AssetTypeBadge assetType={item.assetType} />
            </div>

            {/* Note */}
            <div className="py-3 px-3 text-v2-text-secondary max-w-[160px] truncate italic text-sm" role="cell">
              {item.note || (
                <span className="text-v2-text-tertiary not-italic">—</span>
              )}
            </div>

            {/* Delete */}
            <div className="py-3 px-3 w-12" role="cell">
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                disabled={isDeleting}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-v2-text-tertiary hover:text-v2-red-negative hover:bg-v2-red-negative/10 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Remove ${item.symbol} from watchlist`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}
