"use client";

import { cn } from "@/lib/utils/cn";

interface LabelProps {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Label = ({
  htmlFor,
  required = false,
  children,
  className = "",
}: LabelProps) => {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-sm font-medium cursor-pointer",
        // Light mode
        "text-neutral-700",
        // Dark mode
 "",
        className
      )}
    >
      {children}
      {required ? (
 <span className="required" aria-label="required">
          *
        </span>
      ) : null}
    </label>
  );
};
