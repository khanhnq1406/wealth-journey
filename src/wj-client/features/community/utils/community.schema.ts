import { z } from "zod";

export const createPostSchema = z.object({
  content: z.string().min(1, "COMMUNITY_CONTENT_REQUIRED").max(2000, "COMMUNITY_CONTENT_MAX"),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export type CreatePostFormData = z.infer<typeof createPostSchema>;

export const editPostSchema = z.object({
  content: z.string().min(1, "COMMUNITY_CONTENT_REQUIRED").max(2000, "COMMUNITY_CONTENT_MAX"),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export type EditPostFormData = z.infer<typeof editPostSchema>;

export const createCommentSchema = z.object({
  content: z.string().min(1, "COMMUNITY_COMMENT_REQUIRED").max(500, "COMMUNITY_COMMENT_MAX"),
});

export type CreateCommentFormData = z.infer<typeof createCommentSchema>;

export const updateBioSchema = z.object({
  bio: z.string().max(200, "COMMUNITY_BIO_MAX"),
});

export type UpdateBioFormData = z.infer<typeof updateBioSchema>;

export const reportContentSchema = z.object({
  targetType: z.enum(["post", "comment"]),
  targetId: z.number(),
  reason: z.string().min(1, "COMMUNITY_REASON_REQUIRED"),
});

export type ReportContentFormData = z.infer<typeof reportContentSchema>;

export const sharePostSchema = z.object({
  content: z.string().max(2000, "COMMUNITY_SHARE_MAX").optional().or(z.literal("")),
});

export type SharePostFormData = z.infer<typeof sharePostSchema>;

export const editCommentSchema = z.object({
  content: z.string().min(1, "COMMUNITY_COMMENT_EMPTY").max(500, "COMMUNITY_COMMENT_LENGTH_MAX"),
});

export type EditCommentFormData = z.infer<typeof editCommentSchema>;

export const editProfileSchema = z.object({
  bio: z.string().max(200, "COMMUNITY_BIO_LENGTH_MAX").optional(),
  location: z.string().max(100, "COMMUNITY_LOCATION_MAX").optional(),
  website: z.string().max(200).url("COMMUNITY_URL_INVALID").optional().or(z.literal("")),
});

export type EditProfileFormData = z.infer<typeof editProfileSchema>;
