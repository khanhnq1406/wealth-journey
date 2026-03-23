"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationSharePost } from "@/utils/generated/hooks";
import { sharePostSchema, type SharePostFormData } from "../utils/community.schema";
import type { PostItem } from "@/gen/protobuf/v1/community";
import { SharedPostEmbed } from "../components/SharedPostEmbed";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { useTranslations } from "next-intl";
import { getTranslatedError } from "@/lib/utils/error-translator";

interface SharePostFormProps {
  post: PostItem;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SharePostForm({ post, onSuccess, onCancel }: SharePostFormProps) {
  const t = useTranslations();
  const [errorMessage, setErrorMessage] = useState<string>();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SharePostFormData>({
    resolver: zodResolver(sharePostSchema),
    defaultValues: { content: "" },
  });

  const mutation = useMutationSharePost({
    onSuccess: () => {
      onSuccess?.();
    },
    onError: (error: any) => {
      setErrorMessage(getTranslatedError(error, t));
    },
  });

  const onSubmit = (data: SharePostFormData) => {
    mutation.mutate({
      postId: post.id ?? 0,
      content: data.content ?? "",
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <SharedPostEmbed sharedPost={post} />

      <div>
        <textarea
          {...register("content")}
          placeholder="Thêm bình luận... (không bắt buộc)"
          rows={3}
          className="w-full px-3 py-2 font-roboto text-sm rounded-xl border border-v2-border-light bg-v2-bg-primary focus:outline-none focus:ring-2 focus:ring-bg/30 resize-none"
        />
        {errors.content && (
          <p className="mt-1 text-xs text-lred">{errors.content.message}</p>
        )}
      </div>

      {errorMessage && (
        <p className="text-xs text-lred">{errorMessage}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Button
          type={ButtonType.SECONDARY}
          onClick={onCancel}
        >
          Hủy
        </Button>
        <Button
          type={ButtonType.PRIMARY}
          htmlType="submit"
          loading={mutation.isPending}
        >
          Chia sẻ
        </Button>
      </div>
    </form>
  );
}
