"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationUpdateComment } from "@/utils/generated/hooks";
import { editCommentSchema, type EditCommentFormData } from "../utils/community.schema";
import { useTranslations } from "next-intl";
import { getTranslatedError, translateValidationMessage } from "@/lib/utils/error-translator";

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
  const tValidation = useTranslations("validation");
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
        className="w-full text-sm border border-v2-gold-primary/20 rounded-lg px-3 py-2 bg-v2-maroon-900 text-v2-gold-accent placeholder:text-v2-text-tertiary resize-none focus:outline-none focus:border-v2-gold-primary"
        rows={3}
        autoFocus
      />
      {errors.content && (
        <p className="text-xs text-v2-red-negative">{translateValidationMessage(tValidation, errors.content.message)}</p>
      )}
      {error && <p className="text-xs text-v2-red-negative">{error}</p>}
      <div className="flex items-center justify-between">
        <span className={`text-xs ${remainingChars < 50 ? "text-v2-red-negative" : "text-v2-text-tertiary"}`}>
          {remainingChars}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-v2-text-secondary hover:text-v2-gold-accent px-2 py-1"
            disabled={updateCommentMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateCommentMutation.isPending || !content?.trim()}
            className="text-xs bg-v2-gold-primary text-v2-maroon-900 px-3 py-1 rounded-md hover:bg-v2-gold-accent disabled:opacity-50"
          >
            {updateCommentMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
