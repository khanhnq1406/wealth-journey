"use client";

import { useState } from "react";
import { useQueryGetComments, useMutationCreateComment, useMutationDeleteComment, EVENT_CommunityGetComments, EVENT_CommunityGetFeed } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { CommentBubble } from "./CommentBubble";
import { ReplyList } from "./ReplyList";
import { Avatar } from "./Avatar";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface CommentSectionProps {
  postId: number;
  currentUser: { id: number; name: string; picture: string };
}

export function CommentSection({ postId, currentUser }: CommentSectionProps) {
  const [commentText, setCommentText] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQueryGetComments(
    { postId, pagination: { page, pageSize: 5, orderBy: "", order: "" } },
    { refetchOnMount: "always" }
  );

  const createCommentMutation = useMutationCreateComment({
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetComments] });
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetFeed] });
    },
  });

  const deleteCommentMutation = useMutationDeleteComment({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetComments] });
    },
  });

  const handleDeleteComment = (commentId: number) => {
    deleteCommentMutation.mutate({ commentId });
  };

  const handleSubmit = () => {
    if (!commentText.trim()) return;
    createCommentMutation.mutate({
      postId,
      content: commentText.trim(),
      parentCommentId: 0,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const comments = data?.comments ?? [];
  const pagination = data?.pagination;
  const hasMore = pagination ? pagination.page < pagination.totalPages : false;

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
          <div key={comment.id}>
            <CommentBubble
              commentId={comment.id}
              authorName={comment.userName ?? ""}
              authorPicture={comment.userPicture}
              content={comment.content ?? ""}
              createdAt={comment.createdAt ?? 0}
              isOwnComment={comment.userId === currentUser.id}
              isEdited={comment.isEdited}
              postId={postId}
              currentUser={currentUser}
              isReply={false}
              onDelete={handleDeleteComment}
              onReplyAdded={() => {
                queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetComments] });
              }}
            />
            <ReplyList
              commentId={comment.id}
              replyCount={comment.replyCount ?? 0}
              postId={postId}
              currentUserId={currentUser.id}
            />
          </div>
        ))}
        {hasMore && (
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
          name={currentUser.name}
          imageUrl={currentUser.picture}
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
              commentText.trim() && !createCommentMutation.isPending
                ? "text-v2-red-primary hover:bg-v2-red-light"
                : "text-v2-text-tertiary"
            )}
            aria-label="Send comment"
          >
            {createCommentMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
