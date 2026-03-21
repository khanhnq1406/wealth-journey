"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SuggestedUsersPlaceholderProps {
  className?: string;
}

export function SuggestedUsersPlaceholder({ className }: SuggestedUsersPlaceholderProps) {
  return (
    <div className={cn("bg-v2-maroon-800 rounded-2xl border border-v2-border-light p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-v2-text-tertiary" />
        <p className="font-roboto text-xs font-semibold text-v2-text-tertiary uppercase tracking-wider">
          Gợi ý theo dõi
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-4 h-4 border-2 border-v2-text-tertiary border-t-transparent rounded-full animate-spin" />
        <p className="font-roboto text-sm text-v2-text-tertiary">
          Đang tải...
        </p>
      </div>
    </div>
  );
}
