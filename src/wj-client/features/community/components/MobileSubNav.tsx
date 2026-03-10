"use client";

import { Newspaper, Users, User, Bell, Menu } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type MobileNavTab = {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
};

export function MobileSubNav() {
  const tabs: MobileNavTab[] = [
    { label: "Bảng tin", icon: <Newspaper size={18} />, active: true },
    { label: "Nhóm", icon: <Users size={18} />, disabled: true },
    { label: "Hồ sơ", icon: <User size={18} /> },
    { label: "Thông báo", icon: <Bell size={18} />, disabled: true },
  ];

  return (
    <div className="bg-white border-b border-v2-border-light">
      <div className="flex justify-around px-2 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            disabled={tab.disabled}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[56px]",
              tab.active
                ? "text-v2-red-primary"
                : "text-v2-text-tertiary",
              tab.disabled && "opacity-40 cursor-not-allowed"
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
