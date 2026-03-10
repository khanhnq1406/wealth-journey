"use client";

import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-8 h-8 text-xs",
  md: "w-9 h-9 text-xs",
  lg: "w-10 h-10 text-sm",
};

export function Avatar({ name, imageUrl, size = "md", className }: AvatarProps) {
  const initial = (name || "U").charAt(0).toUpperCase();

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn(
          "rounded-full object-cover shrink-0",
          sizeMap[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-b from-[#B8860B] to-[#D4A017] flex items-center justify-center shrink-0",
        sizeMap[size],
        className
      )}
    >
      <span className="text-white font-vietnam font-semibold">{initial}</span>
    </div>
  );
}
