"use client";

import { ChangeEvent } from "react";
import { cn } from "@/lib/utils/cn";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  label?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  "aria-label"?: string;
}

export function Checkbox({
  checked,
  onChange,
  disabled = false,
  className = "",
  id,
  label,
  description,
  size = "md",
  "aria-label": ariaLabel,
}: CheckboxProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  const sizeClasses = {
    sm: "w-5 h-5", // 20px
    md: "w-6 h-6", // 24px (minimum touch target)
    lg: "w-7 h-7", // 28px
  };

  const checkbox = (
    <input
      type="checkbox"
      id={id}
      name={id}
      checked={checked}
      onChange={handleChange}
      disabled={disabled}
      className={cn(
 "rounded border-neutral-300",
 "text-primary-500",
        "focus:ring-2 focus:ring-primary-500 focus:ring-offset-0",
 "",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "cursor-pointer transition-colors duration-200",
 "",
        sizeClasses[size],
        className
      )}
      aria-label={ariaLabel || label}
      aria-checked={checked}
      aria-describedby={description ? `${id}-description` : undefined}
    />
  );

  // If label is provided, wrap checkbox with label for larger hit target
  if (label) {
    return (
      <label
        className={cn(
          "inline-flex items-start gap-3 cursor-pointer min-h-[44px]",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex-shrink-0 pt-0.5">{checkbox}</div>
        <div className="flex-1">
 <span className="text-sm font-medium text-neutral-900">
            {label}
          </span>
          {description && (
            <p
              id={`${id}-description`}
 className="text-xs text-neutral-500 mt-0.5"
            >
              {description}
            </p>
          )}
        </div>
      </label>
    );
  }

  return checkbox;
}
