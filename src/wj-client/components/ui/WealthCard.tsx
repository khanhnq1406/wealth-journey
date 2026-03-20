"use client";

import React from "react";
import { BaseCard } from "../BaseCard";

/**
 * WealthCard Component
 *
 * A card component for displaying financial summary information.
 * Part of Phase 4 modular components.
 *
 * Features:
 * - Icon support
 * - Value display with formatting
 * - Optional trend indicator
 * - Responsive design
 * - Dark mode support
 */

export interface WealthCardProps {
  /** Card title */
  title: string;

  /** Main value to display */
  value: string | number;

  /** Optional icon */
  icon?: React.ReactNode;

  /** Trend percentage (positive or negative) */
  trend?: number;

  /** Currency symbol */
  currency?: string;

  /** Optional subtitle */
  subtitle?: string;

  /** Color variant */
  variant?: "default" | "success" | "warning" | "danger" | "info";

  /** CSS class name */
  className?: string;

  /** Click handler */
  onClick?: () => void;
}

export function WealthCard({
  title,
  value,
  icon,
  trend,
  currency = "",
  subtitle,
  variant = "default",
  className = "",
  onClick,
}: WealthCardProps) {
  const variantStyles = {
 default: "text-gray-900",
    success: "text-v2-green-positive",
 warning: "text-yellow-600",
 danger: "text-red-600",
 info: "text-primary-600",
  };

  const trendColor = trend && trend > 0 ? "text-v2-green-positive" : trend && trend < 0 ? "text-red-600" : "text-gray-500";

  const displayValue = typeof value === "number" && currency ? `${currency}${value.toLocaleString()}` : value;

  return (
    <BaseCard
      className={`p-4 transition-all hover:shadow-lg ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
 <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${variantStyles[variant]}`}>
            {displayValue}
          </p>

          {subtitle && (
 <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}

          {trend !== undefined && (
            <p className={`text-xs mt-1 ${trendColor}`}>
              {trend > 0 ? "+" : ""}
              {trend}%
            </p>
          )}
        </div>

        {icon && (
          <div className="ml-4 flex-shrink-0">
 <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              {icon}
            </div>
          </div>
        )}
      </div>
    </BaseCard>
  );
}

export default WealthCard;
