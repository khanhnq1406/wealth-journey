"use client";

interface PostEngagementProps {
  likeCount: number;
  commentCount: number;
  shareCount?: number;
  onCommentsClick?: () => void;
}

export function PostEngagement({
  likeCount,
  commentCount,
  shareCount,
  onCommentsClick,
}: PostEngagementProps) {
  if (likeCount === 0 && commentCount === 0 && !shareCount) return null;

  return (
    <div className="flex items-center justify-between mt-3 px-1">
      <div className="flex items-center gap-3">
        {likeCount > 0 && (
          <span className="font-jetbrains text-xs text-v2-text-tertiary">
            {likeCount} lượt thích
          </span>
        )}
        {shareCount != null && shareCount > 0 && (
          <span className="font-jetbrains text-xs text-v2-text-tertiary">
            {shareCount} chia sẻ
          </span>
        )}
      </div>
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
