"use client";

import React, {
  useState,
  useId,
  forwardRef,
  useRef,
  useEffect,
  InputHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils/cn";

export interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /**
   * Label for the input
   */
  label?: string;

  /**
   * Helper text to display below the input
   */
  helperText?: string;

  /**
   * Error message to display
   */
  error?: string;

  /**
   * Success message to display
   */
  success?: string;

  /**
   * Size variant
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Icon to display on the left side
   */
  leftIcon?: React.ReactNode;

  /**
   * Icon to display on the right side
   */
  rightIcon?: React.ReactNode;

  /**
   * Click handler for right icon
   */
  onRightIconClick?: () => void;

  /**
   * Whether the input is required
   */
  required?: boolean;

  /**
   * Whether to show floating label
   * @default true
   */
  floatingLabel?: boolean;

  /**
   * Whether input is disabled
   */
  disabled?: boolean;

  /**
   * Whether input is in loading state
   */
  loading?: boolean;

  /**
   * Additional class name
   */
  className?: string;

  /**
   * Container class name
   */
  containerClassName?: string;

  /**
   * Input mode for mobile keyboards
   * @default "text"
   */
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel" | "url" | "search";

  /**
   * Auto-complete type
   */
  autoComplete?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      helperText,
      error,
      success,
      size = "md",
      leftIcon,
      rightIcon,
      onRightIconClick,
      required,
      floatingLabel = true,
      disabled,
      loading,
      className,
      containerClassName,
      inputMode = "text",
      autoComplete,
      id,
      value,
      defaultValue,
      onFocus,
      onBlur,
      type = "text",
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;
    const successId = `${inputId}-success`;

    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(
      value !== undefined ? String(value).length > 0 : (defaultValue !== undefined ? String(defaultValue).length > 0 : false)
    );

    const inputRef = useRef<HTMLInputElement>(null);

    // Handle refs
    useEffect(() => {
      if (ref) {
        if (typeof ref === "function") {
          ref(inputRef.current);
        } else {
          ref.current = inputRef.current;
        }
      }
    }, [ref]);

    // Update hasValue when value prop changes
    useEffect(() => {
      if (value !== undefined) {
        queueMicrotask(() => setHasValue(String(value).length > 0));
      }
    }, [value]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value.length > 0);
      props.onChange?.(e);
    };

    const showFloatingLabel = floatingLabel && label && (isFocused || hasValue);

    // Size classes
    const sizeClasses = {
      sm: "h-10 px-3 text-sm",
      md: "h-12 px-4 text-base",
      lg: "h-14 px-5 text-lg",
    };

    // Container padding adjustments for icons
    const paddingClasses = {
      left: leftIcon ? "pl-11" : "",
      right: rightIcon || loading ? "pr-11" : "",
    };

    // State colors
    const getStateClasses = () => {
      if (error) {
 return "border-red-300 focus:border-red-500 focus:ring-red-500";
      }
      if (success) {
 return "border-v2-border focus:border-v2-red-primary focus:ring-v2-red-primary";
      }
 return "border-gray-300 focus:border-v2-red-primary focus:ring-v2-red-primary";
    };

    const inputClasses = cn(
      // Base styles
      "w-full rounded-lg border transition-all duration-200",
 "bg-white",
 "text-gray-900",
 "placeholder:text-gray-400",
 "disabled:bg-gray-100 disabled:cursor-not-allowed",
      // Focus styles
      "focus:outline-none focus:ring-2 focus:ring-offset-0",
      // Size
      sizeClasses[size],
      // Padding for icons
      paddingClasses.left,
      paddingClasses.right,
      // State colors
      getStateClasses(),
      // Custom className
      className
    );

    const labelClasses = cn(
      "absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200",
 "bg-white px-1",
 "text-gray-500",
      {
        "text-xs -translate-y-8 top-1/2": showFloatingLabel,
        "text-base": !showFloatingLabel,
      }
    );

    const containerClasses = cn(
      "relative w-full",
      {
        "opacity-50 pointer-events-none": disabled || loading,
      },
      containerClassName
    );

 const iconClasses = "absolute top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none";
    const leftIconClasses = cn(iconClasses, "left-3");
    const rightIconClasses = cn(
      iconClasses,
      "right-3",
 onRightIconClick && "pointer-events-auto cursor-pointer hover:text-gray-600"
    );

    return (
      <div className={containerClasses}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "block text-sm font-medium mb-1.5",
              error
 ? "text-red-600"
                : success
 ? "text-v2-green-positive"
 : "text-gray-700"
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && <span className={leftIconClasses}>{leftIcon}</span>}

          <input
            ref={inputRef}
            id={inputId}
            type={type}
            value={value}
            defaultValue={defaultValue}
            inputMode={inputMode}
            autoComplete={autoComplete}
            disabled={disabled || loading}
            className={inputClasses}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={cn(
              helperText && helperId,
              error && errorId,
              success && successId
            ).trim() || undefined}
            aria-required={required}
            {...props}
          />

          {(rightIcon || loading) && (
            <span
              className={rightIconClasses}
              onClick={onRightIconClick}
              role={onRightIconClick ? "button" : undefined}
              tabIndex={onRightIconClick ? 0 : undefined}
              aria-label={onRightIconClick ? "Clear input" : undefined}
              onKeyPress={(e) => {
                if (onRightIconClick && (e.key === "Enter" || e.key === " ")) {
                  onRightIconClick();
                }
              }}
            >
              {loading ? (
                <svg
                  className="animate-spin h-5 w-5 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
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
              ) : (
                rightIcon
              )}
            </span>
          )}
        </div>

        {/* Helper text, error, or success message */}
        {(helperText || error || success) && (
          <div className="mt-1.5 min-h-[20px]">
            {error && (
 <p id={errorId} className="text-sm text-red-600 flex items-center gap-1">
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
                <span>{error}</span>
              </p>
            )}
            {success && !error && (
 <p id={successId} className="text-sm text-v2-green-positive flex items-center gap-1">
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{success}</span>
              </p>
            )}
            {helperText && !error && !success && (
 <p id={helperId} className="text-sm text-gray-500">
                {helperText}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

FormInput.displayName = "FormInput";
