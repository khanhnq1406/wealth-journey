"use client";

interface PostEngagementProps {
  likeCount: number;
  commentCount: number;
  onCommentsClick?: () => void;
}

export function PostEngagement({
  likeCount,
  commentCount,
  onCommentsClick,
}: PostEngagementProps) {
  if (likeCount === 0 && commentCount === 0) return null;

  return (
    <div className="flex items-center justify-between mt-3 px-1">
      {likeCount > 0 && (
        <span className="font-jetbrains text-xs text-v2-text-tertiary">
          {likeCount} lượt thích
        </span>
      )}
      {commentCount > 0 && (
        <button
          onClick={onCommentsClick}
          className="font-jetbrains text-xs text-v2-text-tertiary hover:text-v2-text-secondary transition-colors"
        >
          {commentCount} bình luận
        </button>
      )}
    </div>
  );
}
