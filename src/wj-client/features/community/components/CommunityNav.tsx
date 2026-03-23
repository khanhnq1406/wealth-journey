"use client";

import { Newspaper, User, Bookmark, Users, Bell } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NavView = "feed" | "profile" | "saved" | "following" | "notifications";

type NavItem = {
  label: string;
  icon: React.ReactNode;
  view: NavView;
};

interface CommunityNavProps {
  activeView?: NavView;
  onViewChange?: (view: NavView) => void;
}

export function CommunityNav({ activeView = "feed", onViewChange }: CommunityNavProps) {
  const navItems: NavItem[] = [
    { label: "Bảng tin", icon: <Newspaper size={18} />, view: "feed" },
    { label: "Hồ sơ", icon: <User size={18} />, view: "profile" },
    { label: "Bài đã lưu", icon: <Bookmark size={18} />, view: "saved" },
    { label: "Đang theo dõi", icon: <Users size={18} />, view: "following" },
    { label: "Thông báo", icon: <Bell size={18} />, view: "notifications" },
  ];

  return (
    <div className="bg-v2-maroon-800 rounded-2xl border border-v2-border-light p-3">
      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => onViewChange?.(item.view)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors font-roboto text-[14px]",
              activeView === item.view
                ? "bg-v2-gold-primary/20 text-v2-gold-primary font-semibold"
                : "text-v2-text-secondary hover:bg-v2-maroon-600"
            )}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
