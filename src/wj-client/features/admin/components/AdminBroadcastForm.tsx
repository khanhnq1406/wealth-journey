"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient } from "@/utils/api-client";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";

const MAX_MESSAGE_LENGTH = 500;
const MAX_TITLE_LENGTH = 200;

interface BroadcastResponse {
  success: boolean;
  message: string;
  recipientCount: number;
}

export function AdminBroadcastForm() {
  const t = useTranslations("admin.broadcast");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const charCount = message.length;
  const isValid = charCount > 0 && charCount <= MAX_MESSAGE_LENGTH && title.length <= MAX_TITLE_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiClient.post<BroadcastResponse>("/api/v1/admin/broadcast", {
        title: title.trim(),
        message: message.trim(),
      });

      const data = res as unknown as BroadcastResponse;
      if (data.success) {
        setSuccess(t("toast.success", { count: data.recipientCount }));
        setTitle("");
        setMessage("");
      } else {
        setError(data.message || t("toast.error"));
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("toast.error");
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h3 className="font-roboto font-semibold text-lg text-v2-text-primary mb-4">
        {t("title")}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="broadcast-title"
            className="block font-roboto text-sm font-medium text-v2-text-secondary mb-1"
          >
            {t("form.title")}
          </label>
          <input
            id="broadcast-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_TITLE_LENGTH}
            placeholder={t("form.titlePlaceholder")}
            className="w-full rounded-lg border border-v2-border-light px-3 py-2 font-roboto text-sm text-v2-text-primary placeholder:text-v2-text-tertiary focus:outline-none focus:ring-2 focus:ring-bg/30 focus:border-v2-gold-primary"
          />
          <p className="mt-1 font-roboto text-xs text-v2-text-tertiary">
            {t("form.titleHelp")}
          </p>
        </div>

        <div>
          <label
            htmlFor="broadcast-message"
            className="block font-roboto text-sm font-medium text-v2-text-secondary mb-1"
          >
            {t("form.message")}
          </label>
          <textarea
            id="broadcast-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={4}
            placeholder={t("form.messagePlaceholder")}
            className="w-full rounded-lg border border-v2-border-light px-3 py-2 font-roboto text-sm text-v2-text-primary placeholder:text-v2-text-tertiary focus:outline-none focus:ring-2 focus:ring-bg/30 focus:border-v2-gold-primary resize-none"
          />
          <p
            className={`mt-1 font-roboto text-xs ${
              charCount > MAX_MESSAGE_LENGTH ? "text-lred" : "text-v2-text-tertiary"
            }`}
          >
            {charCount}/{MAX_MESSAGE_LENGTH} {t("form.charLabel")}
          </p>
        </div>

        {error && (
          <div className="bg-v2-bg-dark border border-v2-red-negative/30 rounded-lg px-4 py-2">
            <p className="font-roboto text-sm text-v2-red-negative">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-v2-bg-dark border border-v2-green-positive/30 rounded-lg px-4 py-2">
            <p className="font-roboto text-sm text-v2-green-positive">{success}</p>
          </div>
        )}

        <Button
          type={ButtonType.PRIMARY}
          htmlType="submit"
          loading={isSubmitting}
          disabled={!isValid}
        >
          {isSubmitting ? t("form.sending") : t("form.send")}
        </Button>
      </form>
    </div>
  );
}
