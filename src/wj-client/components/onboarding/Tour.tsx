"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";

// Storage key for tour completion
const TOUR_COMPLETION_KEY = "wealthjourney-tour-completed";
const TOUR_STEP_KEY = "wealthjourney-tour-step";

export interface TourStep {
  target: string; // CSS selector for the target element
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right" | "center";
  action?: {
    label: string;
    onClick: () => void;
  };
  disableBeacon?: boolean;
}

const DEFAULT_STEPS: TourStep[] = [
  {
    target: "",
    placement: "center",
    title: "Welcome to WealthJourney! 👋",
    content: "Take a quick tour to learn how to manage your finances effectively. This will only take a minute.",
  },
  {
    target: "[data-tour='wallets']",
    placement: "bottom",
    title: "Your Wallets 💳",
    content: "Create and manage multiple wallets to track your cash, bank accounts, and investment portfolios separately.",
    action: {
      label: "Create a Wallet",
      onClick: () => {
        // Trigger wallet creation modal
        const event = new CustomEvent("tour-action", { detail: { action: "create-wallet" } });
        window.dispatchEvent(event);
      },
    },
  },
  {
    target: "[data-tour='transactions']",
    placement: "bottom",
    title: "Track Transactions 📝",
    content: "Record your income and expenses to see where your money goes. Categorize transactions for better insights.",
    action: {
      label: "Add Transaction",
      onClick: () => {
        const event = new CustomEvent("tour-action", { detail: { action: "add-transaction" } });
        window.dispatchEvent(event);
      },
    },
  },
  {
    target: "[data-tour='budget']",
    placement: "bottom",
    title: "Set Budgets 📊",
    content: "Create monthly budgets for different spending categories and get alerts when you're approaching your limits.",
  },
  {
    target: "[data-tour='portfolio']",
    placement: "bottom",
    title: "Investment Portfolio 📈",
    content: "Track your investments, monitor performance, and see real-time PNL calculations with our portfolio management tools.",
  },
  {
    target: "[data-tour='search']",
    placement: "bottom",
    title: "Quick Search 🔍",
    content: "Press Cmd/Ctrl + K anywhere in the app to quickly search for wallets, transactions, and investments.",
  },
  {
    target: "",
    placement: "center",
    title: "You're All Set! 🎉",
    content: "You've learned the basics. Start managing your finances like a pro! You can always access this tour from Settings.",
  },
];

interface TourProps {
  steps?: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  autoStart?: boolean;
  showProgress?: boolean;
  showSkipButton?: boolean;
  keyboardNavigation?: boolean;
}

/**
 * Welcome Tour Component
 *
 * Features:
 * - Steps: Welcome, Add wallet, Record transaction, Set budget, Explore portfolio
 * - Skip option
 * - Progress indicator
 * - Tooltips highlighting UI elements
 * - Celebration on completion
 * - Mobile-friendly with responsive positioning
 * - Keyboard navigation (arrow keys, ESC to skip, Enter to continue)
 * - localStorage for persistence (saves progress and completion)
 *
 * Usage:
 * ```tsx
 * <Tour
 *   onComplete={() => console.log('Tour completed')}
 *   onSkip={() => console.log('Tour skipped')}
 *   autoStart={true}
 * />
 *
 * // Add data-tour attributes to your elements:
 * <div data-tour="wallets">...</div>
 * ```
 */
