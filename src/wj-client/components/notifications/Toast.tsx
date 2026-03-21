"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { ZIndex } from "@/lib/utils/z-index";

export type ToastVariant = "success" | "error" | "warning" | "info";
export type ToastPosition =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "bottom-center";

export interface ToastProps {
  id: string;
  variant?: ToastVariant;
  title?: string;
  message: string;
  duration?: number; // Auto-dismiss duration in ms (0 = no auto-dismiss)
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  position?: ToastPosition;
  showProgress?: boolean;
  icon?: React.ReactNode;
  isClosing?: boolean;
}

/**
 * Toast Notification Component
 *
 * Features:
 * - Variants: success, error, warning, info
 * - Auto-dismiss with timer
 * - Manual dismiss action
 * - Progress bar for auto-dismiss
 * - Slide in/out animations
 * - Position options (top-right, bottom-right, etc.)
 * - Icon per variant
 * - Dark mode support
 * - Accessibility (ARIA labels, keyboard navigation)
 *
 * @example
 * ```tsx
 * <Toast
 *   id="toast-1"
 *   variant="success"
 *   title="Success!"
 *   message="Your changes have been saved."
 *   duration={5000}
 *   onClose={() => console.log('closed')}
 *   action={{ label: "Undo", onClick: handleUndo }}
 * />
 * ```
 */
export function Toast({
  id,
  variant = "info",
  title,
  message,
  duration = 5000,
  onClose,
  action,
  position = "top-right",
  showProgress = true,
  icon,
  isClosing = false,
}: ToastProps) {
  const t = useTranslations("common");
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  // Use lazy initialization to avoid Date.now() during render
  const startTimeRef = useRef<number>(0);
  const remainingTimeRef = useRef<number>(duration);
  const timerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize startTime in effect to avoid impure function during render
  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  // Define handleClose before it's used in other effects
  const handleClose = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    onClose?.();
  }, [onClose]);

  // Auto-dismiss timer
  useEffect(() => {
    if (duration === 0 || isPaused || isClosing) {
      return;
    }

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, remainingTimeRef.current - elapsed);
      const progressPercent = (remaining / duration) * 100;

      setProgress(progressPercent);

      if (remaining <= 0) {
        handleClose();
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [duration, isPaused, isClosing, handleClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (duration > 0) {
      setIsPaused(true);
      // Save remaining time
      remainingTimeRef.current = (progress / 100) * duration;
    }
  }, [duration, progress]);

  const handleMouseLeave = useCallback(() => {
    if (duration > 0) {
      setIsPaused(false);
      startTimeRef.current = Date.now();
    }
  }, [duration]);

  const handleAction = useCallback(() => {
    action?.onClick();
    handleClose();
  }, [action, handleClose]);

  // Get variant-specific styling and icons
  const getVariantConfig = () => {
    const configs = {
      success: {
        containerClass:
          "bg-v2-bg-surface border-l-4 border-success-500",
        iconClass: "text-success-500",
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      error: {
        containerClass:
          "bg-v2-bg-surface border-l-4 border-danger-500",
        iconClass: "text-danger-500",
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      warning: {
        containerClass:
          "bg-v2-bg-surface border-l-4 border-warning-500",
        iconClass: "text-warning-500",
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      info: {
        containerClass:
          "bg-v2-bg-surface border-l-4 border-primary-500",
        iconClass: "text-primary-500",
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
    };

    return configs[variant];
  };

  const config = getVariantConfig();

  // Get position-specific classes
  const getPositionClasses = () => {
    const positions = {
      "top-right": "animate-slide-in-right",
      "top-left": "animate-slide-in-left",
      "bottom-right": "animate-slide-in-up",
      "bottom-left": "animate-slide-in-up",
      "top-center": "animate-fade-in-down",
      "bottom-center": "animate-fade-in-up",
    };
    return positions[position];
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "relative flex items-start gap-3 p-4 rounded-lg shadow-lg",
        "border border-v2-border-light",
        "min-w-[320px] max-w-md w-full",
        "transition-all duration-300 ease-out",
        config.containerClass,
        isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100",
        getPositionClasses(),
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Icon */}
      <div className={cn("flex-shrink-0 mt-0.5", config.iconClass)}>
        {icon || config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="text-sm font-semibold text-v2-gold-accent mb-1">
            {title}
          </h4>
        )}
        <p className="text-sm text-v2-text-tertiary">
          {message}
        </p>
        {action && (
          <button
            onClick={handleAction}
            className={cn(
              "mt-2 text-sm font-medium underline underline-offset-2",
              "hover:no-underline transition-all",
              config.iconClass,
            )}
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className={cn(
          "flex-shrink-0 p-1 rounded-md",
          "text-v2-gold-primary",
          "hover:bg-v2-bg-surface-tint",
          "hover:text-v2-gold-accent",
          "transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-v2-gold-primary focus:ring-offset-2",
        )}
        aria-label={t("close")}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Progress Bar */}
      {/* {showProgress && duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-v2-bg-dark rounded-b-lg overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-100 ease-linear",
              isPaused && "pause-animation",
 variant === "success" && "bg-success-500",
 variant === "error" && "bg-danger-500",
 variant === "warning" && "bg-warning-500",
              variant === "info" && "bg-v2-red-primary"
            )}
            style={{
              width: `${progress}%`,
              transitionDuration: isPaused ? "0ms" : "100ms",
            }}
          />
        </div>
      )} */}
    </div>
  );
}

/**
 * Toast Container Component
 * Manages the positioning of multiple toasts
 */
export interface ToastContainerProps {
  children: React.ReactNode;
  position?: ToastPosition;
}

export function ToastContainer({
  children,
  position = "top-right",
}: ToastContainerProps) {
  const getPositionClasses = () => {
    const positions = {
      "top-right": "top-4 right-4",
      "top-left": "top-4 left-4",
      "bottom-right": "bottom-4 right-4",
      "bottom-left": "bottom-4 left-4",
      "top-center": "top-4 left-1/2 -translate-x-1/2",
      "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
    };
    return positions[position];
  };

  return (
    <div
      className={cn(
        "fixed flex flex-col gap-2 pointer-events-none",
        getPositionClasses(),
      )}
      style={{ zIndex: ZIndex.toast }}
    >
      {React.Children.map(children, (child) => (
        <div className="pointer-events-auto">{child}</div>
      ))}
    </div>
  );
}
