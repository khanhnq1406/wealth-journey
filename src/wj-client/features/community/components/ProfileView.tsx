"use client";

import { useState } from "react";
import { useQueryGetCommunityProfile } from "@/utils/generated/hooks";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { ArrowLeft, MapPin, Link2 } from "lucide-react";
import { ProfileTabs } from "./ProfileTabs";
import { ProfileEditModal } from "./ProfileEditModal";
import { useTranslations } from "next-intl";

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
  const { data: profileData, isLoading: profileLoading } =
    useQueryGetCommunityProfile(
      { userId: targetUserId },
      { enabled: targetUserId > 0, refetchOnMount: "always" },
    );
  const profile = profileData?.data;

  const t = useTranslations();
  const [showEditModal, setShowEditModal] = useState(false);

  const isOwnProfile = profile?.isOwnProfile ?? targetUserId === currentUser.id;

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-v2-gold-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Profile Header Card */}
      <div className="bg-v2-maroon-800 sm:rounded-2xl border-b sm:border border-v2-border-light overflow-hidden isolate">
        {/* Cover photo banner */}
        <div
          className="w-full h-32 sm:h-40 relative"
          style={
            profile?.coverPhotoUrl
              ? {
                  backgroundImage: `url(${profile.coverPhotoUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : { background: "linear-gradient(to right, #B91C1C, #DC2626)" }
          }
        >
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
          {/* {isOwnProfile && (
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="absolute bottom-2 right-2 z-20 bg-black/40 text-white text-xs px-2 py-1 rounded-md hover:bg-black/60"
            >
              Edit cover
            </button>
          )} */}
        </div>

        {/* Profile info */}
        <div className="px-4 pb-4">
          {/* Avatar overlapping banner */}
          <div className="-mt-10 mb-2 flex items-end justify-between relative z-10">
            <Avatar
              name={profile?.userName || currentUser.name}
              imageUrl={profile?.userPicture || currentUser.picture}
              size="lg"
              priority
              className="!w-20 !h-20 !text-2xl ring-[3px] ring-v2-gold-accent"
            />
            {isOwnProfile ? (
              <button
                onClick={() => setShowEditModal(true)}
                className="text-sm px-4 py-1.5 border border-v2-gold-primary/30 rounded-full hover:bg-v2-maroon-700 transition-colors font-medium text-v2-text-primary"
              >
                {t("profile.editProfile")}
              </button>
            ) : (
              <FollowButton
                targetUserId={targetUserId}
                initialIsFollowing={profile?.isFollowing ?? false}
                className="text-sm px-4 py-1.5"
              />
            )}
          </div>

          {/* Name */}
          <p className="font-roboto text-lg font-bold text-v2-text-primary">
            {profile?.userName || currentUser.name}
          </p>

          {/* Bio */}
          {profile?.bio && (
            <p className="mt-1 font-roboto text-[13px] text-v2-text-secondary">
              {profile.bio}
            </p>
          )}

          {/* Location */}
          {profile?.location && (
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <MapPin size={13} className="shrink-0" />
              <span>{profile.location}</span>
            </div>
          )}

          {/* Website */}
          {profile?.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-bg hover:underline mt-1"
            >
              <Link2 size={13} className="shrink-0" />
              <span>{profile.website}</span>
            </a>
          )}

          {/* Stats */}
          <div className="border-t border-v2-gold-primary/30 mt-3 pt-3">
            <div className="flex justify-around">
              <div className="text-center">
                <p className="font-roboto text-xl font-bold text-v2-text-primary">
                  {profile?.postCount ?? 0}
                </p>
                <p className="font-roboto text-xs text-v2-text-tertiary">
                  Bài viết
                </p>
              </div>
              <button
                onClick={() => onFollowingClick?.("followers")}
                className="text-center hover:opacity-70 transition-opacity"
              >
                <p className="font-roboto text-xl font-bold text-v2-text-primary">
                  {profile?.followerCount ?? 0}
                </p>
                <p className="font-roboto text-xs text-v2-text-tertiary">
                  Người theo dõi
                </p>
              </button>
              <button
                onClick={() => onFollowingClick?.("following")}
                className="text-center hover:opacity-70 transition-opacity"
              >
                <p className="font-roboto text-xl font-bold text-v2-text-primary">
                  {profile?.followingCount ?? 0}
                </p>
                <p className="font-roboto text-xs text-v2-text-tertiary">
                  Đang theo dõi
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Tabs (Posts / Likes / Shared) */}
      {profile && (
        <ProfileTabs
          userId={targetUserId}
          currentUser={currentUser}
          onUserClick={onUserClick}
          onHashtagClick={onHashtagClick}
        />
      )}

      {/* Edit Profile Modal */}
      {showEditModal && profile && (
        <ProfileEditModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
