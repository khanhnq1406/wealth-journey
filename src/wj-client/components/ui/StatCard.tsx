"use client";

import React from "react";

/**
 * StatCard Component
 *
 * A compact statistics card for dashboard metrics.
 * Part of Phase 4 modular components.
 *
 * Features:
 * - Compact size
 * - Label and value display
 * - Optional change indicator
 * - Responsive grid layout
 * - Dark mode support
 */

export interface StatCardProps {
  /** Stat label */
  label: string;

  /** Stat value */
  value: string | number;

  /** Change from previous period */
  change?: number;

  /** Change label */
  changeLabel?: string;

  /** Icon */
  icon?: React.ReactNode;

  /** Size variant */
  size?: "sm" | "md" | "lg";

  /** CSS class name */
  className?: string;

  /** Click handler */
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  change,
  changeLabel = "vs last month",
  icon,
  size = "md",
  className = "",
  onClick,
}: StatCardProps) {
  const sizeStyles = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  };

 const changeColor = change && change > 0 ? "text-v2-green-positive" : "text-red-600";

  return (
    <div
 className={`bg-v2-maroon-800 rounded-lg p-4 shadow-sm transition-all hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
 <p className="text-sm text-v2-cream-100">{label}</p>
 <p className={`font-semibold ${sizeStyles[size]} text-white mt-1`}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>

          {change !== undefined && (
            <p className={`text-xs mt-1 ${changeColor}`}>
              {change > 0 ? "+" : ""}
              {change}% {changeLabel}
            </p>
          )}
        </div>

        {icon && (
          <div className="ml-3">
 <div className="w-8 h-8 rounded-lg bg-v2-maroon-700 flex items-center justify-center">
              {icon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatCard;
