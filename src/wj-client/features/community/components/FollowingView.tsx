"use client";

import { useState } from "react";
import { useQueryGetFollowing, useQueryGetFollowers } from "@/utils/generated/hooks";
import { UserListItem } from "./UserListItem";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface FollowingViewProps {
  currentUser: { id: number; name: string; picture: string };
  onUserClick?: (userId: number) => void;
  initialTab?: "following" | "followers";
}

export function FollowingView({ currentUser, onUserClick, initialTab = "following" }: FollowingViewProps) {
  const [activeTab, setActiveTab] = useState<"following" | "followers">(initialTab);

  const { data: followingData, isLoading: followingLoading } = useQueryGetFollowing(
    { userId: currentUser.id, pagination: { page: 1, pageSize: 50, orderBy: "", order: "" } },
    { enabled: activeTab === "following", refetchOnMount: "always" }
  );

  const { data: followersData, isLoading: followersLoading } = useQueryGetFollowers(
    { userId: currentUser.id, pagination: { page: 1, pageSize: 50, orderBy: "", order: "" } },
    { enabled: activeTab === "followers", refetchOnMount: "always" }
  );

  const isLoading = activeTab === "following" ? followingLoading : followersLoading;
  const users = activeTab === "following"
    ? (followingData?.users ?? [])
    : (followersData?.users ?? []);

  const tabs = [
    { key: "following" as const, label: "Đang theo dõi", count: followingData?.pagination?.totalCount },
    { key: "followers" as const, label: "Người theo dõi", count: followersData?.pagination?.totalCount },
  ];

  return (
    <div className="bg-white sm:rounded-2xl border-b sm:border border-v2-border-light overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-[#EDE8E1]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 py-3 font-vietnam text-sm font-medium transition-colors relative",
              activeTab === tab.key
                ? "text-v2-red-primary"
                : "text-v2-text-tertiary hover:text-v2-text-secondary"
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 text-xs">({tab.count})</span>
            )}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-v2-red-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-bg border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Users size={40} className="text-v2-text-tertiary" />
          <p className="font-vietnam text-sm text-v2-text-tertiary">
            {activeTab === "following" ? "Chưa theo dõi ai" : "Chưa có người theo dõi"}
          </p>
          <p className="font-vietnam text-xs text-v2-text-tertiary text-center max-w-xs">
            {activeTab === "following"
              ? "Hãy khám phá cộng đồng và theo dõi những người bạn quan tâm."
              : "Chia sẻ bài viết và tương tác để thu hút người theo dõi."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#EDE8E1]">
          {users.map((user) => (
            <UserListItem
              key={user.userId}
              user={user}
              currentUserId={currentUser.id}
              onUserClick={onUserClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
