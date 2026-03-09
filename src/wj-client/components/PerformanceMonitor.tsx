"use client";

import { useEffect, useState } from "react";
import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";

/**
 * Performance Monitoring Component
 *
 * Tracks Core Web Vitals and provides performance insights:
 * - CLS (Cumulative Layout Shift) - Visual stability
 * - INP (Interaction to Next Paint) - Interactivity (replaces FID in web-vitals v5+)
 * - LCP (Largest Contentful Paint) - Loading performance
 * - FCP (First Contentful Paint) - Initial paint
 * - TTFB (Time to First Byte) - Server response time
 *
 * Also tracks custom metrics:
 * - Navigation timing
 * - Resource loading times
 * - Memory usage (if available)
 */

export interface WebVitalsReport {
  /** Cumulative Layout Shift - target < 0.1 */
  cls?: number;

  /** Interaction to Next Paint - target < 200ms */
  inp?: number;

  /** Largest Contentful Paint - target < 2.5s */
  lcp?: number;

  /** First Contentful Paint - target < 1.8s */
  fcp?: number;

  /** Time to First Byte - target < 800ms */
  ttfb?: number;
}

export interface PerformanceMetrics extends WebVitalsReport {
  /** Page load time */
  loadTime?: number;

  /** DOM content loaded time */
  domContentLoaded?: number;

  /** Number of resources loaded */
  resourceCount?: number;

  /** Memory used (MB) - if available */
  memoryUsed?: number;

  /** Memory limit (MB) - if available */
  memoryLimit?: number;

  /** Connection type */
  connectionType?: string;

  /** Connection downlink (Mbps) */
  connectionDownlink?: number;

  /** Connection RTT (ms) */
  connectionRtt?: number;

  /** Overall performance score (0-100) */
  score?: number;
}

export interface PerformanceMonitorProps {
  /** Enable/disable monitoring */
  enabled?: boolean;

  /** Callback when metrics are collected */
  onMetricsCollected?: (metrics: PerformanceMetrics) => void;

  /** Send to analytics service */
  sendToAnalytics?: (metrics: PerformanceMetrics) => void;

  /** Log to console */
  logToConsole?: boolean;

  /** Show performance badge in development */
  showBadge?: boolean;

  /** Sample rate (0-1) - collect metrics for X% of users */
  sampleRate?: number;
}

/**
 * Get performance rating based on threshold
 */
function getRating(value: number, thresholds: { good: number; needsImprovement: number }): "good" | "needs-improvement" | "poor" {
  if (value <= thresholds.good) return "good";
  if (value <= thresholds.needsImprovement) return "needs-improvement";
  return "poor";
}

/**
 * Calculate overall performance score (0-100)
 */
function calculateScore(metrics: WebVitalsReport): number {
  let score = 100;

  // CLS penalties (good: <0.1, poor: >0.25)
  if (metrics.cls !== undefined) {
    if (metrics.cls > 0.25) score -= 25;
    else if (metrics.cls > 0.1) score -= 10;
  }

  // INP penalties (good: <200ms, poor: >500ms)
  if (metrics.inp !== undefined) {
    if (metrics.inp > 500) score -= 25;
    else if (metrics.inp > 200) score -= 10;
  }

  // LCP penalties (good: <2.5s, poor: >4s)
  if (metrics.lcp !== undefined) {
    if (metrics.lcp > 4000) score -= 25;
    else if (metrics.lcp > 2500) score -= 10;
  }

  // FCP penalties (good: <1.8s, poor: >3s)
  if (metrics.fcp !== undefined) {
    if (metrics.fcp > 3000) score -= 15;
    else if (metrics.fcp > 1800) score -= 5;
  }

  // TTFB penalties (good: <800ms, poor: >1.8s)
  if (metrics.ttfb !== undefined) {
    if (metrics.ttfb > 1800) score -= 10;
    else if (metrics.ttfb > 800) score -= 5;
  }

  return Math.max(0, score);
}

/**
 * Collect navigation timing metrics
 */
