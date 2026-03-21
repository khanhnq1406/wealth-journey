"use client";

import { useState } from "react";
import type { CommentItem } from "@/gen/protobuf/v1/community";
import { formatRelativeTime } from "../utils/time-format";
import { Avatar } from "./Avatar";
import { EditCommentForm } from "./EditCommentForm";

interface ReplyBubbleProps {
  reply: CommentItem;
  currentUserId: number;
  onDelete?: (commentId: number) => void;
}

function ReplyMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
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
          <div className="absolute right-0 top-6 z-20 bg-v2-maroon-800 border border-v2-gold-primary/20 rounded-lg shadow-lg py-1 min-w-[100px]">
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

export function ReplyBubble({ reply, currentUserId, onDelete }: ReplyBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentContent, setCurrentContent] = useState(reply.content);

  const isOwnReply = reply.userId === currentUserId;
  const authorName = reply.userName || "User";
  const authorPicture = reply.userPicture;

  return (
    <div className="flex gap-2 ml-8 mt-2">
      <Avatar name={authorName} imageUrl={authorPicture} size="sm" />
      <div className="flex-1">
        <div className="bg-[#FAF9F7] rounded-2xl px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <span className="font-roboto text-[13px] font-semibold text-v2-text-primary">{authorName}</span>
            {isOwnReply && !isEditing && (
              <ReplyMenu
                onEdit={() => setIsEditing(true)}
                onDelete={() => onDelete?.(reply.id)}
              />
            )}
          </div>
          {isEditing ? (
            <EditCommentForm
              commentId={reply.id}
              initialContent={currentContent}
              onSuccess={(newContent) => {
                setCurrentContent(newContent);
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <p className="text-sm break-words whitespace-pre-wrap mt-0.5">{currentContent}</p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3 mt-0.5">
          <span className="font-roboto text-[11px] text-v2-text-tertiary">
            {formatRelativeTime(reply.createdAt)}
          </span>
          {reply.isEdited && (
            <span className="text-xs text-gray-400">(edited)</span>
          )}
        </div>
      </div>
    </div>
  );
}
