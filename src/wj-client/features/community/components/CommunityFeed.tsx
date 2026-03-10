"use client";

import { useState } from "react";
import { useQueryGetFeed } from "@/utils/generated/hooks";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { PostCard } from "./PostCard";
import { store } from "@/features/auth/store/store";

interface CommunityFeedProps {
  topicFilter: string;
}

export function CommunityFeed({ topicFilter }: CommunityFeedProps) {
  const [page, setPage] = useState(1);
  const [expandedComments, setExpandedComments] = useState<number | null>(null);
  const pageSize = 20;
  const user = store.getState().setAuthReducer;
  const currentUserId = user?.id ?? 0;

  const { data, isLoading, error } = useQueryGetFeed(
    {
      topicFilter,
      page,
      pageSize,
    },
    { refetchOnMount: "always" }
  );

  const handleLikeToggle = (postId: number, _isLiked: boolean) => {
    // Will be implemented in Task 13 with useLike hook
  };

  const handleCommentClick = (postId: number) => {
    setExpandedComments(expandedComments === postId ? null : postId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-v2-border-light p-8 text-center">
        <p className="font-vietnam text-sm text-v2-text-tertiary">
          Could not load feed. Please try again.
        </p>
      </div>
    );
  }

  const posts = data?.posts ?? [];

  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-v2-border-light p-8 text-center">
        <p className="font-vietnam text-lg font-semibold text-v2-text-primary mb-1">
          No posts yet
        </p>
        <p className="font-vietnam text-sm text-v2-text-tertiary">
          Be the first to share something with the community!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard
          key={post.postId}
          post={post}
          currentUserId={currentUserId}
          onLikeToggle={handleLikeToggle}
          onCommentClick={handleCommentClick}
        />
      ))}

      {data?.hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="py-3 text-center font-vietnam text-sm font-medium text-v2-red-primary hover:text-v2-red-dark transition-colors"
        >
          Load more
        </button>
      )}
    </div>
  );
}
