"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationUpdatePost } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { editPostSchema, type EditPostFormData } from "../utils/community.schema";
import { TOPIC_TAGS } from "../utils/topic-tags";
import { cn } from "@/lib/utils/cn";
import type { PostItem } from "@/gen/protobuf/v1/community";

interface EditPostFormProps {
  post: PostItem;
  onSuccess?: () => void;
}

export function EditPostForm({ post, onSuccess }: EditPostFormProps) {
  const [errorMessage, setErrorMessage] = useState<string>();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditPostFormData>({
    resolver: zodResolver(editPostSchema),
    defaultValues: {
      content: post.content ?? "",
      topicTag: post.topicTag ?? "",
      imageUrl: post.imageUrl ?? "",
    },
  });

  const content = watch("content");
  const selectedTopic = watch("topicTag");

  const updatePostMutation = useMutationUpdatePost({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["GetFeed"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      setErrorMessage(error.message || "Failed to update post");
    },
  });

  const onSubmit = (data: EditPostFormData) => {
    setErrorMessage(undefined);
    updatePostMutation.mutate({
      postId: post.postId ?? 0,
      content: data.content,
      topicTag: data.topicTag,
      imageUrl: data.imageUrl || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Topic tags */}
      <div>
        <p className="font-vietnam text-xs font-medium text-v2-text-tertiary mb-2">
          Chủ đề
        </p>
        <div className="flex flex-wrap gap-2">
          {TOPIC_TAGS.map((tag) => (
            <button
              key={tag.value}
              type="button"
              onClick={() => setValue("topicTag", tag.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[12px] font-vietnam font-medium transition-colors border",
                selectedTopic === tag.value
                  ? "bg-v2-red-primary text-white border-v2-red-primary"
                  : "border-v2-border-light text-v2-text-secondary hover:bg-v2-bg-primary"
              )}
            >
              {tag.label}
            </button>
          ))}
        </div>
        {errors.topicTag && (
          <p className="mt-1 text-xs text-red-500 font-vietnam">{errors.topicTag.message}</p>
        )}
      </div>

      {/* Content textarea */}
      <div>
        <textarea
          {...register("content")}
          className="w-full min-h-[120px] resize-none border border-v2-border-light rounded-xl p-3 font-vietnam text-sm text-v2-text-primary placeholder:text-v2-text-tertiary focus:outline-none focus:border-v2-red-primary transition-colors"
          maxLength={2000}
        />
        <div className="flex justify-between items-center mt-1">
          {errors.content && (
            <p className="text-xs text-red-500 font-vietnam">{errors.content.message}</p>
          )}
          <p className="text-xs text-v2-text-tertiary font-jetbrains ml-auto">
            {content.length} / 2.000
          </p>
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs text-red-600 font-vietnam">{errorMessage}</p>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-3 border-t border-v2-border-light">
        <button
          type="submit"
          disabled={updatePostMutation.isPending}
          className={cn(
            "px-6 py-2 rounded-xl font-vietnam text-sm font-semibold transition-colors",
            updatePostMutation.isPending
              ? "bg-v2-border-light text-v2-text-tertiary cursor-not-allowed"
              : "bg-v2-red-primary text-white hover:bg-v2-red-dark"
          )}
        >
          {updatePostMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}
