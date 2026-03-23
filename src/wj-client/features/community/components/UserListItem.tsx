"use client";

import type { FollowUserItem } from "@/gen/protobuf/v1/community";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";

interface UserListItemProps {
  user: FollowUserItem;
  currentUserId: number;
  onUserClick?: (userId: number) => void;
}

export function UserListItem({ user, currentUserId, onUserClick }: UserListItemProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF9F7] transition-colors cursor-pointer"
      onClick={() => onUserClick?.(user.userId)}
    >
      <Avatar
        name={user.userName}
        imageUrl={user.userPicture}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <p className="font-roboto text-sm font-medium text-v2-text-primary truncate">
          {user.userName}
        </p>
        {user.bioSnippet && (
          <p className="font-roboto text-xs text-v2-text-tertiary truncate">
            {user.bioSnippet}
          </p>
        )}
      </div>
      {user.userId !== currentUserId && (
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <FollowButton
            targetUserId={user.userId}
            initialIsFollowing={user.isFollowing}
            className="text-xs px-3 py-1"
          />
        </div>
      )}
    </div>
  );
}
