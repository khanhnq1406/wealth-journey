"use client";

import React, { useMemo, useRef, useCallback } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

/**
 * VirtualList Component
 *
 * A high-performance virtualized list component using react-virtuoso.
 * Optimized for large lists (100+ items) with dynamic item heights.
 *
 * Features:
 * - Maintains scroll position during updates
 * - Dynamic item height support
 * - Pull-to-refresh integration
 * - Infinite scroll capability
 * - Keyboard navigation support
 * - Accessibility compliant (ARIA attributes)
 *
 * @example
 * ```tsx
 * <VirtualList
 *   items={transactions}
 *   renderItem={(item) => <TransactionCard data={item} />}
 *   keyExtractor={(item) => item.id}
 *   onItemClick={(item) => console.log(item)}
 *   loading={isLoading}
 *   onLoadMore={() => fetchMore()}
 * />
 * ```
 */

export interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[];

  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;

  /** Unique key extractor for items */
  keyExtractor: (item: T, index: number) => string | number;

  /** Optional click handler for items */
  onItemClick?: (item: T, index: number) => void;

  /** Loading state */
  loading?: boolean;

  /** Has more items to load (for infinite scroll) */
  hasMore?: boolean;

  /** Load more callback */
  onLoadMore?: () => void;

  /** Custom loading component */
  loadingComponent?: React.ReactNode;

  /** Custom end of list component */
  endListComponent?: React.ReactNode;

  /** Custom empty state component */
  emptyComponent?: React.ReactNode;

  /** Estimated item height for optimization (default: 60) */
  itemHeight?: number;

  /** Height of the list container (default: 100% of parent) */
  height?: string | number;

  /** Enable keyboard navigation */
  keyboardNavigation?: boolean;

  /** CSS class name */
  className?: string;

  /** Additional styles */
  style?: React.CSSProperties;
}

export function VirtualList<T>({
  items,
  renderItem,
  keyExtractor,
  onItemClick,
  loading = false,
  hasMore = false,
  onLoadMore,
  loadingComponent,
  endListComponent,
  emptyComponent,
  itemHeight = 60,
  height = "100%",
  keyboardNavigation = true,
  className = "",
  style = {},
}: VirtualListProps<T>) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Memoize the item content to prevent unnecessary re-renders
  const itemContent = useCallback(
    (index: number, item: T) => {
      const content = renderItem(item, index);

      // Wrap in clickable div if onItemClick is provided
      if (onItemClick) {
        return (
          <div
            role="button"
            tabIndex={keyboardNavigation ? 0 : undefined}
            onClick={() => onItemClick(item, index)}
            onKeyDown={(e) => {
              if (keyboardNavigation && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onItemClick(item, index);
              }
            }}
            className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-bg focus:ring-inset"
          >
            {content}
          </div>
        );
      }

      return <>{content}</>;
    },
    [renderItem, onItemClick, keyboardNavigation],
  );

  // Memoize components to prevent re-renders
  const LoadingComponent = useMemo(
    () => (
      <div className="flex justify-center items-center p-4">
        {loadingComponent || (
          <div className="flex items-center gap-2 text-sm text-v2-text-tertiary">
            <div className="w-4 h-4 border-2 border-v2-red-primary border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        )}
      </div>
    ),
    [loadingComponent],
  );

  const EndListComponent = useMemo(
    () => (
      <div className="flex justify-center items-center p-4 text-sm text-v2-text-tertiary">
        {endListComponent || "End of list"}
      </div>
    ),
    [endListComponent],
  );

  const EmptyListComponent = useMemo(
    () => (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        {emptyComponent || (
          <>
            <div className="w-16 h-16 mb-4 bg-v2-bg-primary rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-v2-text-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <p className="text-v2-text-secondary font-medium">No items found</p>
            <p className="text-v2-text-tertiary text-sm mt-1">Try adjusting your filters</p>
          </>
        )}
      </div>
    ),
    [emptyComponent],
  );

  const containerStyle: React.CSSProperties = {
    height: typeof height === "number" ? `${height}px` : height,
    ...style,
  };

  if (items.length === 0 && !loading) {
    return (
      <div className={className} style={containerStyle}>
        {EmptyListComponent}
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: "100%" }}
        data={items}
        itemContent={(index, item) => {
          // Use keyExtractor for key prop
          return (
            <div key={keyExtractor(item, index)} data-index={index}>
              {itemContent(index, item)}
            </div>
          );
        }}
        components={{
          Footer: () => (loading ? LoadingComponent : hasMore ? LoadingComponent : EndListComponent),
        }}
        endReached={() => {
          if (hasMore && !loading && onLoadMore) {
            onLoadMore();
          }
        }}
        overscan={200}
        defaultItemHeight={itemHeight}
        increaseViewportBy={{ top: 100, bottom: 100 }}
        totalCount={items.length}
      />
    </div>
  );
}

export interface VirtualListHandle {
  scrollToTop: () => void;
  scrollToIndex: (index: number, behavior?: "auto" | "smooth") => void;
  scrollTo: (options: { top: number; behavior?: ScrollBehavior }) => void;
}

export default VirtualList;
