"use client";

import React, { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface TrendData {
  value: number; // Percentage change
  period?: string; // e.g., "vs last month"
}

export interface WealthCardProps {
  /**
   * Card title
   */
  title: string;

  /**
   * Primary value (e.g., total balance)
   */
  value: string | number;

  /**
   * Currency symbol
   * @default ""
   */
  currency?: string;

  /**
   * Trend data for the value
   */
  trend?: TrendData;

  /**
   * Subtitle or description
   */
  subtitle?: string;

  /**
   * Icon to display
   */
  icon?: ReactNode;

  /**
   * Icon position
   * @default "top-left"
   */
  iconPosition?: "top-left" | "top-right" | "background";

  /**
   * Gradient variant for background
   * @default "green"
   */
  gradient?: "green" | "primary" | "purple" | "orange" | "red" | "none";

  /**
   * Card size
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Whether to show sparkline
   */
  showSparkline?: boolean;

  /**
   * Sparkline data points
   */
  sparklineData?: number[];

  /**
   * Footer content
   */
  footer?: ReactNode;

  /**
   * Click handler
   */
  onClick?: () => void;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Card content
   */
  children?: ReactNode;
}

const gradientClasses = {
 green: "bg-gradient-to-br from-v2-green-positive to-v2-green-positive",
 primary: "bg-gradient-to-br from-v2-red-primary to-v2-red-primary",
 purple: "bg-gradient-to-br from-purple-500 to-purple-600",
 orange: "bg-gradient-to-br from-orange-500 to-orange-600",
 red: "bg-gradient-to-br from-red-500 to-red-600",
 none: "bg-v2-maroon-800 border border-v2-maroon-600",
};

const sizeClasses = {
  sm: "p-4 sm:p-5",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

export function WealthCard({
  title,
  value,
  currency = "",
  trend,
  subtitle,
  icon,
  iconPosition = "top-left",
  gradient = "green",
  size = "md",
  showSparkline = false,
  sparklineData = [],
  footer,
  onClick,
  loading = false,
  className,
  children,
}: WealthCardProps) {
  const isPositive = trend && trend.value >= 0;
  const isGradient = gradient !== "none";

  const cardClasses = cn(
    "rounded-xl shadow-lg transition-all duration-200",
    "relative overflow-hidden",
    sizeClasses[size],
    gradientClasses[gradient],
    onClick && "cursor-pointer hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
    loading && "opacity-70 pointer-events-none",
    className
  );

  const textClasses = isGradient
    ? "text-white"
 : "text-white";

  const subtitleClasses = isGradient
    ? "text-white/80"
 : "text-v2-cream-100";

  const trendClasses = cn(
    "inline-flex items-center gap-1 text-sm font-medium",
    isPositive
      ? isGradient
        ? "text-white"
 : "text-v2-green-positive"
      : isGradient
      ? "text-white"
 : "text-red-600"
  );

  // Generate sparkline SVG path
  const generateSparklinePath = (data: number[]) => {
    if (data.length < 2) return "";

    const width = 100;
    const height = 30;
    const padding = 2;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((point, index) => {
      const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((point - min) / range) * (height - padding * 2) - padding;
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  };

  const sparklinePath = sparklineData.length > 1 ? generateSparklinePath(sparklineData) : "";
  const sparklineColor = isGradient ? "rgba(255,255,255,0.3)" : isPositive ? "#22c55e" : "#ef4444";

  return (
    <div className={cardClasses} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      {/* Background icon */}
      {icon && iconPosition === "background" && (
        <div className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10">
          {icon}
        </div>
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {icon && iconPosition === "top-left" && (
              <div className="flex-shrink-0 p-2 rounded-lg bg-white/10">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className={cn(
                "font-semibold truncate",
 isGradient ? "text-white/90" : "text-v2-cream-100"
              )}>
                {title}
              </h3>
              {subtitle && (
                <p className={cn("text-sm truncate", subtitleClasses)}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {icon && iconPosition === "top-right" && (
            <div className="flex-shrink-0 p-2 rounded-lg bg-white/10">
              {icon}
            </div>
          )}
        </div>

        {/* Value */}
        {loading ? (
          <div className="animate-pulse">
            <div className={cn(
              "h-8 bg-current opacity-20 rounded",
              isGradient && "bg-white"
            )} />
          </div>
        ) : (
          <div className="mb-3">
            <div className={cn("text-2xl sm:text-3xl font-bold tracking-tight", textClasses)}>
              {currency}{typeof value === "number" ? value.toLocaleString() : value}
            </div>
            {trend && (
              <div className={trendClasses}>
                <svg
                  className={cn(
                    "w-4 h-4 transition-transform",
                    !isPositive && "rotate-180"
                  )}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 7l-5 5 1.5 1.5L12 10l3.5 3.5L17 12l-5-5z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  {Math.abs(trend.value)}%{trend.period && ` ${trend.period}`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Sparkline */}
        {showSparkline && !loading && (
          <div className="mb-3 h-8">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 100 30"
              preserveAspectRatio="none"
              className="overflow-visible"
            >
              {sparklinePath ? (
                <>
                  <path
                    d={sparklinePath}
                    fill="none"
                    stroke={sparklineColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`${sparklinePath} L 100,30 L 0,30 Z`}
                    fill={sparklineColor}
                    fillOpacity="0.2"
                    stroke="none"
                  />
                </>
              ) : (
                <line
                  x1="0" y1="15" x2="100" y2="15"
                  stroke={sparklineColor}
                  strokeWidth="1.5"
                  strokeOpacity="0.4"
                  strokeDasharray={sparklineData.length === 0 ? "4 4" : "0"}
                />
              )}
            </svg>
          </div>
        )}

        {/* Children content */}
        {children}

        {/* Footer */}
        {footer && (
          <div className={cn(
            "pt-3 mt-3 border-t",
 isGradient ? "border-white/20" : "border-v2-maroon-600"
          )}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * StatCard - Simple stat card with just value and label
 */
export interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  color?: "green" | "primary" | "purple" | "orange" | "red";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  color = "green",
  size = "md",
  loading = false,
  onClick,
  className,
}: StatCardProps) {
  const colorClasses = {
 green: "text-v2-green-positive bg-v2-green-light",
 primary: "text-v2-red-primary bg-v2-red-light",
 purple: "text-purple-600 bg-purple-50",
 orange: "text-orange-600 bg-orange-50",
 red: "text-red-600 bg-red-50",
  };

  const cardSizeClasses = {
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <div
      className={cn(
 "bg-v2-maroon-800 rounded-xl shadow-md border border-v2-maroon-600",
        "transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        loading && "opacity-70",
        cardSizeClasses[size],
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
 <p className="text-sm text-v2-cream-100 mb-1">
            {label}
          </p>
          {loading ? (
            <div className="animate-pulse">
 <div className="h-7 bg-v2-maroon-600 rounded w-24" />
            </div>
          ) : (
 <p className="text-2xl sm:text-3xl font-bold text-white">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
          )}
          {change !== undefined && (
            <div className={cn(
              "inline-flex items-center gap-1 mt-2 text-sm font-medium",
              change >= 0
 ? "text-v2-green-positive"
 : "text-red-600"
            )}>
              <svg
                className={cn(
                  "w-4 h-4 transition-transform",
                  change < 0 && "rotate-180"
                )}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M12 7l-5 5 1.5 1.5L12 10l3.5 3.5L17 12l-5-5z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{Math.abs(change)}%</span>
              {changeLabel && (
 <span className="text-v2-cream-100 ml-1">
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className={cn(
            "flex-shrink-0 p-3 rounded-xl",
            colorClasses[color]
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
