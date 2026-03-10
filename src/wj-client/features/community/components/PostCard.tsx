"use client";

import { useState } from "react";
import { PostHeader } from "./PostHeader";
import { PostBody } from "./PostBody";
import { PostEngagement } from "./PostEngagement";
import { PostActions } from "./PostActions";
import { CommentSection } from "./CommentSection";
import { useLike } from "../hooks/useLike";
import type { PostItem } from "@/gen/protobuf/v1/community";

interface PostCardProps {
  post: PostItem;
  currentUser: { id: number; name: string; picture: string };
  onPostUpdated?: () => void;
  onMenuClick?: (postId: number) => void;
}

export function PostCard({
  post,
  currentUser,
  onPostUpdated,
  onMenuClick,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const isOwnPost = post.isOwnPost || post.userId === currentUser.id;
  const postId = post.id ?? 0;

  const { isLiked, count: likeCount, toggle: toggleLike, isLoading: isLikeLoading } = useLike(
    postId,
    post.isLiked ?? false,
    post.likeCount ?? 0
  );

  return (
    <article className="bg-white sm:rounded-2xl border-b sm:border border-v2-border-light p-4">
      <PostHeader
        authorId={post.userId ?? 0}
        authorName={post.userName ?? ""}
        authorPicture={post.userPicture}
        topicTag={post.topicTag}
        createdAt={post.createdAt ?? 0}
        isOwnPost={isOwnPost}
        isFollowing={post.isFollowing ?? false}
        onMenuClick={onMenuClick ? () => onMenuClick(postId) : undefined}
      />

      <PostBody
        content={post.content ?? ""}
        imageUrl={post.imageUrl}
      />

      <PostEngagement
        likeCount={likeCount}
        commentCount={post.commentCount ?? 0}
        onCommentsClick={() => setShowComments(!showComments)}
      />

      <PostActions
        isLiked={isLiked}
        onLikeToggle={toggleLike}
        onCommentClick={() => setShowComments(!showComments)}
        isLikeLoading={isLikeLoading}
      />

      {showComments && (
        <CommentSection
          postId={postId}
          currentUser={currentUser}
        />
      )}
    </article>
  );
}
