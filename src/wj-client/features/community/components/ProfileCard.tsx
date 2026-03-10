"use client";

import { useState } from "react";
import { useQueryGetCommunityProfile, useMutationUpdateBio, EVENT_CommunityGetCommunityProfile } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar } from "./Avatar";
import { Pencil, Check, X } from "lucide-react";

interface ProfileCardProps {
  currentUser: { id: number; name: string; picture: string };
}

export function ProfileCard({ currentUser }: ProfileCardProps) {
  const queryClient = useQueryClient();

  const { data } = useQueryGetCommunityProfile(
    { userId: currentUser.id },
    { enabled: currentUser.id > 0, refetchOnMount: "always" }
  );

  const profile = data?.data;

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

  const handleCancelBio = () => {
    setIsEditingBio(false);
  };

  const stats = [
    { value: profile?.postCount ?? 0, label: "Bài viết" },
    { value: profile?.followerCount ?? 0, label: "Người theo dõi" },
    { value: profile?.followingCount ?? 0, label: "Đang theo dõi" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-v2-border-light overflow-hidden">
      {/* Banner */}
      <div className="h-20 bg-gradient-to-r from-[#B91C1C] to-[#DC2626]" />

      {/* Profile info */}
      <div className="px-4 pb-4">
        {/* Avatar overlapping banner */}
        <div className="-mt-9 mb-2">
          <Avatar
            name={profile?.userName || currentUser.name}
            imageUrl={profile?.userPicture || currentUser.picture}
            size="lg"
            priority
            className="!w-[72px] !h-[72px] !text-xl ring-[3px] ring-white"
          />
        </div>

        {/* Name */}
        <p className="font-vietnam text-lg font-bold text-v2-text-primary">
          {profile?.userName || currentUser.name}
        </p>

        {/* Bio */}
        {isEditingBio ? (
          <div className="mt-1">
            <textarea
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full font-vietnam text-[13px] text-v2-text-primary bg-[#FAF9F7] rounded-lg px-3 py-2 border border-v2-border-light focus:outline-none focus:border-v2-red-primary resize-none"
              placeholder="Viết giới thiệu..."
            />
            <div className="flex items-center justify-between mt-1">
              <span className="font-jetbrains text-[11px] text-v2-text-tertiary">
                {bioText.length}/200
              </span>
              <div className="flex gap-1">
                <button
                  onClick={handleCancelBio}
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
              aria-label="Edit bio"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-[#EDE8E1] mt-3 pt-3">
          {/* Stats row */}
          <div className="flex justify-around">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-jetbrains text-xl font-bold text-v2-text-primary">
                  {stat.value}
                </p>
                <p className="font-vietnam text-xs text-v2-text-tertiary">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
