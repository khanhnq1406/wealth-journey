"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutationUpdateProfile, EVENT_CommunityGetCommunityProfile } from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { editProfileSchema, type EditProfileFormData } from "../utils/community.schema";
import { ImageUpload } from "./ImageUpload";
import type { CommunityProfile } from "@/gen/protobuf/v1/community";
import { useTranslations } from "next-intl";
import { getTranslatedError } from "@/lib/utils/error-translator";

interface ProfileEditModalProps {
  profile: CommunityProfile;
  onClose: () => void;
}

export function ProfileEditModal({ profile, onClose }: ProfileEditModalProps) {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(profile.userPicture || "");
  const [coverUrl, setCoverUrl] = useState(profile.coverPhotoUrl || "");
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      bio: profile.bio || "",
      location: profile.location || "",
      website: profile.website || "",
    },
  });

  const updateProfileMutation = useMutationUpdateProfile({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetCommunityProfile] });
      onClose();
    },
    onError: (err: any) => {
      setError(getTranslatedError(err, t));
    },
  });

  const onSubmit = (data: EditProfileFormData) => {
    setError(null);
    updateProfileMutation.mutate({
      bio: data.bio || "",
      location: data.location || "",
      website: data.website || "",
      picture: avatarUrl,
      coverPhotoUrl: coverUrl,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-v2-maroon-800 rounded-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-v2-border-light">
          <h2 className="font-semibold text-v2-text-primary">Edit Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 flex flex-col gap-4">
          {/* Cover photo */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Cover Photo</label>
            <ImageUpload
              purpose="cover"
              onUpload={setCoverUrl}
              onRemove={() => setCoverUrl("")}
              currentImageUrl={coverUrl || undefined}
              label="Upload cover photo"
              className="h-24"
            />
          </div>

          {/* Avatar */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Profile Photo</label>
            <ImageUpload
              purpose="avatar"
              onUpload={setAvatarUrl}
              onRemove={() => setAvatarUrl("")}
              currentImageUrl={avatarUrl || undefined}
              label="Upload profile photo"
              className="h-24"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Bio</label>
            <textarea
              {...register("bio")}
              rows={3}
              maxLength={200}
              placeholder="Tell people about yourself..."
              className="w-full text-sm border border-v2-gold-primary/20 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-v2-gold-primary"
            />
            <div className="flex justify-between">
              {errors.bio && (
                <p className="text-xs text-red-500">{errors.bio.message}</p>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {200 - (watch("bio")?.length || 0)}
              </span>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Location</label>
            <input
              {...register("location")}
              type="text"
              maxLength={100}
              placeholder="Where are you based?"
              className="w-full text-sm border border-v2-gold-primary/20 rounded-lg px-3 py-2 focus:outline-none focus:border-v2-gold-primary"
            />
            {errors.location && (
              <p className="text-xs text-red-500">{errors.location.message}</p>
            )}
          </div>

          {/* Website */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Website</label>
            <input
              {...register("website")}
              type="url"
              maxLength={200}
              placeholder="https://..."
              className="w-full text-sm border border-v2-gold-primary/20 rounded-lg px-3 py-2 focus:outline-none focus:border-v2-gold-primary"
            />
            {errors.website && (
              <p className="text-xs text-red-500">{errors.website.message}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm border border-v2-gold-primary/20 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="flex-1 py-2 text-sm bg-bg text-white rounded-lg hover:bg-hgreen disabled:opacity-50"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
