"use client";

import { useState } from "react";
import { PostHeader } from "./PostHeader";
import { PostBody } from "./PostBody";
import { PostEngagement } from "./PostEngagement";
import { PostActions } from "./PostActions";
import { CommentSection } from "./CommentSection";
import { SharePostModal } from "./SharePostModal";
import { useLike } from "../hooks/useLike";
import { useSavedPost } from "../hooks/useSavedPost";
import type { PostItem } from "@/gen/protobuf/v1/community";

interface PostCardProps {
  post: PostItem;
  currentUser: { id: number; name: string; picture: string };
  onPostUpdated?: () => void;
  onMenuClick?: (postId: number) => void;
  onHashtagClick?: (tag: string) => void;
  onUserClick?: (userId: number) => void;
}

export function PostCard({
  post,
  currentUser,
  onPostUpdated,
  onMenuClick,
  onHashtagClick,
  onUserClick,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const isOwnPost = post.isOwnPost || post.userId === currentUser.id;
  const postId = post.id ?? 0;

  const { isLiked, count: likeCount, toggle: toggleLike, isLoading: isLikeLoading } = useLike(
    postId,
    post.isLiked ?? false,
    post.likeCount ?? 0
  );

  const { isSaved, toggle: toggleSave, isLoading: isSaveLoading } = useSavedPost(
    postId,
    post.isSaved ?? false
  );

  return (
    <article className="bg-white sm:rounded-2xl border-b sm:border border-v2-border-light p-4">
      <PostHeader
        authorId={post.userId ?? 0}
        authorName={post.userName ?? ""}
        authorPicture={post.userPicture}
        createdAt={post.createdAt ?? 0}
        isOwnPost={isOwnPost}
        isFollowing={post.isFollowing ?? false}
        onMenuClick={onMenuClick ? () => onMenuClick(postId) : undefined}
        onUserClick={onUserClick}
      />

      <PostBody
        content={post.content ?? ""}
        imageUrl={post.imageUrl}
        sharedPost={post.sharedPost ?? undefined}
        onHashtagClick={onHashtagClick}
      />

      <PostEngagement
        likeCount={likeCount}
        commentCount={post.commentCount ?? 0}
        shareCount={post.shareCount ?? 0}
        onCommentsClick={() => setShowComments(!showComments)}
      />

      <PostActions
        isLiked={isLiked}
        onLikeToggle={toggleLike}
        onCommentClick={() => setShowComments(!showComments)}
        onShareClick={() => setShowShareModal(true)}
        onSaveToggle={toggleSave}
        isSaved={isSaved}
        isLikeLoading={isLikeLoading}
        isSaveLoading={isSaveLoading}
      />

      {showComments && (
        <CommentSection
          postId={postId}
          currentUser={currentUser}
        />
      )}

      <SharePostModal
        post={showShareModal ? post : null}
        onClose={() => setShowShareModal(false)}
        onSuccess={onPostUpdated}
      />
    </article>
  );
}
