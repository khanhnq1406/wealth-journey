"use client";

import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { formatRelativeTime } from "../utils/time-format";
import { MoreHorizontal } from "lucide-react";

interface PostHeaderProps {
  authorId: number;
  authorName: string;
  authorPicture?: string;
  createdAt: number;
  isOwnPost: boolean;
  isFollowing?: boolean;
  onMenuClick?: () => void;
  onUserClick?: (userId: number) => void;
}

export function PostHeader({
  authorId,
  authorName,
  authorPicture,
  createdAt,
  isOwnPost,
  isFollowing = false,
  onMenuClick,
  onUserClick,
}: PostHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => onUserClick?.(authorId)}
          className="shrink-0"
          type="button"
        >
          <Avatar name={authorName} imageUrl={authorPicture} size="md" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUserClick?.(authorId)}
              className="font-roboto text-sm font-semibold text-v2-text-primary truncate hover:underline text-left"
              type="button"
            >
              {authorName}
            </button>
            {!isOwnPost && (
              <FollowButton
                targetUserId={authorId}
                initialIsFollowing={isFollowing}
                className="!px-2.5 !py-0.5 !text-[11px]"
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-v2-text-tertiary">
            <span className="font-roboto text-xs">
              {formatRelativeTime(createdAt)}
            </span>
          </div>
        </div>
      </div>

      {isOwnPost && onMenuClick && (
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded-lg hover:bg-v2-bg-primary transition-colors shrink-0"
          aria-label="Post options"
        >
          <MoreHorizontal size={18} className="text-v2-text-tertiary" />
        </button>
      )}
    </div>
  );
}
