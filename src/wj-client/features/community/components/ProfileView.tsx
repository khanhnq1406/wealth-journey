"use client";

import { useState } from "react";
import { useQueryGetCommunityProfile, useQueryGetUserPosts, useMutationUpdateBio, EVENT_CommunityGetCommunityProfile } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { PostCard } from "./PostCard";
import { ArrowLeft, Pencil, Check, X, FileText } from "lucide-react";

interface ProfileViewProps {
  targetUserId: number;
  currentUser: { id: number; name: string; picture: string };
  onBack?: () => void;
  onUserClick?: (userId: number) => void;
  onHashtagClick?: (tag: string) => void;
  onFollowingClick?: (tab: "following" | "followers") => void;
}

export function ProfileView({
  targetUserId,
  currentUser,
  onBack,
  onUserClick,
  onHashtagClick,
  onFollowingClick,
}: ProfileViewProps) {
  const queryClient = useQueryClient();

  const { data: profileData, isLoading: profileLoading } = useQueryGetCommunityProfile(
    { userId: targetUserId },
    { enabled: targetUserId > 0, refetchOnMount: "always" }
  );
  const profile = profileData?.data;

  const { data: postsData, isLoading: postsLoading } = useQueryGetUserPosts(
    { userId: targetUserId, pagination: { page: 1, pageSize: 20, orderBy: "", order: "" } },
    { enabled: targetUserId > 0, refetchOnMount: "always" }
  );
  const posts = postsData?.posts ?? [];

  // Bio editing state (own profile only)
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");

  const updateBioMutation = useMutationUpdateBio({
    onSuccess: () => {
      setIsEditingBio(false);
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetCommunityProfile] });
    },
  });

  const handleEditBio = () => {
    setBioText(profile?.bio ?? "");
    setIsEditingBio(true);
  };

  const handleSaveBio = () => {
    updateBioMutation.mutate({ bio: bioText.trim() });
  };

  const isOwnProfile = profile?.isOwnProfile ?? (targetUserId === currentUser.id);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-bg border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Profile Header Card */}
      <div className="bg-white sm:rounded-2xl border-b sm:border border-v2-border-light overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-[#B91C1C] to-[#DC2626] relative">
          {/* Back button */}
          {onBack && (
            <button
              onClick={onBack}
              className="absolute top-3 left-3 p-1.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
              aria-label="Quay lại"
            >
              <ArrowLeft size={18} />
            </button>
          )}
        </div>

        {/* Profile info */}
        <div className="px-4 pb-4">
          {/* Avatar overlapping banner */}
          <div className="-mt-10 mb-2 flex items-end justify-between">
            <Avatar
              name={profile?.userName || currentUser.name}
              imageUrl={profile?.userPicture || currentUser.picture}
              size="lg"
              priority
              className="!w-20 !h-20 !text-2xl ring-[3px] ring-white"
            />
            {!isOwnProfile && (
              <FollowButton
                targetUserId={targetUserId}
                initialIsFollowing={profile?.isFollowing ?? false}
                className="text-sm px-4 py-1.5"
              />
            )}
          </div>

          {/* Name */}
          <p className="font-vietnam text-lg font-bold text-v2-text-primary">
            {profile?.userName || currentUser.name}
          </p>

          {/* Bio */}
          {isOwnProfile ? (
            isEditingBio ? (
              <div className="mt-1">
                <textarea
                  value={bioText}
                  onChange={(e) => setBioText(e.target.value)}
                  maxLength={200}
                  rows={2}
                  className="w-full font-vietnam text-[13px] text-v2-text-primary bg-[#FAF9F7] rounded-lg px-3 py-2 border border-v2-border-light focus:outline-none focus:border-v2-red-primary resize-none"
                  placeholder="Viết giới thiệu..."
                  autoFocus
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="font-jetbrains text-[11px] text-v2-text-tertiary">
                    {bioText.length}/200
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setIsEditingBio(false)}
                      className="p-1 rounded-full text-v2-text-tertiary hover:bg-gray-100 transition-colors"
                    >
                      <X size={14} />
                    </button>
                    <button
                      onClick={handleSaveBio}
                      disabled={updateBioMutation.isPending}
                      className="p-1 rounded-full text-v2-red-primary hover:bg-v2-red-light transition-colors"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-1 flex items-start gap-1">
                <p className="font-vietnam text-[13px] text-v2-text-secondary flex-1">
                  {profile?.bio || "Chưa có giới thiệu"}
                </p>
                <button
                  onClick={handleEditBio}
                  className="p-1 rounded-full text-v2-text-tertiary hover:bg-gray-100 transition-colors shrink-0"
                  aria-label="Chỉnh sửa bio"
                >
                  <Pencil size={12} />
                </button>
              </div>
            )
          ) : (
            profile?.bio && (
              <p className="mt-1 font-vietnam text-[13px] text-v2-text-secondary">
                {profile.bio}
              </p>
            )
          )}

          {/* Stats */}
          <div className="border-t border-[#EDE8E1] mt-3 pt-3">
            <div className="flex justify-around">
              <div className="text-center">
                <p className="font-jetbrains text-xl font-bold text-v2-text-primary">
                  {profile?.postCount ?? 0}
                </p>
                <p className="font-vietnam text-xs text-v2-text-tertiary">Bài viết</p>
              </div>
              <button
                onClick={() => onFollowingClick?.("followers")}
                className="text-center hover:opacity-70 transition-opacity"
              >
                <p className="font-jetbrains text-xl font-bold text-v2-text-primary">
                  {profile?.followerCount ?? 0}
                </p>
                <p className="font-vietnam text-xs text-v2-text-tertiary">Người theo dõi</p>
              </button>
              <button
                onClick={() => onFollowingClick?.("following")}
                className="text-center hover:opacity-70 transition-opacity"
              >
                <p className="font-jetbrains text-xl font-bold text-v2-text-primary">
                  {profile?.followingCount ?? 0}
                </p>
                <p className="font-vietnam text-xs text-v2-text-tertiary">Đang theo dõi</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Posts */}
      {postsLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-bg border-t-transparent rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <FileText size={40} className="text-v2-text-tertiary" />
          <p className="font-vietnam text-sm text-v2-text-tertiary">Chưa có bài viết nào</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onHashtagClick={onHashtagClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