function collectNavigationTiming() {
  if (typeof window === "undefined" || !window.performance) return {};

  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

  if (!navigation) return {};

  return {
    loadTime: navigation.loadEventEnd - navigation.fetchStart,
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
  };
}

/**
 * Collect resource metrics
 */
function collectResourceMetrics() {
  if (typeof window === "undefined" || !window.performance) return {};

  const resources = performance.getEntriesByType("resource");

  return {
    resourceCount: resources.length,
  };
}

/**
 * Collect memory metrics (Chrome only)
 */
function collectMemoryMetrics() {
  if (typeof window === "undefined") return {};

  // @ts-ignore - Chrome-specific API
  const memory = (performance as any).memory;

  if (!memory) return {};

  return {
    memoryUsed: Math.round(memory.usedJSHeapSize / 1048576), // Convert to MB
    memoryLimit: Math.round(memory.jsHeapSizeLimit / 1048576), // Convert to MB
  };
}

/**
 * Collect connection metrics
 */
function collectConnectionMetrics() {
  if (typeof window === "undefined") return {};

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  if (!connection) return {};

  return {
    connectionType: connection.effectiveType,
    connectionDownlink: connection.downlink,
    connectionRtt: connection.rtt,
  };
}

/**
 * Send metrics to analytics
 */
function sendToAnalytics(metrics: PerformanceMetrics, endpoint?: string) {
  if (typeof window === "undefined") return;

  // Send to custom analytics endpoint
  if (endpoint) {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metrics),
      keepalive: true,
    }).catch((err) => console.error("Failed to send metrics:", err));
  }

  // Example: Send to Google Analytics 4
  if ((window as any).gtag) {
    (window as any).gtag("event", "web_vitals", {
      event_category: "Performance",
      event_label: "Web Vitals",
      non_interaction: true,
      value: metrics.score,
      cls: metrics.cls,
      inp: metrics.inp,
      lcp: metrics.lcp,
      fcp: metrics.fcp,
      ttfb: metrics.ttfb,
    });
  }

  // Example: Send to Vercel Analytics
  if ((window as any).va) {
    (window as any).va("event", {
      name: "web_vitals",
      data: metrics,
    });
  }
}

