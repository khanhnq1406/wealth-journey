"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  usePriceOverrideSet,
  usePriceOverrideDelete,
} from "../hooks/usePriceOverride";
import type { PriceItem } from "@/gen/protobuf/v1/investment";
import { formatPriceValue } from "@/app/[locale]/dashboard/prices/helpers";

interface InlinePriceEditProps {
  item: PriceItem;
  category: string;
}

export function InlinePriceEdit({ item, category }: InlinePriceEditProps) {
  const t = useTranslations("prices.override");
  const [isEditing, setIsEditing] = useState(false);
  const [buyValue, setBuyValue] = useState("");
  const [sellValue, setSellValue] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 2500);
    },
    [],
  );

  const setMutation = usePriceOverrideSet({
    onSuccess: () => {
      showToast(t("saved"));
      setIsEditing(false);
    },
    onError: (err) => {
      showToast(err.message || t("saveFailed"), "error");
    },
  });

  const deleteMutation = usePriceOverrideDelete({
    onSuccess: () => {
      showToast(t("removed"));
    },
    onError: (err) => {
      showToast(err.message || t("removeFailed"), "error");
    },
  });

  const handleEdit = () => {
    setBuyValue(String(item.buy));
    setSellValue(String(item.sell));
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = () => {
    const buy = parseInt(buyValue, 10);
    const sell = parseInt(sellValue, 10);
    if (isNaN(buy) || isNaN(sell) || buy <= 0 || sell <= 0) {
      showToast(t("invalidValues"), "error");
      return;
    }
    setMutation.mutate({
      category,
      typeCode: item.typeCode,
      currency: item.currency,
      buy,
      sell,
      name: item.name || item.typeCode,
    });
  };

  const handleRemoveOverride = () => {
    if (!confirm(t("confirmRemove"))) return;
    deleteMutation.mutate({
      category,
      typeCode: item.typeCode,
      currency: item.currency,
    });
  };

  const isPending = setMutation.isPending || deleteMutation.isPending;

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={buyValue}
          onChange={(e) => setBuyValue(e.target.value)}
          className="w-24 px-1.5 py-0.5 text-sm border border-v2-border-light rounded bg-v2-bg-dark text-v2-gold-accent placeholder-v2-text-tertiary focus:border-v2-gold-primary focus:outline-none"
          placeholder={t("buy")}
          disabled={isPending}
        />
        <input
          type="number"
          value={sellValue}
          onChange={(e) => setSellValue(e.target.value)}
          className="w-24 px-1.5 py-0.5 text-sm border border-v2-border-light rounded bg-v2-bg-dark text-v2-gold-accent placeholder-v2-text-tertiary focus:border-v2-gold-primary focus:outline-none"
          placeholder={t("sell")}
          disabled={isPending}
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className="p-1 text-v2-green-positive hover:text-v2-green-positive/80 disabled:opacity-50"
          title={t("save")}
        >
          {isPending ? (
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="p-1 text-v2-text-tertiary hover:text-v2-gold-accent disabled:opacity-50"
          title={t("cancel")}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        {toast && (
          <span
            className={`text-xs ${toast.type === "error" ? "text-v2-red-negative" : "text-v2-green-positive"}`}
          >
            {toast.message}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {item.isOverridden && (
        <button
          onClick={handleRemoveOverride}
          disabled={isPending}
          className="w-2 h-2 rounded-full bg-v2-gold-primary flex-shrink-0 hover:bg-v2-gold-dark disabled:opacity-50 cursor-pointer"
          title={t("removeOverride")}
        />
      )}
      <button
        onClick={handleEdit}
        disabled={isPending}
        className="p-1 text-v2-maroon-900 hover:text-v2-text-secondary disabled:opacity-50"
        title={t("edit")}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
      {toast && (
        <span
          className={`text-xs ${toast.type === "error" ? "text-v2-red-negative" : "text-v2-green-positive"}`}
        >
          {toast.message}
        </span>
      )}
    </div>
  );
}

// Standalone override indicator for display in price cells
export function OverrideIndicator({
  item,
  category,
  isAdmin,
}: {
  item: PriceItem;
  category: string;
  isAdmin: boolean;
}) {
  if (!item.isOverridden) return null;
  if (!isAdmin) {
    // Non-admin: just show a subtle indicator, no interaction
    return (
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-v2-gold-primary ml-1"
        title="Overridden"
      />
    );
  }
  // Admin: the InlinePriceEdit component handles the override indicator
  return null;
}
