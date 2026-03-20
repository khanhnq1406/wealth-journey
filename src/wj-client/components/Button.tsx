import { ButtonType } from "@/app/constants";
import { CheckIcon, LoadingSpinnerIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";
import React from "react";

type PropType = {
  type?: string;
  onClick?: React.MouseEventHandler;
  children?: React.ReactNode;
  src?: string | undefined;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
  // Enhanced props
  variant?: "primary" | "secondary" | "ghost" | "link" | "danger" | "success";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  iconOnly?: boolean;
  success?: boolean;
  href?: string;
  target?: string;
  download?: boolean;
  // HTML button type attribute
  htmlType?: "button" | "submit" | "reset";
};

export const Button = React.memo(function Button({
  type,
  src,
  onClick,
  children,
  loading = false,
  disabled = false,
  className = "",
  "aria-label": ariaLabel,
  "aria-pressed": ariaPressed,
  fullWidth = true,
  size = "md",
  variant,
  leftIcon,
  rightIcon,
  iconOnly,
  success = false,
  href,
  target,
  download,
  htmlType = "button",
}: PropType) {
  // Determine button variant from type or variant prop
  const buttonVariant =
    variant ||
    (type === ButtonType.PRIMARY
      ? "primary"
      : type === ButtonType.SECONDARY
        ? "secondary"
        : "primary");

  // Size variants
  const sizeClasses = {
    sm: iconOnly
      ? "p-2 min-h-[36px] min-w-[36px]"
      : "py-2 px-3 sm:px-4 text-sm min-h-[44px] sm:min-h-[40px]",
    md: iconOnly
      ? "p-2.5 min-h-[40px] min-w-[40px]"
      : "py-2.5 sm:py-3 px-4 sm:px-6 text-base min-h-[44px] sm:min-h-[48px]",
    lg: iconOnly
      ? "p-3 min-h-[48px] min-w-[48px]"
      : "py-3 sm:py-4 px-6 sm:px-8 text-lg min-h-[48px] sm:min-h-[56px]",
  };

  // Base classes for all buttons
  const baseClasses = cn(
    "font-semibold rounded-lg cursor-pointer",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-bg-primary",
    "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
    "flex items-center justify-center gap-2 sm:gap-3",
    "transition-all duration-200 ease-in-out",
    "active:scale-[0.98]",
    sizeClasses[size],
  );

  // Variant-specific classes (using semantic design system colors)
  const variantClasses = {
    primary: cn(
      "bg-v2-gold-primary text-v2-bg-dark",
      "hover:bg-v2-gold-dark hover:shadow-md",
      "active:bg-v2-gold-accent",
    ),
    secondary: cn(
      "bg-transparent text-v2-gold-primary border-2 border-v2-gold-primary",
      "hover:bg-v2-gold-primary/10 hover:shadow-md",
      "active:bg-v2-gold-primary/20",
    ),
    ghost: cn(
      "bg-transparent text-v2-gold-accent",
      "hover:bg-v2-bg-surface-tint",
      "active:bg-v2-bg-surface",
    ),
    link: cn(
      "bg-transparent text-v2-gold-primary",
      "hover:underline",
      "hover:bg-transparent",
      "p-0 min-h-0",
    ),
    danger: cn(
      "bg-danger-600 text-white",
      "hover:bg-danger-700 hover:shadow-md",
      "active:bg-danger-800",
    ),
    success: cn(
      "bg-success-600 text-white",
      "hover:bg-success-700 hover:shadow-md",
      "active:bg-success-800",
    ),
  };

  // Content to render
  const renderContent = () => {
    if (loading) {
      return (
        <>
          <LoadingSpinnerIcon size="md" className="text-current" />
          {!iconOnly && children}
        </>
      );
    }

    if (success && !loading) {
      return (
        <>
          <CheckIcon size="md" />
          {!iconOnly && (children || "Success")}
        </>
      );
    }

    return (
      <>
        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        {!iconOnly && children}
        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </>
    );
  };

  // Common props
  const commonProps = {
    className: cn(
      baseClasses,
      variantClasses[buttonVariant],
      fullWidth && !iconOnly && buttonVariant !== "link" ? "w-full" : "w-auto",
      className,
    ),
    onClick: href ? undefined : onClick,
    disabled: loading || disabled || success,
    "aria-label": ariaLabel,
    "aria-pressed": ariaPressed,
    "aria-busy": loading,
    type: htmlType,
  };

  // Image button (legacy type)
  if (type === ButtonType.IMG) {
    return (
      <button
        type={htmlType}
        className={cn(
          "!p-2.5 sm:!p-2 !min-h-[44px] sm:!min-h-[48px] !min-w-[44px] sm:!min-w-[48px] !w-auto",
          "bg-transparent",
          "hover:bg-v2-bg-surface-tint",
          "rounded-full",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-gold-primary focus-visible:ring-offset-2 focus-visible:ring-offset-v2-bg-primary",
          "transition-all duration-200 ease-in-out",
          "active:scale-[0.95]",
          "flex items-center justify-center",
          className,
        )}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        disabled={loading || disabled}
        aria-busy={loading}
      >
        {loading ? (
          <LoadingSpinnerIcon size="md" className="text-v2-gold-primary" />
        ) : src ? (
          <img src={src} alt="" className="w-5 h-5" />
        ) : null}
      </button>
    );
  }

  // Link variant renders as anchor tag
  if (buttonVariant === "link" && href) {
    return (
      <a
        href={href}
        target={target}
        download={download}
        className={commonProps.className}
        aria-label={ariaLabel}
      >
        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </a>
    );
  }

  // Regular button
  if (href) {
    return (
      <a href={href} target={target} download={download} {...commonProps}>
        {renderContent()}
      </a>
    );
  }

  return <button {...commonProps}>{renderContent()}</button>;
});
