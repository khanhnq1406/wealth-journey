"use client";

import { useController, UseControllerProps } from "react-hook-form";
import { cn } from "@/lib/utils/cn";

interface ToggleOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}

interface FormToggleProps extends Omit<UseControllerProps, "control"> {
  control: any; // Control type causes generic issues with RHF, using any as workaround
  options: ToggleOption[];
  disabled?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
}

export const FormToggle = ({
  options = [],
  disabled = false,
  className = "",
  label,
  required = false,
  ...props
}: FormToggleProps) => {
  const {
    field: { onChange, value },
    fieldState: { error },
  } = useController(props);

  const labelId = `${props.name}-label`;
  const errorId = `${props.name}-error`;

  return (
    <div className={cn("mb-3 sm:mb-4", className)}>
      {label && (
        <label
          htmlFor={labelId}
 className="block text-sm font-medium text-neutral-700 mb-2"
        >
          {label}
          {required && <span className="text-danger-600 ml-1">*</span>}
        </label>
      )}
      <div
 className="flex gap-2 p-1 bg-neutral-100 rounded-lg"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? errorId : undefined}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            role="radio"
            aria-checked={value === option.value}
            tabIndex={value === option.value ? 0 : -1}
            className={cn(
              "flex-1 min-h-[44px] sm:min-h-[48px] flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-md text-sm sm:text-base font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
              value === option.value
 ? "bg-white text-primary-600 shadow-sm"
 : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50",
              disabled && "opacity-50 cursor-not-allowed pointer-events-none",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.icon && (
              <span className="w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0">
                {option.icon}
              </span>
            )}
            <span className="truncate">{option.label}</span>
          </button>
        ))}
      </div>
      {error && (
        <p
          id={errorId}
 className="text-danger-600 text-sm mt-1.5 flex items-center gap-1.5"
          role="alert"
        >
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error.message}</span>
        </p>
      )}
    </div>
  );
};
