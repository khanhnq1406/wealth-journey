"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/Button";

// Storage keys
const DISMISSED_FEATURES_KEY = "wealthjourney-dismissed-features";
const VIEWED_FEATURES_KEY = "wealthjourney-viewed-features";

export interface FeatureTip {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for targeted tips
  type: "tip" | "new" | "update" | "announcement";
  priority?: number; // Higher priority tips show first
  action?: {
    label: string;
    onClick: () => void;
  };
  videoUrl?: string; // Optional video walkthrough URL
  icon?: React.ReactNode;
  persistent?: boolean; // If true, doesn't auto-dismiss
  showOnce?: boolean; // If true, only show once per user
}

// Default feature tips
const DEFAULT_FEATURES: FeatureTip[] = [
  {
    id: "search-shortcut",
    title: "Quick Search with Keyboard Shortcuts",
    description: "Press Cmd/Ctrl + K anywhere in the app to instantly search for wallets, transactions, and investments.",
    type: "tip",
    priority: 10,
  },
  {
    id: "export-reports",
    title: "Export Your Financial Reports",
    description: "Download your transactions and portfolio data as CSV, PDF, or Excel files for offline analysis or record-keeping.",
    type: "new",
    priority: 8,
  },
  {
    id: "budget-alerts",
    title: "Smart Budget Alerts",
    description: "Get notified when you're approaching your budget limits. We'll alert you at 50%, 75%, and 90% of your budget.",
    type: "tip",
    priority: 7,
  },
  {
    id: "portfolio-pnl",
    title: "Real-time Investment PNL",
    description: "Track your realized and unrealized profits/losses with automatic FIFO cost basis calculations.",
    type: "update",
    priority: 6,
  },
  {
    id: "currency-conversion",
    title: "Multi-Currency Support",
    description: "View your finances in your preferred currency. We automatically convert all amounts using real-time exchange rates.",
    type: "tip",
    priority: 5,
  },
];

interface FeatureDiscoveryProps {
  features?: FeatureTip[];
  autoShow?: boolean;
  showDelay?: number; // Delay before showing first tip (ms)
  interval?: number; // Interval between tips (ms)
  maxTipsPerSession?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  onDismiss?: (featureId: string) => void;
  onView?: (featureId: string) => void;
}

/**
 * Feature Discovery Component
 *
 * Features:
 * - Contextual tips that appear based on user behavior
 * - "What's new" highlights for feature announcements
 * - Interactive tutorials with video walkthrough option
 * - Smart scheduling (shows tips at appropriate times)
 * - Dismissal persistence (user's choices are remembered)
 * - Priority-based ordering
 * - Mobile-friendly positioning
 *
 * Usage:
 * ```tsx
 * <FeatureDiscovery
 *   autoShow={true}
 *   showDelay={5000}
 *   maxTipsPerSession={2}
 *   onDismiss={(id) => console.log('Dismissed:', id)}
 * />
 * ```
 */
