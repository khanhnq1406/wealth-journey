"use client";

import { useFollow } from "../hooks/useFollow";
import { cn } from "@/lib/utils/cn";

interface FollowButtonProps {
  targetUserId: number;
  initialIsFollowing: boolean;
  className?: string;
}

export function FollowButton({
  targetUserId,
  initialIsFollowing,
  className,
}: FollowButtonProps) {
  const { isFollowing, toggle, isLoading } = useFollow(targetUserId, initialIsFollowing);

  return (
    <button
      onClick={toggle}
      disabled={isLoading}
      className={cn(
        "px-4 py-1.5 rounded-full text-[13px] font-vietnam font-semibold transition-colors",
        isFollowing
          ? "bg-white border border-v2-border-light text-v2-text-secondary hover:bg-v2-bg-primary"
          : "bg-[#B91C1C] text-white hover:bg-[#991B1B]",
        isLoading && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      {isFollowing ? "Đang theo dõi" : "Theo dõi"}
    </button>
  );
}
