"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { BaseCard } from "@/components/BaseCard";
import { Avatar } from "@/features/community/components/Avatar";
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

/** Check if a YYYY-MM-DD string is today (Vietnam TZ UTC+7). */
function isToday(dateStr: string): boolean {
  if (!dateStr) return true;
  const now = new Date();
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const todayStr = vnNow.toISOString().slice(0, 10);
  return dateStr === todayStr;
}

/** Format YYYY-MM-DD to a human-readable short date (e.g. "Mar 13"). */
function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function GoldSentimentCard({ variant }: GoldSentimentCardProps) {
  const t = useTranslations("goldSentiment");
  const queryClient = useQueryClient();
  const isHome = variant === "home";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [page, setPage] = useState(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const authState = store.getState().setAuthReducer.isAuthenticated;
    queueMicrotask(() => setIsAuthenticated(authState ?? false));
  }, []);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  // Data fetching
  const { data: sentiment, isLoading: sentimentLoading } =
    useQueryGetGoldSentiment({}, { refetchOnMount: "always" });

  const { data: commentsData, isLoading: commentsLoading } =
    useQueryGetGoldSentimentComments(
      { page: 1, pageSize: isHome ? COMMENTS_PER_PAGE * page : 2 },
      { refetchOnMount: "always" },
    );

  const allComments: CommentItem[] = commentsData?.comments ?? [];

  // Mutations
  const castVoteMutation = useMutationCastGoldVote({
    onSuccess: (data) => {
      if (data?.anonymousId) {
        localStorage.setItem("gold_vote_anonymous_id", data.anonymousId);
      }
      queryClient.invalidateQueries({
        queryKey: [EVENT_GoldSentimentGetGoldSentiment],
      });
    },
  });

  const postCommentMutation = useMutationPostGoldSentimentComment({
    onSuccess: () => {
      setCommentText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      showToast(t("commentPosted"));
      queryClient.invalidateQueries({
        queryKey: [EVENT_GoldSentimentGetGoldSentimentComments],
      });
    },
    onError: (error) => {
      if (error.message?.includes("comments per day")) {
        showToast(t("dailyLimitReached", { count: 5 }));
      } else {
        showToast(error.message || "Failed to post comment");
      }
    },
  });

  const deleteCommentMutation = useMutationDeleteGoldSentimentComment({
    onSuccess: () => {
      showToast(t("commentDeleted"));
      queryClient.invalidateQueries({
        queryKey: [EVENT_GoldSentimentGetGoldSentimentComments],
      });
    },
    onError: (error) => {
      showToast(error.message || "Failed to delete comment");
    },
  });

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const handleVote = useCallback(
    (direction: VoteDirection) => {
      castVoteMutation.mutate({ direction });
    },
    [castVoteMutation],
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
  const commentDate = commentsData?.commentDate ?? "";
  const showingOlderComments = commentDate && !isToday(commentDate) && allComments.length > 0;

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
          <div className="w-6 h-6 border-2 border-v2-gold-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </BaseCard>
    );
  }

  return (
    <BaseCard padding="md" mobileOptimized>
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-toast bg-neutral-800 dark:bg-neutral-700 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Question */}
      <h3 className="text-sm sm:text-base font-semibold text-v2-text-primary dark:text-dark-text mb-2.5">
        {t("question")}
      </h3>

      {/* Vote buttons */}
      <div className="flex gap-2 sm:gap-3 mb-2" style={{ touchAction: "manipulation" }}>
        <button
          type="button"
          onClick={() => handleVote(VoteDirection.VOTE_DIRECTION_BULLISH)}
          disabled={castVoteMutation.isPending}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg min-h-11 px-3 py-2 text-sm font-medium transition-all duration-150 select-none ${
            userVote === VoteDirection.VOTE_DIRECTION_BULLISH
              ? "bg-success-600 text-white shadow-sm"
              : "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400 active:bg-success-200 dark:active:bg-success-900/40"
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          </svg>
          <span className="truncate">{t("bullish")}</span>
          {bullishPct > 0 && (
            <span className="text-xs opacity-75 tabular-nums">{Math.round(bullishPct)}%</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleVote(VoteDirection.VOTE_DIRECTION_BEARISH)}
          disabled={castVoteMutation.isPending}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg min-h-11 px-3 py-2 text-sm font-medium transition-all duration-150 select-none ${
            userVote === VoteDirection.VOTE_DIRECTION_BEARISH
              ? "bg-danger-600 text-white shadow-sm"
              : "bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-400 active:bg-danger-200 dark:active:bg-danger-900/40"
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
          <span className="truncate">{t("bearish")}</span>
          {bearishPct > 0 && (
            <span className="text-xs opacity-75 tabular-nums">{Math.round(bearishPct)}%</span>
          )}
        </button>
      </div>

      {/* Sentiment bar — visual progress */}
      {totalVotes > 0 && (
        <div className="mb-2">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            <div
              className="bg-success-500 transition-all duration-500 ease-out rounded-l-full"
              style={{ width: `${bullishPct}%` }}
            />
            <div
              className="bg-danger-500 transition-all duration-500 ease-out rounded-r-full"
              style={{ width: `${bearishPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary */}
      <p className="text-xs text-v2-text-tertiary dark:text-dark-text-secondary mb-2.5">
        {getSummaryText()}
      </p>

      {/* Login CTA for landing when not authenticated */}
      {!isHome && !isAuthenticated && (
        <div className="text-center text-sm text-v2-text-secondary dark:text-dark-text-secondary mb-2.5">
          <Link
            href="/auth/login"
            className="text-v2-gold-primary hover:text-v2-gold-dark dark:hover:text-v2-gold-accent font-medium underline"
          >
            {t("loginToComment")}
          </Link>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-v2-border-light dark:border-dark-border my-2.5" />

      {/* Comments section header */}
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-xs sm:text-sm font-medium text-v2-text-secondary dark:text-dark-text-secondary">
          {t("comments")} {totalComments > 0 && <span className="text-v2-text-tertiary">({totalComments})</span>}
        </h4>
        {showingOlderComments && (
          <span className="text-[11px] text-v2-text-tertiary dark:text-dark-text-tertiary italic">
            {t("commentsFrom", { date: formatShortDate(commentDate) })}
          </span>
        )}
      </div>

      {/* Comments list */}
      <div className="space-y-2 relative">
        {commentsLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-v2-gold-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : allComments.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-sm text-neutral-400 dark:text-dark-text-tertiary">
              {t("noComments")}
            </p>
            {isHome && (
              <p className="text-xs text-neutral-300 dark:text-dark-text-tertiary mt-1">
                {t("beFirstToComment")}
              </p>
            )}
          </div>
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
                <div className="blur-sm pointer-events-none opacity-50">
                  <CommentRow
                    comment={allComments[1]}
                    isHome={false}
                    onDelete={() => {}}
                    isDeleting={false}
                    t={t}
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Link
                    href="/auth/login"
                    className="text-sm font-medium text-v2-gold-primary hover:text-v2-gold-dark dark:hover:text-v2-gold-accent underline"
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
          className="w-full mt-2 text-xs text-v2-gold-primary hover:text-v2-gold-dark dark:hover:text-v2-gold-accent font-medium py-2 min-h-11 transition-colors"
          style={{ touchAction: "manipulation" }}
        >
          {t("loadMore")}
        </button>
      )}

      {/* Comment input (home only, authenticated) */}
      {isHome && isAuthenticated && (
        <div className="mt-2.5 border-t border-v2-border-light dark:border-dark-border pt-2.5">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value);
                autoResize();
              }}
              placeholder={t("writeComment")}
              maxLength={MAX_COMMENT_LENGTH}
              rows={1}
              className="flex-1 resize-none rounded-lg border border-v2-border bg-v2-bg-primary dark:border-dark-border dark:bg-neutral-800 text-sm text-v2-text-primary dark:text-dark-text placeholder-v2-text-tertiary dark:placeholder-dark-text-tertiary px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-v2-gold-primary/30 focus:border-v2-gold-primary transition-colors"
              style={{ minHeight: "2.75rem", maxHeight: "7.5rem" }}
            />
            <button
              type="button"
              onClick={handlePostComment}
              disabled={
                !commentText.trim() || postCommentMutation.isPending
              }
              className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg bg-v2-gold-primary text-white hover:bg-v2-gold-dark active:bg-v2-gold-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ touchAction: "manipulation" }}
              aria-label={t("send")}
            >
              {postCommentMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              )}
            </button>
          </div>
          {commentText.length > 0 && (
            <p className="text-[11px] text-v2-text-tertiary dark:text-dark-text-tertiary mt-1 text-right tabular-nums">
              {commentText.length}/{MAX_COMMENT_LENGTH}
            </p>
          )}
        </div>
      )}

      {/* Login prompt for home when not authenticated — for commenting */}
      {isHome && !isAuthenticated && (
        <div className="mt-2.5 border-t border-v2-border-light dark:border-dark-border pt-2.5 text-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1 text-sm font-medium text-v2-gold-primary hover:text-v2-gold-dark dark:hover:text-v2-gold-accent"
          >
            <span>{t("login")}</span>
            <span className="text-v2-text-secondary dark:text-dark-text-secondary font-normal">
              {t("loginToComment")}
            </span>
          </Link>
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
    <div className="flex items-start gap-2 group/comment">
      {/* Avatar */}
      <Avatar
        name={comment.userName || "?"}
        imageUrl={comment.userPicture || undefined}
        size="sm"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[13px] font-medium text-v2-text-primary dark:text-dark-text truncate max-w-[120px] sm:max-w-[180px]">
            {comment.userName}
          </span>

          {/* Vote direction badge */}
          {isBullish && (
            <svg className="w-3 h-3 text-success-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          )}
          {isBearish && (
            <svg className="w-3 h-3 text-danger-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          )}

          <span className="text-[11px] text-neutral-400 dark:text-dark-text-tertiary whitespace-nowrap">
            {comment.createdAt ? formatRelativeTime(comment.createdAt, t) : ""}
          </span>
        </div>

        <p className="text-[13px] leading-snug text-v2-text-secondary dark:text-dark-text-secondary mt-0.5 break-words">
          {comment.content}
        </p>
      </div>

      {/* Delete button (own comments, home only) */}
      {isHome && comment.isOwnComment && (
        <button
          type="button"
          onClick={() => onDelete(comment.id)}
          disabled={isDeleting}
          className="min-w-[32px] min-h-[32px] flex items-center justify-center text-neutral-300 hover:text-danger-500 dark:text-dark-text-tertiary dark:hover:text-danger-400 transition-colors shrink-0 disabled:opacity-50 rounded-md sm:opacity-0 sm:group-hover/comment:opacity-100"
          style={{ touchAction: "manipulation" }}
          aria-label={t("delete")}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}
