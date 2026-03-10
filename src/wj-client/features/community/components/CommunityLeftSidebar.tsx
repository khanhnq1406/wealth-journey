"use client";

import { cn } from "@/lib/utils/cn";
import { ProfileCard } from "./ProfileCard";
import { CommunityNav } from "./CommunityNav";

type NavView = "feed" | "profile" | "saved" | "following" | "notifications";

interface CommunityLeftSidebarProps {
  className?: string;
  currentUser: { id: number; name: string; picture: string };
  activeView?: NavView;
  onViewChange?: (view: NavView) => void;
}

export function CommunityLeftSidebar({ className, currentUser, activeView, onViewChange }: CommunityLeftSidebarProps) {
  return (
    <aside className={cn("flex flex-col gap-4", className)}>
      <ProfileCard currentUser={currentUser} />
      <CommunityNav activeView={activeView} onViewChange={onViewChange} />
    </aside>
  );
}
