"use client";

import React, { memo } from "react";

/**
 * Data point for donut/pie chart
 */
export interface DonutChartDataPoint {
  /** Value/amount for this segment */
  value: number;
  /** Label for this segment */
  name: string;
  /** Optional color for this segment (overrides default palette) */
  color?: string;
}

/**
 * Donut chart component props
 */
export interface DonutChartSVGProps {
  /** Array of data segments */
  data: DonutChartDataPoint[];
  /** Inner radius as percentage (creates donut hole) - default 60% */
  innerRadiusPercent?: number;
  /** Outer radius as percentage - default 80% */
  outerRadiusPercent?: number;
  /** Height of the chart (default: 300) */
  height?: number;
  /** Custom color palette for segments */
  colors?: string[];
  /** Whether to show legend (default: true) */
  showLegend?: boolean;
  /** Legend position (default: "right") */
  legendPosition?: "left" | "right" | "top" | "bottom";
  /** CSS class name */
  className?: string;
  /** Label to show in center of donut (e.g., total value) */
  centerLabel?: string;
  /** Sub-label to show below center label (e.g., "Total Portfolio") */
  centerSubLabel?: string;
  /** Whether to show percentage labels on segments (default: false) */
  showPercentageLabels?: boolean;
  /** Position of percentage labels: "inside" or "outside" (default: "inside") */
  labelPosition?: "inside" | "outside";
  /** Custom tooltip formatter function */
  tooltipFormatter?: (value: number, name: string) => string;
  /** Whether to animate on load (default: true) */
  animate?: boolean;
}

/**
 * Default color palette - using maroon/gold palette
 */
const DEFAULT_COLORS = [
  "#D78B1C", // Gold primary
  "#9B0111", // Red primary
  "#F1BD61", // Gold accent
  "#FFF8EC", // Cream
  "#F5D38E", // Gold light
  "#7B0A0E", // Dark red
  "#E8A535", // Gold warm
  "#C0392B", // Red accent
];

/**
 * DonutChartSVG component - Pure SVG implementation for React 19 compatibility
 *
 * Displays a donut/pie chart with customizable colors, legend, and center label.
 * Uses native SVG elements instead of Recharts for better React 19 compatibility.
 * Mobile-responsive: legend moves below chart on small screens.
 *
 * @example
 * ```tsx
 * <DonutChartSVG
 *   data={[
 *     { name: "Stocks", value: 50000 },
 *     { name: "Bonds", value: 30000 },
 *     { name: "Crypto", value: 15000 }
 *   ]}
 *   centerLabel="$95,000"
 *   centerSubLabel="Total Portfolio"
 * />
 * ```
 */
