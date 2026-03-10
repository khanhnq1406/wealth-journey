"use client";

import { useState } from "react";
import { useMutationLikePost, useMutationUnlikePost } from "@/utils/generated/hooks";

export function useLike(postId: number, initialIsLiked: boolean, initialCount: number) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [count, setCount] = useState(initialCount);

  const likeMutation = useMutationLikePost();
  const unlikeMutation = useMutationUnlikePost();

  const toggle = () => {
    if (isLiked) {
      setIsLiked(false);
      setCount((c) => c - 1);
      unlikeMutation.mutate(
        { postId },
        {
          onError: () => {
            setIsLiked(true);
            setCount((c) => c + 1);
          },
        }
      );
    } else {
      setIsLiked(true);
      setCount((c) => c + 1);
      likeMutation.mutate(
        { postId },
        {
          onError: () => {
            setIsLiked(false);
            setCount((c) => c - 1);
          },
        }
      );
    }
  };

  const isLoading = likeMutation.isPending || unlikeMutation.isPending;

  return { isLiked, count, toggle, isLoading };
}
