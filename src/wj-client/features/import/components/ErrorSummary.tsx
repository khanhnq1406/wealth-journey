"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { ValidationError } from "@/gen/protobuf/v1/import";

export interface ErrorSummaryProps {
  errors: Array<{ rowNumber: number; errors: ValidationError[] }>;
}

type SeverityFilter = "all" | "error" | "warning" | "info";

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("w-5 h-5 transition-transform", className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-5 h-5", className)} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ErrorSummary({ errors }: ErrorSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  // Count errors by severity
  const allErrors = errors.flatMap((e) => e.errors);
  const errorCount = allErrors.filter((e) => e.severity === "error").length;
  const warningCount = allErrors.filter((e) => e.severity === "warning").length;
  const infoCount = allErrors.filter((e) => e.severity === "info").length;

  // Filter errors based on selected severity
  const filteredErrors = errors
    .map((row) => ({
      rowNumber: row.rowNumber,
      errors:
        severityFilter === "all"
          ? row.errors
          : row.errors.filter((e) => e.severity === severityFilter),
    }))
    .filter((row) => row.errors.length > 0);

  if (errors.length === 0) {
    return null;
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800";
      case "info":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
      default:
        return "bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700";
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case "error":
        return "bg-red-600 text-white dark:bg-red-700";
      case "warning":
        return "bg-yellow-600 text-white dark:bg-yellow-700";
      case "info":
        return "bg-blue-600 text-white dark:bg-blue-700";
      default:
        return "bg-neutral-600 text-white dark:bg-neutral-700";
    }
  };

  return (
    <div
      className={cn(
        "border-2 rounded-lg overflow-hidden",
        errorCount > 0
          ? "border-red-300 dark:border-red-800"
          : "border-yellow-300 dark:border-yellow-800",
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between",
          "hover:opacity-90 transition-opacity",
          errorCount > 0
            ? "bg-red-50 dark:bg-red-950"
            : "bg-yellow-50 dark:bg-yellow-950",
        )}
      >
        <div className="flex items-center gap-3">
          <AlertCircleIcon
            className={
              errorCount > 0
                ? "text-red-600 dark:text-red-400"
                : "text-yellow-600 dark:text-yellow-400"
            }
          />
          <div className="text-left">
            <h3
              className={cn(
                "font-semibold text-base",
                errorCount > 0
                  ? "text-red-900 dark:text-red-200"
                  : "text-yellow-900 dark:text-yellow-200",
              )}
            >
              {errorCount > 0 ? "Validation Errors Found" : "Warnings Found"}
            </h3>
            <p
              className={cn(
                "text-sm",
                errorCount > 0
                  ? "text-red-700 dark:text-red-300"
                  : "text-yellow-700 dark:text-yellow-300",
              )}
            >
              {errorCount > 0 && `${errorCount} error${errorCount !== 1 ? "s" : ""}`}
              {errorCount > 0 && warningCount > 0 && ", "}
              {warningCount > 0 &&
                `${warningCount} warning${warningCount !== 1 ? "s" : ""}`}
              {infoCount > 0 &&
                `, ${infoCount} info message${infoCount !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <ChevronDownIcon
          className={cn(
            "flex-shrink-0",
            isExpanded && "rotate-180",
            errorCount > 0
              ? "text-red-600 dark:text-red-400"
              : "text-yellow-600 dark:text-yellow-400",
          )}
        />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="bg-white dark:bg-dark-surface border-t border-neutral-200 dark:border-dark-border">
          {/* Severity Filter */}
          <div className="px-4 py-3 bg-neutral-50 dark:bg-dark-surface-hover border-b border-neutral-200 dark:border-dark-border">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSeverityFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[44px] sm:min-h-[36px]",
                  severityFilter === "all"
                    ? "bg-primary-600 text-white dark:bg-primary-700"
                    : "bg-white dark:bg-dark-surface text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-dark-surface-active",
                )}
              >
                All ({allErrors.length})
              </button>
              {errorCount > 0 && (
                <button
                  onClick={() => setSeverityFilter("error")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[44px] sm:min-h-[36px]",
                    severityFilter === "error"
                      ? "bg-red-600 text-white dark:bg-red-700"
                      : "bg-white dark:bg-dark-surface text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-dark-surface-active",
                  )}
                >
                  Errors ({errorCount})
                </button>
              )}
              {warningCount > 0 && (
                <button
                  onClick={() => setSeverityFilter("warning")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[44px] sm:min-h-[36px]",
                    severityFilter === "warning"
                      ? "bg-yellow-600 text-white dark:bg-yellow-700"
                      : "bg-white dark:bg-dark-surface text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-dark-surface-active",
                  )}
                >
                  Warnings ({warningCount})
                </button>
              )}
              {infoCount > 0 && (
                <button
                  onClick={() => setSeverityFilter("info")}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-h-[44px] sm:min-h-[36px]",
                    severityFilter === "info"
                      ? "bg-blue-600 text-white dark:bg-blue-700"
                      : "bg-white dark:bg-dark-surface text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-dark-surface-active",
                  )}
                >
                  Info ({infoCount})
                </button>
              )}
            </div>
          </div>

          {/* Error List */}
          <div className="max-h-[40vh] overflow-y-auto">
            {filteredErrors.map((row) => (
              <div
                key={row.rowNumber}
                className="px-4 py-3 border-b border-neutral-200 dark:border-dark-border last:border-b-0"
              >
                <div className="font-semibold text-sm text-neutral-900 dark:text-dark-text mb-2">
                  Row {row.rowNumber}
                </div>
                <div className="space-y-2">
                  {row.errors.map((error, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-md border text-sm",
                        getSeverityColor(error.severity),
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase flex-shrink-0 mt-0.5",
                          getSeverityBadgeColor(error.severity),
                        )}
                      >
                        {error.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{error.field}:</span>{" "}
                        {error.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
