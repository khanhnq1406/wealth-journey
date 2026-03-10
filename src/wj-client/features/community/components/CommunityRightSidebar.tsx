"use client";

import { cn } from "@/lib/utils/cn";
import { SuggestedUsers } from "./SuggestedUsers";
import { TrendingTopics } from "./TrendingTopics";

interface CommunityRightSidebarProps {
  className?: string;
  onHashtagClick?: (tag: string) => void;
}

export function CommunityRightSidebar({ className, onHashtagClick }: CommunityRightSidebarProps) {
  return (
    <aside className={cn("flex flex-col gap-4", className)}>
      <SuggestedUsers />
      <TrendingTopics onHashtagClick={onHashtagClick} />
    </aside>
  );
}
