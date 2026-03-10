"use client";

import { cn } from "@/lib/utils/cn";

interface CommunityRightSidebarProps {
  className?: string;
}

export function CommunityRightSidebar({ className }: CommunityRightSidebarProps) {
  return (
    <aside className={cn("flex flex-col gap-4", className)}>
      {/* Suggested users placeholder */}
      <div className="bg-white rounded-2xl border border-v2-border-light p-4">
        <p className="font-vietnam text-xs font-semibold text-v2-text-tertiary uppercase tracking-wider mb-3">
          Suggested for you
        </p>
        <p className="text-sm font-vietnam text-v2-text-tertiary">
          Coming soon...
        </p>
      </div>

      {/* Trending topics placeholder */}
      <div className="bg-white rounded-2xl border border-v2-border-light p-4">
        <p className="font-vietnam text-xs font-semibold text-v2-text-tertiary uppercase tracking-wider mb-3">
          Trending Topics
        </p>
        <p className="text-sm font-vietnam text-v2-text-tertiary">
          Coming soon...
        </p>
      </div>
    </aside>
  );
}
