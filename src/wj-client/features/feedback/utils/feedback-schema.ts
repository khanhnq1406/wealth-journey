import { z } from "zod";

export const submitFeedbackSchema = z.object({
  subject: z
    .string()
    .min(1, "FEEDBACK_SUBJECT_REQUIRED")
    .max(200, "FEEDBACK_SUBJECT_MAX"),
  message: z
    .string()
    .min(1, "FEEDBACK_MESSAGE_REQUIRED")
    .max(2000, "FEEDBACK_MESSAGE_MAX"),
});

export type SubmitFeedbackFormInput = z.infer<typeof submitFeedbackSchema>;
