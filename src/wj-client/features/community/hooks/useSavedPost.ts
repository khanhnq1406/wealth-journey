"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useMutationSavePost,
  useMutationUnsavePost,
  EVENT_CommunityGetFeed,
  EVENT_CommunityGetSavedPosts,
} from "@/utils/generated/hooks";

export function useSavedPost(postId: number, initialIsSaved: boolean) {
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const queryClient = useQueryClient();

  const saveMutation = useMutationSavePost();
  const unsaveMutation = useMutationUnsavePost();

  const invalidateFeed = () => {
    queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetFeed] });
    queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetSavedPosts] });
  };

  const toggle = () => {
    if (isSaved) {
      setIsSaved(false);
      unsaveMutation.mutate(
        { postId },
        {
          onSuccess: invalidateFeed,
          onError: () => {
            setIsSaved(true);
          },
        }
      );
    } else {
      setIsSaved(true);
      saveMutation.mutate(
        { postId },
        {
          onSuccess: invalidateFeed,
          onError: () => {
            setIsSaved(false);
          },
        }
      );
    }
  };

  const isLoading = saveMutation.isPending || unsaveMutation.isPending;

  return { isSaved, toggle, isLoading };
}
