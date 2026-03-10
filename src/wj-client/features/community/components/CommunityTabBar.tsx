"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { TOPIC_TAGS } from "../utils/topic-tags";

interface CommunityTabBarProps {
  className?: string;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function CommunityTabBar({
  className,
  activeFilter,
  onFilterChange,
}: CommunityTabBarProps) {
  return (
    <div className={cn("bg-white border-b border-v2-border-light", className)}>
      <div className="flex gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => onFilterChange("")}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-[13px] font-vietnam font-medium transition-colors",
            activeFilter === ""
              ? "bg-v2-red-primary text-white"
              : "bg-v2-bg-primary text-v2-text-secondary hover:bg-v2-border-light"
          )}
        >
          Tất cả
        </button>
        {TOPIC_TAGS.map((tag) => (
          <button
            key={tag.value}
            onClick={() => onFilterChange(tag.value)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-[13px] font-vietnam font-medium transition-colors",
              activeFilter === tag.value
                ? "bg-v2-red-primary text-white"
                : "bg-v2-bg-primary text-v2-text-secondary hover:bg-v2-border-light"
            )}
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}
