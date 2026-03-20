import { cn } from "@/lib/utils/cn";

interface OrnateHeadingProps {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "text-sm sm:text-base font-semibold tracking-wider",
  md: "text-base sm:text-lg font-bold tracking-wider",
  lg: "text-lg sm:text-xl font-bold tracking-widest",
};

const lineWidthClasses = {
  sm: "min-w-6 sm:min-w-10",
  md: "min-w-8 sm:min-w-14",
  lg: "min-w-10 sm:min-w-20",
};

/**
 * Ornate section heading matching mihong.vn's "GIA VANG HIEN TAI" style.
 * Renders: ——◆—— HEADING TEXT ——◆——
 */
export function OrnateHeading({
  children,
  className,
  size = "md",
}: OrnateHeadingProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 sm:gap-4",
        "text-v2-gold-accent uppercase",
        sizeClasses[size],
        className
      )}
    >
      {/* Left decorative line */}
      <div className={cn("flex items-center flex-1", lineWidthClasses[size])}>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-v2-gold-primary" />
        <div className="w-1.5 h-1.5 rotate-45 bg-v2-gold-primary mx-1 flex-shrink-0" />
        <div className="w-4 sm:w-6 h-px bg-v2-gold-primary" />
      </div>

      {/* Heading text */}
      <span className="flex-shrink-0 whitespace-nowrap">{children}</span>

      {/* Right decorative line */}
      <div className={cn("flex items-center flex-1", lineWidthClasses[size])}>
        <div className="w-4 sm:w-6 h-px bg-v2-gold-primary" />
        <div className="w-1.5 h-1.5 rotate-45 bg-v2-gold-primary mx-1 flex-shrink-0" />
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-v2-gold-primary" />
      </div>
    </div>
  );
}
