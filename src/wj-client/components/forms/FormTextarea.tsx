"use client";

import { useController, UseControllerProps } from "react-hook-form";
import { useState, useEffect, useRef, useCallback } from "react";
import { Label } from "./Label";
import { ErrorMessage } from "./ErrorMessage";
import { cn } from "@/lib/utils/cn";

interface FormTextareaProps extends Omit<UseControllerProps, "control"> {
  control: any; // Control type causes generic issues with RHF, using any as workaround
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  rows?: number;
  maxLength?: number;
  showCharacterCount?: boolean;
  helperText?: string;
  autoResize?: boolean;
  maxHeight?: number;
}

export const FormTextarea = ({
  label,
  placeholder = "",
  required = false,
  disabled = false,
  className = "",
  rows = 3,
  maxLength = 500,
  showCharacterCount = false,
  helperText,
  autoResize = false,
  maxHeight = 200,
  ...props
}: FormTextareaProps) => {
  const {
    field,
    fieldState: { error },
  } = useController(props);

  // Internal ref for auto-resize functionality
  const internalRef = useRef<HTMLTextAreaElement>(null);

  // Extract field properties without ref
  const { ref: fieldRef, onChange: fieldOnChange, onBlur: fieldOnBlur, name: fieldName, value: fieldValue } = field;

  // Store field ref in a mutable object to avoid modifying the original ref
  const fieldRefValue = useRef<HTMLTextAreaElement | null>(null);

  // Merge refs to support both the field.ref from useController and our internal ref
  const setRef = useCallback((ref: HTMLTextAreaElement | null) => {
    // Set the field ref (from react-hook-form)
    if (typeof fieldRef === "function") {
      fieldRef(ref);
    } else if (fieldRef) {
      // Store in our wrapper instead of modifying the original ref
      fieldRefValue.current = ref;
    }
    // Set our internal ref
    internalRef.current = ref;
  }, [fieldRef]);

  const currentLength = String(fieldValue || "").length;
  const isNearLimit = maxLength && currentLength > maxLength * 0.9;
  const isAtLimit = maxLength && currentLength >= maxLength;
  const hasError = !!error;

  const errorId = `${props.name}-error`;
  const helperId = `${props.name}-helper`;

  // Auto-resize functionality
  useEffect(() => {
    if (autoResize && internalRef.current) {
      const textarea = internalRef.current;
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [fieldValue, autoResize, maxHeight]);

  return (
    <div className={cn("mb-3 sm:mb-4", className)}>
      <div className="flex justify-between items-start">
        <Label htmlFor={props.name} required={required}>
          {label}
        </Label>
        {showCharacterCount && maxLength && (
          <span
            className={cn(
              "text-xs ml-2 transition-colors",
              isAtLimit
 ? "text-v2-red-negative font-medium"
                : isNearLimit
 ? "text-warning-600"
 : "text-v2-text-tertiary"
            )}
            aria-live="polite"
          >
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
      <div className="relative mt-1 sm:mt-1.5">
        <textarea
          ref={setRef}
          id={props.name}
          name={fieldName}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          value={fieldValue}
          onChange={fieldOnChange}
          onBlur={fieldOnBlur}
          className={cn(
            // IMPORTANT: Font size must be at least 16px (text-base) to prevent iOS auto-zoom
            "w-full text-base sm:text-base min-h-[44px] sm:min-h-[48px]",
            "px-3 sm:px-4 py-2.5 sm:py-3",
            "rounded-lg",
            "border transition-all duration-200",
 "bg-v2-bg-dark",
 "text-v2-gold-accent",
 "placeholder:text-v2-text-placeholder",
            // Focus states - single ring (clean, modern)
            "focus:outline-none focus:ring-2 focus:ring-v2-gold-primary focus:border-transparent",
            // Error states
            hasError && "border-v2-red-negative focus:ring-v2-red-negative focus:border-transparent",
 !hasError && "border-v2-border-light hover:border-v2-border-light",
            // Disabled states
 "disabled:opacity-40 disabled:cursor-not-allowed",
            // Resize
            autoResize ? "resize-none overflow-hidden" : "resize-y"
          )}
          style={
            autoResize
              ? { minHeight: `${Math.max(rows * 24, 44)}px`, maxHeight: `${maxHeight}px` }
              : undefined
          }
          aria-invalid={hasError ? "true" : "false"}
          aria-describedby={cn(
            hasError && errorId,
            helperText && !hasError && helperId
          )}
        />
      </div>
      {/* Helper text */}
      {helperText && !hasError && (
 <p id={helperId} className="mt-1.5 text-xs sm:text-sm text-v2-text-tertiary">
          {helperText}
        </p>
      )}
      {error && (
        <ErrorMessage id={errorId}>{error.message}</ErrorMessage>
      )}
    </div>
  );
};
