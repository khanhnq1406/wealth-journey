"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { BaseCard } from "@/components/BaseCard";
import { store } from "@/features/auth/store/store";
import {
  useQueryGetGoldSentiment,
  useQueryGetGoldSentimentComments,
  useMutationCastGoldVote,
  useMutationPostGoldSentimentComment,
  useMutationDeleteGoldSentimentComment,
  EVENT_GoldSentimentGetGoldSentiment,
  EVENT_GoldSentimentGetGoldSentimentComments,
} from "@/utils/generated/hooks";
import { VoteDirection } from "@/gen/protobuf/v1/gold_sentiment";
import type { GoldSentimentCommentItem as CommentItem } from "@/gen/protobuf/v1/gold_sentiment";

interface GoldSentimentCardProps {
  variant: "landing" | "home";
}

const MAX_COMMENT_LENGTH = 500;
const COMMENTS_PER_PAGE = 10;

function formatRelativeTime(
  timestampSeconds: number,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const now = Date.now();
  const diff = now - timestampSeconds * 1000;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  if (hours < 24) return t("hoursAgo", { count: hours });
  return t("daysAgo", { count: days });
}

export function GoldSentimentCard({ variant }: GoldSentimentCardProps) {
  const t = useTranslations("goldSentiment");
  const queryClient = useQueryClient();
  const isHome = variant === "home";

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [page, setPage] = useState(1);
  const [allComments, setAllComments] = useState<CommentItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const authState = store.getState().setAuthReducer.isAuthenticated;
    queueMicrotask(() => setIsAuthenticated(authState ?? false));
  }, []);

  // Data fetching
  const { data: sentiment, isLoading: sentimentLoading } =
    useQueryGetGoldSentiment({}, { refetchOnMount: "always" });

  const { data: commentsData, isLoading: commentsLoading } =
    useQueryGetGoldSentimentComments(
      { page: 1, pageSize: isHome ? COMMENTS_PER_PAGE * page : 2 },
      { refetchOnMount: "always" },
    );

  useEffect(() => {
    if (commentsData?.comments) {
      setAllComments(commentsData.comments);
    }
  }, [commentsData]);

  // Mutations
  const castVoteMutation = useMutationCastGoldVote({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [EVENT_GoldSentimentGetGoldSentiment],
      });
    },
  });

  const postCommentMutation = useMutationPostGoldSentimentComment({
    onSuccess: () => {
      setCommentText("");
      showToast(t("commentPosted"));
      queryClient.invalidateQueries({
        queryKey: [EVENT_GoldSentimentGetGoldSentimentComments],
      });
    },
  });

  const deleteCommentMutation = useMutationDeleteGoldSentimentComment({
    onSuccess: () => {
      showToast(t("commentDeleted"));
      queryClient.invalidateQueries({
        queryKey: [EVENT_GoldSentimentGetGoldSentimentComments],
      });
    },
  });

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const handleVote = useCallback(
    (direction: VoteDirection) => {
      if (!isAuthenticated) return;
      castVoteMutation.mutate({ direction });
    },
    [isAuthenticated, castVoteMutation],
  );

  const handlePostComment = useCallback(() => {
    const trimmed = commentText.trim();
    if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) return;
    postCommentMutation.mutate({ content: trimmed });
  }, [commentText, postCommentMutation]);

  const handleDeleteComment = useCallback(
    (commentId: number) => {
      deleteCommentMutation.mutate({ commentId });
    },
    [deleteCommentMutation],
  );

  const handleLoadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  // Derived state
  const userVote = sentiment?.userVote ?? VoteDirection.VOTE_DIRECTION_UNSPECIFIED;
  const bullishPct = sentiment?.bullishPercentage ?? 0;
  const bearishPct = sentiment?.bearishPercentage ?? 0;
  const totalVotes = sentiment?.totalVotes ?? 0;
  const totalComments = commentsData?.totalCount ?? 0;
  const hasMore = allComments.length < totalComments;

  // Summary text
  const getSummaryText = () => {
    if (totalVotes === 0) return t("communityNeutral");
    if (bullishPct >= bearishPct) {
      return t("communityBullish", { count: totalVotes });
    }
    return t("communityBearish", { count: totalVotes });
  };

  if (sentimentLoading) {
    return (
      <BaseCard padding="md" mobileOptimized>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </BaseCard>
    );
  }

  return (
    <BaseCard padding="md" mobileOptimized>
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-800 dark:bg-dark-surface-secondary text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Question */}
      <h3 className="text-base sm:text-lg font-semibold text-neutral-800 dark:text-dark-text mb-4">
        {t("question")}
      </h3>

      {/* Vote buttons */}
      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => handleVote(VoteDirection.VOTE_DIRECTION_BULLISH)}
          disabled={!isHome || !isAuthenticated || castVoteMutation.isPending}
          className={`flex-1 flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition-all duration-200 ${
            userVote === VoteDirection.VOTE_DIRECTION_BULLISH
              ? "bg-green-600 text-white ring-2 ring-green-300 dark:ring-green-700"
              : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          {t("bullish")} {bullishPct > 0 && `${Math.round(bullishPct)}%`}
        </button>

        <button
          type="button"
          onClick={() => handleVote(VoteDirection.VOTE_DIRECTION_BEARISH)}
          disabled={!isHome || !isAuthenticated || castVoteMutation.isPending}
          className={`flex-1 flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition-all duration-200 ${
            userVote === VoteDirection.VOTE_DIRECTION_BEARISH
              ? "bg-red-600 text-white ring-2 ring-red-300 dark:ring-red-700"
              : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {t("bearish")} {bearishPct > 0 && `${Math.round(bearishPct)}%`}
        </button>
      </div>

      {/* Summary */}
      <p className="text-xs text-neutral-500 dark:text-dark-text-secondary mb-4">
        {getSummaryText()}
      </p>

      {/* Login CTA for landing when not authenticated */}
      {!isHome && !isAuthenticated && (
        <div className="text-center text-sm text-neutral-500 dark:text-dark-text-secondary mb-4">
          <Link
            href="/auth/login"
            className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 font-medium underline"
          >
            {t("loginToVote")}
          </Link>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-neutral-200 dark:border-dark-border my-4" />

      {/* Comments section header */}
      <h4 className="text-sm font-medium text-neutral-700 dark:text-dark-text-secondary mb-3">
        {t("comments")} {totalComments > 0 && `(${totalComments})`}
      </h4>

      {/* Comments list */}
      <div className="space-y-3 relative">
        {commentsLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : allComments.length === 0 ? (
          <p className="text-sm text-neutral-400 dark:text-dark-text-tertiary text-center py-4">
            {t("noComments")} {isHome && t("beFirstToComment")}
          </p>
        ) : (
          <>
            {(isHome ? allComments : allComments.slice(0, 1)).map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                isHome={isHome}
                onDelete={handleDeleteComment}
                isDeleting={deleteCommentMutation.isPending}
                t={t}
              />
            ))}

            {/* Landing variant: blurred overlay */}
            {!isHome && allComments.length > 1 && (
              <div className="relative">
                <div className="blur-sm pointer-events-none">
                  <CommentRow
                    comment={allComments[1]}
                    isHome={false}
                    onDelete={() => {}}
                    isDeleting={false}
                    t={t}
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-dark-surface/60 rounded-lg">
                  <Link
                    href="/auth/login"
                    className="text-sm font-medium text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 underline"
                  >
                    {t("loginToSeeMore")}
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Load more (home only) */}
      {isHome && hasMore && (
        <button
          type="button"
          onClick={handleLoadMore}
          className="w-full mt-3 text-sm text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 font-medium py-2"
        >
          {t("loadMore")}
        </button>
      )}

      {/* Comment input (home only, authenticated) */}
      {isHome && isAuthenticated && (
        <div className="mt-4 border-t border-neutral-200 dark:border-dark-border pt-4">
          <div className="flex gap-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t("writeComment")}
              maxLength={MAX_COMMENT_LENGTH}
              rows={2}
              className="flex-1 resize-none rounded-lg border border-neutral-300 dark:border-dark-border bg-white dark:bg-dark-surface-secondary text-sm text-neutral-800 dark:text-dark-text placeholder-neutral-400 dark:placeholder-dark-text-tertiary p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={handlePostComment}
              disabled={
                !commentText.trim() || postCommentMutation.isPending
              }
              className="self-end px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("send")}
            </button>
          </div>
          <p className="text-xs text-neutral-400 dark:text-dark-text-tertiary mt-1 text-right">
            {t("charsRemaining", {
              count: MAX_COMMENT_LENGTH - commentText.length,
            })}
          </p>
        </div>
      )}

      {/* Login prompt for home when not authenticated */}
      {isHome && !isAuthenticated && (
        <div className="mt-4 border-t border-neutral-200 dark:border-dark-border pt-4 text-center">
          <Link
            href="/auth/login"
            className="inline-block text-sm font-medium text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 underline"
          >
            {t("login")}
          </Link>
          <span className="text-sm text-neutral-500 dark:text-dark-text-secondary ml-1">
            {t("loginToVote")}
          </span>
        </div>
      )}
    </BaseCard>
  );
}

// --- Comment Row ---

interface CommentRowProps {
  comment: CommentItem;
  isHome: boolean;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}

function CommentRow({ comment, isHome, onDelete, isDeleting, t }: CommentRowProps) {
  const isBullish = comment.userVoteDirection === VoteDirection.VOTE_DIRECTION_BULLISH;
  const isBearish = comment.userVoteDirection === VoteDirection.VOTE_DIRECTION_BEARISH;

  return (
    <div className="flex items-start gap-3">
      {/* Avatar */}
      {comment.userPicture ? (
        <img
          src={comment.userPicture}
          alt={comment.userName}
          className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-neutral-200 dark:bg-dark-surface-secondary flex items-center justify-center">
          <span className="text-xs font-medium text-neutral-500 dark:text-dark-text-secondary">
            {comment.userName?.charAt(0)?.toUpperCase() ?? "?"}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-neutral-800 dark:text-dark-text truncate max-w-[120px]">
            {comment.userName}
          </span>

          {/* Vote direction badge */}
          {isBullish && (
            <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </span>
          )}
          {isBearish && (
            <span className="inline-flex items-center gap-0.5 text-xs text-red-600 dark:text-red-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          )}

          <span className="text-xs text-neutral-400 dark:text-dark-text-tertiary">
            {comment.createdAt ? formatRelativeTime(comment.createdAt, t) : ""}
          </span>
        </div>

        <p className="text-sm text-neutral-700 dark:text-dark-text-secondary mt-0.5 break-words">
          {comment.content}
        </p>
      </div>

      {/* Delete button (own comments, home only) */}
      {isHome && comment.isOwnComment && (
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          disabled={isDeleting}
          className="text-xs text-neutral-400 hover:text-red-500 dark:text-dark-text-tertiary dark:hover:text-red-400 transition-colors flex-shrink-0 disabled:opacity-50"
          aria-label={t("delete")}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
