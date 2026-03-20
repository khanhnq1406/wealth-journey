"use client";

import { useTranslations } from "next-intl";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const t = useTranslations("admin.pagination");

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
 className="px-3 py-1 text-sm rounded border border-v2-border-light disabled:opacity-40 disabled:cursor-not-allowed hover:bg-v2-bg-surface-tint transition-colors"
      >
        {t("prev")}
      </button>
 <span className="text-sm text-v2-text-secondary">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
 className="px-3 py-1 text-sm rounded border border-v2-border-light disabled:opacity-40 disabled:cursor-not-allowed hover:bg-v2-bg-surface-tint transition-colors"
      >
        {t("next")}
      </button>
    </div>
  );
}
