"use client";

import { useState } from "react";
import { useQueryGetFeed } from "@/utils/generated/hooks";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";

interface CommunityFeedProps {
  topicFilter: string;
}

export function CommunityFeed({ topicFilter }: CommunityFeedProps) {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, error } = useQueryGetFeed(
    {
      topicFilter,
      page,
      pageSize,
    },
    { refetchOnMount: "always" }
  );

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
        <div
          key={post.postId}
          className="bg-white rounded-2xl sm:rounded-2xl border border-v2-border-light p-4"
        >
          {/* PostCard placeholder — will be filled in Task 11 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-v2-gold-primary to-v2-gold-accent flex items-center justify-center">
              <span className="text-white font-vietnam font-semibold text-xs">
                {(post.authorName || "U").charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-vietnam text-sm font-semibold text-v2-text-primary">
                {post.authorName}
              </p>
              {post.topicTag && (
                <span className="font-vietnam text-xs text-v2-text-tertiary">
                  {post.topicTag}
                </span>
              )}
            </div>
          </div>
          <p className="font-vietnam text-sm text-v2-text-primary whitespace-pre-wrap break-words">
            {post.content}
          </p>
          {post.imageUrl && (
            <div className="mt-3 rounded-xl overflow-hidden">
              <img
                src={post.imageUrl}
                alt=""
                className="w-full h-[220px] object-cover"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-v2-border-light">
            <span className="font-vietnam text-xs text-v2-text-tertiary">
              {post.likeCount ?? 0} likes
            </span>
            <span className="font-vietnam text-xs text-v2-text-tertiary">
              {post.commentCount ?? 0} comments
            </span>
          </div>
        </div>
      ))}

      {/* Load more */}
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
