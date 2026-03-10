"use client";

import { useState } from "react";
import { useMutationFollowUser, useMutationUnfollowUser } from "@/utils/generated/hooks";

export function useFollow(targetUserId: number, initialIsFollowing: boolean) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);

  const followMutation = useMutationFollowUser();
  const unfollowMutation = useMutationUnfollowUser();

  const toggle = () => {
    if (isFollowing) {
      setIsFollowing(false);
      unfollowMutation.mutate(
        { userId: targetUserId },
        {
          onError: () => {
            setIsFollowing(true);
          },
        }
      );
    } else {
      setIsFollowing(true);
      followMutation.mutate(
        { userId: targetUserId },
        {
          onError: () => {
            setIsFollowing(false);
          },
        }
      );
    }
  };

  const isLoading = followMutation.isPending || unfollowMutation.isPending;

  return { isFollowing, toggle, isLoading };
}
