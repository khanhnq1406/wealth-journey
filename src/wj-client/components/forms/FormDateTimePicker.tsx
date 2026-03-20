"use client";

import { useController, UseControllerProps } from "react-hook-form";
import { Label } from "./Label";
import { ErrorMessage } from "./ErrorMessage";
import { cn } from "@/lib/utils/cn";

interface FormDateTimePickerProps extends Omit<UseControllerProps, "control"> {
  control: any; // Control type causes generic issues with RHF, using any as workaround
  label: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showTime?: boolean;
}

export const FormDateTimePicker = ({
  label,
  required = false,
  disabled = false,
  className = "",
  showTime = true,
  ...props
}: FormDateTimePickerProps) => {
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController(props);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const inputValue = value || "";

  return (
    <div className={cn("mb-3 sm:mb-4", className)}>
      <Label htmlFor={props.name} required={required}>
        {label}
      </Label>
      <input
        id={props.name}
        type={showTime ? "datetime-local" : "date"}
        disabled={disabled}
        value={inputValue}
        onChange={handleChange}
        onBlur={onBlur}
        ref={ref}
        className={cn(
          "w-full text-sm sm:text-base min-h-[44px] sm:min-h-[48px]",
          "px-3 sm:px-4 py-2.5 sm:py-3 mt-1",
          "rounded-lg",
          "border transition-all duration-200",
 "bg-white",
 "text-neutral-900",
          // Focus styles - single ring (clean, modern)
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
          // Error states
          error && "border-danger-500 focus:ring-danger-500 focus:border-transparent",
 !error && "border-neutral-300 hover:border-neutral-400",
          // Disabled states
 "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-50",
        )}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${props.name}-error` : undefined}
      />
      {error && (
        <ErrorMessage id={`${props.name}-error`}>{error.message}</ErrorMessage>
      )}
    </div>
  );
};
