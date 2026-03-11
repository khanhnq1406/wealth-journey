"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "../utils/time-format";
import { EditCommentForm } from "./EditCommentForm";
import { ReplyInput } from "./ReplyInput";

interface CommentBubbleProps {
  commentId: number;
  authorName: string;
  authorPicture?: string;
  content: string;
  createdAt: number;
  isOwnComment: boolean;
  isEdited?: boolean;
  onDelete?: (commentId: number) => void;
  postId?: number;
  currentUser?: { id: number; name: string; picture: string };
  isReply?: boolean;
  onReplyAdded?: () => void;
}

function CommentMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-20 bg-white border border-gray-100 rounded-lg shadow-lg py-1 min-w-[100px]">
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-gray-50"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function CommentBubble({
  commentId,
  authorName,
  authorPicture,
  content,
  createdAt,
  isOwnComment,
  isEdited,
  onDelete,
  postId,
  currentUser,
  isReply = false,
  onReplyAdded,
}: CommentBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentContent, setCurrentContent] = useState(content);
  const [showReplyInput, setShowReplyInput] = useState(false);

  return (
    <div className="flex items-start gap-2">
      <Avatar name={authorName} imageUrl={authorPicture} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="bg-[#FAF9F7] rounded-xl px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="font-vietnam text-[13px] font-semibold text-v2-text-primary">
              {authorName}
            </p>
            {isOwnComment && !isEditing && (
              <CommentMenu
                onEdit={() => setIsEditing(true)}
                onDelete={() => onDelete?.(commentId)}
              />
            )}
          </div>
          {isEditing ? (
            <EditCommentForm
              commentId={commentId}
              initialContent={currentContent}
              onSuccess={(newContent) => {
                setCurrentContent(newContent);
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <p className="text-sm break-words whitespace-pre-wrap">{currentContent}</p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-3 mt-0.5">
          <span className="font-jetbrains text-[11px] text-v2-text-tertiary inline-block">
            {formatRelativeTime(createdAt)}
          </span>
          {isEdited && (
            <span className="text-xs text-gray-400 ml-1">(edited)</span>
          )}
          {!isReply && currentUser && postId !== undefined && (
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="text-xs text-gray-500 hover:text-bg ml-2"
            >
              Reply
            </button>
          )}
        </div>
        {!isReply && showReplyInput && currentUser && postId !== undefined && (
          <ReplyInput
            postId={postId}
            parentCommentId={commentId}
            currentUser={currentUser}
            onSuccess={() => {
              setShowReplyInput(false);
              onReplyAdded?.();
            }}
            onCancel={() => setShowReplyInput(false)}
          />
        )}
      </div>
    </div>
  );
}
