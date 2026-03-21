"use client";

import { memo } from "react";
import ActiveLink from "@/components/ActiveLink";
import { NavTooltip } from "./NavTooltip";
import { cn } from "@/lib/utils/cn";

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  isExpanded?: boolean;
  isPremium?: boolean;
  showTooltip?: boolean;
  animationDelay?: number;
}

/**
 * V2 Navigation item component with Crimson & Gold design system
 * Supports both expanded (icon + label) and collapsed (icon only with tooltip) states
 * isPremium: true for Home and Portfolio items — gives them special collapsed container styling
 */
export const NavItem = memo(function NavItem({
  href,
  label,
  icon,
  isActive = false,
  isExpanded = true,
  isPremium = false,
  showTooltip = false,
  animationDelay = 0,
}: NavItemProps) {
  const linkContent = (
    <div className="relative">
      <ActiveLink
        href={href}
        disableBuiltInActive
        className={cn(
          "flex items-center py-2.5 rounded-[10px] font-roboto text-[14px] transition-all duration-300 ease-in-out touch-target",
          isExpanded
            ? cn(
                "gap-3 px-3",
                isActive
                  ? "text-v2-gold-primary bg-v2-bg-surface-tint font-semibold border-l-3 border-v2-gold-primary"
                  : "text-v2-gold-accent/70 hover:bg-v2-bg-surface-tint font-medium",
              )
            : cn(
                "justify-center px-0 gap-0",
                isActive
                  ? "text-v2-gold-primary font-semibold"
                  : "text-v2-gold-accent/70 font-medium hover:bg-v2-bg-surface-tint",
              ),
        )}
      >
        {isExpanded ? (
          // Expanded state: simple 20×20 icon
          <div className="w-5 h-5 flex-shrink-0">{icon}</div>
        ) : (
          // Collapsed state: 44×44 container with conditional Premium styling
          <div
            className={cn(
              "w-11 h-11 flex items-center justify-center rounded-xl flex-shrink-0",
              isPremium && !isActive && "bg-v2-bg-surface-tint/30",
              // Standard items (not premium): no bg, no border — hover handled by parent link
            )}
          >
            <div className="w-[22px] h-[22px] flex items-center justify-center">
              {icon}
            </div>
          </div>
        )}
        <span
          className={cn(
            "whitespace-nowrap transition-all duration-300 ease-in-out",
            isExpanded
              ? "opacity-100 w-auto translate-x-0"
              : "opacity-0 w-0 overflow-hidden -translate-x-2",
          )}
          style={{
            transitionDelay: isExpanded ? `${animationDelay}ms` : "0ms",
          }}
        >
          {label}
        </span>
      </ActiveLink>
    </div>
  );

  if (!isExpanded && showTooltip) {
    return <NavTooltip content={label}>{linkContent}</NavTooltip>;
  }

  return linkContent;
});
