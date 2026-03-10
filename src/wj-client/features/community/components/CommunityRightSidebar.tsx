"use client";

import { cn } from "@/lib/utils/cn";
import { SuggestedUsersPlaceholder } from "./SuggestedUsersPlaceholder";
import { TrendingUp } from "lucide-react";

interface CommunityRightSidebarProps {
  className?: string;
}

export function CommunityRightSidebar({ className }: CommunityRightSidebarProps) {
  return (
    <aside className={cn("flex flex-col gap-4", className)}>
      <SuggestedUsersPlaceholder />

      {/* Trending topics placeholder */}
      <div className="bg-white rounded-2xl border border-v2-border-light p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-v2-text-tertiary" />
          <p className="font-vietnam text-xs font-semibold text-v2-text-tertiary uppercase tracking-wider">
            Chủ đề nổi bật
          </p>
        </div>
        <p className="font-vietnam text-sm text-v2-text-tertiary text-center py-4">
          Sắp ra mắt...
        </p>
      </div>
    </aside>
  );
}
