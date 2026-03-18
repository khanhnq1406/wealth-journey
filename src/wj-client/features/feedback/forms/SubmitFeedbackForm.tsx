"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { RHFFormInput as FormInput } from "@/components/forms/RHFFormInput";
import { FormTextarea } from "@/components/forms/FormTextarea";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { Success } from "@/components/modals/Success";
import { useMutationSubmitFeedback } from "@/utils/generated/hooks";
import {
  submitFeedbackSchema,
  type SubmitFeedbackFormInput,
} from "@/features/feedback/utils/feedback-schema";

interface SubmitFeedbackFormProps {
  onSuccess?: () => void;
}

export function SubmitFeedbackForm({ onSuccess }: SubmitFeedbackFormProps) {
  const t = useTranslations("feedback");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [showSuccess, setShowSuccess] = useState(false);

  const submitFeedback = useMutationSubmitFeedback();

  const { control, handleSubmit, reset } = useForm<SubmitFeedbackFormInput>({
    resolver: zodResolver(submitFeedbackSchema),
    defaultValues: {
      subject: "",
      message: "",
    },
    mode: "onSubmit",
  });

  const onSubmit = (data: SubmitFeedbackFormInput) => {
    setErrorMessage(undefined);
    submitFeedback.mutate(
      { subject: data.subject, message: data.message },
      {
        onSuccess: () => {
          setShowSuccess(true);
        },
        onError: (error: any) => {
          if (error?.statusCode === 429) {
            setErrorMessage(t("form.rateLimited"));
          } else {
            setErrorMessage(error.message || t("form.failedToSubmit"));
          }
        },
      }
    );
  };

  const handleDone = () => {
    setShowSuccess(false);
    reset();
    onSuccess?.();
  };

  if (showSuccess) {
    return <Success message={t("form.submittedSuccess")} onDone={handleDone} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      {errorMessage && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      <FormInput
        name="subject"
        control={control}
        label={t("form.subject")}
        placeholder={t("form.subjectPlaceholder")}
        maxLength={200}
        required
      />

      <FormTextarea
        name="message"
        control={control}
        label={t("form.message")}
        placeholder={t("form.messagePlaceholder")}
        rows={5}
        maxLength={2000}
        showCharacterCount={true}
        required
      />

      <Button
        type={ButtonType.PRIMARY}
        htmlType="submit"
        loading={submitFeedback.isPending}
      >
        {t("form.submit")}
      </Button>
    </form>
  );
}
