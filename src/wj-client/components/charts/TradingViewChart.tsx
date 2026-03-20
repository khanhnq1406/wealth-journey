"use client";

import { useEffect, useRef, useState, memo } from "react";

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  locale?: string;
  theme?: "light" | "dark";
  interval?: string;
  allowSymbolChange?: boolean;
  className?: string;
}

let tvScriptPromise: Promise<void> | null = null;

function loadTradingViewScript(): Promise<void> {
  if (tvScriptPromise) return tvScriptPromise;
  if (window.TradingView) return Promise.resolve();

  tvScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      tvScriptPromise = null;
      reject(new Error("Failed to load TradingView"));
    };
    document.head.appendChild(script);
  });

  return tvScriptPromise;
}

type ChartStatus = "loading" | "ready" | "error";

function TradingViewChartInner({
  symbol,
  height = 400,
  locale = "en",
  theme = "light",
  interval = "D",
  allowSymbolChange = false,
  className,
}: TradingViewChartProps) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ChartStatus>("loading");
  const [isVisible, setIsVisible] = useState(false);

  const tvLocale = locale === "vi" ? "vi_VN" : "en";

  // Detect when the container is actually visible (not inside display:none)
  useEffect(() => {
    const container = widgetRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Only initialize TradingView widget when visible
  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;
    const container = widgetRef.current;
    if (!container) return;

    // Generate unique container id for the widget
    const containerId = `tv-widget-${symbol.replace(/[^a-zA-Z0-9]/g, "-")}-${Date.now()}`;
    container.id = containerId;

    loadTradingViewScript()
      .then(() => {
        if (cancelled || !window.TradingView) return;

        // Reset to loading at the start of widget creation
        setStatus("loading");

        new window.TradingView.widget({
          container_id: containerId,
          autosize: true,
          symbol,
          interval,
          timezone: "Asia/Ho_Chi_Minh",
          theme: "dark",
          style: "1",
          locale: tvLocale,
          toolbar_bg: "#3D0101",
          enable_publishing: false,
          allow_symbol_change: allowSymbolChange,
          hide_side_toolbar: true,
          save_image: false,
          calendar: false,
          studies: [],
          overrides: {
            "paneProperties.background": "#580202",
            "paneProperties.backgroundType": "solid",
            "scalesProperties.backgroundColor": "#580202",
            "scalesProperties.lineColor": "rgba(215, 139, 28, 0.2)",
            "scalesProperties.textColor": "#FFF8EC",
            "mainSeriesProperties.candleStyle.upColor": "#D78B1C",
            "mainSeriesProperties.candleStyle.downColor": "#9B0111",
            "mainSeriesProperties.candleStyle.borderUpColor": "#D78B1C",
            "mainSeriesProperties.candleStyle.borderDownColor": "#9B0111",
            "mainSeriesProperties.candleStyle.wickUpColor": "#D78B1C",
            "mainSeriesProperties.candleStyle.wickDownColor": "#9B0111",
          },
        });

        // Wait for iframe to render
        setTimeout(() => {
          if (!cancelled) setStatus("ready");
        }, 1500);
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
      setStatus("loading");
    };
  }, [isVisible, symbol, theme, tvLocale, interval, allowSymbolChange]);

  return (
    <div
      className={`relative ${className ?? ""}`}
      style={{ height, width: "100%" }}
    >
      <div
        ref={widgetRef}
        style={{ height: "100%", width: "100%" }}
        role="img"
        aria-label={`TradingView chart for ${symbol}`}
      />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-v2-maroon-800 z-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-v2-maroon-900 border-t-v2-gold-primary" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-v2-maroon-900 z-10">
          <p className="text-sm text-v2-cream-100/60">Chart unavailable</p>
        </div>
      )}
    </div>
  );
}

export const TradingViewChart = memo(TradingViewChartInner);
