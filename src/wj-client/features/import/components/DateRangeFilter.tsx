"use client";

import React, { useState } from "react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils/cn";
import { ChevronDownIcon } from "@/components/icons";

export interface DateRangeFilterProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (startDate: Date | null, endDate: Date | null) => void;
  transactionCount: number;
}

export const DateRangeFilter = React.memo(function DateRangeFilter({
  startDate,
  endDate,
  onChange,
  transactionCount,
}: DateRangeFilterProps) {
  const [expanded, setExpanded] = useState(false);

  const quickFilters = [
    { label: "Last 7 Days", days: 7 },
    { label: "Last 30 Days", days: 30 },
    { label: "This Month", type: "thisMonth" as const },
    { label: "Last Month", type: "lastMonth" as const },
  ];

  const handleQuickFilter = (filter: typeof quickFilters[0]) => {
    const now = new Date();
    let start: Date;
    let end = now;

    if ("days" in filter && filter.days) {
      start = new Date(now);
      start.setDate(start.getDate() - filter.days);
    } else if ("type" in filter && filter.type === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if ("type" in filter && filter.type === "lastMonth") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      return;
    }

    onChange(start, end);
  };

  const handleClear = () => {
    onChange(null, null);
  };

  const isFiltered = startDate !== null || endDate !== null;

  return (
 <div className="border border-v2-border-light rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
 className="w-full flex items-center justify-between p-4 hover:bg-v2-bg-surface-tint transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">📅</span>
          <div className="text-left">
 <h3 className="font-semibold text-sm text-v2-gold-accent">
              Date Range Filter
            </h3>
            {isFiltered ? (
 <p className="text-xs text-v2-gold-primary">
                {startDate?.toLocaleDateString("vi-VN")} -{" "}
                {endDate?.toLocaleDateString("vi-VN")}
              </p>
            ) : (
 <p className="text-xs text-v2-text-tertiary">
                All dates ({transactionCount} transactions)
              </p>
            )}
          </div>
        </div>
        <ChevronDownIcon
          size="sm"
          className={cn(
 "transition-transform text-v2-text-secondary",
            expanded && "rotate-180"
          )}
          decorative
        />
      </button>

      {expanded && (
 <div className="p-4 border-t border-v2-border-light space-y-4">
          {/* Quick Filters */}
          <div className="space-y-2">
 <p className="text-xs font-medium text-v2-text-secondary">
              Quick Filters
            </p>
            <div className="grid grid-cols-2 gap-2">
              {quickFilters.map((filter) => (
                <button
                  key={filter.label}
                  onClick={() => handleQuickFilter(filter)}
 className="px-3 py-2 text-xs bg-v2-bg-dark text-v2-text-secondary rounded-lg hover:bg-v2-bg-surface-tint transition-colors"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="space-y-2">
 <p className="text-xs font-medium text-v2-text-secondary">
              Custom Range
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={startDate?.toISOString().split("T")[0] || ""}
                onChange={(e) =>
                  onChange(e.target.value ? new Date(e.target.value) : null, endDate)
                }
 className="px-3 py-2 text-sm border border-v2-border-light rounded-lg bg-v2-bg-surface text-v2-gold-accent"
              />
              <input
                type="date"
                value={endDate?.toISOString().split("T")[0] || ""}
                onChange={(e) =>
                  onChange(startDate, e.target.value ? new Date(e.target.value) : null)
                }
 className="px-3 py-2 text-sm border border-v2-border-light rounded-lg bg-v2-bg-surface text-v2-gold-accent"
              />
            </div>
          </div>

          {/* Clear Filter */}
          {isFiltered && (
            <Button variant="secondary" onClick={handleClear} fullWidth size="sm">
              Clear Filter
            </Button>
          )}
        </div>
      )}
    </div>
  );
});
