"use client";

import { useState } from "react";
import { useMutationSavePost, useMutationUnsavePost } from "@/utils/generated/hooks";

export function useSavedPost(postId: number, initialIsSaved: boolean) {
  const [isSaved, setIsSaved] = useState(initialIsSaved);

  const saveMutation = useMutationSavePost();
  const unsaveMutation = useMutationUnsavePost();

  const toggle = () => {
    if (isSaved) {
      setIsSaved(false);
      unsaveMutation.mutate(
        { postId },
        {
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