export function FeatureDiscovery({
  features = DEFAULT_FEATURES,
  autoShow = false,
  showDelay = 10000,
  interval = 60000,
  maxTipsPerSession = 3,
  position = "bottom-right",
  onDismiss,
  onView,
}: FeatureDiscoveryProps) {
  const t = useTranslations("featureDiscovery");
  const [currentTip, setCurrentTip] = useState<FeatureTip | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [dismissedFeatures, setDismissedFeatures] = useState<Set<string>>(new Set());
  const [viewedFeatures, setViewedFeatures] = useState<Set<string>>(new Set());
  const [tipsShown, setTipsShown] = useState(0);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  // Load dismissed and viewed features from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const dismissed = localStorage.getItem(DISMISSED_FEATURES_KEY);
      if (dismissed) {
        queueMicrotask(() => setDismissedFeatures(new Set(JSON.parse(dismissed))));
      }

      const viewed = localStorage.getItem(VIEWED_FEATURES_KEY);
      if (viewed) {
        queueMicrotask(() => setViewedFeatures(new Set(JSON.parse(viewed))));
      }
    } catch (e) {
      console.error("Failed to load feature discovery state:", e);
    }
  }, []);

  // Get next available tip
  const getNextTip = useCallback((): FeatureTip | null => {
    const availableTips = features
      .filter((tip) => {
        // Skip if dismissed (unless persistent)
        if (dismissedFeatures.has(tip.id) && !tip.persistent) return false;

        // Skip if showOnce and already viewed
        if (tip.showOnce && viewedFeatures.has(tip.id)) return false;

        return true;
      })
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return availableTips[0] || null;
  }, [features, dismissedFeatures, viewedFeatures]);

  // Show next tip
  const showNextTip = useCallback(() => {
    if (tipsShown >= maxTipsPerSession) return;

    const tip = getNextTip();
    if (tip) {
      setCurrentTip(tip);
      setIsVisible(true);
      setTipsShown((prev) => prev + 1);
      onView?.(tip.id);

      // Mark as viewed
      try {
        const updated = new Set(viewedFeatures);
        updated.add(tip.id);
        setViewedFeatures(updated);
        localStorage.setItem(VIEWED_FEATURES_KEY, JSON.stringify([...updated]));
      } catch (e) {
        console.error("Failed to save viewed feature:", e);
      }
    }
  }, [getNextTip, tipsShown, maxTipsPerSession, onView, viewedFeatures]);

  // Auto-show tips
  useEffect(() => {
    if (!autoShow) return;

    const initialTimer = setTimeout(() => {
      showNextTip();
    }, showDelay);

    const intervalTimer = setInterval(() => {
      if (isVisible) return; // Don't show new tip while one is visible
      showNextTip();
    }, interval);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [autoShow, showDelay, interval, showNextTip, isVisible]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    if (!currentTip) return;

    setIsVisible(false);

    // Add to dismissed (unless persistent)
    if (!currentTip.persistent) {
      try {
        const updated = new Set(dismissedFeatures);
        updated.add(currentTip.id);
        setDismissedFeatures(updated);
        localStorage.setItem(DISMISSED_FEATURES_KEY, JSON.stringify([...updated]));
      } catch (e) {
        console.error("Failed to save dismissed feature:", e);
      }
    }

    onDismiss?.(currentTip.id);

    // Clear current tip after animation
    setTimeout(() => {
      setCurrentTip(null);
    }, 300);
  }, [currentTip, dismissedFeatures, onDismiss]);

  // Handle action click
  const handleAction = useCallback(() => {
    if (!currentTip?.action) return;

    currentTip.action.onClick();
    handleDismiss();
  }, [currentTip, handleDismiss]);

  // Get position classes
  const getPositionClasses = () => {
    const positions = {
      "top-right": "top-4 right-4",
      "top-left": "top-4 left-4",
      "bottom-right": "bottom-4 right-4",
      "bottom-left": "bottom-4 left-4",
    };
    return positions[position];
  };

  // Get type-specific styling
  const getTypeStyles = () => {
    if (!currentTip) return null;

    const styles = {
      tip: {
 bgColor: "bg-primary-50",
 borderColor: "border-v2-gold-primary/30",
 textColor: "text-primary-800",
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        ),
      },
      new: {
 bgColor: "bg-accent-50",
 borderColor: "border-accent-200",
 textColor: "text-accent-800",
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ),
      },
      update: {
 bgColor: "bg-secondary-50",
 borderColor: "border-v2-gold-primary/30",
 textColor: "text-secondary-800",
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
        ),
      },
      announcement: {
 bgColor: "bg-warning-50",
 borderColor: "border-v2-gold-accent/30",
 textColor: "text-warning-800",
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clipRule="evenodd" />
          </svg>
        ),
      },
    };

    return styles[currentTip.type];
  };

  if (!currentTip || !isVisible) return null;

  const typeStyles = getTypeStyles();
  const portalTarget = typeof document !== "undefined" ? document.body : null;

  if (!portalTarget || !typeStyles) return null;

  return createPortal(
    <>
      {/* Feature Tip Card */}
      <div
        className={cn(
          "fixed z-[55] max-w-sm w-full",
          "animate-fade-in-up",
          getPositionClasses()
        )}
      >
        <div
          className={cn(
            "rounded-lg shadow-lg border p-4",
 "bg-v2-maroon-800",
 "border-v2-gold-primary/20",
            typeStyles.bgColor,
            typeStyles.borderColor
          )}
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-2">
            <div className={cn("flex-shrink-0 p-1 rounded", typeStyles.textColor)}>
              {currentTip.icon || typeStyles.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className={cn("text-sm font-semibold", typeStyles.textColor)}>
                  {currentTip.title}
                </h4>
                {currentTip.type !== "tip" && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs font-medium",
 currentTip.type === "new" && "bg-accent-100 text-accent-700",
 currentTip.type === "update" && "bg-secondary-100 text-secondary-700",
 currentTip.type === "announcement" && "bg-warning-100 text-warning-700"
                  )}>
                    {currentTip.type === "new" && "New"}
                    {currentTip.type === "update" && "Updated"}
                    {currentTip.type === "announcement" && "Important"}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleDismiss}
 className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 transition-colors"
              aria-label={t("dismissAriaLabel")}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Content */}
 <p className="text-sm text-neutral-600 mb-3">
            {currentTip.description}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {currentTip.action && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleAction}
                className="flex-1"
              >
                {currentTip.action.label}
              </Button>
            )}

            {currentTip.videoUrl && (
              <button
                onClick={() => setIsVideoOpen(true)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
 "bg-neutral-100",
 "text-neutral-700",
 "hover:bg-neutral-200"
                )}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                Watch Tutorial
              </button>
            )}

            <button
              onClick={handleDismiss}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                "bg-transparent",
 "text-neutral-500",
 "hover:bg-neutral-100"
              )}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {isVideoOpen && currentTip.videoUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsVideoOpen(false)}
        >
          <div
 className="bg-v2-maroon-800 rounded-xl shadow-modal max-w-3xl w-full overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
 <div className="p-4 border-b border-v2-gold-primary/20 flex items-center justify-between">
 <h3 className="font-semibold text-neutral-900">
                {currentTip.title}
              </h3>
              <button
                onClick={() => setIsVideoOpen(false)}
 className="text-neutral-400 hover:text-neutral-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="aspect-video">
              <iframe
                src={currentTip.videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>,
    portalTarget
  );
}

