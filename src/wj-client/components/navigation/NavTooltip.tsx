"use client";

import { memo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ZIndex } from "@/lib/utils/z-index";

interface NavTooltipProps {
  children: React.ReactNode;
  content: string;
  disabled?: boolean;
}

/**
 * Tooltip component for navigation items in collapsed state
 * Appears on hover to the right of icons
 */
export const NavTooltip = memo(function NavTooltip({
  children,
  content,
  disabled = false,
}: NavTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (disabled) return;

    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: rect.top + rect.height / 2,
          left: rect.right + 12, // 12px gap from sidebar
        });
        setIsVisible(true);
      }
    }, 300); // 300ms delay before showing
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {isVisible &&
        !disabled &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            className="fixed pointer-events-none"
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              transform: "translateY(-50%)",
              zIndex: ZIndex.tooltip,
            }}
          >
 <div className="bg-v2-bg-dark text-white text-sm font-medium px-3 py-2 rounded-lg shadow-dropdown whitespace-nowrap animate-fade-in">
              {content}
            </div>
          </div>,
          document.body
        )}
    </>
  );
});
