import { memo } from "react";
import { cn } from "@/lib/utils/cn";

interface ProgressBarProps {
  percentage: number; // 0-100
  label?: string;
  variant?: "primary" | "accent" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  showPercentage?: boolean;
  className?: string;
}

export const ProgressBar = memo(function ProgressBar({
  percentage,
  label,
  variant = "primary",
  size = "md",
  showPercentage = false,
  className,
}: ProgressBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  const variantClasses = {
    primary: "bg-primary-500",
    accent: "bg-accent-500",
    success: "bg-accent-500",
    warning: "bg-warning-500",
    danger: "bg-danger-500",
  };

  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={cn("w-full", className)}>
      {(label || showPercentage) && (
 <div className="flex items-center justify-between text-xs text-neutral-600 mb-1.5">
          {label && <span>{label}</span>}
          {showPercentage && (
            <span className="font-medium tabular-nums">
              {clampedPercentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
 "w-full bg-neutral-200 rounded-full overflow-hidden",
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={clampedPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `${clampedPercentage}% complete`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            variantClasses[variant]
          )}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
});
