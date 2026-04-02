"use client";

import { cn } from "@/lib/utils/cn";
import React, { useState, useCallback, useEffect } from "react";
import { ZIndex } from "@/lib/utils/z-index";
import { XIcon, PlusIcon } from "@/components/icons";
import { Skeleton } from "@/components/loading/Skeleton";

interface FABAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface FABProps {
  actions: FABAction[];
  introContent?: { title: string; text: string; contactInfo: string };
  autoOpen?: boolean;
  isLoading?: boolean;
}

export function FloatingActionButton({
  actions,
  introContent,
  autoOpen,
  isLoading,
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
          "fixed inset-0 bg-neutral-900/60 transition-opacity duration-300",
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
        {/* Unified card: intro + action buttons in one background */}
        <div
          className={cn(
            "transition-all duration-300 mb-3",
            isOpen
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none",
          )}
        >
          <div
            className="bg-v2-maroon-800 border-2 border-v2-gold-primary rounded-2xl overflow-hidden"
            style={{
              boxShadow:
                "0 0 20px rgba(212, 175, 55, 0.3), 0 8px 32px rgba(0, 0, 0, 0.4)",
            }}
          >
            {/* Loading skeleton */}
            {isOpen && isLoading && !introContent && (
              <div className="px-5 pt-4 pb-3" aria-busy="true">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <div className="border-t border-v2-gold-primary/20 mt-3 pt-3">
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            )}

            {/* Intro section */}
            {isOpen && introContent && (
              <div className="px-5 pt-4 pb-3">
                {introContent.title && (
                  <h3 className="text-v2-gold-primary font-bold text-base mb-2">
                    {introContent.title}
                  </h3>
                )}
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

            {/* Action buttons */}
            {isOpen && (
              <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={(event) => handleActionClick(event, action)}
                    className={cn(
                      "flex items-center justify-center gap-2 w-full",
                      "bg-v2-gold-primary rounded-lg",
                      "px-4 py-3 min-h-[44px]",
                      "hover:bg-v2-gold-accent active:scale-[0.98]",
                      "transition-all duration-200",
                    )}
                    style={{
                      transitionDelay: isOpen ? `${index * 50}ms` : "0ms",
                    }}
                    aria-label={action.label}
                  >
                    <div className="flex-shrink-0 w-5 h-5 text-v2-maroon-800">
                      {action.icon}
                    </div>
                    <span className="font-semibold text-v2-maroon-800 whitespace-nowrap">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main FAB button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-14 h-14 bg-v2-red-primary text-white rounded-full border-2 border-v2-gold-primary",
            "flex items-center justify-center",
            "hover:bg-v2-red-dark hover:shadow-xl",
            "active:scale-95",
            "transition-all duration-200",
          )}
          style={{
            minWidth: "56px",
            minHeight: "56px",
            boxShadow: isOpen
              ? "0 0 16px rgba(212, 175, 55, 0.4), 0 0 32px rgba(212, 175, 55, 0.15)"
              : "0 0 12px rgba(220, 38, 38, 0.4)",
          }}
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
