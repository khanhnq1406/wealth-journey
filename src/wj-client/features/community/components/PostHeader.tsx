"use client";

import { Avatar } from "./Avatar";
import { TopicTag } from "./TopicTag";
import { formatRelativeTime } from "../utils/time-format";
import { MoreHorizontal } from "lucide-react";

interface PostHeaderProps {
  authorName: string;
  authorPicture?: string;
  topicTag?: string;
  createdAt: number;
  isOwnPost: boolean;
  onMenuClick?: () => void;
}

export function PostHeader({
  authorName,
  authorPicture,
  topicTag,
  createdAt,
  isOwnPost,
  onMenuClick,
}: PostHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={authorName} imageUrl={authorPicture} size="md" />
        <div className="min-w-0">
          <p className="font-vietnam text-sm font-semibold text-v2-text-primary truncate">
            {authorName}
          </p>
          <div className="flex items-center gap-1.5 text-v2-text-tertiary">
            <span className="font-jetbrains text-xs">
              {formatRelativeTime(createdAt)}
            </span>
            {topicTag && (
              <>
                <span className="text-xs">·</span>
                <TopicTag value={topicTag} />
              </>
            )}
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
