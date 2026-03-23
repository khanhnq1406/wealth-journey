"use client";

import { useState, useRef, useEffect } from "react";
import { useMutationCreateComment } from "@/utils/generated/hooks";
import { Avatar } from "./Avatar";

interface ReplyInputProps {
  postId: number;
  parentCommentId: number;
  currentUser: { id: number; name: string; picture: string };
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReplyInput({
  postId,
  parentCommentId,
  currentUser,
  onSuccess,
  onCancel,
}: ReplyInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const createCommentMutation = useMutationCreateComment({
    onSuccess: () => {
      setContent("");
      onSuccess();
    },
  });

  const handleSubmit = () => {
    if (!content.trim() || createCommentMutation.isPending) return;
    createCommentMutation.mutate({
      postId,
      content: content.trim(),
      parentCommentId,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="flex gap-2 ml-8 mt-2">
      <Avatar name={currentUser.name} imageUrl={currentUser.picture} size="sm" />
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Reply..."
          className="w-full text-sm border border-v2-gold-primary/20 rounded-lg px-3 py-2 bg-v2-maroon-900 text-v2-gold-accent placeholder:text-v2-text-tertiary resize-none focus:outline-none focus:border-v2-gold-primary"
          rows={2}
          maxLength={500}
        />
        <div className="flex justify-end gap-2 mt-1">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-v2-text-secondary hover:text-v2-gold-accent px-2 py-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || createCommentMutation.isPending}
            className="text-xs bg-v2-gold-primary text-v2-maroon-900 px-3 py-1 rounded-md hover:bg-v2-gold-accent disabled:opacity-50"
          >
            {createCommentMutation.isPending ? "Replying..." : "Reply"}
          </button>
        </div>
      </div>
    </div>
  );
}