/**
 * "What's New" panel component
 */
export function WhatsNewPanel({
  features = DEFAULT_FEATURES,
  onDismiss,
}: {
  features?: FeatureTip[];
  onDismiss?: (featureId: string) => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(DISMISSED_FEATURES_KEY);
      if (stored) {
        queueMicrotask(() => setDismissed(new Set(JSON.parse(stored))));
      }
    } catch (e) {
      console.error("Failed to load dismissed features:", e);
    }
  }, []);

  const handleDismiss = useCallback((id: string) => {
    try {
      const updated = new Set(dismissed);
      updated.add(id);
      setDismissed(updated);
      localStorage.setItem(DISMISSED_FEATURES_KEY, JSON.stringify([...updated]));
    } catch (e) {
      console.error("Failed to dismiss feature:", e);
    }
    onDismiss?.(id);
  }, [dismissed, onDismiss]);

  const visibleFeatures = features.filter((f) => !dismissed.has(f.id));

  if (visibleFeatures.length === 0) {
    return (
      <div className="text-center py-8">
 <svg className="w-12 h-12 mx-auto text-neutral-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
 <p className="text-neutral-600">You&apos;re all caught up!</p>
 <p className="text-sm text-neutral-400">Check back later for new features and updates.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleFeatures.map((feature) => (
        <div
          key={feature.id}
          className={cn(
            "p-4 rounded-lg border",
 "bg-v2-maroon-800",
 "border-v2-gold-primary/20"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
 <h4 className="font-medium text-neutral-900">
                  {feature.title}
                </h4>
                {feature.type !== "tip" && (
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
 feature.type === "new" && "bg-accent-100 text-accent-700",
 feature.type === "update" && "bg-secondary-100 text-secondary-700",
 feature.type === "announcement" && "bg-warning-100 text-warning-700"
                  )}>
                    {feature.type === "new" && "New"}
                    {feature.type === "update" && "Updated"}
                    {feature.type === "announcement" && "Important"}
                  </span>
                )}
              </div>
 <p className="text-sm text-neutral-600">
                {feature.description}
              </p>
              {feature.action && (
                <button
                  onClick={() => {
                    feature.action?.onClick();
                    handleDismiss(feature.id);
                  }}
 className="mt-2 text-sm font-medium text-primary-600 hover:underline"
                >
                  {feature.action.label} →
                </button>
              )}
            </div>
            <button
              onClick={() => handleDismiss(feature.id)}
 className="flex-shrink-0 text-neutral-400 hover:text-neutral-600"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
