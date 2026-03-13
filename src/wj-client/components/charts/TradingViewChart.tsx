"use client";

import { useEffect, useRef, memo } from "react";

interface TradingViewChartProps {
  symbol: string;
  height?: number;
  locale?: string;
  theme?: "light" | "dark";
  interval?: string;
  allowSymbolChange?: boolean;
  className?: string;
}

function TradingViewChartInner({
  symbol,
  height = 400,
  locale = "en",
  theme = "light",
  interval = "D",
  allowSymbolChange = false,
  className,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const tvLocale = locale === "vi" ? "vi_VN" : "en";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "calc(100% - 32px)";
    widgetDiv.style.width = "100%";
    container.appendChild(widgetDiv);

    const copyrightDiv = document.createElement("div");
    copyrightDiv.className = "tradingview-widget-copyright";
    copyrightDiv.innerHTML = `<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a>`;
    container.appendChild(copyrightDiv);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Asia/Ho_Chi_Minh",
      theme,
      style: "1",
      locale: tvLocale,
      allow_symbol_change: allowSymbolChange,
      hide_top_toolbar: false,
      hide_side_toolbar: true,
      hide_volume: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [symbol, theme, tvLocale, interval, allowSymbolChange]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: "100%" }}
      role="img"
      aria-label={`TradingView chart for ${symbol}`}
    />
  );
}

export const TradingViewChart = memo(TradingViewChartInner);
