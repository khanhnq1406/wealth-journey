"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { ZIndex } from "@/lib/utils/z-index";

// Hoist regex outside component to avoid recreating on each render (js-hoist-regexp)
const SPACE_REGEX = /\s+/g;

export type ModalVariant = "center" | "bottom" | "full";
export type ModalAnimation = "fade" | "scale" | "slide" | "none";

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode; // Optional custom footer (e.g., for confirmation dialogs)
  maxWidth?: string; // Optional max-width for the modal (e.g., "max-w-2xl", "max-w-3xl")
  maxHeight?: string; // Optional max-height for the modal (e.g., "max-h-2xl", "max-h-3xl")
  // Mobile-specific props
  fullScreenOnMobile?: boolean; // Show modal as full-screen on mobile (< 800px)
  bottomSheetOnMobile?: boolean; // Force bottom sheet style on mobile (default: true)

  // Enhanced props
  variant?: ModalVariant; // Modal variant: "center" (default), "bottom", "full"
  animation?: ModalAnimation; // Animation type: "scale" (default), "fade", "slide", "none"
  closeOnBackdropClick?: boolean; // Close modal when clicking backdrop (default: true)
  closeOnEscape?: boolean; // Close modal when pressing Escape (default: true)
  showCloseButton?: boolean; // Show close button in header (default: true)
  closeOnSwipe?: boolean; // Enable swipe-to-close gesture on mobile (default: true)
  swipeThreshold?: number; // Swipe threshold in pixels (default: 100)
  swipeVelocityThreshold?: number; // Velocity threshold for swipe (default: 0.5)
  backdropBlur?: boolean; // Add backdrop blur effect (default: false)
  padding?: "none" | "sm" | "md" | "lg"; // Modal padding (default: "md")
  zIndex?: number; // Custom z-index for the modal (default: 50)
  id?: string; // Custom ID for the modal
  ariaLabel?: string; // Custom aria-label for the modal
}

/**
 * Enhanced modal wrapper component with focus trap and mobile swipe gestures.
 * Mobile optimizations:
 * - Slide-up animation from bottom on mobile (bottom sheet style)
 * - Swipe-down to close gesture with visual feedback
 * - Drag handle indicator for visual affordance
 * - Touch-friendly close button (44x44px min per iOS guidelines)
 * - Safe area padding for devices with home indicators
 * - Virtual keyboard handling with automatic position adjustment
 * - Optional full-screen mode on mobile
 *
 * Desktop behavior:
 * - Centered modal with backdrop
 * - Scale animation on open
 * - Standard padding and spacing
 *
 * Responsive breakpoints:
 * - Mobile: < 800px (defined in tailwind.config.ts as "sm" breakpoint)
 * - Desktop: >= 800px
 */
