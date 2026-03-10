"use client";

import { Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface PostActionsProps {
  isLiked: boolean;
  onLikeToggle: () => void;
  onCommentClick: () => void;
  isLikeLoading?: boolean;
}

export function PostActions({
  isLiked,
  onLikeToggle,
  onCommentClick,
  isLikeLoading,
}: PostActionsProps) {
  return (
    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#EDE8E1]">
      <button
        onClick={onLikeToggle}
        disabled={isLikeLoading}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-lg transition-colors flex-1 justify-center",
          "font-vietnam text-sm font-medium",
          isLiked
            ? "text-[#DC2626] hover:bg-red-50"
            : "text-v2-text-secondary hover:bg-v2-bg-primary"
        )}
        aria-label={isLiked ? "Unlike" : "Like"}
      >
        <Heart
          size={18}
          className={cn(
            "transition-transform",
            isLiked ? "fill-[#DC2626] scale-110" : "fill-none"
          )}
        />
        <span>{isLiked ? "Đã thích" : "Thích"}</span>
      </button>

      <button
        onClick={onCommentClick}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg transition-colors font-vietnam text-sm font-medium text-v2-text-secondary hover:bg-v2-bg-primary flex-1 justify-center"
        aria-label="Comment"
      >
        <MessageCircle size={18} />
        <span>Bình luận</span>
      </button>
    </div>
  );
}
