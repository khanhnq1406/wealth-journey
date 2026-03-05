"use client";

/**
 * Modern Pull-to-Refresh Indicator
 *
 * Features:
 * - Circular progress indicator that fills as you pull
 * - Smooth animations and transitions
 * - Success state with checkmark
 * - Responsive design
 */

import { useEffect, useState } from "react";

interface PullToRefreshIndicatorProps {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  threshold?: number; // Distance needed to trigger refresh (default: 80)
}

export function PullToRefreshIndicator({
  isPulling,
  isRefreshing,
  pullDistance,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  // Calculate progress percentage (0-100)
  const progress = Math.min((pullDistance / threshold) * 100, 100);

  // Calculate rotation for arrow (0-180 degrees)
  const rotation = Math.min((pullDistance / threshold) * 180, 180);

  // Show success state briefly after refresh completes
  useEffect(() => {
    if (!isRefreshing && showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isRefreshing, showSuccess]);

  // Trigger success animation when refresh completes
  useEffect(() => {
    if (isRefreshing) {
      setShowSuccess(false);
    }
  }, [isRefreshing]);

  if (!isPulling && !isRefreshing && !showSuccess) return null;

  // When refreshing, show at a fixed position (60px from top)
  const yPosition =
    isRefreshing || showSuccess ? 60 : Math.min(pullDistance * 0.8, 100);

  return (
    <div
      className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none"
      style={{
        transform: `translateY(${yPosition}px)`,
        transition: isPulling ? "none" : "transform 0.3s ease-out",
      }}
    >
      <div className="relative">
        {/* Main circle container */}
        <div className="relative w-12 h-12 bg-white dark:bg-dark-surface rounded-full shadow-lg flex items-center justify-center">
          {/* Center content */}
          <div className="relative flex items-center justify-center">
            {isRefreshing ? (
              // Spinning loader
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            ) : showSuccess ? (
              // Success checkmark
              <svg
                className="w-6 h-6 text-success-600 animate-scale-in"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              // Pull arrow
              <svg
                className="w-6 h-6 text-primary-600 dark:text-primary-500 transition-transform duration-200"
                style={{ transform: `rotate(${rotation}deg)` }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Status text */}
        {!showSuccess && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-white dark:bg-dark-surface px-3 py-1 rounded-full shadow-sm">
              {isRefreshing
                ? "Updating prices..."
                : progress >= 100
                  ? "Release to refresh"
                  : "Pull to refresh"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