export function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  maxHeight,
  fullScreenOnMobile = false,
  bottomSheetOnMobile = true,
  variant = "center",
  animation = "scale",
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  closeOnSwipe = true,
  swipeThreshold = 100,
  swipeVelocityThreshold = 0.5,
  backdropBlur = false,
  padding = "md",
  zIndex = ZIndex.modal,
  id,
  ariaLabel,
}: BaseModalProps) {
  const tCommon = useTranslations("common");
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const startY = useRef(0);
  const startX = useRef(0);
  const currentY = useRef(0);
  const startTime = useRef(0);
  const rafId = useRef<number | null>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Small delay to trigger animation after mount
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  // Focus trap: keep focus within modal when open
  useEffect(() => {
    if (!isOpen) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the modal container
    modalRef.current?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);

    return () => {
      document.removeEventListener("keydown", handleTabKey);
      // Restore focus to previous element when modal closes
      previousActiveElement.current?.focus();
    };
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Also prevent scroll on mobile to prevent bounce
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      return () => {
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.width = "";
      };
    }
  }, [isOpen]);

  // Handle virtual keyboard on mobile - with smooth transition
  useEffect(() => {
    if (!isOpen) return;

    let keyboardTimeout: NodeJS.Timeout;

    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        // Clear any pending timeout
        if (keyboardTimeout) clearTimeout(keyboardTimeout);

        const keyboardThreshold = window.innerHeight * 0.25; // 25% height change indicates keyboard
        const heightChange = window.innerHeight - window.visualViewport.height;
        const isKeyboard = heightChange > keyboardThreshold;

        // Debounce state updates to prevent rapid changes
        keyboardTimeout = setTimeout(() => {
          setIsKeyboardVisible(isKeyboard);
        }, 50);
      }
    };

    // Use visual viewport API for better keyboard detection
    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        handleVisualViewportResize,
      );
      // Initial check
      handleVisualViewportResize();

      return () => {
        window.visualViewport?.removeEventListener(
          "resize",
          handleVisualViewportResize,
        );
        if (keyboardTimeout) clearTimeout(keyboardTimeout);
      };
    }

    // Fallback: listen for focus events on form inputs
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        // Delay to allow keyboard animation to start
        keyboardTimeout = setTimeout(() => {
          setIsKeyboardVisible(true);
          // Scroll focused input into view after keyboard appears
          requestAnimationFrame(() => {
            target.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            });
          });
        }, 150);
      }
    };

    const handleFocusOut = () => {
      // Clear any pending timeout
      if (keyboardTimeout) clearTimeout(keyboardTimeout);
      // Delay to allow keyboard animation to complete
      keyboardTimeout = setTimeout(() => {
        setIsKeyboardVisible(false);
      }, 150);
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      if (keyboardTimeout) clearTimeout(keyboardTimeout);
    };
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose, closeOnEscape]);

  // Swipe gesture handlers for mobile with smooth 60fps animations
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    const contentDiv = modalContentRef.current?.querySelector('[class*="overflow-y-auto"]');

    // Check if touch started inside scrollable content
    const isInsideScrollableContent = contentDiv?.contains(target);

    // If inside scrollable content and content can scroll, allow native scroll
    if (isInsideScrollableContent && contentDiv) {
      const canScroll = contentDiv.scrollHeight > contentDiv.clientHeight;
      const isAtTop = contentDiv.scrollTop === 0;

      // Only enable swipe when at top of scroll AND dragging down
      if (canScroll && !isAtTop) {
        return; // Let native scroll handle it
      }
    }

    // Only enable swipe on mobile (touch) devices
    const touch = e.touches[0];
    startY.current = touch.clientY;
    startX.current = touch.clientX;
    currentY.current = touch.clientY;
    startTime.current = Date.now();
    setIsDragging(true);

    // Cancel any pending animation frame
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;

      const touch = e.touches[0];
      currentY.current = touch.clientY;
      const deltaY = currentY.current - startY.current;
      const deltaX = Math.abs(touch.clientX - startX.current);

      // If horizontal movement is greater, it's likely a scroll, not a swipe
      if (deltaX > Math.abs(deltaY)) {
        setIsDragging(false);
        return;
      }

      // Check if user is scrolling content
      const contentDiv = modalContentRef.current?.querySelector('[class*="overflow-y-auto"]');
      if (contentDiv && contentDiv.scrollTop > 0 && deltaY < 0) {
        // User is scrolling up inside content, disable swipe
        setIsDragging(false);
        return;
      }

      // Only allow dragging downward (positive delta) AND when at top of scroll
      if (deltaY > 0) {
        // Use requestAnimationFrame for smooth 60fps updates
        if (rafId.current === null) {
          rafId.current = requestAnimationFrame(() => {
            setDragY(deltaY);
            rafId.current = null;
          });
        }

        // Prevent default scrolling during drag (only when dragging > 10px)
        if (e.cancelable && deltaY > 10) {
          e.preventDefault();
        }
      }
    },
    [isDragging],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || !closeOnSwipe) return;

    setIsDragging(false);

    // Calculate velocity (pixels per millisecond)
    const deltaTime = Date.now() - startTime.current;
    const velocity =
      deltaTime > 0 ? (currentY.current - startY.current) / deltaTime : 0;

    // Close modal if:
    // 1. Dragged past threshold, OR
    // 2. Fast swipe down with sufficient velocity
    const shouldClose =
      dragY > swipeThreshold ||
      (dragY > 50 && velocity > swipeVelocityThreshold);

    if (shouldClose) {
      setIsClosing(true);
      // Add a small delay for the close animation to start
      setTimeout(() => {
        onClose();
        setIsClosing(false);
        setDragY(0);
      }, 50);
    } else {
      // Spring back to original position with smooth animation
      setDragY(0);
    }

    // Cancel any pending animation frame
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, [
    isDragging,
    dragY,
    onClose,
    closeOnSwipe,
    swipeThreshold,
    swipeVelocityThreshold,
  ]);

  // Cleanup animation frames on unmount
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // Memoize modal title ID to avoid recalculating (rendering-hoist-jsx)
  const modalTitleId = useMemo(() => {
    const titleStr = typeof title === "string" ? title : String(title);
    return `modal-title-${titleStr.replace(SPACE_REGEX, "-")}`;
  }, [title]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with fade animation and swipe feedback */}
      <div
        className={cn(
          "fixed inset-0 transition-opacity duration-300",
          // Light mode backdrop
          "bg-modal",
          // Dark mode backdrop (darker for better contrast)
          "dark:bg-dark-overlay",
          // Backdrop blur
          backdropBlur && "backdrop-blur-sm",
          // Fade backdrop when dragging modal
          isDragging && dragY > 50
            ? "opacity-0"
            : isAnimating
              ? "opacity-100"
              : "opacity-0",
        )}
        style={{ zIndex: zIndex - 1 }}
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal container with slide/scale animation */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        aria-label={ariaLabel}
        id={id}
        tabIndex={-1}
        className={cn(
          "fixed flex justify-center px-safe mx-2 sm:p-4 sm:mx-0",
          // Use visual viewport height on mobile to prevent jumping
          "top-0 left-0 right-0",
          // Variant positioning with smooth transition
          "transition-all duration-300 ease-out",
          variant === "bottom" && "items-end sm:items-center",
          variant === "center" && "items-center",
          variant === "full" && "items-center",
          // Keep modal at bottom when keyboard is visible on mobile
          isKeyboardVisible && "sm:items-center",
        )}
        style={{
          zIndex,
          // Use visual viewport height on mobile to prevent modal jumping
          height: isKeyboardVisible
            ? `${window.visualViewport?.height || window.innerHeight}px`
            : "100vh",
        }}
      >
        <div
          ref={modalContentRef}
          className={cn(
            // Light mode
            "bg-white shadow-modal",
            // Dark mode
            "dark:bg-dark-surface dark:shadow-dark-modal",
            "w-full overscroll-contain outline-none",
            // Responsive border radius
            fullScreenOnMobile || variant === "full"
              ? "rounded-none sm:rounded-lg"
              : variant === "bottom"
                ? "rounded-t-xl sm:rounded-lg"
                : "rounded-lg",
            // Responsive margin
            fullScreenOnMobile || variant === "full" ? "" : "sm:mx-4",
            // Mobile-specific optimizations
            "pb-safe", // Safe area for devices with home indicators
            // Transform with swipe drag - no transition during drag for 1:1 finger tracking
            isDragging || isClosing
              ? "transition-none"
              : "transition-all duration-300 ease-out",
            // Color transitions for dark mode
            "transition-colors duration-200",
            // Animation states based on animation prop
            isAnimating && !isDragging && !isClosing
              ? animation === "fade"
                ? "opacity-100"
                : animation === "scale"
                  ? "scale-100 opacity-100"
                  : animation === "slide"
                    ? "translate-y-0 opacity-100"
                    : "opacity-100"
              : !isAnimating
                ? animation === "fade"
                  ? "opacity-0"
                  : animation === "scale"
                    ? "scale-95 opacity-0"
                    : animation === "slide"
                      ? "translate-y-full sm:translate-y-4 opacity-0"
                      : "opacity-0"
                : "",
            // Add backdrop blur when dragging for visual depth
            isDragging && dragY > 50 && "backdrop-blur-sm",
            maxWidth || "max-w-sm sm:max-w-md lg:max-w-lg",
            // Responsive max height based on variant
            maxHeight ||
              (variant === "full"
                ? "h-[100dvh]"
                : fullScreenOnMobile
                  ? "h-[100dvh] sm:max-h-[90vh]"
                  : "max-h-[85vh] sm:max-h-[90vh]"),
            // Adjust height when keyboard is visible - use dynamic height
            isKeyboardVisible &&
              !fullScreenOnMobile &&
              variant !== "full" &&
              "!max-h-[70vh]",
            // Prevent touch actions like browser zoom/scroll during swipe
            isDragging && "touch-none",
          )}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={closeOnSwipe ? handleTouchStart : undefined}
          onTouchMove={closeOnSwipe ? handleTouchMove : undefined}
          onTouchEnd={closeOnSwipe ? handleTouchEnd : undefined}
          style={
            isDragging && dragY > 0
              ? {
                  transform: `translateY(${dragY}px)`,
                  transition: "none",
                }
              : isClosing
                ? {
                    transform: `translateY(100%)`,
                    transition: "transform 150ms ease-out",
                  }
                : undefined
          }
        >
          {/* Mobile drag handle indicator - visible only on mobile and bottom sheet mode */}
          {bottomSheetOnMobile && !fullScreenOnMobile && variant !== "full" && (
            <div className="sm:hidden flex justify-center pt-3 pb-2">
              <div
                className={cn(
                  "w-12 h-1.5 rounded-full transition-colors duration-200",
                  // Visual feedback during drag
                  isDragging && dragY > 0
                    ? dragY > swipeThreshold
                      ? "bg-danger-500 dark:bg-danger-600" // Red when close threshold reached
                      : "bg-v2-red-primary" // Red while dragging
                    : "bg-neutral-300 dark:bg-dark-border", // Gray at rest
                )}
              />
            </div>
          )}

          <div
            className={cn(
              // Responsive padding based on padding prop
              padding === "none" && "px-0 py-0 sm:px-0 sm:py-0",
              padding === "sm" && "px-3 sm:px-3 py-2 sm:py-3",
              padding === "md" &&
                (fullScreenOnMobile
                  ? "px-4 sm:px-6 py-4 sm:py-5"
                  : "px-4 sm:px-5 pb-4 sm:pb-5"),
              padding === "lg" && "px-6 sm:px-8 py-6 sm:py-8",
              // Extra top padding when no drag handle (full screen mode)
              (fullScreenOnMobile || variant === "full") &&
                padding !== "none" &&
                "pt-4",
            )}
          >
            <div className="flex justify-between items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
              <h2
                id={modalTitleId}
                className="font-bold text-base sm:text-lg flex-1 pr-2 dark:text-dark-text"
              >
                {title}
              </h2>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  // Touch-friendly minimum size (44x44px per iOS Human Interface Guidelines)
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-dark-surface-hover dark:active:bg-dark-surface-active transition-colors flex-shrink-0"
                  aria-label={tCommon("close")}
                  type="button"
                >
                  <svg
                    className="w-6 h-6 text-neutral-500 dark:text-dark-text-secondary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div
              className={cn(
                "overflow-y-auto overflow-x-hidden -mx-1 px-1 transition-all duration-300",
                // Dynamic max-height based on keyboard visibility
                isKeyboardVisible
                  ? "max-h-[calc(70vh-200px)]"
                  : "max-h-[calc(100vh-250px)] sm:max-h-[calc(90vh-150px)]",
              )}
            >
              {children}
            </div>

            {footer ? (
              <div className="mt-4 sm:mt-5 sticky bottom-0 bg-white dark:bg-dark-surface py-2 -mx-2 px-2 sm:mx-0 sm:px-0 sm:static sm:bg-transparent sm:py-0">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
