"use client";

import React, { memo } from "react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { pieChartColors } from "@/app/constants";

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
export interface DonutChartProps {
  /** Array of data segments */
  data: DonutChartDataPoint[];
  /** Inner radius as percentage or pixels (creates donut hole) */
  innerRadius?: number | string;
  /** Outer radius as percentage or pixels */
  outerRadius?: number | string;
  /** Height of the chart (default: 300) */
  height?: number;
  /** Custom color palette for segments */
  colors?: string[];
  /** Whether to show legend (default: true) */
  showLegend?: boolean;
  /** Legend position (default: "right") */
  legendPosition?: "left" | "right" | "top" | "bottom";
  /** Whether to show tooltips (default: true) */
  showTooltip?: boolean;
  /** CSS class name */
  className?: string;
  /** Label to show in center of donut (e.g., total value) */
  centerLabel?: string;
  /** Sub-label to show below center label (e.g., "Total Portfolio") */
  centerSubLabel?: string;
  /** Custom formatter for tooltip values */
  tooltipFormatter?: (value: number, name: string | undefined) => [string, string];
  /** Whether to animate on load (default: true) */
  animate?: boolean;
}

/**
 * Default color palette - using maroon/gold palette from constants
 */
const DEFAULT_COLORS = pieChartColors;

/**
 * DonutChart component - Asset allocation and categorical breakdowns
 *
 * Displays a donut/pie chart with customizable colors, legend, and center label.
 * Supports animations and responsive sizing.
 *
 * @example
 * ```tsx
 * <DonutChart
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
export const DonutChart = memo(function DonutChart({
  data,
  innerRadius = "60%",
  outerRadius = "80%",
  height = 300,
  colors = DEFAULT_COLORS,
  showLegend = true,
  legendPosition = "right",
  showTooltip = true,
  className = "",
  centerLabel,
  centerSubLabel,
  tooltipFormatter,
  animate = true,
}: DonutChartProps) {
  // Assign colors to segments
  const coloredData = data.map((point, index) => ({
    ...point,
    color: point.color ?? colors[index % colors.length],
  }));

  // Legend layout based on position
  const getLegendLayout = () => {
    switch (legendPosition) {
      case "left":
        return { verticalAlign: "middle", align: "left" };
      case "right":
        return { verticalAlign: "middle", align: "right" };
      case "top":
        return { verticalAlign: "top", align: "center" };
      case "bottom":
        return { verticalAlign: "bottom", align: "center" };
      default:
        return { verticalAlign: "middle", align: "right" };
    }
  };

  const legendLayout = getLegendLayout();

  return (
    <div
      className={
        className || "relative w-full h-[250px] sm:h-[300px] md:h-[350px]"
      }
      style={height ? { height: `${height}px` } : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={coloredData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={false}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            isAnimationActive={animate}
            animationBegin={0}
            animationDuration={750}
          >
            {coloredData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="#3D0101"
                strokeWidth={2}
              />
            ))}
          </Pie>

          {showTooltip && (
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(61, 1, 1, 0.95)",
                border: "1px solid #D78B1C",
                borderRadius: "6px",
                fontSize: "12px",
                padding: "8px 12px",
                color: "#FFFFFF",
              }}
              formatter={(value: number | undefined, name?: string) => {
                if (tooltipFormatter) {
                  return tooltipFormatter(value ?? 0, name ?? "");
                }
                return [
                  typeof value === "number" ? value.toLocaleString() : (value ?? 0).toLocaleString(),
                  name ?? "",
                ];
              }}
            />
          )}

          {showLegend && (
            <Legend
              {...(legendLayout as any)}
              iconType="circle"
              wrapperStyle={{
                fontSize: "12px",
                fontWeight: 500,
              }}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>

      {/* Center label overlay */}
      {(centerLabel || centerSubLabel) && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ transform: `translateY(${legendPosition === "top" ? "25%" : legendPosition === "bottom" ? "-25%" : "0"})` }}
        >
          {centerLabel && (
            <div className="text-xl sm:text-2xl font-bold text-white">
              {centerLabel}
            </div>
          )}
          {centerSubLabel && (
            <div className="text-xs sm:text-sm text-v2-cream-100/70 mt-1">
              {centerSubLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
