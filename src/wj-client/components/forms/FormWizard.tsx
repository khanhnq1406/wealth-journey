"use client";

import { memo, useCallback, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  isValid?: boolean;
}

export interface FormWizardProps {
  steps: WizardStep[];
  currentStepIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onStepChange?: (stepIndex: number) => void;
  onFinish?: () => void;
  isNextDisabled?: boolean;
  isPreviousDisabled?: boolean;
  isLoading?: boolean;
  className?: string;
  hideProgress?: boolean; // Hide progress on desktop
}

/**
 * Multi-step wizard component for complex forms.
 * Mobile-first with progress indicators and smooth transitions.
 */
export const FormWizard = memo(function FormWizard({
  steps,
  currentStepIndex,
  onNext,
  onPrevious,
  onStepChange,
  onFinish,
  isNextDisabled = false,
  isPreviousDisabled = false,
  isLoading = false,
  className,
  hideProgress = false,
}: FormWizardProps) {
  const t = useTranslations("formWizard");
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      if (onStepChange) {
        // Only allow clicking on completed steps or the next step
        if (stepIndex <= currentStepIndex) {
          onStepChange(stepIndex);
        }
      }
    },
    [currentStepIndex, onStepChange]
  );

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Progress Indicator - Hidden on desktop when hideProgress is true */}
      {!hideProgress && (
        <div className="mb-6 hidden sm:block">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isAccessible = index <= currentStepIndex;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  {/* Step circle */}
                  <button
                    type="button"
                    onClick={() => handleStepClick(index)}
                    disabled={!isAccessible || !onStepChange}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-all duration-200",
                      "focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2",
                      isCurrent
                        ? "bg-v2-gold-primary text-white shadow-md"
                        : isCompleted
                        ? "bg-success-500 text-white"
 : "bg-v2-bg-surface-tint text-v2-text-tertiary",
                      !isAccessible && !isCurrent && "cursor-not-allowed opacity-50"
                    )}
                    aria-label={t("goToStep", { number: index + 1, title: step.title })}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </button>

                  {/* Step title */}
                  <div className="ml-3 text-left">
                    <div
                      className={cn(
                        "text-sm font-medium",
                        isCurrent
 ? "text-white"
                          : isCompleted
 ? "text-success-600"
 : "text-v2-text-tertiary"
                      )}
                    >
                      {step.title}
                    </div>
                    {step.description && (
 <div className="text-xs text-v2-text-tertiary">
                        {step.description}
                      </div>
                    )}
                  </div>

                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "flex-1 h-0.5 mx-4",
                        isCompleted
                          ? "bg-success-500"
 : "bg-v2-bg-surface-tint"
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile Progress Dots */}
      <div className="sm:hidden mb-4 flex justify-center gap-2">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "h-2 rounded-full transition-all duration-200",
              index === currentStepIndex
                ? "w-8 bg-v2-gold-primary"
                : index < currentStepIndex
                ? "w-2 bg-success-500"
 : "w-2 bg-v2-bg-surface-tint"
            )}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="flex-1 min-h-0">
        <div className="animate-fade-in">
          {/* Mobile step title */}
          <div className="sm:hidden mb-4">
 <h2 className="text-lg font-semibold text-white">
              {t("stepOf", { current: currentStepIndex + 1, total: steps.length })}
            </h2>
 <p className="text-sm text-v2-text-tertiary">
              {currentStep.title}
            </p>
          </div>

          {currentStep.content}
        </div>
      </div>

      {/* Navigation */}
 <div className="mt-6 flex gap-3 pt-4 border-t border-v2-border-light">
        {/* Previous Button */}
        <button
          type="button"
          onClick={onPrevious}
          disabled={isPreviousDisabled || isFirstStep}
          className={cn(
            "flex-1 min-h-[48px] px-4 py-3 rounded-lg font-medium transition-all duration-150",
            "focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2",
            isFirstStep || isPreviousDisabled
 ? "bg-v2-bg-surface-tint text-v2-text-tertiary cursor-not-allowed"
 : "bg-v2-bg-dark text-v2-text-secondary border border-v2-border-light hover:bg-v2-bg-surface-tint active:bg-v2-bg-surface-tint"
          )}
          aria-label={t("previousStepAriaLabel")}
        >
          {t("previous")}
        </button>

        {/* Next/Finish Button */}
        <button
          type={isLastStep && onFinish ? "submit" : "button"}
          onClick={isLastStep && onFinish ? undefined : onNext}
          disabled={isNextDisabled || (currentStep.isValid === false)}
          className={cn(
            "flex-1 min-h-[48px] px-4 py-3 rounded-lg font-medium transition-all duration-150",
            "focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2",
            isNextDisabled || currentStep.isValid === false
 ? "bg-v2-bg-surface-tint text-v2-text-tertiary cursor-not-allowed"
              : "bg-v2-gold-primary text-white hover:bg-v2-gold-primary/80 active:bg-v2-gold-primary/80 shadow-md hover:shadow-lg",
            isLoading && "opacity-70 cursor-wait"
          )}
          aria-label={isLastStep ? t("finishAriaLabel") : t("nextStepAriaLabel")}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {t("processing")}
            </span>
          ) : isLastStep ? (
            t("finish")
          ) : (
            t("next")
          )}
        </button>
      </div>
    </div>
  );
});
