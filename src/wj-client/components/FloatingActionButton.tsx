"use client";

import { cn } from "@/lib/utils/cn";
import React, { useState, useCallback, useEffect } from "react";
import { ZIndex } from "@/lib/utils/z-index";
import { XIcon, PlusIcon } from "@/components/icons";

interface FABAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface FABProps {
  actions: FABAction[];
  introContent?: { text: string; contactInfo: string };
  autoOpen?: boolean;
}

export function FloatingActionButton({
  actions,
  introContent,
  autoOpen,
}: FABProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (autoOpen) {
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [autoOpen]);

  const handleActionClick = useCallback(
    (
      event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
      action: FABAction,
    ) => {
      event.preventDefault();
      action.onClick();
      setIsOpen(false);
    },
    [],
  );

  return (
    <>
      {/* Backdrop when expanded */}
      <div
        className={cn(
          "fixed inset-0 bg-neutral-900/20 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        style={{ zIndex: ZIndex.floating }}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* FAB Container */}
      <div
        className="fixed right-3 sm:right-6 sm:!bottom-6 flex flex-col items-end"
        style={{
          zIndex: ZIndex.floating + 1,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)",
        }}
      >
        {/* Intro card (above action buttons) */}
        {isOpen && introContent && (
          <div className="bg-v2-maroon-800 border border-v2-gold-primary/30 rounded-2xl px-5 py-4 mb-1">
            <p className="text-v2-gold-accent text-sm leading-relaxed">
              {introContent.text}
            </p>
            <div className="border-t border-v2-gold-primary/20 mt-3 pt-3">
              <p className="text-v2-text-tertiary text-xs">
                {introContent.contactInfo}
              </p>
            </div>
          </div>
        )}

        {/* Action buttons (expand upward) */}
        <div
          className={cn(
            "flex flex-col-reverse gap-3 mb-3 transition-all duration-300",
            isOpen
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none",
          )}
        >
          {isOpen &&
            actions.map((action, index) => (
              <button
                key={index}
                onClick={(event) => handleActionClick(event, action)}
                className={cn(
                  "flex items-center gap-3 bg-v2-maroon-800 shadow-floating rounded-full",
                  "px-4 py-3 min-h-[56px]",
                  "hover:shadow-xl active:scale-95",
                  "transition-all duration-200",
                  "transform",
                  "relative",
                )}
                style={{
                  transitionDelay: isOpen ? `${index * 50}ms` : "0ms",
                }}
                aria-label={action.label}
              >
                <div className="flex-shrink-0 w-6 h-6 text-v2-red-primary">
                  {action.icon}
                </div>
                <span className="font-medium text-v2-gold-accent whitespace-nowrap pr-2">
                  {action.label}
                </span>
              </button>
            ))}
        </div>

        {/* Main FAB button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-14 h-14 bg-v2-red-primary text-white rounded-full shadow-floating",
            "flex items-center justify-center",
            "hover:bg-v2-red-dark hover:shadow-xl",
            "active:scale-95",
            "transition-all duration-200",
            isOpen && "rotate-45",
          )}
          style={{ minWidth: "56px", minHeight: "56px" }}
          aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
          aria-expanded={isOpen}
        >
          <div
            className="flex-shrink-0 h-8"
            style={{ minWidth: "24px", minHeight: "24px" }}
          >
            {isOpen ? (
              <XIcon size="xl" className="text-white" decorative />
            ) : (
              <PlusIcon size="xl" className="text-white" decorative />
            )}
          </div>
        </button>
      </div>
    </>
  );
}

// Re-export for backward compatibility if needed
export default FloatingActionButton;
