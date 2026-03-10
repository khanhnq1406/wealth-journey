"use client";

import type { SuggestedUserItem } from "@/gen/protobuf/v1/community";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";

interface SuggestedUserCardProps {
  user: SuggestedUserItem;
}

export function SuggestedUserCard({ user }: SuggestedUserCardProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Avatar
        name={user.userName}
        imageUrl={user.userPicture}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="font-vietnam text-sm font-medium text-v2-text-primary truncate">
          {user.userName}
        </p>
        {user.mutualFollowCount > 0 ? (
          <p className="font-vietnam text-xs text-v2-text-tertiary">
            {user.mutualFollowCount} bạn chung
          </p>
        ) : user.followerCount > 0 ? (
          <p className="font-vietnam text-xs text-v2-text-tertiary">
            {user.followerCount} người theo dõi
          </p>
        ) : user.bioSnippet ? (
          <p className="font-vietnam text-xs text-v2-text-tertiary truncate">
            {user.bioSnippet}
          </p>
        ) : null}
      </div>
      <FollowButton
        targetUserId={user.userId}
        initialIsFollowing={false}
        className="text-xs px-3 py-1 flex-shrink-0"
      />
    </div>
  );
}
