"use client";

import { Heart, MessageCircle, Share2, Bookmark, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useNotification } from "@/contexts/NotificationContext";

interface PostActionsProps {
  isLiked: boolean;
  onLikeToggle: () => void;
  onCommentClick: () => void;
  onShareClick?: () => void;
  onSaveToggle?: () => void;
  isSaved?: boolean;
  isLikeLoading?: boolean;
  isSaveLoading?: boolean;
}

export function PostActions({
  isLiked,
  onLikeToggle,
  onCommentClick,
  onShareClick,
  onSaveToggle,
  isSaved,
  isLikeLoading,
  isSaveLoading,
}: PostActionsProps) {
  const { toast } = useNotification();

  return (
    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-v2-gold-primary/30">
      <button
        onClick={onLikeToggle}
        disabled={isLikeLoading}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors flex-1 justify-center",
          "font-roboto text-sm font-medium",
          isLiked
            ? "text-v2-red-negative hover:bg-v2-red-light"
            : "text-v2-text-secondary hover:bg-v2-maroon-600"
        )}
        aria-label={isLiked ? "Unlike" : "Like"}
      >
        <Heart
          size={18}
          className={cn(
            "transition-transform",
            isLiked ? "fill-v2-red-negative scale-110" : "fill-none"
          )}
        />
        <span className="hidden sm:inline">{isLiked ? "Đã thích" : "Thích"}</span>
      </button>

      <button
        onClick={onCommentClick}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors font-roboto text-sm font-medium text-v2-text-secondary hover:bg-v2-maroon-600 flex-1 justify-center"
        aria-label="Comment"
      >
        <MessageCircle size={18} />
        <span className="hidden sm:inline">Bình luận</span>
      </button>

      {onShareClick && (
        <button
          onClick={onShareClick}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors font-roboto text-sm font-medium text-v2-text-secondary hover:bg-v2-maroon-600 flex-1 justify-center"
          aria-label="Share"
        >
          <Share2 size={18} />
          <span className="hidden sm:inline">Chia sẻ</span>
        </button>
      )}

      {onSaveToggle && (
        <button
          onClick={onSaveToggle}
          disabled={isSaveLoading}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors font-roboto text-sm font-medium flex-1 justify-center",
            isSaved
              ? "text-v2-gold-primary hover:bg-v2-maroon-600"
              : "text-v2-text-secondary hover:bg-v2-maroon-600"
          )}
          aria-label={isSaved ? "Unsave" : "Save"}
        >
          <Bookmark
            size={18}
            className={cn(isSaved ? "fill-v2-gold-primary" : "fill-none")}
          />
          <span className="hidden sm:inline">{isSaved ? "Đã lưu" : "Lưu"}</span>
        </button>
      )}

      <button
        onClick={() => toast.info("Tính năng Tặng sao sẽ sớm được ra mắt!")}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors font-roboto text-sm font-medium text-v2-text-secondary hover:bg-v2-maroon-600 flex-1 justify-center"
        aria-label="Donate stars"
      >
        <Star size={18} />
        <span className="hidden sm:inline">Tặng sao</span>
      </button>
    </div>
  );
}
