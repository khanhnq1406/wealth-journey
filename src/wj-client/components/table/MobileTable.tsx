"use client";

import React, { useMemo, memo, useState } from "react";
import { BaseCard } from "@/components/BaseCard";
import { cn } from "@/lib/utils/cn";

// Define a simplified column type for mobile table
export interface MobileColumnDef<T> {
  id: string;
  header: string | React.ReactNode;
  accessorFn?: (row: T, index: number) => any;
  accessorKey?: keyof T | string;
  cell?: (props: { getValue: () => any; row: T }) => React.ReactNode;
  /**
   * If true, this column will be shown in the collapsed view (key info)
   * If false, it will only be shown when expanded
   */
  showInCollapsed?: boolean;
}

export interface MobileTableProps<T> {
  data: T[];
  columns: MobileColumnDef<T>[];
  className?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  isLoading?: boolean;
  loadingRowCount?: number;
  /**
   * Optional key extractor for items. If not provided, uses index
   */
  getKey?: (item: T, index: number) => string | number;
  /**
   * Optional custom renderer for field values. Useful for formatting dates, currency, etc.
   */
  renderFieldValue?: (columnId: string, value: any, row: T) => React.ReactNode;
  /**
   * Optional custom actions renderer for each row
   */
  renderActions?: (row: T) => React.ReactNode;
  /**
   * Optional max height for the scrollable container. Enables vertical scrolling when content exceeds this height.
   * Example: "400px", "50vh", "calc(100vh - 200px)"
   */
  maxHeight?: string;
  /**
   * Whether to show a scroll indicator when content is scrollable
   */
  showScrollIndicator?: boolean;
  /**
   * Position of action buttons. 'inline' shows actions at the bottom of each card, 'top' shows actions in the card header row (alongside the first collapsed column), 'sticky' shows a sticky footer with actions.
   * Sticky is better for scrollable tables with many rows.
   */
  actionsPosition?: "inline" | "top" | "sticky";
  /**
   * Label for sticky action button (only used when actionsPosition is 'sticky')
   */
  stickyActionLabel?: string;
  /**
   * Callback when sticky action button is clicked (only used when actionsPosition is 'sticky')
   * Returns the row that was clicked
   */
  onStickyActionClick?: (row: T) => void;
  /**
   * Enable expandable rows. When true, rows can be expanded to show more details.
   * Columns with showInCollapsed=true will be shown in collapsed view.
   */
  expandable?: boolean;
  /**
   * Label for the expand button
   */
  expandButtonLabel?: string;
  /**
   * Label for the collapse button
   */
  collapseButtonLabel?: string;
  /**
   * Layout mode for each field row.
   * - "stacked": header on its own line above the value (default)
   * - "inline": header and value on the same line (header left, value right)
   */
  layout?: "stacked" | "inline";
  /**
   * Horizontal alignment of the expand/collapse button.
   * Defaults to "right".
   */
  expandButtonAlign?: "left" | "center" | "right";
}

/**
 * Mobile Table Component
 *
 * A reusable component that displays tabular data as cards on mobile devices.
 * Follows a column-based API similar to TanStack Table for consistency.
 *
 * @template T - The shape of the row data
 *
 * @example
 * ```tsx
 * const columns: MobileColumnDef<Transaction>[] = [
 *   {
 *     id: 'category',
 *     header: 'Category',
 *     accessorFn: (row) => getCategoryName(row.categoryId),
 *   },
 *   {
 *     id: 'amount',
 *     header: 'Amount',
 *     accessorFn: (row) => row.amount,
 *   },
 * ];
 *
 * <MobileTable
 *   data={transactions}
 *   columns={columns}
 *   renderActions={(row) => (
 *     <button onClick={() => handleEdit(row.id)}>Edit</button>
 *   )}
 * />
 * ```
 */
/**
 * Internal component for a single expandable mobile table row
 */
