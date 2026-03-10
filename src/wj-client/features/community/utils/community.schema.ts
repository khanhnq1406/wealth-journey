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
