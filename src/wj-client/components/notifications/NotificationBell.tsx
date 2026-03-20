"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils/cn";
import { useNotificationCount } from "@/features/community/hooks/useNotifications";
import { EVENT_CommunityGetUnreadNotificationCount } from "@/utils/generated/hooks";
import { NotificationPanel } from "./NotificationPanel";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { count } = useNotificationCount();

  // Invalidate unread count when panel opens so badge syncs with panel list
  useEffect(() => {
    if (isOpen) {
      queryClient.invalidateQueries({
        queryKey: [EVENT_CommunityGetUnreadNotificationCount],
      });
    }
  }, [isOpen, queryClient]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          isOpen ? "bg-v2-bg-primary text-v2-text-primary" : "text-v2-text-secondary hover:bg-v2-bg-primary"
        )}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-[#DC2626] text-white text-[10px] font-bold rounded-full px-0.5">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-v2-maroon-800 rounded-2xl shadow-lg border border-v2-border-light z-50 overflow-hidden">
          <NotificationPanel onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}