const MobileTableRow = memo(function MobileTableRow<T>({
  row,
  rowIndex,
  columns,
  renderFieldValue,
  renderActions,
  actionsPosition,
  expandable,
  expandButtonLabel,
  collapseButtonLabel,
  layout = "inline",
  expandButtonAlign = "center",
}: {
  row: T;
  rowIndex: number;
  columns: MobileColumnDef<T>[];
  renderFieldValue?: (columnId: string, value: any, row: T) => React.ReactNode;
  renderActions?: (row: T) => React.ReactNode;
  actionsPosition: "inline" | "top" | "sticky";
  expandable?: boolean;
  expandButtonLabel: string;
  collapseButtonLabel: string;
  layout?: "stacked" | "inline";
  expandButtonAlign?: "left" | "center" | "right";
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Separate columns into collapsed and expanded views
  const collapsedColumns = columns.filter(
    (col) => col.showInCollapsed !== false,
  );
  const expandedOnlyColumns = columns.filter(
    (col) => col.showInCollapsed === false,
  );

  const hasExpandableContent = expandable && expandedOnlyColumns.length > 0;

  const renderColumn = (column: MobileColumnDef<T>, cellIndex: number) => {
    // Get column header — support both string and ReactNode
    const headerContent = column.header ?? column.id;

    // Get cell value using accessorFn or accessorKey
    let cellValue: any;
    if (column.accessorFn) {
      cellValue = column.accessorFn(row, rowIndex);
    } else if (column.accessorKey) {
      cellValue = (row as any)[column.accessorKey];
    }

    // Use custom renderer if provided, otherwise use cell renderer
    const displayValue = renderFieldValue
      ? renderFieldValue(column.id, cellValue, row)
      : column.cell
        ? column.cell({ getValue: () => cellValue, row })
        : cellValue;

    if (layout === "inline") {
      return (
        <React.Fragment key={column.id || cellIndex}>
          <div className="flex justify-between items-center gap-2">
            <p className="text-v2-gold-accent text-sm font-bold shrink-0">
              {headerContent}
            </p>
            <div className="text-v2-gold-accent text-sm font-light text-right min-w-0">
              {displayValue ?? "-"}
            </div>
          </div>
        </React.Fragment>
      );
    }

    return (
      <React.Fragment key={column.id || cellIndex}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-v2-gold-accent text-sm font-bold mb-1">
              {headerContent}
            </p>
            <div className="text-v2-gold-accent text-sm font-light text-right">
              {displayValue ?? "-"}
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="p-3 space-y-2">
      {/* Top actions header — show first collapsed column value + actions in one row */}
      {renderActions && actionsPosition === "top" && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {collapsedColumns[0] && renderColumn(collapsedColumns[0], 0)}
            </div>
            <div className="flex gap-1 -mr-2 shrink-0">{renderActions(row)}</div>
          </div>
          <div className="border-t border-v2-gold-primary/20" />
        </>
      )}

      {/* Collapsed view - show key info only */}
      {collapsedColumns
        .slice(actionsPosition === "top" ? 1 : 0)
        .map((column, cellIndex) => (
        <React.Fragment key={column.id || cellIndex}>
          {renderColumn(column, cellIndex)}
          {cellIndex < collapsedColumns.slice(actionsPosition === "top" ? 1 : 0).length - 1 && (
            <div className="border-t border-v2-gold-primary/20" />
          )}
        </React.Fragment>
      ))}

      {/* Expand/Collapse button */}
      {hasExpandableContent && (
        <>
          <div className="border-t border-v2-gold-primary/20" />
          <div
            className={cn("flex", {
              "justify-start": expandButtonAlign === "left",
              "justify-center": expandButtonAlign === "center",
              "justify-end": expandButtonAlign === "right",
            })}
          >
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm font-medium text-v2-gold-primary hover:text-v2-gold-accent transition-colors duration-200 py-1 px-2 rounded hover:bg-v2-maroon-900"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? collapseButtonLabel : expandButtonLabel}
            >
              {isExpanded ? collapseButtonLabel : expandButtonLabel}
            </button>
          </div>
        </>
      )}

      {/* Expanded view - show all additional fields */}
      {hasExpandableContent && isExpanded && (
        <div
          className={cn(
            "pt-3 border-t border-v2-gold-primary/20 space-y-2",
            "animate-in fade-in slide-in-from-top-2 duration-200",
          )}
        >
          {expandedOnlyColumns.map((column, cellIndex) => (
            <React.Fragment key={column.id || cellIndex}>
              {renderColumn(column, cellIndex)}
              {cellIndex < expandedOnlyColumns.length - 1 && (
                <div className="border-t border-v2-gold-primary/20" />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Inline Actions section */}
      {renderActions && actionsPosition === "inline" && (
        <>
          <div className="border-t border-v2-gold-primary/20" />
          <div className="flex justify-between items-center">
            <p className="text-v2-gold-accent text-sm font-bold">Actions</p>
            <div className="flex gap-1 -mr-2">{renderActions(row)}</div>
          </div>
        </>
      )}
    </div>
  );
}) as <T>(props: {
  row: T;
  rowIndex: number;
  columns: MobileColumnDef<T>[];
  renderFieldValue?: (columnId: string, value: any, row: T) => React.ReactNode;
  renderActions?: (row: T) => React.ReactNode;
  actionsPosition: "inline" | "top" | "sticky";
  expandable?: boolean;
  expandButtonLabel: string;
  collapseButtonLabel: string;
  layout?: "stacked" | "inline";
  expandButtonAlign?: "left" | "center" | "right";
}) => React.ReactElement;

export const MobileTable = memo(function MobileTable<T>({
  data,
  columns,
  className = "",
  emptyMessage = "No data found",
  emptyDescription = "Try adjusting your filters or search criteria",
  isLoading = false,
  loadingRowCount = 3,
  getKey,
  renderFieldValue,
  renderActions,
  maxHeight,
  showScrollIndicator = false,
  actionsPosition = "inline",
  stickyActionLabel = "View Details",
  onStickyActionClick,
  expandable = false,
  expandButtonLabel = "Details",
  collapseButtonLabel = "Less",
  layout = "inline",
  expandButtonAlign = "center",
}: MobileTableProps<T>) {
  // Memoize loading skeleton to avoid recreating on every render
  const loadingSkeleton = useMemo(() => {
    const collapsedColumns = columns.filter(
      (col) => col.showInCollapsed !== false,
    );
    const columnsToShow = expandable ? collapsedColumns : columns;

    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: loadingRowCount }).map((_, index) => (
          <BaseCard key={`loading-${index}`}>
            <div className="p-3 space-y-2">
              {columnsToShow.map((_, cellIndex) => (
                <React.Fragment key={`loading-cell-${cellIndex}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="h-4 bg-v2-maroon-900 rounded animate-pulse mb-2 w-24" />
                      <div className="h-3 bg-v2-maroon-900/70 rounded animate-pulse w-full" />
                    </div>
                  </div>
                  {cellIndex < columnsToShow.length - 1 && (
                    <div className="border-t border-v2-gold-primary/20" />
                  )}
                </React.Fragment>
              ))}
              {expandable && (
                <>
                  <div className="border-t border-v2-gold-primary/20" />
                  <div className="flex justify-end">
                    <div className="h-6 w-16 bg-v2-maroon-900 rounded animate-pulse" />
                  </div>
                </>
              )}
            </div>
          </BaseCard>
        ))}
      </div>
    );
  }, [className, columns, loadingRowCount, expandable]);

  // Memoize empty state
  const emptyState = useMemo(
    () => (
      <BaseCard>
        <div className="flex flex-col items-center justify-center py-12">
          <svg
            className="w-16 h-16 mb-4 text-v2-text-secondary"
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
          <p className="text-lg font-medium text-v2-gold-accent">
            {emptyMessage}
          </p>
          <p className="text-sm text-v2-text-secondary">{emptyDescription}</p>
        </div>
      </BaseCard>
    ),
    [emptyMessage, emptyDescription],
  );

  // Show loading state
  if (isLoading) {
    return loadingSkeleton;
  }

  if (data.length === 0) {
    return emptyState;
  }

  // Render the list of cards
  const cardsList = (
    <div className={cn("space-y-3", className)}>
      {data.map((row, rowIndex) => {
        const key = getKey ? getKey(row, rowIndex) : rowIndex;

        return (
          <BaseCard key={key}>
            <MobileTableRow
              row={row}
              rowIndex={rowIndex}
              columns={columns}
              renderFieldValue={renderFieldValue}
              renderActions={renderActions}
              actionsPosition={actionsPosition}
              expandable={expandable}
              expandButtonLabel={expandButtonLabel}
              collapseButtonLabel={collapseButtonLabel}
              layout={layout}
              expandButtonAlign={expandButtonAlign}
            />
          </BaseCard>
        );
      })}
    </div>
  );

  // If maxHeight is specified, wrap in scrollable container
  if (maxHeight) {
    return (
      <div className={cn("relative", className)}>
        <div className="overflow-y-auto" style={{ maxHeight }}>
          {cardsList}
        </div>

        {/* Sticky Action Button (for single-action use cases like "View Details") */}
        {actionsPosition === "sticky" && onStickyActionClick && (
          <div className="sticky bottom-0 left-0 right-0 mt-3 z-10">
            <button
              onClick={() => {
                // For single row selection, use the first item
                // For multi-row, you might want a row selector first
                if (data.length > 0) {
                  onStickyActionClick(data[0]);
                }
              }}
              className="w-full bg-v2-red-primary text-white py-3 px-4 rounded-lg font-medium shadow-lg hover:opacity-90 transition-opacity"
            >
              {stickyActionLabel}
            </button>
          </div>
        )}

        {/* Scroll indicator */}
        {showScrollIndicator && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-v2-maroon-700 to-transparent pointer-events-none" />
        )}
      </div>
    );
  }

  return <div className={cn(className)}>{cardsList}</div>;
}) as <T>(props: MobileTableProps<T>) => React.ReactElement;
