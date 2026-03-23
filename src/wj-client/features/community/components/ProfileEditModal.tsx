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
          <h2 className="font-semibold text-v2-text-primary">Chỉnh sửa hồ sơ</h2>
          <button
            onClick={onClose}
            className="text-v2-text-tertiary hover:text-v2-gold-primary text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 flex flex-col gap-4">
          {/* Cover photo */}
          <div>
            <label className="text-xs font-medium text-v2-text-secondary mb-1 block">Ảnh bìa</label>
            <ImageUpload
              purpose="cover"
              onUpload={setCoverUrl}
              onRemove={() => setCoverUrl("")}
              currentImageUrl={coverUrl || undefined}
              label="Tải ảnh bìa lên"
              className="h-24"
            />
          </div>

          {/* Avatar */}
          <div>
            <label className="text-xs font-medium text-v2-text-secondary mb-1 block">Ảnh đại diện</label>
            <ImageUpload
              purpose="avatar"
              onUpload={setAvatarUrl}
              onRemove={() => setAvatarUrl("")}
              currentImageUrl={avatarUrl || undefined}
              label="Tải ảnh đại diện lên"
              className="h-24"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-medium text-v2-text-secondary mb-1 block">Giới thiệu</label>
            <textarea
              {...register("bio")}
              rows={3}
              maxLength={200}
              placeholder="Giới thiệu về bản thân..."
              className="w-full text-sm bg-v2-maroon-900 text-v2-gold-accent border border-v2-gold-primary/20 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-v2-gold-primary placeholder:text-v2-text-tertiary transition-colors"
            />
            <div className="flex justify-between">
              {errors.bio && (
                <p className="text-xs text-v2-red-negative">{errors.bio.message}</p>
              )}
              <span className="text-xs text-v2-text-tertiary ml-auto">
                {200 - (watch("bio")?.length || 0)}
              </span>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-medium text-v2-text-secondary mb-1 block">Vị trí</label>
            <input
              {...register("location")}
              type="text"
              maxLength={100}
              placeholder="Bạn đang ở đâu?"
              className="w-full text-sm bg-v2-maroon-900 text-v2-gold-accent border border-v2-gold-primary/20 rounded-lg px-3 py-2 focus:outline-none focus:border-v2-gold-primary placeholder:text-v2-text-tertiary transition-colors"
            />
            {errors.location && (
              <p className="text-xs text-v2-red-negative">{errors.location.message}</p>
            )}
          </div>

          {/* Website */}
          <div>
            <label className="text-xs font-medium text-v2-text-secondary mb-1 block">Website</label>
            <input
              {...register("website")}
              type="url"
              maxLength={200}
              placeholder="https://..."
              className="w-full text-sm bg-v2-maroon-900 text-v2-gold-accent border border-v2-gold-primary/20 rounded-lg px-3 py-2 focus:outline-none focus:border-v2-gold-primary placeholder:text-v2-text-tertiary transition-colors"
            />
            {errors.website && (
              <p className="text-xs text-v2-red-negative">{errors.website.message}</p>
            )}
          </div>

          {error && <p className="text-sm text-v2-red-negative">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm text-v2-text-secondary border border-v2-gold-primary/20 rounded-lg hover:bg-v2-maroon-700 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="flex-1 py-2 text-sm bg-v2-gold-primary text-v2-maroon-900 font-medium rounded-lg hover:bg-v2-gold-accent disabled:opacity-50 transition-colors"
            >
              {updateProfileMutation.isPending ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
