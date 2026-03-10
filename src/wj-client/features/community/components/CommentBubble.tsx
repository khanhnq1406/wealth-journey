"use client";

import { Avatar } from "./Avatar";
import { formatRelativeTime } from "../utils/time-format";

interface CommentBubbleProps {
  authorName: string;
  authorPicture?: string;
  content: string;
  createdAt: number;
}

export function CommentBubble({
  authorName,
  authorPicture,
  content,
  createdAt,
}: CommentBubbleProps) {
  return (
    <div className="flex items-start gap-2">
      <Avatar name={authorName} imageUrl={authorPicture} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="bg-[#FAF9F7] rounded-xl px-3 py-2">
          <p className="font-vietnam text-[13px] font-semibold text-v2-text-primary">
            {authorName}
          </p>
          <p className="font-vietnam text-[13px] text-v2-text-primary leading-relaxed whitespace-pre-wrap break-words">
            {content}
          </p>
        </div>
        <span className="font-jetbrains text-[11px] text-v2-text-tertiary ml-3 mt-0.5 inline-block">
          {formatRelativeTime(createdAt)}
        </span>
      </div>
    </div>
  );
}
