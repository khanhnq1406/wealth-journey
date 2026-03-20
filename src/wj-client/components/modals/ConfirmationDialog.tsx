"use client";

import { ButtonType } from "@/app/constants";
import { Button } from "@/components/Button";
import { useTranslations } from "next-intl";
import { ReactNode } from "react";
import { createPortal } from "react-dom";

export type ConfirmationDialogProps = {
  title?: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  variant?: "default" | "danger";
};

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  isLoading = false,
  variant = "default",
}) => {
  const tCommon = useTranslations("common");
  const resolvedTitle = title ?? tCommon("confirm");
  const resolvedConfirmText = confirmText ?? tCommon("confirm");
  const resolvedCancelText = cancelText ?? tCommon("cancel");
  return createPortal(
    <div className="fixed top-0 left-0 w-full h-full bg-modal flex justify-center items-center z-50">
      <div className="bg-v2-maroon-800 rounded-lg p-6">
        {resolvedTitle && (
          <div className="flex justify-between items-center mb-4">
            <div className="font-bold text-lg text-white">{resolvedTitle}</div>
          </div>
        )}
        <div className="text-center mb-6 text-v2-cream-100">{message}</div>
        <div className="flex gap-3 justify-end">
          <Button
            type={ButtonType.SECONDARY}
            onClick={onCancel}
            disabled={isLoading}
          >
            {resolvedCancelText}
          </Button>
          <Button
            type={ButtonType.PRIMARY}
            onClick={onConfirm}
            loading={isLoading}
            className={variant === "danger" ? "bg-danger-600 hover:bg-danger-700" : ""}
          >
            {resolvedConfirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
