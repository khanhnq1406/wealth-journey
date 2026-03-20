"use client";

import { cn } from "@/lib/utils/cn";
import { memo } from "react";
import { useTranslations } from "next-intl";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface SidebarToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Toggle button for collapsing/expanding the sidebar
 * Uses PanelLeftClose/PanelLeftOpen lucide icons to indicate direction
 */
export const SidebarToggle = memo(function SidebarToggle({
  isExpanded,
  onToggle,
}: SidebarToggleProps) {
  const t = useTranslations("sidebarToggle");
  return (
    <button
      onClick={onToggle}
      className={cn(
        "hidden sm:flex items-center justify-center h-11 rounded-xl bg-v2-bg-primary hover:bg-v2-bg-surface-tint active:scale-95 transition-all touch-target duration-300 ease-in-out",
        isExpanded ? "w-full" : "w-11",
      )}
      aria-label={isExpanded ? t("collapse") : t("expand")}
      aria-expanded={isExpanded}
      title={isExpanded ? t("collapse") : t("expand")}
    >
      {isExpanded ? (
        <PanelLeftClose className="w-5 h-5 text-v2-gold-primary" />
      ) : (
        <PanelLeftOpen className="w-5 h-5 text-v2-gold-primary" />
      )}
    </button>
  );
});
