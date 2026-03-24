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
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-v2-border-light">
            {/* Drag handle column */}
            <th className="py-2 px-2 w-8" aria-label="Drag to reorder" />
            <th className="text-left py-2 px-3 font-semibold text-v2-text-secondary">
              {t("symbol")}
            </th>
            <th className="text-right py-2 px-3 font-semibold text-v2-text-secondary">
              {t("price")}
            </th>
            <th className="text-right py-2 px-3 font-semibold text-v2-text-secondary">
              {t("change")}
            </th>
            <th className="text-center py-2 px-3 font-semibold text-v2-text-secondary">
              {t("type")}
            </th>
            <th className="text-left py-2 px-3 font-semibold text-v2-text-secondary">
              {t("note")}
            </th>
            <th className="py-2 px-3 w-12" aria-label="Actions" />
          </tr>
        </thead>
        <Reorder.Group
          as="tbody"
          axis="y"
          values={items}
          onReorder={onReorder}
        >
          {items.map((item) => (
            <Reorder.Item
              key={item.id}
              as="tr"
              value={item}
              className="border-b border-v2-border-light last:border-0 hover:bg-v2-bg-surface-tint transition-colors duration-150 cursor-default"
              style={{ position: "relative" }}
            >
              {/* Drag handle */}
              <td className="py-3 px-2 w-8">
                <span
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] cursor-grab active:cursor-grabbing text-v2-text-tertiary hover:text-v2-text-secondary transition-colors duration-150"
                  style={{ touchAction: "none" }}
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="w-4 h-4" aria-hidden="true" />
                </span>
              </td>

              {/* Symbol + Name */}
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

              {/* Price */}
              <td className="py-3 px-3 text-right tabular-nums font-semibold">
                {formatWatchlistPrice(item)}
              </td>

              {/* Change */}
              <td className="py-3 px-3 text-right">
                <ChangeCell item={item} />
              </td>

              {/* Asset type badge */}
              <td className="py-3 px-3 text-center">
                <AssetTypeBadge assetType={item.assetType} />
              </td>

              {/* Note */}
              <td className="py-3 px-3 text-v2-text-secondary max-w-[160px] truncate italic">
                {item.note || (
                  <span className="text-v2-text-tertiary not-italic">—</span>
                )}
              </td>

              {/* Delete */}
              <td className="py-3 px-3 w-12">
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  disabled={isDeleting}
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-v2-text-tertiary hover:text-v2-red-negative hover:bg-v2-red-negative/10 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Remove ${item.symbol} from watchlist`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </td>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </table>
    </div>
  );
}
