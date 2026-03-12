"use client";

import { useQueryGetSavedPosts } from "@/utils/generated/hooks";
import { PostCard } from "./PostCard";
import { Bookmark } from "lucide-react";

interface SavedPostsViewProps {
  currentUser: { id: number; name: string; picture: string };
  onHashtagClick?: (tag: string) => void;
}

export function SavedPostsView({ currentUser, onHashtagClick }: SavedPostsViewProps) {
  const { data, isLoading } = useQueryGetSavedPosts(
    { pagination: { page: 1, pageSize: 20, orderBy: "", order: "" } },
    { refetchOnMount: "always" }
  );

  const posts = data?.posts ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-bg border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Bookmark size={40} className="text-v2-text-tertiary" />
        <p className="font-vietnam text-sm text-v2-text-tertiary">Chưa có bài viết đã lưu</p>
        <p className="font-vietnam text-xs text-v2-text-tertiary text-center max-w-xs">
          Lưu bài viết để xem lại sau bằng cách nhấn nút &quot;Lưu&quot; ở mỗi bài viết.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="px-4 sm:px-0">
        <h2 className="font-vietnam font-semibold text-v2-text-primary">
          Bài viết đã lưu ({posts.length})
        </h2>
      </div>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          onHashtagClick={onHashtagClick}
        />
      ))}
    </div>
  );
}
