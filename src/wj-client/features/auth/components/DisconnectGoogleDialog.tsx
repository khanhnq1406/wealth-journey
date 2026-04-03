"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import {
  useMutationUnlinkGoogle,
  EVENT_AuthGetAuthMethods,
} from "@/utils/generated/hooks";
import { useNotification } from "@/contexts/NotificationContext";
import { mapUnlinkGoogleError } from "@/features/auth/utils/error-mapper";

interface DisconnectGoogleDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DisconnectGoogleDialog({
  isOpen,
  onClose,
}: DisconnectGoogleDialogProps) {
  const t = useTranslations("settings.security");
  const queryClient = useQueryClient();
  const { toast } = useNotification();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const unlinkGoogle = useMutationUnlinkGoogle({
    onSuccess() {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: [EVENT_AuthGetAuthMethods] });
      toast.success(t("disconnectGoogleSuccess"));
      onClose();
    },
    onError(error: any) {
      const i18nKey = mapUnlinkGoogleError(error.message);
      setErrorMessage(
        i18nKey
          ? t(`errors.${i18nKey}`)
          : error.message || t("errors.unlinkGoogleFailed"),
      );
    },
  });

  const handleConfirm = () => {
    setErrorMessage(null);
    unlinkGoogle.mutate({});
  };

  if (!isOpen) return null;

  return (
    <ConfirmationDialog
      title={t("disconnectGoogleTitle")}
      message={
        <div className="space-y-3">
          <p>{t("disconnectGoogleMessage")}</p>
          {errorMessage && (
            <div className="p-2.5 bg-v2-bg-dark border border-v2-red-negative/30 rounded-lg">
              <p className="text-xs text-v2-red-negative">{errorMessage}</p>
            </div>
          )}
        </div>
      }
      confirmText={t("disconnectGoogleConfirm")}
      onConfirm={handleConfirm}
      onCancel={() => {
        setErrorMessage(null);
        onClose();
      }}
      isLoading={unlinkGoogle.isPending}
      variant="danger"
    />
  );
}
