"use client";

import { Newspaper, User, Bookmark, Users, Bell } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  onClick?: () => void;
};

export function CommunityNav() {
  const navItems: NavItem[] = [
    {
      label: "Bảng tin",
      icon: <Newspaper size={18} />,
      active: true,
    },
    {
      label: "Hồ sơ",
      icon: <User size={18} />,
    },
    {
      label: "Bài đã lưu",
      icon: <Bookmark size={18} />,
      disabled: true,
      disabledLabel: "Phase 2",
    },
    {
      label: "Đang theo dõi",
      icon: <Users size={18} />,
    },
    {
      label: "Thông báo",
      icon: <Bell size={18} />,
      disabled: true,
      disabledLabel: "Phase 2",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-v2-border-light p-3">
      <nav className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            disabled={item.disabled}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors font-vietnam text-[14px]",
              item.active
                ? "bg-v2-red-light text-v2-red-primary font-semibold"
                : "text-v2-text-secondary hover:bg-[#FAF9F7]",
              item.disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.disabledLabel && (
              <span className="font-jetbrains text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-v2-text-tertiary">
                {item.disabledLabel}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
