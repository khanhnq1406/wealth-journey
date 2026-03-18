import { z } from "zod";

export const submitFeedbackSchema = z.object({
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject must be 200 characters or less"),
  message: z
    .string()
    .min(1, "Message is required")
    .max(2000, "Message must be 2000 characters or less"),
});

export type SubmitFeedbackFormInput = z.infer<typeof submitFeedbackSchema>;
