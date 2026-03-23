"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationUpdateComment } from "@/utils/generated/hooks";
import { editCommentSchema, type EditCommentFormData } from "../utils/community.schema";
import { useTranslations } from "next-intl";
import { getTranslatedError } from "@/lib/utils/error-translator";

interface EditCommentFormProps {
  commentId: number;
  initialContent: string;
  onSuccess: (newContent: string) => void;
  onCancel: () => void;
}

export function EditCommentForm({
  commentId,
  initialContent,
  onSuccess,
  onCancel,
}: EditCommentFormProps) {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<EditCommentFormData>({
    resolver: zodResolver(editCommentSchema),
    defaultValues: { content: initialContent },
  });

  const content = watch("content");
  const remainingChars = 500 - (content?.length || 0);

  const updateCommentMutation = useMutationUpdateComment({
    onSuccess: () => {
      onSuccess(content);
    },
    onError: (err: any) => {
      setError(getTranslatedError(err, t));
    },
  });

  const onSubmit = (data: EditCommentFormData) => {
    setError(null);
    updateCommentMutation.mutate({
      commentId,
      content: data.content,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-1 mt-1">
      <textarea
        {...register("content")}
        className="w-full text-sm border border-v2-gold-primary/20 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-v2-gold-primary"
        rows={3}
        autoFocus
      />
      {errors.content && (
        <p className="text-xs text-red-500">{errors.content.message}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center justify-between">
        <span className={`text-xs ${remainingChars < 50 ? "text-red-500" : "text-gray-400"}`}>
          {remainingChars}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            disabled={updateCommentMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateCommentMutation.isPending || !content?.trim()}
            className="text-xs bg-bg text-white px-3 py-1 rounded-md hover:bg-hgreen disabled:opacity-50"
          >
            {updateCommentMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
