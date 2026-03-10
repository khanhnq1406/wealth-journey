"use client";

import { useState } from "react";
import { useQueryGetComments, useMutationCreateComment } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { CommentBubble } from "./CommentBubble";
import { Avatar } from "./Avatar";
import { store } from "@/features/auth/store/store";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface CommentSectionProps {
  postId: number;
}

export function CommentSection({ postId }: CommentSectionProps) {
  const [commentText, setCommentText] = useState("");
  const [page, setPage] = useState(1);
  const user = store.getState().setAuthReducer;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQueryGetComments(
    { postId, page, pageSize: 5 },
    { refetchOnMount: "always" }
  );

  const createCommentMutation = useMutationCreateComment({
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["GetComments"] });
      queryClient.invalidateQueries({ queryKey: ["GetFeed"] });
    },
  });

  const handleSubmit = () => {
    if (!commentText.trim()) return;
    createCommentMutation.mutate({
      postId,
      content: commentText.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const comments = data?.comments ?? [];

  return (
    <div className="mt-3 pt-3 border-t border-[#EDE8E1]">
      {/* Comments list */}
      <div className="flex flex-col gap-3 mb-3">
        {isLoading && (
          <p className="text-xs text-v2-text-tertiary font-vietnam text-center py-2">
            Loading...
          </p>
        )}
        {comments.map((comment) => (
          <CommentBubble
            key={comment.commentId}
            authorName={comment.authorName ?? ""}
            authorPicture={comment.authorPicture}
            content={comment.content ?? ""}
            createdAt={comment.createdAt ?? 0}
          />
        ))}
        {data?.hasMore && (
          <button
            onClick={() => setPage((p) => p + 1)}
            className="text-xs font-vietnam font-medium text-v2-red-primary hover:text-v2-red-dark transition-colors py-1"
          >
            Xem thêm bình luận
          </button>
        )}
      </div>

      {/* Add comment input */}
      <div className="flex items-center gap-2">
        <Avatar
          name={user?.fullname || "User"}
          imageUrl={user?.picture}
          size="sm"
        />
        <div className="flex-1 flex items-center gap-2 bg-[#FAF9F7] rounded-full px-3 py-1.5">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Viết bình luận..."
            maxLength={500}
            className="flex-1 bg-transparent font-vietnam text-[13px] text-v2-text-primary placeholder:text-v2-text-tertiary focus:outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={!commentText.trim() || createCommentMutation.isPending}
            className={cn(
              "p-1 rounded-full transition-colors",
              commentText.trim()
                ? "text-v2-red-primary hover:bg-v2-red-light"
                : "text-v2-text-tertiary"
            )}
            aria-label="Send comment"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
