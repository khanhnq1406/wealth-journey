"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AuthMethodsCard } from "@/features/auth/components/AuthMethodsCard";
import { LinkPasswordForm } from "@/features/auth/forms/LinkPasswordForm";
import { ChangePasswordForm } from "@/features/auth/forms/ChangePasswordForm";
import { BaseCard } from "@/components/BaseCard";
import { useQueryClient } from "@tanstack/react-query";
import { EVENT_AuthGetAuthMethods } from "@/utils/generated/hooks";

type FormView = "none" | "link" | "change";

export default function SecuritySettingsPage() {
  const t = useTranslations("settings.security");
  const [formView, setFormView] = useState<FormView>("none");
  const queryClient = useQueryClient();

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [EVENT_AuthGetAuthMethods] });
    setFormView("none");
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6">
 <h1 className="text-xl font-semibold text-white">
        {t("title")}
      </h1>

      <AuthMethodsCard
        onSetPassword={() => setFormView("link")}
        onChangePassword={() => setFormView("change")}
      />

      {formView === "link" && (
        <BaseCard padding="none">
 <div className="px-4 pt-4 pb-2 sm:px-6 sm:pt-5 sm:pb-3 border-b border-v2-border-light">
            <div className="flex items-center justify-between">
 <h2 className="text-base font-semibold text-white">
                {t("setPassword")}
              </h2>
              <button
                onClick={() => setFormView("none")}
 className="text-v2-text-tertiary hover:text-v2-text-secondary transition-colors p-1 -mr-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <LinkPasswordForm onSuccess={handleFormSuccess} />
          </div>
        </BaseCard>
      )}

      {formView === "change" && (
        <BaseCard padding="none">
 <div className="px-4 pt-4 pb-2 sm:px-6 sm:pt-5 sm:pb-3 border-b border-v2-border-light">
            <div className="flex items-center justify-between">
 <h2 className="text-base font-semibold text-white">
                {t("changePassword")}
              </h2>
              <button
                onClick={() => setFormView("none")}
 className="text-v2-text-tertiary hover:text-v2-text-secondary transition-colors p-1 -mr-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <ChangePasswordForm onSuccess={handleFormSuccess} />
          </div>
        </BaseCard>
      )}
    </div>
  );
}