export function PerformanceMonitor({
  enabled = true,
  onMetricsCollected,
  sendToAnalytics: customAnalytics,
  logToConsole = process.env.NODE_ENV === "development",
  showBadge = process.env.NODE_ENV === "development",
  sampleRate = 1,
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // Sampling - only collect for X% of users
    if (Math.random() > sampleRate) return;

    const vitals: WebVitalsReport = {};

    // Collect Core Web Vitals
    onCLS((metric) => {
      vitals.cls = metric.value;
      checkAndReport();
    });

    onINP((metric) => {
      vitals.inp = metric.value;
      checkAndReport();
    });

    onLCP((metric) => {
      vitals.lcp = metric.value;
      checkAndReport();
    });

    onFCP((metric) => {
      vitals.fcp = metric.value;
      checkAndReport();
    });

    onTTFB((metric) => {
      vitals.ttfb = metric.value;
      checkAndReport();
    });

    let reported = false;

    function checkAndReport() {
      // Wait for all metrics to be collected
      if (
        reported ||
        vitals.cls === undefined ||
        vitals.inp === undefined ||
        vitals.lcp === undefined ||
        vitals.fcp === undefined ||
        vitals.ttfb === undefined
      ) {
        return;
      }

      reported = true;

      // Collect additional metrics
      const additionalMetrics = {
        ...collectNavigationTiming(),
        ...collectResourceMetrics(),
        ...collectMemoryMetrics(),
        ...collectConnectionMetrics(),
      };

      // Calculate overall score
      const score = calculateScore(vitals);

      const finalMetrics: PerformanceMetrics = {
        ...vitals,
        ...additionalMetrics,
        score,
      };

      setMetrics(finalMetrics);

      // Log to console in development
      if (logToConsole) {
        console.group("Performance Metrics");
        console.log("Overall Score:", score, score >= 90 ? "Excellent" : score >= 70 ? "Good" : "Needs Improvement");
        console.log("CLS:", vitals.cls, getRating(vitals.cls, { good: 0.1, needsImprovement: 0.25 }));
        console.log("INP:", vitals.inp, getRating(vitals.inp, { good: 200, needsImprovement: 500 }));
        console.log("LCP:", vitals.lcp, getRating(vitals.lcp, { good: 2500, needsImprovement: 4000 }));
        console.log("FCP:", vitals.fcp, getRating(vitals.fcp, { good: 1800, needsImprovement: 3000 }));
        console.log("TTFB:", vitals.ttfb, getRating(vitals.ttfb, { good: 800, needsImprovement: 1800 }));
        console.log("Additional:", additionalMetrics);
        console.groupEnd();
      }

      // Send to analytics
      if (customAnalytics) {
        sendToAnalytics(finalMetrics);
      }

      // Call custom callback
      if (onMetricsCollected) {
        onMetricsCollected(finalMetrics);
      }
    }

    // Cleanup
    return () => {
      // Web vitals callbacks don't need cleanup
    };
  }, [enabled, sampleRate, logToConsole, customAnalytics, onMetricsCollected]);

  // Don't render anything in production unless explicitly requested
  if (!showBadge) return null;

  const score = metrics.score ?? 0;
  const scoreColor = score >= 90 ? "bg-v2-green-positive" : score >= 70 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {visible ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 mb-2 w-64 text-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Performance</h3>
            <button
              onClick={() => setVisible(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {metrics.score !== undefined && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-600 dark:text-gray-400">Score</span>
                <span className="font-bold">{score}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full ${scoreColor}`} style={{ width: `${score}%` }} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {metrics.cls !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">CLS</span>
                <span className={getRating(metrics.cls, { good: 0.1, needsImprovement: 0.25 }) === "good" ? "text-v2-green-positive" : "text-yellow-600"}>
                  {metrics.cls.toFixed(3)}
                </span>
              </div>
            )}
            {metrics.inp !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">INP</span>
                <span className={getRating(metrics.inp, { good: 200, needsImprovement: 500 }) === "good" ? "text-v2-green-positive" : "text-yellow-600"}>
                  {metrics.inp.toFixed(0)}ms
                </span>
              </div>
            )}
            {metrics.lcp !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">LCP</span>
                <span className={getRating(metrics.lcp, { good: 2500, needsImprovement: 4000 }) === "good" ? "text-v2-green-positive" : "text-yellow-600"}>
                  {(metrics.lcp / 1000).toFixed(2)}s
                </span>
              </div>
            )}
            {metrics.memoryUsed !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Memory</span>
                <span className="text-gray-800 dark:text-gray-200">
                  {metrics.memoryUsed}MB
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setVisible(true)}
          className={`w-10 h-10 rounded-full ${scoreColor} text-white flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity`}
          title={`Performance Score: ${score}`}
        >
          <span className="text-sm font-bold">{score || "—"}</span>
        </button>
      )}
    </div>
  );
}

/**
 * Hook to programmatically track performance metrics
 */
export function usePerformanceTracking() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.performance) return;

    // Track page view
    const trackPageView = () => {
      // Send page view event to analytics
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

      if (navigation) {
        const loadTime = navigation.loadEventEnd - navigation.fetchStart;

        // Example analytics event
        console.log("Page load time:", loadTime);
      }
    };

    // Track after page load
    if (document.readyState === "complete") {
      trackPageView();
    } else {
      window.addEventListener("load", trackPageView);
      return () => window.removeEventListener("load", trackPageView);
    }
  }, []);
}

/**
 * Utility to measure component render time
 */
export function useRenderTime(componentName: string) {
  useEffect(() => {
    const start = performance.now();

    return () => {
      const end = performance.now();
      const renderTime = end - start;

      if (process.env.NODE_ENV === "development" && renderTime > 16) {
        console.warn(`[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render`);
      }
    };
  }, [componentName]);
}

export default PerformanceMonitor;
