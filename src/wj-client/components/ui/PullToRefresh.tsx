"use client";

import { memo, useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils/cn";

export interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  isRefreshing: boolean;
  children: React.ReactNode;
  className?: string;
  threshold?: number; // px to trigger refresh
  maxPull?: number; // max px to pull
}

const DEFAULT_THRESHOLD = 80;
const DEFAULT_MAX_PULL = 120;

/**
 * Pull-to-refresh component for mobile lists.
 * Pull down to trigger refresh with visual feedback.
 */
export const PullToRefresh = memo(function PullToRefresh({
  onRefresh,
  isRefreshing,
  children,
  className,
  threshold = DEFAULT_THRESHOLD,
  maxPull = DEFAULT_MAX_PULL,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only enable pull-to-refresh when at the top
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling) return;

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      // Only pull down (positive distance)
      if (distance > 0) {
        // Add resistance for longer pulls
        const resistance = distance > threshold ? 0.4 : 1;
        const clampedDistance = Math.min(maxPull, distance * resistance);

        setPullDistance(clampedDistance);

        // Trigger refresh when threshold is met
        if (clampedDistance >= threshold && !shouldRefresh) {
          setShouldRefresh(true);
        } else if (clampedDistance < threshold && shouldRefresh) {
          setShouldRefresh(false);
        }
      }
    },
    [isPulling, threshold, maxPull, shouldRefresh],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    setIsPulling(false);

    if (shouldRefresh && !isRefreshing) {
      // Trigger refresh
      setPullDistance(threshold);
      await onRefresh();
    }

    // Reset state
    setPullDistance(0);
    setShouldRefresh(false);
  }, [isPulling, shouldRefresh, isRefreshing, onRefresh, threshold]);

  // Reset pull distance when refresh completes
  useEffect(() => {
    if (!isRefreshing && pullDistance > 0) {
      queueMicrotask(() => setPullDistance(0));
    }
  }, [isRefreshing, pullDistance]);

  // Calculate rotation for spinner
  const rotation = Math.min((pullDistance / threshold) * 360, 360);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      style={{ touchAction: "pan-y" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center transition-transform duration-200 pointer-events-none",
 "bg-gradient-to-b from-primary-50 to-transparent",
        )}
        style={{
          transform: `translateY(${-Math.max(0, pullDistance - 70)}px)`,
          height: Math.max(0, pullDistance),
          opacity: pullDistance > 0 ? 1 : 0,
        }}
      >
        <div
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full",
 "bg-white shadow-sm",
            "transition-transform duration-200",
          )}
          style={{
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {isRefreshing ? (
            <svg
              className="w-5 h-5 text-primary-600 animate-spin"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className={cn(
          "transition-transform duration-200",
          isRefreshing && "opacity-50",
        )}
        style={{
          transform:
            pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
});
