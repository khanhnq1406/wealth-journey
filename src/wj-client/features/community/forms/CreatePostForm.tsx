"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationCreatePost, EVENT_CommunityGetFeed } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { createPostSchema, type CreatePostFormData } from "../utils/community.schema";
import { Avatar } from "../components/Avatar";
import { ImageUpload } from "../components/ImageUpload";
import { cn } from "@/lib/utils/cn";
import { ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslatedError } from "@/lib/utils/error-translator";

interface CreatePostFormProps {
  currentUser: { id: number; name: string; picture: string };
  onSuccess?: () => void;
}

export function CreatePostForm({ currentUser, onSuccess }: CreatePostFormProps) {
  const t = useTranslations();
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
      imageUrl: "",
    },
  });

  const content = watch("content");

  const createPostMutation = useMutationCreatePost({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetFeed] });
      onSuccess?.();
    },
    onError: (error: any) => {
      setErrorMessage(getTranslatedError(error, t));
    },
  });

  const onSubmit = (data: CreatePostFormData) => {
    setErrorMessage(undefined);
    createPostMutation.mutate({
      content: data.content,
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
          <p className="font-roboto text-sm font-semibold text-v2-text-primary">
            {currentUser.name}
          </p>
        </div>
      </div>

      {/* Content textarea */}
      <div>
        <textarea
          {...register("content")}
          placeholder="Chia sẻ kiến thức tài chính của bạn..."
          className="w-full min-h-[120px] resize-none border border-v2-gold-primary/20 rounded-xl p-3 bg-v2-maroon-900 font-roboto text-sm text-v2-gold-accent placeholder:text-v2-text-tertiary focus:outline-none focus:border-v2-gold-primary transition-colors"
          maxLength={2000}
        />
        <div className="flex justify-between items-center mt-1">
          {errors.content && (
            <p className="text-xs text-v2-red-negative font-roboto">{errors.content.message}</p>
          )}
          <p className="text-xs text-v2-text-tertiary font-roboto ml-auto">
            {content.length} / 2.000
          </p>
        </div>
      </div>

      {/* Image upload */}
      {showImageInput && (
        <ImageUpload
          purpose="post"
          onUpload={(url) => setValue("imageUrl", url)}
          onRemove={() => setValue("imageUrl", "")}
          currentImageUrl={watch("imageUrl")}
          label="Thêm ảnh"
        />
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-v2-red-primary/10 border border-v2-red-negative/30">
          <p className="text-xs text-v2-red-negative font-roboto">{errorMessage}</p>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between pt-3 border-t border-v2-border-light">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowImageInput(!showImageInput)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-roboto text-sm",
              showImageInput
                ? "text-v2-red-primary bg-v2-red-light"
                : "text-v2-text-secondary hover:bg-v2-maroon-600"
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
            "px-6 py-2 rounded-xl font-roboto text-sm font-semibold transition-colors",
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
