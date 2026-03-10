"use client";

import { useState } from "react";
import { useQueryGetFeed, EVENT_CommunityGetFeed } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { PostCard } from "./PostCard";
import { FeedEmpty } from "./FeedEmpty";

interface CommunityFeedProps {
  currentUser: { id: number; name: string; picture: string };
}

export function CommunityFeed({ currentUser }: CommunityFeedProps) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQueryGetFeed(
    {
      pagination: { page, pageSize, orderBy: "", order: "" },
    },
    { refetchOnMount: "always" }
  );

  const handlePostUpdated = () => {
    queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetFeed] });
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
    return <FeedEmpty />;
  }

  return (
    <div className="flex flex-col gap-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onPostUpdated={handlePostUpdated}
        />
      ))}

      {data?.pagination && data.pagination.page < data.pagination.totalPages && (
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
