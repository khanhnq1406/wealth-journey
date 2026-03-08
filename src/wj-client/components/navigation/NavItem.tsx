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
  showTooltip?: boolean;
  animationDelay?: number;
}

/**
 * V2 Navigation item component with Crimson & Gold design system
 * Supports both expanded (icon + label) and collapsed (icon only with tooltip) states
 */
export const NavItem = memo(function NavItem({
  href,
  label,
  icon,
  isActive = false,
  isExpanded = true,
  showTooltip = false,
  animationDelay = 0,
}: NavItemProps) {
  const linkContent = (
    <div className="relative">
      <ActiveLink
        href={href}
        className={cn(
          "flex items-center py-2.5 rounded-xl font-sora text-[14px] font-medium transition-all duration-300 ease-in-out touch-target",
          isActive
            ? "text-v2-red-primary bg-v2-red-light"
            : "text-v2-text-secondary hover:bg-v2-bg-primary",
          isExpanded ? "gap-3 px-3" : "justify-center px-0 gap-0",
        )}
      >
        <div
          className={cn(
            "w-5 h-5 flex-shrink-0 transition-all duration-300 ease-in-out",
            !isExpanded && "mx-auto scale-110",
          )}
        >
          {icon}
        </div>
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
