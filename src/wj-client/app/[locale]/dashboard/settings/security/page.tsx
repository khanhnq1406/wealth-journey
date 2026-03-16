"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AuthMethodsCard } from "@/features/auth/components/AuthMethodsCard";
import { LinkPasswordForm } from "@/features/auth/forms/LinkPasswordForm";
import { ChangePasswordForm } from "@/features/auth/forms/ChangePasswordForm";
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
    <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <AuthMethodsCard
        onSetPassword={() => setFormView("link")}
        onChangePassword={() => setFormView("change")}
      />

      {formView === "link" && (
        <div className="bg-white dark:bg-dark-surface rounded-md drop-shadow-round p-4">
          <h2 className="text-lg font-semibold mb-4">{t("setPassword")}</h2>
          <LinkPasswordForm onSuccess={handleFormSuccess} />
        </div>
      )}

      {formView === "change" && (
        <div className="bg-white dark:bg-dark-surface rounded-md drop-shadow-round p-4">
          <h2 className="text-lg font-semibold mb-4">{t("changePassword")}</h2>
          <ChangePasswordForm onSuccess={handleFormSuccess} />
        </div>
      )}
    </div>
  );
}
