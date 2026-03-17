"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { BaseCard } from "@/components/BaseCard";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { EmptyState } from "@/components/feedback/EmptyState";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { MessageCircle } from "lucide-react";
import {
  useQueryListMyFeedback,
  EVENT_FeedbackListMyFeedback,
} from "@/utils/generated/hooks";
import { SubmitFeedbackForm } from "@/features/feedback/forms/SubmitFeedbackForm";
import { FeedbackItem } from "@/features/feedback/components/FeedbackItem";

export default function FeedbackPage() {
  const t = useTranslations("feedback");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const feedbackQuery = useQueryListMyFeedback(
    { pagination: { page, pageSize, orderBy: "", order: "" } },
    { refetchOnMount: "always" }
  );

  const handleFormSuccess = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [EVENT_FeedbackListMyFeedback],
    });
  }, [queryClient]);

  const feedbackItems = feedbackQuery.data?.feedback || [];
  const totalCount = feedbackQuery.data?.pagination?.totalCount || 0;
  const hasMore = page * pageSize < totalCount;

  return (
    <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 max-w-2xl mx-auto">
      {/* Submit Feedback Form */}
      <BaseCard noMobileMargin className="mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-bold font-vietnam text-v2-text-primary mb-3">
          {t("sendFeedback")}
        </h2>
        <SubmitFeedbackForm onSuccess={handleFormSuccess} />
      </BaseCard>

      {/* Feedback History */}
      <h2 className="text-base sm:text-lg font-bold font-vietnam text-v2-text-primary mb-3">
        {t("myFeedback")}
      </h2>

      {feedbackQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner text={t("loading")} />
        </div>
      ) : feedbackItems.length === 0 ? (
        <EmptyState
          icon={<MessageCircle size={40} />}
          title={t("noFeedbackTitle")}
          description={t("noFeedbackDescription")}
          variant="card"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {feedbackItems.map((item) => (
            <FeedbackItem
              key={item.id}
              subject={item.subject}
              message={item.message}
              status={item.status}
              createdAt={item.createdAt}
            />
          ))}

          {hasMore && (
            <Button
              type={ButtonType.SECONDARY}
              onClick={() => setPage((p) => p + 1)}
              loading={feedbackQuery.isFetching}
            >
              {t("loadMore")}
            </Button>
          )}

          {!hasMore && feedbackItems.length > 0 && (
            <p className="text-center text-sm text-v2-text-tertiary font-vietnam py-2">
              {t("noMore")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
