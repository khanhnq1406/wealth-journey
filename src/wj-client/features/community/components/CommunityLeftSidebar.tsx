"use client";

import { cn } from "@/lib/utils/cn";
import { ProfileCard } from "./ProfileCard";
import { CommunityNav } from "./CommunityNav";

interface CommunityLeftSidebarProps {
  className?: string;
}

export function CommunityLeftSidebar({ className }: CommunityLeftSidebarProps) {
  return (
    <aside className={cn("flex flex-col gap-4", className)}>
      <ProfileCard />
      <CommunityNav />
    </aside>
  );
}
