"use client";

import { useState } from "react";
import { PostHeader } from "./PostHeader";
import { PostBody } from "./PostBody";
import { PostEngagement } from "./PostEngagement";
import { PostActions } from "./PostActions";
import type { PostItem } from "@/gen/protobuf/v1/community";

interface PostCardProps {
  post: PostItem;
  currentUserId: number;
  onLikeToggle: (postId: number, isLiked: boolean) => void;
  onCommentClick: (postId: number) => void;
  onMenuClick?: (postId: number) => void;
  isLikeLoading?: boolean;
}

export function PostCard({
  post,
  currentUserId,
  onLikeToggle,
  onCommentClick,
  onMenuClick,
  isLikeLoading,
}: PostCardProps) {
  const isOwnPost = post.authorId === currentUserId;
  const postId = post.postId ?? 0;

  return (
    <article className="bg-white sm:rounded-2xl border-b sm:border border-v2-border-light p-4">
      <PostHeader
        authorName={post.authorName ?? ""}
        authorPicture={post.authorPicture}
        topicTag={post.topicTag}
        createdAt={post.createdAt ?? 0}
        isOwnPost={isOwnPost}
        onMenuClick={onMenuClick ? () => onMenuClick(postId) : undefined}
      />

      <PostBody
        content={post.content ?? ""}
        imageUrl={post.imageUrl}
      />

      <PostEngagement
        likeCount={post.likeCount ?? 0}
        commentCount={post.commentCount ?? 0}
        onCommentsClick={() => onCommentClick(postId)}
      />

      <PostActions
        isLiked={post.isLiked ?? false}
        onLikeToggle={() => onLikeToggle(postId, post.isLiked ?? false)}
        onCommentClick={() => onCommentClick(postId)}
        isLikeLoading={isLikeLoading}
      />
    </article>
  );
}
