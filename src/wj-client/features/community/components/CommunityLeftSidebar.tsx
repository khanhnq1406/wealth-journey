"use client";

import { cn } from "@/lib/utils/cn";

interface CommunityLeftSidebarProps {
  className?: string;
}

export function CommunityLeftSidebar({ className }: CommunityLeftSidebarProps) {
  return (
    <aside className={cn("flex flex-col gap-4", className)}>
      {/* Profile card placeholder — will be filled in Task 14 */}
      <div className="bg-white rounded-2xl border border-v2-border-light p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-v2-gold-primary to-v2-gold-accent flex items-center justify-center">
            <span className="text-white font-vietnam font-semibold text-sm">U</span>
          </div>
          <div>
            <p className="font-vietnam text-sm font-semibold text-v2-text-primary">My Profile</p>
            <p className="font-jetbrains text-xs text-v2-text-tertiary">Community member</p>
          </div>
        </div>
      </div>

      {/* Quick nav placeholder */}
      <div className="bg-white rounded-2xl border border-v2-border-light p-4">
        <p className="font-vietnam text-xs font-semibold text-v2-text-tertiary uppercase tracking-wider mb-3">
          Quick Links
        </p>
        <div className="flex flex-col gap-1 text-sm font-vietnam text-v2-text-secondary">
          <span className="py-1.5">My Posts</span>
          <span className="py-1.5">Saved</span>
          <span className="py-1.5">Following</span>
        </div>
      </div>
    </aside>
  );
}
