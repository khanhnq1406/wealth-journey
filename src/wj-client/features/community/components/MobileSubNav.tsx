"use client";

import { Newspaper, Bookmark, User, Bell } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type MobileNavView = "feed" | "saved" | "profile" | "notifications";

type MobileNavTab = {
  label: string;
  icon: React.ReactNode;
  view: MobileNavView;
};

interface MobileSubNavProps {
  activeView?: MobileNavView;
  onViewChange?: (view: MobileNavView) => void;
}

export function MobileSubNav({ activeView = "feed", onViewChange }: MobileSubNavProps) {
  const tabs: MobileNavTab[] = [
    { label: "Bảng tin", icon: <Newspaper size={18} />, view: "feed" },
    { label: "Đã lưu", icon: <Bookmark size={18} />, view: "saved" },
    { label: "Hồ sơ", icon: <User size={18} />, view: "profile" },
    { label: "Thông báo", icon: <Bell size={18} />, view: "notifications" },
  ];

  return (
    <div className="sticky top-0 z-[5] bg-v2-maroon-800 border-b border-v2-border-light">
      <div className="flex justify-around px-2 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => onViewChange?.(tab.view)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[56px]",
              activeView === tab.view
                ? "text-v2-red-primary"
                : "text-v2-text-tertiary hover:text-v2-text-secondary"
            )}
          >
            {tab.icon}
            <span className="font-vietnam text-[10px] font-medium">
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
