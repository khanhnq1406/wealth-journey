"use client";

import type { SuggestedUserItem } from "@/gen/protobuf/v1/community";
import { X } from "lucide-react";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";

interface SuggestedUserCardProps {
  user: SuggestedUserItem;
  onDismiss: (userId: number) => void;
}

export function SuggestedUserCard({ user, onDismiss }: SuggestedUserCardProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar
        name={user.userName}
        imageUrl={user.userPicture}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="font-roboto text-sm font-medium text-v2-text-primary truncate">
          {user.userName}
        </p>
        {user.mutualFollowCount > 0 ? (
          <p className="font-roboto text-xs text-v2-text-tertiary">
            {user.mutualFollowCount} bạn chung
          </p>
        ) : user.followerCount > 0 ? (
          <p className="font-roboto text-xs text-v2-text-tertiary">
            {user.followerCount} người theo dõi
          </p>
        ) : user.bioSnippet ? (
          <p className="font-roboto text-xs text-v2-text-tertiary truncate">
            {user.bioSnippet}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <FollowButton
          targetUserId={user.userId}
          initialIsFollowing={false}
          className="text-xs px-3 py-1"
        />
        <button
          onClick={() => onDismiss(user.userId)}
          className="p-1 rounded-full text-v2-text-tertiary hover:text-v2-text-secondary hover:bg-v2-bg-secondary transition-colors"
          aria-label="Bỏ qua gợi ý"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
