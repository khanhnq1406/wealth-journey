"use client";

import { cn } from "@/lib/utils/cn";
import { ProfileCard } from "./ProfileCard";
import { CommunityNav } from "./CommunityNav";

interface CommunityLeftSidebarProps {
  className?: string;
  currentUser: { id: number; name: string; picture: string };
}

export function CommunityLeftSidebar({ className, currentUser }: CommunityLeftSidebarProps) {
  return (
    <aside className={cn("flex flex-col gap-4", className)}>
      <ProfileCard currentUser={currentUser} />
      <CommunityNav />
    </aside>
  );
}
