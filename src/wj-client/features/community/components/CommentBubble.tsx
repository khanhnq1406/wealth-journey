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
        className="text-v2-text-tertiary hover:text-v2-gold-accent text-lg leading-none px-1"
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-20 bg-v2-maroon-800 border border-v2-gold-primary/20 rounded-lg shadow-lg py-1 min-w-[100px]">
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full text-left px-3 py-2 text-sm text-v2-gold-accent hover:bg-v2-maroon-700"
            >
              Edit
            </button>
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full text-left px-3 py-2 text-sm text-v2-red-negative hover:bg-v2-maroon-700"
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
        <div className="bg-v2-maroon-900 rounded-xl px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="font-roboto text-[13px] font-semibold text-v2-text-primary">
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
            <p className="text-sm text-v2-gold-accent break-words whitespace-pre-wrap">{currentContent}</p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-3 mt-0.5">
          <span className="font-roboto text-[11px] text-v2-text-tertiary inline-block">
            {formatRelativeTime(createdAt)}
          </span>
          {isEdited && (
            <span className="text-xs text-v2-text-tertiary ml-1">(edited)</span>
          )}
          {!isReply && currentUser && postId !== undefined && (
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="text-xs text-v2-text-secondary hover:text-v2-gold-primary ml-2"
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