export const DonutChartSVG = memo(function DonutChartSVG({
  data,
  innerRadiusPercent = 60,
  outerRadiusPercent = 80,
  height = 300,
  colors = DEFAULT_COLORS,
  showLegend = true,
  legendPosition = "right",
  className = "",
  centerLabel,
  centerSubLabel,
  showPercentageLabels = false,
  labelPosition = "inside",
  tooltipFormatter,
  animate = true,
}: DonutChartSVGProps) {
  // Assign colors to segments and filter out invalid values
  const coloredData = data
    .filter((point) => point.value !== undefined && point.value !== null && !isNaN(point.value))
    .map((point, index) => ({
      ...point,
      color: point.color ?? colors[index % colors.length],
    }));

  // Calculate total value
  const total = coloredData.reduce((sum, item) => sum + (item.value || 0), 0);

  // SVG dimensions
  const size = Math.min(height, 400);
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size / 2) * (outerRadiusPercent / 100);
  const innerRadius = (size / 2) * (innerRadiusPercent / 100);

  // Generate pie slices using reduce to avoid variable mutation during render
  const slices = coloredData.reduce<
    Array<{
      path: string;
      color: string;
      name: string;
      value: number;
      percentage: number;
      labelX: number;
      labelY: number;
    }>
  >((acc, item) => {
    const currentAngle = -90 + acc.reduce((sum, _, i) => sum + (coloredData[i].value / total) * 360, 0);
    const percentage = total > 0 ? item.value / total : 0;
    const angle = percentage * 360;

    // Calculate path for slice
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;

    // Convert to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // Calculate coordinates
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);

    const x1Inner = centerX + innerRadius * Math.cos(startRad);
    const y1Inner = centerY + innerRadius * Math.sin(startRad);
    const x2Inner = centerX + innerRadius * Math.cos(endRad);
    const y2Inner = centerY + innerRadius * Math.sin(endRad);

    // Create SVG path
    // Special case: if angle is >= 360 (full circle), draw two semicircles
    let path: string;
    if (angle >= 359.99) {
      // Draw full circle as two semicircles
      const midRad = (startRad + Math.PI) % (2 * Math.PI);
      const xMid = centerX + radius * Math.cos(midRad);
      const yMid = centerY + radius * Math.sin(midRad);
      const xMidInner = centerX + innerRadius * Math.cos(midRad);
      const yMidInner = centerY + innerRadius * Math.sin(midRad);

      path = [
        `M ${x1Inner} ${y1Inner}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 1 1 ${xMid} ${yMid}`,
        `A ${radius} ${radius} 0 1 1 ${x1} ${y1}`,
        `L ${x1Inner} ${y1Inner}`,
        `A ${innerRadius} ${innerRadius} 0 1 0 ${xMidInner} ${yMidInner}`,
        `A ${innerRadius} ${innerRadius} 0 1 0 ${x1Inner} ${y1Inner}`,
        "Z",
      ].join(" ");
    } else {
      const largeArcFlag = angle > 180 ? 1 : 0;
      path = [
        `M ${x1Inner} ${y1Inner}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${x2Inner} ${y2Inner}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner}`,
        "Z",
      ].join(" ");
    }

    // Calculate label position (mid-angle of slice)
    const midAngle = (startAngle + endAngle) / 2;
    const midRad = (midAngle * Math.PI) / 180;
    const labelRadius = labelPosition === "inside"
      ? (innerRadius + radius) / 2
      : radius + 20;
    const labelX = centerX + labelRadius * Math.cos(midRad);
    const labelY = centerY + labelRadius * Math.sin(midRad);

    acc.push({
      path,
      color: item.color,
      name: item.name,
      value: item.value,
      percentage,
      labelX,
      labelY,
    });
    return acc;
  }, []);

  return (
    <div className={`${className} w-full`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-center gap-3 sm:gap-4 w-full px-2 sm:px-0 pb-2 sm:pb-0">
        {/* Chart Container - with relative positioning for center label */}
        <div className="relative flex-shrink-0 w-full sm:w-auto flex justify-center">
          <div style={{ width: `${size}px`, height: `${size}px`, maxWidth: '100%' }}>
            {/* SVG Chart */}
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              style={{ width: "100%", height: "100%", maxWidth: `${size}px` }}
            >
            {animate ? (
              <>
                <style>{`
                  @keyframes donut-enter {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                  }
                  .donut-slice {
                    animation: donut-enter 0.5s ease-out forwards;
                    transform-origin: center;
                  }
                  .donut-slice:hover {
                    opacity: 0.8;
                    cursor: pointer;
                  }
                `}</style>
                {slices.map((slice, index) => (
                  <g key={index}>
                    <path
                      d={slice.path}
                      fill={slice.color}
                      className="donut-slice"
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      <title>
                        {tooltipFormatter
                          ? `${slice.name}: ${tooltipFormatter(slice.value, slice.name)}`
                          : `${slice.name}: ${(slice.value || 0).toLocaleString()} (${(slice.percentage * 100).toFixed(1)}%)`
                        }
                      </title>
                    </path>
                    {/* Percentage label */}
                    {showPercentageLabels && slice.percentage >= 0.05 && (
                      <text
                        x={slice.labelX}
                        y={slice.labelY}
                        fill={labelPosition === "inside" ? "white" : "#FFF8EC"}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-sm font-medium pointer-events-none"
                        style={{
                          animation: animate ? "donut-enter 0.5s ease-out forwards" : "none",
                          animationDelay: `${index * 50 + 200}ms`,
                        }}
                      >
                        {(slice.percentage * 100).toFixed(0)}%
                      </text>
                    )}
                  </g>
                ))}
              </>
            ) : (
              slices.map((slice, index) => (
                <g key={index}>
                  <path
                    d={slice.path}
                    fill={slice.color}
                    className="hover:opacity-80 cursor-pointer transition-opacity"
                  >
                    <title>
                      {tooltipFormatter
                        ? `${slice.name}: ${tooltipFormatter(slice.value, slice.name)}`
                        : `${slice.name}: ${(slice.value || 0).toLocaleString()} (${(slice.percentage * 100).toFixed(1)}%)`
                      }
                    </title>
                  </path>
                  {/* Percentage label */}
                  {showPercentageLabels && slice.percentage >= 0.05 && (
                    <text
                      x={slice.labelX}
                      y={slice.labelY}
                      fill={labelPosition === "inside" ? "white" : "#FFF8EC"}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-sm font-medium pointer-events-none"
                    >
                      {(slice.percentage * 100).toFixed(0)}%
                    </text>
                  )}
                </g>
              ))
            )}
          </svg>

            {/* Center label overlay - positioned absolutely relative to chart container */}
            {(centerLabel || centerSubLabel) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-2">
                <div className="flex flex-col items-center justify-center text-center">
                  {centerLabel && (
                    <div className="text-base sm:text-lg lg:text-xl font-bold text-white leading-tight">
                      {centerLabel}
                    </div>
                  )}
                  {centerSubLabel && (
                    <div className="text-[10px] sm:text-xs text-v2-cream-100/70 mt-0.5">
                      {centerSubLabel}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex flex-col gap-1.5 text-xs sm:text-sm w-full sm:w-auto sm:min-w-[180px] sm:max-w-[220px]">
            {coloredData.map((item, index) => {
              const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={index} className="flex items-center gap-1.5 sm:gap-2 w-full">
                  <div
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-v2-cream-100 truncate min-w-0 flex-1">{item.name}</span>
                  <span className="text-v2-cream-100/60 flex-shrink-0 tabular-nums text-right">{percentage}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
