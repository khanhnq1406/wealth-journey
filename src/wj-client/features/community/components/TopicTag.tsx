"use client";

import { cn } from "@/lib/utils/cn";
import { getTopicTagColor } from "../utils/topic-tags";

interface TopicTagProps {
  value: string;
  className?: string;
}

export function TopicTag({ value, className }: TopicTagProps) {
  if (!value) return null;

  const color = getTopicTagColor(value);

  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded-full text-[11px] font-vietnam font-medium",
        color,
        className
      )}
    >
      {value}
    </span>
  );
}
