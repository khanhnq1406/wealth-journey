"use client";

import { useState, useCallback } from "react";
import { useQueryGetReplies, useMutationDeleteComment, EVENT_CommunityGetReplies } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { ReplyBubble } from "./ReplyBubble";

interface ReplyListProps {
  commentId: number;
  replyCount: number;
  postId: number;
  currentUserId: number;
}

export function ReplyList({ commentId, replyCount, postId: _postId, currentUserId }: ReplyListProps) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQueryGetReplies(
    {
      commentId,
      pagination: { page, pageSize, orderBy: "", order: "" },
    },
    {
      enabled: expanded,
      staleTime: 30000,
    }
  );

  const deleteCommentMutation = useMutationDeleteComment({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetReplies, { commentId }] });
    },
  });

  const handleDelete = useCallback(
    (replyId: number) => {
      deleteCommentMutation.mutate({ commentId: replyId });
    },
    [deleteCommentMutation]
  );

  if (replyCount === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-8 text-xs text-bg font-medium hover:underline mt-1"
      >
        {expanded ? "Hide replies" : `View ${replyCount} ${replyCount === 1 ? "reply" : "replies"}`}
      </button>

      {expanded && (
        <div>
          {isLoading && (
            <div className="ml-8 mt-2 text-xs text-gray-400">Loading replies...</div>
          )}
          {data?.replies?.map((reply) => (
            <ReplyBubble
              key={reply.id}
              reply={reply}
              currentUserId={currentUserId}
              onDelete={handleDelete}
            />
          ))}
          {data?.pagination && data.pagination.totalPages > page && (
            <button
              onClick={() => setPage(page + 1)}
              className="ml-8 text-xs text-bg hover:underline mt-2"
            >
              Load more replies
            </button>
          )}
        </div>
      )}
    </div>
  );
}
