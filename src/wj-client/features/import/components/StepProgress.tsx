"use client";

import { FC, ReactNode } from "react";

interface Step {
  number: number;
  label: string;
  icon?: ReactNode;
}

interface StepProgressProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

/**
 * StepProgress - Shows user's progress through multi-step flow
 *
 * Mobile view:
 * - "Step X of Y" text
 * - Current step label
 * - Progress bar
 *
 * Desktop view:
 * - All steps horizontally with circles and labels
 * - Completed steps: filled with checkmark
 * - Current step: white with ring
 * - Upcoming steps: white with neutral border
 * - Connector lines between steps
 */
export const StepProgress: FC<StepProgressProps> = ({
  steps,
  currentStep,
  className = "",
}) => {
  const totalSteps = steps.length;
  const currentStepIndex = steps.findIndex(
    (step) => step.number === currentStep,
  );
  const progressPercentage = ((currentStepIndex + 1) / totalSteps) * 100;
  const currentStepData = steps[currentStepIndex];

  return (
    <div className={className}>
      {/* Mobile view: Simple progress bar with step indicator */}
      <div className="sm:hidden">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-600 font-medium">
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
          <span className="text-sm text-gray-900 font-semibold">
            {currentStepData?.label}
          </span>
        </div>
        <div
          className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={`Step ${currentStep} of ${steps.length}: ${steps.find((s) => s.number === currentStep)?.label}`}
        >
          <div
            className="bg-[#008148] h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Desktop view: Full step indicators */}
      <div className="hidden sm:flex sm:justify-center">
        <ol
          className="flex items-center justify-center max-w-3xl w-full"
          aria-label="Import progress steps"
        >
          {steps.map((step, index) => {
            const isCompleted = step.number < currentStep;
            const isCurrent = step.number === currentStep;
            const isUpcoming = step.number > currentStep;

            return (
              <li key={step.number} className="flex items-center">
                {/* Step circle and label */}
                <div className="flex flex-col items-center relative w-20">
                  {/* Circle */}
                  <div
                    className={`
                      w-10 h-10 rounded-full border-2 flex items-center justify-center
                      transition-all duration-300
                      ${
                        isCompleted
                          ? "bg-[#008148] border-[#008148]"
                          : isCurrent
                            ? "bg-white border-[#008148] ring-4 ring-[#008148]/10"
                            : "bg-white border-gray-300"
                      }
                    `}
                    {...(isCurrent && { "aria-current": "step" })}
                  >
                    {isCompleted ? (
                      // Checkmark for completed steps
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : step.icon ? (
                      // Icon for current and upcoming steps
                      <div
                        className={`w-5 h-5 ${
                          isCurrent ? "text-[#008148]" : "text-gray-400"
                        }`}
                      >
                        {step.icon}
                      </div>
                    ) : (
                      // Fallback to step number if no icon
                      <span
                        className={`text-sm font-semibold ${
                          isCurrent ? "text-[#008148]" : "text-gray-400"
                        }`}
                      >
                        {step.number}
                      </span>
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`
                      mt-2 text-xs font-medium text-center whitespace-nowrap
                      ${
                        isCurrent
                          ? "text-[#008148]"
                          : isCompleted
                            ? "text-gray-700"
                            : "text-gray-400"
                      }
                    `}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line (not shown after last step) */}
                {index < steps.length - 1 && (
                  <div className="w-24 h-0.5 relative top-[-16px]">
                    <div
                      className={`
                        w-full h-full transition-all duration-300
                        ${isCompleted ? "bg-[#008148]" : "bg-gray-300"}
                      `}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