export function Tour({
  steps = DEFAULT_STEPS,
  onComplete,
  onSkip,
  autoStart = false,
  showProgress = true,
  showSkipButton = true,
  keyboardNavigation = true,
}: TourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [targetElement, setTargetElement] = useState<Element | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Load tour state from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const completed = localStorage.getItem(TOUR_COMPLETION_KEY);
      if (completed === "true") {
        setIsCompleted(true);
        return;
      }

      const savedStep = localStorage.getItem(TOUR_STEP_KEY);
      if (savedStep && autoStart) {
        const stepIndex = parseInt(savedStep, 10);
        if (stepIndex < steps.length) {
          setCurrentStep(stepIndex);
          setIsActive(true);
        }
      }
    } catch (e) {
      console.error("Failed to load tour state:", e);
    }
  }, [autoStart, steps.length]);

  // Auto-start tour if configured
  useEffect(() => {
    if (autoStart && !isCompleted && !isActive) {
      // Small delay to allow page to render
      const timer = setTimeout(() => {
        setIsActive(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoStart, isCompleted, isActive]);

  // Find and position tooltip for current step
  useEffect(() => {
    if (!isActive) return;

    const step = steps[currentStep];
    if (!step) return;

    if (step.target) {
      const element = document.querySelector(step.target);
      setTargetElement(element);

      if (element) {
        const rect = element.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        const scrollX = window.scrollX || window.pageXOffset;

        setTooltipPosition({
          top: rect.top + scrollY,
          left: rect.left + scrollX,
        });

        // Scroll element into view if needed
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      setTargetElement(null);
    }
  }, [isActive, currentStep, steps]);

  // Save current step to localStorage
  useEffect(() => {
    if (isActive && !isCompleted) {
      try {
        localStorage.setItem(TOUR_STEP_KEY, currentStep.toString());
      } catch (e) {
        console.error("Failed to save tour step:", e);
      }
    }
  }, [isActive, isCompleted, currentStep]);

  // Define handlers before keyboard navigation effect
  const handleComplete = useCallback(() => {
    setIsActive(false);
    setIsCompleted(true);
    onComplete?.();

    try {
      localStorage.setItem(TOUR_COMPLETION_KEY, "true");
      localStorage.removeItem(TOUR_STEP_KEY);
    } catch (e) {
      console.error("Failed to save tour completion:", e);
    }
  }, [onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, steps.length, handleComplete]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    setIsActive(false);
    onSkip?.();

    try {
      localStorage.setItem(TOUR_COMPLETION_KEY, "true");
      localStorage.removeItem(TOUR_STEP_KEY);
    } catch (e) {
      console.error("Failed to save tour completion:", e);
    }
  }, [onSkip]);

  // Keyboard navigation
  useEffect(() => {
    if (!keyboardNavigation || !isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleSkip();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, keyboardNavigation, handleNext, handlePrevious, handleSkip]);

  // Handle window resize
  useEffect(() => {
    if (!isActive || !targetElement) return;

    const handleResize = () => {
      const rect = targetElement.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;

      setTooltipPosition({
        top: rect.top + scrollY,
        left: rect.left + scrollX,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isActive, targetElement]);

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  if (!isActive || !step) return null;

  // Portal target
  const portalTarget = typeof document !== "undefined" ? document.body : null;

  if (!portalTarget) return null;

  // Center overlay for welcome/completion steps
  const isCenterStep = !step.target || step.placement === "center";

  // Calculate tooltip position using useMemo to avoid accessing refs during render
  const tooltipStyle = useMemo(() => {
    if (isCenterStep || !targetElement) return undefined;

    const rect = targetElement.getBoundingClientRect();
    const tooltipHeight = 200; // Default height, will adjust after mount
    const tooltipWidth = 400; // Default width

    switch (step.placement) {
      case "top":
        return {
          top: `${tooltipPosition.top - tooltipHeight - 16}px`,
          left: `${tooltipPosition.left + rect.width / 2 - tooltipWidth / 2}px`,
        };
      case "bottom":
        return {
          top: `${tooltipPosition.top + rect.height + 16}px`,
          left: `${tooltipPosition.left + rect.width / 2 - tooltipWidth / 2}px`,
        };
      case "left":
        return {
          top: `${tooltipPosition.top + rect.height / 2 - tooltipHeight / 2}px`,
          left: `${tooltipPosition.left - tooltipWidth - 16}px`,
        };
      case "right":
        return {
          top: `${tooltipPosition.top + rect.height / 2 - tooltipHeight / 2}px`,
          left: `${tooltipPosition.left + rect.width + 16}px`,
        };
      default:
        return {
          top: `${tooltipPosition.top + rect.height + 16}px`,
          left: `${Math.max(16, Math.min(tooltipPosition.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16))}px`,
        };
    }
  }, [isCenterStep, targetElement, step.placement, tooltipPosition]);

  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Backdrop */}
      {!isCenterStep && (
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={handleSkip}
        />
      )}

      {/* Spotlight for target element */}
      {!isCenterStep && targetElement && (
        <div
          className="absolute transition-all duration-300 pointer-events-none"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            width: (targetElement as HTMLElement).offsetWidth,
            height: (targetElement as HTMLElement).offsetHeight,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
            borderRadius: "8px",
            zIndex: 61,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={containerRef}
        className={cn(
          "absolute pointer-events-auto transition-all duration-300 ease-out",
          "bg-white dark:bg-dark-surface rounded-xl shadow-modal dark:shadow-dark-modal",
          "border border-neutral-200 dark:border-dark-border",
          "max-w-sm sm:max-w-md w-full",
          isCenterStep
            ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-scale-in"
            : "animate-fade-in",
        )}
        style={tooltipStyle}
      >
        {/* Progress Bar */}
        {showProgress && (
          <div className="h-1 bg-neutral-200 dark:bg-dark-border rounded-t-xl overflow-hidden">
            <div
              className="h-full bg-v2-red-primary transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        )}

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-dark-text pr-4">
              {step.title}
            </h3>
            {showSkipButton && !isCenterStep && (
              <button
                onClick={handleSkip}
                className="text-sm text-neutral-500 dark:text-dark-text-tertiary hover:text-neutral-700 dark:hover:text-dark-text-secondary transition-colors flex-shrink-0"
              >
                Skip
              </button>
            )}
          </div>

          {/* Content */}
          <p className="text-sm text-neutral-600 dark:text-dark-text-secondary mb-4">
            {step.content}
          </p>

          {/* Action Button (if available) */}
          {step.action && (
            <button
              onClick={() => {
                step.action?.onClick();
                handleNext();
              }}
              className="w-full mb-4 px-4 py-2 bg-v2-red-light dark:bg-primary-950 text-v2-red-primary dark:text-primary-400 rounded-lg text-sm font-medium hover:bg-v2-red-light dark:hover:bg-primary-900 transition-colors"
            >
              {step.action.label}
            </button>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-neutral-400 dark:text-dark-text-tertiary">
              Step {currentStep + 1} of {steps.length}
            </div>

            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button
                  type={ButtonType.SECONDARY}
                  onClick={handlePrevious}
                  size="sm"
                >
                  Back
                </Button>
              )}
              <Button
                type={ButtonType.PRIMARY}
                onClick={handleNext}
                size="sm"
              >
                {isLastStep ? "Get Started" : "Next"}
              </Button>
            </div>
          </div>

          {/* Keyboard hint */}
          {keyboardNavigation && (
            <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-dark-border flex items-center justify-center gap-3 text-xs text-neutral-400 dark:text-dark-text-tertiary">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-dark-surface-hover border border-neutral-200 dark:border-dark-border">←</kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-dark-surface-hover border border-neutral-200 dark:border-dark-border">→</kbd>
                <span>to navigate</span>
              </div>
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-dark-surface-hover border border-neutral-200 dark:border-dark-border">ESC</kbd>
              <span>to skip</span>
            </div>
          )}
        </div>

        {/* Arrow pointer */}
        {!isCenterStep && step.placement !== "center" && (
          <div
            className={cn(
              "absolute w-3 h-3 bg-white dark:bg-dark-surface border border-neutral-200 dark:border-dark-border rotate-45",
              step.placement === "top" && "bottom-[-7px] left-1/2 -translate-x-1/2 border-b-0 border-r-0",
              step.placement === "bottom" && "top-[-7px] left-1/2 -translate-x-1/2 border-t-0 border-l-0",
              step.placement === "left" && "right-[-7px] top-1/2 -translate-y-1/2 border-t-0 border-r-0",
              step.placement === "right" && "left-[-7px] top-1/2 -translate-y-1/2 border-b-0 border-l-0"
            )}
          />
        )}
      </div>
    </div>,
    portalTarget
  );
}

/**
 * Hook to manage tour state
 */
export function useTour() {
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const completed = localStorage.getItem(TOUR_COMPLETION_KEY);
      queueMicrotask(() => setIsCompleted(completed === "true"));

      const savedStep = localStorage.getItem(TOUR_STEP_KEY);
      if (savedStep) {
        queueMicrotask(() => setCurrentStep(parseInt(savedStep, 10)));
      }
    } catch (e) {
      console.error("Failed to load tour state:", e);
    }
  }, []);

  const startTour = useCallback(() => {
    setIsActive(true);
    setCurrentStep(0);
  }, []);

  const resumeTour = useCallback(() => {
    if (!isCompleted) {
      setIsActive(true);
    }
  }, [isCompleted]);

  const resetTour = useCallback(() => {
    try {
      localStorage.removeItem(TOUR_COMPLETION_KEY);
      localStorage.removeItem(TOUR_STEP_KEY);
      setIsCompleted(false);
      setCurrentStep(0);
      setIsActive(true);
    } catch (e) {
      console.error("Failed to reset tour:", e);
    }
  }, []);

  return {
    isCompleted,
    currentStep,
    isActive,
    startTour,
    resumeTour,
    resetTour,
  };
}

/**
 * Trigger for starting the tour (can be placed in settings)
 */
export function TourTrigger({ className }: { className?: string }) {
  const { isCompleted, startTour, resetTour } = useTour();

  if (isCompleted) {
    return (
      <button
        onClick={resetTour}
        className={className}
      >
        Retake Tour
      </button>
    );
  }

  return (
    <button
      onClick={startTour}
      className={className}
    >
      Start Tour
    </button>
  );
}
