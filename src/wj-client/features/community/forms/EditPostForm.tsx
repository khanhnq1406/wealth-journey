"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationUpdatePost } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { editPostSchema, type EditPostFormData } from "../utils/community.schema";
import { ImageUpload } from "../components/ImageUpload";
import { cn } from "@/lib/utils/cn";
import type { PostItem } from "@/gen/protobuf/v1/community";
import { useTranslations } from "next-intl";
import { getTranslatedError } from "@/lib/utils/error-translator";

interface EditPostFormProps {
  post: PostItem;
  onSuccess?: () => void;
}

export function EditPostForm({ post, onSuccess }: EditPostFormProps) {
  const t = useTranslations();
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
      imageUrl: post.imageUrl ?? "",
    },
  });

  const content = watch("content");

  const updatePostMutation = useMutationUpdatePost({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["GetFeed"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      setErrorMessage(getTranslatedError(error, t));
    },
  });

  const onSubmit = (data: EditPostFormData) => {
    setErrorMessage(undefined);
    updatePostMutation.mutate({
      postId: post.id ?? 0,
      content: data.content,
      imageUrl: data.imageUrl || "",
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Content textarea */}
      <div>
        <textarea
          {...register("content")}
          className="w-full min-h-[120px] resize-none border border-v2-border-light rounded-xl p-3 font-roboto text-sm text-v2-text-primary placeholder:text-v2-text-tertiary focus:outline-none focus:border-v2-red-primary transition-colors"
          maxLength={2000}
        />
        <div className="flex justify-between items-center mt-1">
          {errors.content && (
            <p className="text-xs text-red-500 font-roboto">{errors.content.message}</p>
          )}
          <p className="text-xs text-v2-text-tertiary font-roboto ml-auto">
            {content.length} / 2.000
          </p>
        </div>
      </div>

      {/* Image upload */}
      <ImageUpload
        purpose="post"
        onUpload={(url) => setValue("imageUrl", url)}
        onRemove={() => setValue("imageUrl", "")}
        currentImageUrl={watch("imageUrl")}
        label="Thêm ảnh"
      />

      {/* Error message */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 border border-v2-red-negative/30">
          <p className="text-xs text-red-600 font-roboto">{errorMessage}</p>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-3 border-t border-v2-border-light">
        <button
          type="submit"
          disabled={updatePostMutation.isPending}
          className={cn(
            "px-6 py-2 rounded-xl font-roboto text-sm font-semibold transition-colors",
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
