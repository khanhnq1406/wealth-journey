"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BaseCard } from "@/components/BaseCard";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils/cn";

interface FeedbackItemProps {
  subject: string;
  message: string;
  status: number;
  createdAt: number;
}

export function FeedbackItem({
  subject,
  message,
  status,
  createdAt,
}: FeedbackItemProps) {
  const [expanded, setExpanded] = useState(false);

  const formattedDate = new Date(createdAt * 1000).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" }
  );

  const preview = message.length > 100 ? message.slice(0, 100) + "..." : message;

  return (
    <BaseCard padding="none">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex flex-col gap-2"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-vietnam text-sm font-semibold text-v2-text-primary truncate flex-1">
            {subject}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={status} />
            <ChevronDown
              size={16}
              className={cn(
                "text-v2-text-tertiary transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-v2-text-tertiary font-vietnam">
          <span>{formattedDate}</span>
        </div>
        {!expanded && (
          <p className="text-sm text-v2-text-secondary font-vietnam line-clamp-2">
            {preview}
          </p>
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-v2-border-light pt-3">
          <p className="text-sm text-v2-text-secondary font-vietnam whitespace-pre-wrap">
            {message}
          </p>
        </div>
      )}
    </BaseCard>
  );
}
