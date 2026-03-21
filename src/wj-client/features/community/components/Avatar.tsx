"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  priority?: boolean;
}

const sizeMap = {
  sm: { className: "w-8 h-8 text-xs", px: 32 },
  md: { className: "w-9 h-9 text-xs", px: 36 },
  // lg: base is 40px but ProfileCard overrides to 72px via className; use 96 to cover both cases
  lg: { className: "w-10 h-10 text-sm", px: 96 },
};

export function Avatar({ name, imageUrl, size = "md", className, priority = false }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || "U").charAt(0).toUpperCase();
  const { className: sizeClass, px } = sizeMap[size];

  if (imageUrl && !imgError) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={px}
        height={px}
        priority={priority}
        className={cn(
          "rounded-full object-cover shrink-0",
          sizeClass,
          className
        )}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-b from-[#B8860B] to-[#D4A017] flex items-center justify-center shrink-0",
        sizeClass,
        className
      )}
    >
      <span className="text-white font-roboto font-semibold">{initial}</span>
    </div>
  );
}
