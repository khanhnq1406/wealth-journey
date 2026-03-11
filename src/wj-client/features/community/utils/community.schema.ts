import { z } from "zod";

export const createPostSchema = z.object({
  content: z.string().min(1, "Content is required").max(2000, "Maximum 2000 characters"),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export type CreatePostFormData = z.infer<typeof createPostSchema>;

export const editPostSchema = z.object({
  content: z.string().min(1, "Content is required").max(2000, "Maximum 2000 characters"),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export type EditPostFormData = z.infer<typeof editPostSchema>;

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment is required").max(500, "Maximum 500 characters"),
});

export type CreateCommentFormData = z.infer<typeof createCommentSchema>;

export const updateBioSchema = z.object({
  bio: z.string().max(200, "Maximum 200 characters"),
});

export type UpdateBioFormData = z.infer<typeof updateBioSchema>;

export const reportContentSchema = z.object({
  targetType: z.enum(["post", "comment"]),
  targetId: z.number(),
  reason: z.string().min(1, "Please select a reason"),
});

export type ReportContentFormData = z.infer<typeof reportContentSchema>;

export const sharePostSchema = z.object({
  content: z.string().max(2000, "Maximum 2000 characters").optional().or(z.literal("")),
});

export type SharePostFormData = z.infer<typeof sharePostSchema>;

export const editCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(500, "Comment must be 500 characters or less"),
});

export type EditCommentFormData = z.infer<typeof editCommentSchema>;

export const editProfileSchema = z.object({
  bio: z.string().max(200, "Bio must be 200 characters or less").optional(),
  location: z.string().max(100, "Location must be 100 characters or less").optional(),
  website: z.string().max(200).url("Must be a valid URL").optional().or(z.literal("")),
});

export type EditProfileFormData = z.infer<typeof editProfileSchema>;
