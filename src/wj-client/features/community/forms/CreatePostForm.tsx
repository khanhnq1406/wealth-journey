"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationCreatePost, EVENT_CommunityGetFeed } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { createPostSchema, type CreatePostFormData } from "../utils/community.schema";
import { TOPIC_TAGS } from "../utils/topic-tags";
import { Avatar } from "../components/Avatar";
import { cn } from "@/lib/utils/cn";
import { ImageIcon, X } from "lucide-react";

interface CreatePostFormProps {
  currentUser: { id: number; name: string; picture: string };
  onSuccess?: () => void;
}

export function CreatePostForm({ currentUser, onSuccess }: CreatePostFormProps) {
  const [errorMessage, setErrorMessage] = useState<string>();
  const [showImageInput, setShowImageInput] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      content: "",
      topicTag: "",
      imageUrl: "",
    },
  });

  const content = watch("content");
  const selectedTopic = watch("topicTag");

  const createPostMutation = useMutationCreatePost({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetFeed] });
      onSuccess?.();
    },
    onError: (error: any) => {
      setErrorMessage(error.message || "Failed to create post");
    },
  });

  const onSubmit = (data: CreatePostFormData) => {
    setErrorMessage(undefined);
    createPostMutation.mutate({
      content: data.content,
      topicTag: data.topicTag,
      imageUrl: data.imageUrl || "",
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Gradient accent */}
      <div className="h-1 -mt-4 -mx-4 sm:-mx-6 bg-gradient-to-r from-v2-red-primary via-[#B8860B] to-[#D4A017] rounded-t-xl" />

      {/* User info */}
      <div className="flex items-center gap-3">
        <Avatar
          name={currentUser.name}
          imageUrl={currentUser.picture}
          size="lg"
        />
        <div>
          <p className="font-vietnam text-sm font-semibold text-v2-text-primary">
            {currentUser.name}
          </p>
        </div>
      </div>

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
          placeholder="Chia sẻ kiến thức tài chính của bạn..."
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

      {/* Image URL input */}
      {showImageInput && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="font-vietnam text-xs font-medium text-v2-text-tertiary">
              URL ảnh
            </p>
            <button
              type="button"
              onClick={() => {
                setShowImageInput(false);
                setValue("imageUrl", "");
              }}
              className="p-0.5 rounded-full text-v2-text-tertiary hover:bg-gray-100 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <input
            {...register("imageUrl")}
            type="url"
            placeholder="https://example.com/image.jpg"
            className="w-full border border-v2-border-light rounded-xl px-3 py-2 font-vietnam text-sm text-v2-text-primary placeholder:text-v2-text-tertiary focus:outline-none focus:border-v2-red-primary transition-colors"
          />
          {errors.imageUrl && (
            <p className="mt-1 text-xs text-red-500 font-vietnam">{errors.imageUrl.message}</p>
          )}
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs text-red-600 font-vietnam">{errorMessage}</p>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between pt-3 border-t border-v2-border-light">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowImageInput(!showImageInput)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-vietnam text-sm",
              showImageInput
                ? "text-v2-red-primary bg-v2-red-light"
                : "text-v2-text-secondary hover:bg-v2-bg-primary"
            )}
          >
            <ImageIcon size={18} className={showImageInput ? "text-v2-red-primary" : "text-v2-text-tertiary"} />
            <span>Ảnh</span>
          </button>
        </div>

        <button
          type="submit"
          disabled={createPostMutation.isPending}
          className={cn(
            "px-6 py-2 rounded-xl font-vietnam text-sm font-semibold transition-colors",
            createPostMutation.isPending
              ? "bg-v2-border-light text-v2-text-tertiary cursor-not-allowed"
              : "bg-v2-red-primary text-white hover:bg-v2-red-dark"
          )}
        >
          {createPostMutation.isPending ? "Đang đăng..." : "Đăng bài"}
        </button>
      </div>
    </form>
  );
}
