import { cn } from "@/lib/utils/cn";

interface OrnateDividerProps {
  className?: string;
  variant?: "simple" | "ornate" | "diamond";
}

/**
 * Gold horizontal divider matching mihong.vn's ornate style.
 */
export function OrnateDivider({
  className,
  variant = "simple",
}: OrnateDividerProps) {
  if (variant === "simple") {
    return (
      <div
        className={cn(
          "h-px bg-gradient-to-r from-transparent via-v2-gold-primary to-transparent",
          className
        )}
      />
    );
  }

  if (variant === "diamond") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-v2-gold-primary" />
        <div className="w-1.5 h-1.5 rotate-45 bg-v2-gold-primary flex-shrink-0" />
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-v2-gold-primary" />
      </div>
    );
  }

  // ornate: line — diamond — short line — diamond — line
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-v2-gold-primary" />
      <div className="w-1 h-1 rotate-45 bg-v2-gold-primary flex-shrink-0" />
      <div className="w-3 sm:w-5 h-px bg-v2-gold-accent" />
      <div className="w-1.5 h-1.5 rotate-45 bg-v2-gold-accent flex-shrink-0" />
      <div className="w-3 sm:w-5 h-px bg-v2-gold-accent" />
      <div className="w-1 h-1 rotate-45 bg-v2-gold-primary flex-shrink-0" />
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-v2-gold-primary" />
    </div>
  );
}
