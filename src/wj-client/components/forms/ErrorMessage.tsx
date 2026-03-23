"use client";

import { cn } from "@/lib/utils/cn";

interface ErrorMessageProps {
  id?: string;
  children: React.ReactNode;
  severity?: "error" | "warning" | "info";
  className?: string;
}

export const ErrorMessage = ({
  id,
  children,
  severity = "error",
  className,
}: ErrorMessageProps) => {
  // Severity-based styling — mihong v2 maroon/gold theme
  const styles = {
    error: "bg-v2-bg-dark border-v2-red-negative/30 text-v2-red-negative",
    warning: "bg-v2-bg-dark border-v2-border-light text-v2-gold-accent",
    info: "bg-v2-bg-dark border-v2-border-light text-v2-text-tertiary",
  };

  // Icons for each severity level
  const icons = {
    error: (
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    ),
    warning: (
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    info: (
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
  };

  // ARIA role based on severity
  const role = severity === "error" ? "alert" : "status";

  return (
    <div
      id={id}
      className={cn(
        "flex items-start gap-3 p-3 sm:p-4 rounded-lg border mt-2",
        styles[severity],
        className
      )}
      role={role}
      aria-live={severity === "error" ? "assertive" : "polite"}
    >
      <div className="flex-shrink-0">{icons[severity]}</div>
      <p className="text-sm font-medium flex-1">{children}</p>
    </div>
  );
};
