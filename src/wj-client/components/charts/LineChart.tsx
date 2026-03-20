"use client";

import React, { memo, useState, useEffect } from "react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  ComposedChart as RechartsComposedChart,
} from "recharts";
import { formatCurrency } from "@/utils/currency-formatter";
import { chartColors } from "@/app/constants";

/**
 * Data point for line/area chart
 */
export interface LineChartDataPoint {
  /** X-axis value (typically date or time period) */
  [key: string]: string | number | undefined;
  /** Name of the data series (must match key in data) */
  name?: string;
}

/**
 * Configuration for a single data series
 */
export interface LineChartSeries {
  /** Key in data objects for this series */
  dataKey: string;
  /** Display name for legend/tooltip */
  name: string;
  /** Color for this series (line and fill) */
  color?: string;
  /** Chart type for this series: "line", "area", or "bar" */
  chartType?: "line" | "area" | "bar";
  /** Whether to show as area chart (filled) - deprecated, use chartType: "area" */
  showArea?: boolean;
  /** Stack ID for stacking multiple series (for area/bar charts) */
  stackId?: string | number;
  /** Type of line: "monotone" | "linear" | "step" | "stepBefore" | "stepAfter" */
  curveType?: "monotone" | "linear" | "step" | "stepBefore" | "stepAfter";
  /** Whether to show dots at data points */
  showDots?: boolean;
  /** Stroke width */
  strokeWidth?: number;
}

/**
 * Line chart component props
 */
export interface LineChartProps {
  /** Array of data points */
  data: LineChartDataPoint[];
  /** Series configurations */
  series: LineChartSeries[];
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
  /** Custom X-axis label formatter */
  xAxisFormatter?: (value: string) => string;
  /** Custom Y-axis label formatter */
  yAxisFormatter?: (value: number) => string;
  /** Custom tooltip formatter */
  tooltipFormatter?: (
    value: number,
    name: string,
    props: any,
  ) => [string, string];
  /** Background color for grid (default: transparent) */
  gridColor?: string;
  /** Y-axis domain (min, max values) */
  yAxisDomain?: [number | "auto", number | "auto"];
  /** Whether to animate on load (default: true) */
  animate?: boolean;
}

/**
 * Default colors for series - using maroon/gold palette
 */
const DEFAULT_SERIES_COLORS = chartColors;

/**
 * LineChart component - Portfolio performance and trends over time
 *
 * Displays line or area charts with support for multiple series.
 * Handles currency formatting, responsive sizing, and animations.
 *
 * @example
 * ```tsx
 * <LineChart
 *   data={[
 *     { month: "Jan", portfolio: 100000, benchmark: 95000 },
 *     { month: "Feb", portfolio: 105000, benchmark: 97000 }
 *   ]}
 *   xAxisKey="month"
 *   series={[
 *     { dataKey: "portfolio", name: "My Portfolio", color: "#10b981", showArea: true },
 *     { dataKey: "benchmark", name: "Benchmark", color: "#94a3b8", showArea: false }
 *   ]}
 * />
 * ```
 */
export const LineChart = memo(function LineChart({
  data,
  series,
  xAxisKey,
  height = 300,
  showGrid = true,
  showLegend = true,
  legendPosition = "top",
  showTooltip = true,
  className = "",
  xAxisFormatter,
  yAxisFormatter = (value) => value.toLocaleString(),
  tooltipFormatter,
  gridColor = "rgba(61, 1, 1, 0.4)",
  yAxisDomain,
  animate = true,
}: LineChartProps) {
  // Responsive margin based on screen size
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 800); // sm breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Determine chart type needed based on series
  const seriesTypes = new Set(
    series.map((s) => {
      if (s.chartType) return s.chartType;
      return s.showArea ? "area" : "line";
    }),
  );

  const hasMultipleTypes = seriesTypes.size > 1 || seriesTypes.has("bar");
  const hasAreaSeries = seriesTypes.has("area");

  // Choose appropriate chart component
  const ChartComponent = hasMultipleTypes
    ? RechartsComposedChart
    : hasAreaSeries
      ? RechartsAreaChart
      : RechartsLineChart;

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
              className="w-3 h-3 rounded-full"
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

  // Custom legend rendered outside the chart
  const renderExternalLegend = () => {
    if (!showLegend || legendPosition !== "top") return null;

    return (
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-2 px-2">
        {series.map((s, index) => {
          const color =
            s.color ??
            DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length];
          return (
            <div
              key={`legend-${s.dataKey}`}
              className="flex items-center gap-2"
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-medium text-v2-cream-100 whitespace-nowrap">
                {s.name}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={className || "w-full"}>
      {renderExternalLegend()}
      <div
        style={{
          height: height
            ? `${height}px`
            : isMobile
              ? "250px"
              : window.innerWidth >= 1024
                ? "350px"
                : "300px",
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: isMobile ? 10 : 20,
              bottom: 10,
            }}
          >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
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

          {showLegend && legendPosition !== "top" && (
            <Legend
              {...(legendLayout as any)}
              iconType="circle"
              wrapperStyle={{
                fontSize: "12px",
                fontWeight: 500,
                paddingBottom: "0px",
                paddingTop: "0px",
                paddingLeft: "0px",
              }}
              content={(props) => {
                const { payload } = props;
                const isBottomPosition = legendPosition === "bottom";
                return (
                  <div
                    className={`flex ${isBottomPosition ? "flex-wrap justify-center gap-4" : "flex-col gap-2"}`}
                  >
                    {payload?.map((entry: any, index: number) => (
                      <div
                        key={`legend-${index}`}
                        className="flex items-center gap-2"
                      >
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-xs font-medium text-v2-cream-100">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
          )}

          {series.map((s, index) => {
            const color =
              s.color ??
              DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length];
            const type = s.chartType || (s.showArea ? "area" : "line");
            const gradientId = `area-gradient-${s.dataKey}-${index}`;

            // Render Bar for bar chart type
            if (type === "bar") {
              return (
                <Bar
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={color}
                  stackId={s.stackId}
                  isAnimationActive={animate}
                  animationBegin={index * 100}
                  animationDuration={750}
                  radius={[4, 4, 0, 0]}
                />
              );
            }

            // Render Area/Line for area/line chart types
            if (type === "line") {
              return (
                <Line
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={color}
                  strokeWidth={s.strokeWidth ?? 2}
                  type={s.curveType ?? "monotone"}
                  dot={
                    s.showDots
                      ? { r: 4, fill: color, strokeWidth: 2, stroke: "#3D0101" }
                      : false
                  }
                  activeDot={{
                    r: 5,
                    fill: color,
                    strokeWidth: 2,
                    stroke: "#3D0101",
                  }}
                  isAnimationActive={animate}
                  animationBegin={index * 100}
                  animationDuration={750}
                />
              );
            }

            return (
              <React.Fragment key={s.dataKey}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={color}
                  strokeWidth={s.strokeWidth ?? 2}
                  fill={`url(#${gradientId})`}
                  type={s.curveType ?? "monotone"}
                  stackId={s.stackId}
                  dot={
                    s.showDots
                      ? { r: 4, fill: color, strokeWidth: 2, stroke: "#3D0101" }
                      : false
                  }
                  activeDot={{
                    r: 5,
                    fill: color,
                    strokeWidth: 2,
                    stroke: "#3D0101",
                  }}
                  isAnimationActive={animate}
                  animationBegin={index * 100}
                  animationDuration={750}
                />
              </React.Fragment>
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
      </div>
    </div>
  );
});
