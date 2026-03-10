"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SuggestedUsersPlaceholderProps {
  className?: string;
}

export function SuggestedUsersPlaceholder({ className }: SuggestedUsersPlaceholderProps) {
  return (
    <div className={cn("bg-white rounded-2xl border border-v2-border-light p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-v2-text-tertiary" />
        <p className="font-vietnam text-xs font-semibold text-v2-text-tertiary uppercase tracking-wider">
          Gợi ý theo dõi
        </p>
      </div>
      <p className="font-vietnam text-sm text-v2-text-tertiary text-center py-4">
        Sắp ra mắt...
      </p>
    </div>
  );
}
