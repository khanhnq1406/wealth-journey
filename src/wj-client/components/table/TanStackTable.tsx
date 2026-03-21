"use client";

import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { useState, useMemo, useCallback, memo } from "react";
import Image from "next/image";
import { resources } from "@/app/constants";
import { cn } from "@/lib/utils/cn";

export interface TanStackTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  className?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  isLoading?: boolean;
  loadingRowCount?: number;
  /**
   * Enable expandable rows on mobile. When true, rows can be expanded to show all columns.
   * On mobile, only the first few columns are shown by default.
   */
  enableMobileExpansion?: boolean;
  /**
   * Number of columns to show in collapsed view on mobile (default: 2)
   */
  mobileVisibleColumnCount?: number;
  /**
   * Optional mobile breakpoint. Below this width, expandable mode is enabled.
   * Default: 768px (md breakpoint)
   */
  mobileBreakpoint?: number;
}

export interface TablePaginationProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  showPageNumbers?: boolean;
}

/**
 * Pagination component for tables (memoized to prevent unnecessary re-renders)
 */
export const TablePagination = memo(({
  currentPage,
  pageSize,
  totalCount,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  showPageNumbers = true,
}: TablePaginationProps) => {
  // Memoize calculated values to avoid recalculation on every render
  const { totalPages, startRecord, endRecord } = useMemo(() => {
    const calculatedTotalPages = Math.ceil(totalCount / pageSize);
    const calculatedStartRecord = (currentPage - 1) * pageSize + 1;
    const calculatedEndRecord = Math.min(currentPage * pageSize, totalCount);
    return {
      totalPages: calculatedTotalPages,
      startRecord: calculatedStartRecord,
      endRecord: calculatedEndRecord,
    };
  }, [currentPage, pageSize, totalCount]);

  // Memoize page size options to avoid recreating array
  const memoizedPageSizeOptions = useMemo(
    () => pageSizeOptions,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pageSizeOptions.join(",")]
  );

  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange?.(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange?.(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const handlePageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onPageSizeChange?.(parseInt(e.target.value));
    },
    [onPageSizeChange]
  );

  return (
    <div className="flex items-center justify-between p-4 border-t border-v2-maroon-600">
      <p className="text-v2-gold-accent text-base font-light">
        Showing {startRecord} to {endRecord} of {totalCount} results
      </p>
      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <>
            <span className="text-v2-gold-accent text-base font-light">Rows</span>
            <div className="relative">
              <select
                name="rows-per-page"
                value={pageSize.toString()}
                onChange={handlePageSizeChange}
                className="appearance-none bg-neutral-50 border-2 border-black/50 rounded px-3 py-1 pr-8 text-gray-900 text-sm font-bold cursor-pointer focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2 focus:border-v2-gold-primary"
              >
                {memoizedPageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <Image
                src={`${resources}/down.svg`}
                width={12}
                height={12}
                alt="Rows per page dropdown"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none"
              />
            </div>
          </>
        )}

        {showPageNumbers && onPageChange && totalPages > 1 && (
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded border border-v2-maroon-600 text-v2-gold-accent disabled:opacity-50 disabled:cursor-not-allowed hover:bg-v2-maroon-700"
            >
              Previous
            </button>
            <span className="text-v2-gold-accent text-sm font-light">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded border border-v2-maroon-600 text-v2-gold-accent disabled:opacity-50 disabled:cursor-not-allowed hover:bg-v2-maroon-700"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

TablePagination.displayName = "TablePagination";

/**
 * Chevron icon for expandable rows
 */
const ChevronIcon = memo(({ isOpen }: { isOpen: boolean }) => (
  <svg
    className={cn(
      "w-5 h-5 transition-transform duration-200 ease-in-out",
      isOpen && "rotate-180"
    )}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
));
ChevronIcon.displayName = "ChevronIcon";

/**
 * Expandable row content for mobile view - displays all column data in stacked format
 */
const MobileExpandedRow = memo(function MobileExpandedRow<T>({
  row,
  allCells,
  startIndex,
}: {
  row: T;
  allCells: any[];
  startIndex: number;
}) {
  return (
    <tr className="sm:hidden">
      <td colSpan={999} className="p-0 border-0">
        <div className="p-4 bg-neutral-50 border-t border-v2-gold-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-3">
            {allCells.slice(startIndex).map((cell, cellIndex) => {
              const column = cell.column;
              const headerText =
                typeof column.columnDef.header === "string"
                  ? column.columnDef.header
                  : column.id || `Column ${startIndex + cellIndex}`;

              return (
                <div key={`${column.id}-${cellIndex}`} className="flex flex-col">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                    {headerText}
                  </span>
                  <span className="text-sm text-neutral-900 font-medium">
                    {flexRender(column.columnDef.cell, cell.getContext())}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </td>
    </tr>
  );
}) as <T>(props: {
  row: T;
  allCells: any[];
  startIndex: number;
}) => React.ReactElement;

/**
 * Generic TanStack Table component with built-in sorting and mobile expandable rows (memoized to prevent unnecessary re-renders)
 * @template T - The shape of the row data
 */
export const TanStackTable = memo(function TanStackTable<T>({
  data,
  columns,
  className = "",
  emptyMessage = "No data found",
  emptyDescription = "Try adjusting your filters or search criteria",
  isLoading = false,
  loadingRowCount = 5,
  enableMobileExpansion = true,
  mobileVisibleColumnCount = 2,
  mobileBreakpoint = 768,
}: TanStackTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < mobileBreakpoint : false);

  // Handle window resize for mobile detection
  const handleResize = useCallback(() => {
    if (typeof window === "undefined") return;

    const mobile = window.innerWidth < mobileBreakpoint;
    setIsMobile(mobile);
    // Clear expanded rows when switching to desktop
    if (!mobile) {
      setExpandedRows(new Set());
    }
  }, [mobileBreakpoint]);

  React.useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  // Toggle row expansion
  const toggleRowExpansion = useCallback((rowId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  // Memoize loading skeleton to avoid recreating on every render
  const loadingSkeleton = useMemo(() => (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full">
        <thead className="sticky top-0 bg-v2-maroon-800 z-10 border-b-2 border-v2-maroon-600">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="text-left py-3 px-4 text-v2-gold-accent text-base font-bold"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {Array.from({ length: loadingRowCount }).map((_, index) => (
            <tr key={`loading-${index}`} className="border-b border-v2-maroon-600">
              {columns.map((_, cellIndex) => (
                <td key={`loading-cell-${cellIndex}`} className="py-3 px-4">
                  <div className="h-4 bg-v2-maroon-600 rounded animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ), [className, columns, loadingRowCount, table]);

  // Memoize empty state
  const emptyState = useMemo(() => (
    <div
      className={cn("flex flex-col items-center justify-center py-12", className)}
    >
      <svg
        className="w-16 h-16 mb-4 text-v2-cream-100"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p className="text-lg font-medium text-v2-gold-accent">{emptyMessage}</p>
      <p className="text-sm text-v2-cream-100">{emptyDescription}</p>
    </div>
  ), [className, emptyMessage, emptyDescription]);

  // Show loading state
  if (isLoading) {
    return loadingSkeleton;
  }

  if (data.length === 0) {
    return emptyState;
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full">
        <thead className="sticky top-0 bg-v2-maroon-800 z-10 border-b-2 border-v2-maroon-600">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b-2 border-v2-maroon-600">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="text-left py-3 px-4 text-v2-gold-accent text-base font-bold cursor-pointer hover:bg-v2-maroon-700 select-none"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                  {header.column.getIsSorted() === "asc" ? (
                    <span className="ml-2">↑</span>
                  ) : header.column.getIsSorted() === "desc" ? (
                    <span className="ml-2">↓</span>
                  ) : null}
                </th>
              ))}
              {/* Add extra column for expand chevron on mobile when enabled */}
              {enableMobileExpansion && isMobile && columns.length > mobileVisibleColumnCount && (
                <th className="w-12 sm:hidden" aria-hidden="true" />
              )}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, index) => {
            const isExpanded = expandedRows.has(row.id);
            const showExpandable = enableMobileExpansion && isMobile && columns.length > mobileVisibleColumnCount;
            const visibleColumnCount = showExpandable ? mobileVisibleColumnCount : columns.length;

            return (
              <React.Fragment key={row.id}>
                <tr
                  className={cn(
                    index < table.getRowModel().rows.length - 1 && "border-b border-v2-maroon-600",
                    showExpandable && "cursor-pointer hover:bg-neutral-50 transition-colors duration-150"
                  )}
                  onClick={() => showExpandable && toggleRowExpansion(row.id)}
                  aria-expanded={isExpanded}
                >
                  {row.getVisibleCells().slice(0, visibleColumnCount).map((cell) => (
                    <td
                      key={cell.id}
                      className="py-3 px-4 text-v2-gold-accent text-base font-light"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  {/* Expandable chevron column for mobile */}
                  {showExpandable && (
                    <td className="py-3 px-2 sm:hidden">
                      <button
                        type="button"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-600 hover:text-primary-600 transition-colors duration-200 rounded-full hover:bg-neutral-100"
                        aria-label={isExpanded ? "Collapse row" : "Expand row"}
                        aria-expanded={isExpanded}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRowExpansion(row.id);
                        }}
                      >
                        <ChevronIcon isOpen={isExpanded} />
                      </button>
                    </td>
                  )}
                </tr>
                {/* Expanded row content for mobile */}
                {showExpandable && isExpanded && (
                  <MobileExpandedRow
                    row={row.original}
                    allCells={row.getVisibleCells()}
                    startIndex={mobileVisibleColumnCount}
                  />
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}) as <T>(props: TanStackTableProps<T>) => React.ReactElement;
