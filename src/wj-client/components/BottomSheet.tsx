"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import { ZIndex } from "@/lib/utils/z-index";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

// Swipe threshold to close (in pixels)
const SWIPE_THRESHOLD = 100;
// Minimum velocity to close (pixels per millisecond)
const MIN_VELOCITY = 0.3;

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Swipe gesture state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset drag state when sheet opens/closes
  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => {
        setDragOffset(0);
        setIsDragging(false);
      });
      touchStartRef.current = null;
    }
  }, [isOpen]);

  // Touch start - begin tracking swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      y: touch.clientY,
      time: Date.now(),
    };
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  // Touch move - track drag position
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Only allow dragging downward (positive deltaY)
    if (deltaY > 0) {
      setIsDragging(true);
      setDragOffset(deltaY);

      // Prevent content from scrolling while dragging the sheet
      if (deltaY > 10) {
        e.preventDefault();
      }
    }
  }, []);

  // Touch end - determine if we should close
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const velocity = deltaY / deltaTime;

    // Close if dragged past threshold OR has sufficient downward velocity
    if (deltaY > SWIPE_THRESHOLD || (deltaY > 30 && velocity > MIN_VELOCITY)) {
      onClose();
    } else {
      // Animate back to position
      setDragOffset(0);
      setIsDragging(false);
    }

    touchStartRef.current = null;
    setIsDragging(false);
  }, [onClose]);

  if (!isOpen) return null;

  const transformValue = dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined;
  const transitionClass = isDragging ? "" : "transition-transform duration-300 ease-out";
  const opacityValue = dragOffset > 0 ? Math.max(0, 1 - dragOffset / 300) : undefined;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 dark:bg-black/70",
          "transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={handleBackdropClick}
        style={{
          zIndex: ZIndex.modalBackdrop,
          opacity: opacityValue,
        }}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 px-safe",
          "bg-white dark:bg-dark-surface",
          "rounded-t-3xl shadow-2xl dark:shadow-dark-modal",
          "max-h-[85vh] overflow-hidden",
          "pb-16 sm:pb-0",
          transitionClass
        )}
        style={{
          zIndex: ZIndex.modal,
          transform: transformValue,
          willChange: isOpen ? "transform" : "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
      >
        {/* Handle bar - swipe zone for dismissal */}
        <div
          data-testid="bottom-sheet-drag-handle"
          className="flex justify-center items-center min-h-[44px] cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-neutral-200 dark:border-dark-border">
          <h2
            id="bottom-sheet-title"
            className="text-lg font-semibold text-neutral-900 dark:text-dark-text"
          >
            {title}
          </h2>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="px-4 sm:px-0 overflow-y-auto max-h-[calc(85vh-144px)] sm:max-h-[calc(85vh-80px)] overscroll-contain"
          style={{
            overscrollBehavior: isDragging ? "none" : "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
