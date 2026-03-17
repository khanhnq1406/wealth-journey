"use client";

import { parseAmount } from "@/utils/currency-formatter";
import React, { memo, useId, useState, useEffect, useRef } from "react";

/**
 * Data point for sparkline chart
 */
export interface SparklineDataPoint {
  /** Value at this point */
  value: number;
  /** Optional label for tooltip */
  label?: string;
}

/**
 * Sparkline component props
 */
export interface SparklineProps {
  /** Array of data points to display */
  data: SparklineDataPoint[];
  /** Color of the line (default: green for positive, red for negative trend) */
  color?: string;
  /** Width of the line (default: 2) */
  strokeWidth?: number;
  /** Whether to show dots at data points (default: false) */
  showDots?: boolean;
  /** Whether to show tooltip on hover (default: false for sparklines) */
  showTooltip?: boolean;
  /** Height of the chart (default: 60) */
  height?: number;
  /** CSS class name */
  className?: string;
  /** Whether to use gradient fill (default: true) */
  showGradient?: boolean;
}

/**
 * Sparkline component - Mini trend indicator for cards
 *
 * Pure SVG implementation without Recharts dependency
 */
export const Sparkline = memo(function Sparkline({
  data,
  color,
  strokeWidth = 2,
  showDots = false,
  showTooltip = false,
  height = 60,
  className = "",
  showGradient = true,
}: SparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const uniqueId = useId();

  // Measure container width on mount and resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        if (containerWidth > 0) {
          setWidth(containerWidth);
        }
      }
    };

    // Initial measurement
    setTimeout(updateWidth, 0);

    // Set up ResizeObserver for dynamic resizing
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Determine trend color if not provided
  const trendColor =
    color ??
    (() => {
      if (data.length < 2) return "#10b981"; // Default green
      const first = parseAmount(data[0].value);
      const last = parseAmount(data[data.length - 1].value);
      return last >= first ? "#10b981" : "#ef4444"; // Green if up, red if down
    })();

  if (!data || data.length <= 1) {
    // Render a flat horizontal line with gradient fill, matching normal sparkline style
    const flatGradientId = `sparkline-flat-gradient-${uniqueId.replace(/:/g, '-')}`;
    const lineY = Math.round(height * 0.4); // Line at 40% from top
    return (
      <div className={className} style={{ height }}>
        <svg width="100%" height="100%" preserveAspectRatio="none">
          {showGradient && (
            <defs>
              <linearGradient id={flatGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trendColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
              </linearGradient>
            </defs>
          )}
          {showGradient && (
            <rect
              x="0" y={lineY} width="100%" height={height - lineY}
              fill={`url(#${flatGradientId})`}
            />
          )}
          <line
            x1="0" y1={lineY} x2="100%" y2={lineY}
            stroke={trendColor}
            strokeWidth={strokeWidth}
          />
          {showDots && data.length === 1 && (
            <circle cx="50%" cy={lineY} r={3} fill={trendColor} />
          )}
        </svg>
      </div>
    );
  }

  // Single pass: parse values and track min/max
  const padding = 5;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const parsed = data.reduce<{ value: number; label?: string }[]>(
    (acc, d) => {
      if (d.value !== undefined && d.value !== null) {
        acc.push({ value: parseAmount(d.value), label: d.label });
      }
      return acc;
    },
    [],
  );

  let minValue = Infinity;
  let maxValue = -Infinity;
  for (const p of parsed) {
    if (p.value < minValue) minValue = p.value;
    if (p.value > maxValue) maxValue = p.value;
  }
  const valueRange = maxValue - minValue || 1; // Avoid division by zero

  const points = parsed.map((point, index) => {
    const x = padding + (chartWidth * index) / (parsed.length - 1 || 1);
    const y =
      padding +
      chartHeight -
      ((point.value - minValue) / valueRange) * chartHeight;
    return { x, y, value: point.value };
  });

  // Create SVG path string
  const pathData = points
    .map((point, index) => {
      return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
    })
    .join(" ");

  // Create area fill path (for gradient)
  const areaPath = showGradient
    ? `${pathData} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`
    : "";

  const gradientId = `sparkline-gradient-${uniqueId.replace(/:/g, '-')}`;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: `${height}px` }}
    >
      {width > 0 && (
        <svg width={width} height={height} style={{ display: "block" }}>
          {showGradient && (
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trendColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
              </linearGradient>
            </defs>
          )}

          {/* Area fill */}
          {showGradient && areaPath && (
            <path d={areaPath} fill={`url(#${gradientId})`} />
          )}

          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke={trendColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots */}
          {showDots &&
            points.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={3}
                fill={trendColor}
              />
            ))}
        </svg>
      )}
    </div>
  );
});
