"use client";

import React, { memo } from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { chartColors } from "@/app/constants";

/**
 * Data point for bar chart
 */
export interface BarChartDataPoint {
  /** X-axis value (category label) */
  [key: string]: string | number | undefined;
  /** Display name for data point */
  name?: string;
}

/**
 * Configuration for a single bar series
 */
export interface BarChartSeries {
  /** Key in data objects for this series */
  dataKey: string;
  /** Display name for legend/tooltip */
  name: string;
  /** Color for this series */
  color?: string;
  /** Whether to stack bars (for multiple series) */
  stackId?: string | number;
}

/**
 * Bar chart component props
 */
export interface BarChartProps {
  /** Array of data points */
  data: BarChartDataPoint[];
  /** Series configurations */
  series: BarChartSeries[];
  /** Key in data for X-axis labels */
  xAxisKey: string;
  /** Height of the chart (default: 300) */
  height?: number;
  /** Whether to show grid lines (default: true) */
  showGrid?: boolean;
  /** Whether to show legend (default: true) */
  showLegend?: boolean;
  /** Legend position (default: "top") */
  legendPosition?: "top" | "bottom" | "left" | "right";
  /** Whether to show tooltips (default: true) */
  showTooltip?: boolean;
  /** CSS class name */
  className?: string;
  /** Layout orientation (default: "vertical") */
  layout?: "vertical" | "horizontal";
  /** Bar corner radius (default: 4) */
  barRadius?: number;
  /** Custom X-axis label formatter */
  xAxisFormatter?: (value: string) => string;
  /** Custom Y-axis label formatter */
  yAxisFormatter?: (value: number) => string;
  /** Custom tooltip formatter */
  tooltipFormatter?: (value: number, name: string, props: any) => [string, string];
  /** Background color for grid (default: transparent) */
  gridColor?: string;
  /** Y-axis domain (min, max values) */
  yAxisDomain?: [number | "auto", number | "auto"];
  /** Custom colors for individual bars (overrides series color) */
  barColors?: ((dataPoint: BarChartDataPoint, index: number) => string) | string[];
  /** Whether to animate on load (default: true) */
  animate?: boolean;
}

/**
 * Default colors for series - using maroon/gold palette
 */
const DEFAULT_SERIES_COLORS = chartColors;

/**
 * BarChart component - Sector allocation and categorical comparisons
 *
 * Displays bar charts with support for multiple series and stacking.
 * Handles currency formatting, responsive sizing, and animations.
 *
 * @example
 * ```tsx
 * <BarChart
 *   data={[
 *     { sector: "Technology", amount: 45000, benchmark: 30000 },
 *     { sector: "Healthcare", amount: 28000, benchmark: 25000 }
 *   ]}
 *   xAxisKey="sector"
 *   series={[
 *     { dataKey: "amount", name: "Portfolio", color: "#10b981" },
 *     { dataKey: "benchmark", name: "Target", color: "#94a3b8" }
 *   ]}
 * />
 * ```
 */
export const BarChart = memo(function BarChart({
  data,
  series,
  xAxisKey,
  height = 300,
  showGrid = true,
  showLegend = true,
  legendPosition = "top",
  showTooltip = true,
  className = "",
  layout = "vertical",
  barRadius = 4,
  xAxisFormatter,
  yAxisFormatter = (value) => value.toLocaleString(),
  tooltipFormatter,
  gridColor = "rgba(61, 1, 1, 0.4)",
  yAxisDomain,
  barColors,
  animate = true,
}: BarChartProps) {
  // Legend layout
  const getLegendLayout = () => {
    switch (legendPosition) {
      case "left":
        return { verticalAlign: "middle", align: "left" };
      case "right":
        return { verticalAlign: "middle", align: "right" };
      case "bottom":
        return { verticalAlign: "bottom", align: "center" };
      default:
        return { verticalAlign: "top", align: "center" };
    }
  };

  const legendLayout = getLegendLayout();

  // Custom tooltip content
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-v2-maroon-900/95 backdrop-blur-sm border border-v2-gold-primary rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-v2-gold-light mb-2">
          {xAxisFormatter ? xAxisFormatter(label) : label}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-v2-cream-100/70">{entry.name}:</span>
            <span className="font-semibold text-white">
              {tooltipFormatter
                ? tooltipFormatter(entry.value, entry.name, entry.payload)[0]
                : yAxisFormatter(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className={className || "w-full h-[250px] sm:h-[300px] md:h-[350px]"}
      style={height ? { height: `${height}px` } : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={layout === "vertical"}
            />
          )}

          <XAxis
            dataKey={xAxisKey}
            tick={{ fontSize: 12, fill: "#FFF8EC" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(215, 139, 28, 0.3)", strokeWidth: 1 }}
            tickFormatter={xAxisFormatter}
          />

          <YAxis
            tick={{ fontSize: 12, fill: "#FFF8EC" }}
            tickLine={false}
            axisLine={false}
            domain={yAxisDomain}
            tickFormatter={yAxisFormatter}
          />

          {showTooltip && <Tooltip content={<CustomTooltip />} />}

          {showLegend && (
            <Legend
              {...(legendLayout as any)}
              iconType="rect"
              wrapperStyle={{
                fontSize: "12px",
                fontWeight: 500,
              }}
            />
          )}

          {series.map((s, seriesIndex) => {
            const defaultColor = DEFAULT_SERIES_COLORS[seriesIndex % DEFAULT_SERIES_COLORS.length];

            return (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name}
                fill={s.color ?? defaultColor}
                radius={[barRadius, barRadius, 0, 0]}
                stackId={s.stackId}
                isAnimationActive={animate}
                animationBegin={seriesIndex * 100}
                animationDuration={750}
              >
                {Array.isArray(barColors) || typeof barColors === "function"
                  ? data.map((entry, index) => {
                      const color =
                        typeof barColors === "function"
                          ? barColors(entry, index)
                          : barColors[index % barColors.length];
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })
                  : null}
              </Bar>
            );
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
});
