"use client";

import { useState } from "react";
import { useQueryGetUserPosts, useQueryGetLikedPosts } from "@/utils/generated/hooks";
import { TabBar } from "@/components/navigation/TabBar";
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
      <TabBar
        tabs={tabs.map((tab) => ({ id: tab.key, label: tab.label }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="bg-v2-maroon-800 sm:rounded-t-2xl"
      />

      {/* Content */}
      <div className="mt-2">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-v2-gold-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : currentPosts.length === 0 ? (
          <div className="p-8 text-center text-sm text-v2-text-tertiary">
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
