"use client";

import { useState } from "react";
import { useQueryGetUserPosts, useQueryGetLikedPosts } from "@/utils/generated/hooks";
import { PostCard } from "./PostCard";

type TabType = "posts" | "likes" | "shared";

interface ProfileTabsProps {
  userId: number;
  currentUser: { id: number; name: string; picture: string };
  onUserClick?: (userId: number) => void;
  onHashtagClick?: (tag: string) => void;
}

export function ProfileTabs({ userId, currentUser, onUserClick, onHashtagClick }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [postsPage] = useState(1);
  const [likesPage] = useState(1);

  const postsQuery = useQueryGetUserPosts(
    {
      userId,
      pagination: { page: postsPage, pageSize: 20, orderBy: "created_at", order: "desc" },
    },
    {
      enabled: activeTab === "posts" || activeTab === "shared",
      staleTime: 30000,
    }
  );

  const likesQuery = useQueryGetLikedPosts(
    {
      userId,
      pagination: { page: likesPage, pageSize: 20, orderBy: "", order: "" },
    },
    {
      enabled: activeTab === "likes",
      staleTime: 30000,
    }
  );

  const tabs: { key: TabType; label: string }[] = [
    { key: "posts", label: "Posts" },
    { key: "likes", label: "Likes" },
    { key: "shared", label: "Shared" },
  ];

  const currentPosts =
    activeTab === "posts"
      ? postsQuery.data?.posts || []
      : activeTab === "likes"
      ? likesQuery.data?.posts || []
      : (postsQuery.data?.posts || []).filter((p) => !!p.sharedPost);

  const isLoading =
    activeTab === "posts"
      ? postsQuery.isLoading
      : activeTab === "likes"
      ? likesQuery.isLoading
      : postsQuery.isLoading;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-v2-border-light bg-white sm:rounded-t-2xl overflow-hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-bg border-b-2 border-bg"
                : "text-gray-500 hover:text-v2-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-2">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-bg border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : currentPosts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {activeTab === "posts"
              ? "No posts yet"
              : activeTab === "likes"
              ? "No liked posts"
              : "No shared posts"}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {currentPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={currentUser}
                onUserClick={onUserClick}
                onHashtagClick={onHashtagClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
