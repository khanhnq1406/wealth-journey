"use client";

import { useQueryGetTrendingTopics } from "@/utils/generated/hooks";
import { TrendingUp } from "lucide-react";

interface TrendingTopicsProps {
  onHashtagClick?: (tag: string) => void;
}

export function TrendingTopics({ onHashtagClick }: TrendingTopicsProps) {
  const { data, isLoading } = useQueryGetTrendingTopics({}, { refetchOnMount: "always" });
  const topics = data?.topics ?? [];

  return (
    <div className="bg-v2-maroon-800 rounded-2xl border border-v2-border-light p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={14} className="text-v2-text-tertiary" />
        <p className="font-roboto text-xs font-semibold text-v2-text-tertiary uppercase tracking-wider">
          Chủ đề nổi bật
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-4 h-4 border-2 border-v2-gold-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : topics.length === 0 ? (
        <p className="font-roboto text-sm text-v2-text-tertiary text-center py-4">
          Chưa có chủ đề nổi bật
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {topics.slice(0, 8).map((topic, i) => (
            <button
              key={topic.hashtag}
              onClick={() => onHashtagClick?.(topic.hashtag)}
              className="flex items-center justify-between py-1.5 px-1 rounded-lg hover:bg-v2-bg-primary transition-colors text-left w-full group"
            >
              <span className="font-roboto text-sm font-medium text-bg group-hover:underline">
                #{topic.hashtag}
              </span>
              <span className="font-roboto text-xs text-v2-text-tertiary">
                {topic.postCount} bài
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
