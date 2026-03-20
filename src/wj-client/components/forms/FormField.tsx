"use client";

import React, { ReactNode, useId } from "react";
import { cn } from "@/lib/utils/cn";

export interface FormFieldProps {
  /**
   * Field label
   */
  label?: string;

  /**
   * Field content (input, select, etc.)
   */
  children: ReactNode;

  /**
   * Helper text to display below the field
   */
  helperText?: string;

  /**
   * Error message to display
   */
  error?: string;

  /**
   * Success message to display
   */
  success?: string;

  /**
   * Whether the field is required
   */
  required?: boolean;

  /**
   * Additional class name for the container
   */
  className?: string;

  /**
   * Class name for the label
   */
  labelClassName?: string;

  /**
   * Layout direction
   * @default "vertical"
   */
  layout?: "vertical" | "horizontal";

  /**
   * Width of the label in horizontal layout
   */
  labelWidth?: "sm" | "md" | "lg";

  /**
   * Align label in horizontal layout
   */
  labelAlign?: "start" | "center" | "end";
}

export function FormField({
  label,
  children,
  helperText,
  error,
  success,
  required,
  className,
  labelClassName,
  layout = "vertical",
  labelWidth = "md",
  labelAlign = "start",
}: FormFieldProps) {
  const fieldId = useId();
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;
  const successId = `${fieldId}-success`;

  const labelWidthClasses = {
    sm: "w-20 sm:w-24",
    md: "w-32 sm:w-40",
    lg: "w-40 sm:w-48",
  };

  const labelAlignClasses = {
    start: "text-left",
    center: "text-center",
    end: "text-right",
  };

  const containerClasses = cn(
    "w-full",
    {
      "flex flex-col": layout === "vertical",
      "flex flex-row items-start gap-4": layout === "horizontal",
    },
    className
  );

  const labelClasses = cn(
    "text-sm font-medium mb-1.5",
    {
      "mb-0 sm:pt-3": layout === "horizontal",
      "flex-shrink-0": layout === "horizontal",
    },
    labelWidthClasses[labelWidth],
    labelAlignClasses[labelAlign],
    error
 ? "text-v2-red-negative"
      : success
 ? "text-v2-green-positive"
 : "text-v2-text-secondary",
    labelClassName
  );

  return (
    <div className={containerClasses}>
      {label && (
        <label
          htmlFor={fieldId}
          className={labelClasses}
        >
          {label}
          {required && <span className="text-v2-red-negative ml-1">*</span>}
        </label>
      )}

      <div className="flex-1 min-w-0">
        {children}

        {/* Helper text, error, or success message */}
        {(helperText || error || success) && (
          <div className="mt-1.5 min-h-[20px]">
            {error && (
              <p
                id={errorId}
 className="text-sm text-v2-red-negative flex items-center gap-1"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </p>
            )}
            {success && !error && (
              <p
                id={successId}
 className="text-sm text-v2-green-positive flex items-center gap-1"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{success}</span>
              </p>
            )}
            {helperText && !error && !success && (
              <p
                id={helperId}
 className="text-sm text-v2-text-tertiary"
              >
                {helperText}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * FormFieldGroup - Wrapper for related form fields
 */
export interface FormFieldGroupProps {
  /**
   * Group title
   */
  title?: string;

  /**
   * Group description
   */
  description?: string;

  /**
   * Field children
   */
  children: ReactNode;

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Whether the group is collapsible
   */
  collapsible?: boolean;

  /**
   * Default collapsed state
   */
  defaultCollapsed?: boolean;

  /**
   * Whether to show a border
   * @default true
   */
  bordered?: boolean;
}

export function FormFieldGroup({
  title,
  description,
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
  bordered = true,
}: FormFieldGroupProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  return (
    <div
      className={cn(
        "rounded-lg",
 bordered && "border border-v2-border-light p-4 sm:p-6",
        !bordered && "space-y-4",
        className
      )}
    >
      {(title || description) && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {title && (
 <h3 className="text-base font-semibold text-white">
                {title}
              </h3>
            )}
            {description && (
 <p className="mt-1 text-sm text-v2-text-tertiary">
                {description}
              </p>
            )}
          </div>
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
 className="flex-shrink-0 p-2 rounded-md hover:bg-v2-bg-surface-tint transition-colors"
              aria-expanded={!isCollapsed}
            >
              <svg
                className={cn(
                  "w-5 h-5 text-v2-text-tertiary transition-transform duration-200",
                  isCollapsed && "-rotate-90"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className={cn(
          bordered && "mt-4 space-y-4",
          !bordered && "space-y-4"
        )}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * FormFieldRow - Horizontal layout for multiple fields
 */
export interface FormFieldRowProps {
  /**
   * Field children
   */
  children: ReactNode;

  /**
   * Number of columns on mobile
   * @default 1
   */
  cols?: 1 | 2;

  /**
   * Number of columns on desktop
   * @default 2
   */
  smCols?: 2 | 3 | 4;

  /**
   * Gap between fields
   * @default "md"
   */
  gap?: "sm" | "md" | "lg";

  /**
   * Additional class name
   */
  className?: string;
}

export function FormFieldRow({
  children,
  cols = 1,
  smCols = 2,
  gap = "md",
  className,
}: FormFieldRowProps) {
  const gapClasses = {
    sm: "gap-2 sm:gap-3",
    md: "gap-3 sm:gap-4",
    lg: "gap-4 sm:gap-6",
  };

  const colsClasses = {
    1: "grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
  };

  return (
    <div
      className={cn(
        "grid",
        cols === 2 ? "grid-cols-2" : "grid-cols-1",
        colsClasses[smCols],
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}
