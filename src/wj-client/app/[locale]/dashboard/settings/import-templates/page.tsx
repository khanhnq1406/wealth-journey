"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import {
  useQueryListUserTemplates,
  useMutationDeleteUserTemplate,
} from "@/utils/generated/hooks";
import { UserTemplate } from "@/gen/protobuf/v1/import";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { formatDate } from "@/lib/utils/date";

export default function ImportTemplatesPage() {
  const t = useTranslations("settings.importTemplates");
  const [selectedTemplate, setSelectedTemplate] =
    useState<UserTemplate | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch user templates
  const {
    data: templatesResponse,
    isLoading,
    refetch,
  } = useQueryListUserTemplates({}, { refetchOnMount: "always" });

  // Delete mutation
  const deleteMutation = useMutationDeleteUserTemplate({
    onSuccess: () => {
      setShowDeleteConfirm(false);
      setSelectedTemplate(null);
      refetch();
    },
  });

  const templates = templatesResponse?.templates || [];

  const handleDeleteClick = (template: UserTemplate) => {
    setSelectedTemplate(template);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (selectedTemplate) {
      deleteMutation.mutate({
        templateId: selectedTemplate.id,
      });
    }
  };

  const getFileFormatsDisplay = (fileFormats: string[] | undefined) => {
    if (!fileFormats || fileFormats.length === 0) return "CSV";
    return fileFormats.map((f) => f.toUpperCase()).join(", ");
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>
        <div className="text-center py-8">{t("loadingTemplates")}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-gray-600 mt-1">
            {t("description")}
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <BaseCard>
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">
              {t("noTemplates")}
            </p>
          </div>
        </BaseCard>
      ) : (
        <BaseCard>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-semibold">{t("tableHeaders.templateName")}</th>
                  <th className="text-left p-4 font-semibold">{t("tableHeaders.fileFormats")}</th>
                  <th className="text-left p-4 font-semibold">{t("tableHeaders.currency")}</th>
                  <th className="text-left p-4 font-semibold">{t("tableHeaders.dateFormat")}</th>
                  <th className="text-left p-4 font-semibold">{t("tableHeaders.created")}</th>
                  <th className="text-right p-4 font-semibold">{t("tableHeaders.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-medium">{template.name}</div>
                    </td>
                    <td className="p-4">
                      {getFileFormatsDisplay(template.fileFormats)}
                    </td>
                    <td className="p-4">{template.currency}</td>
                    <td className="p-4">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {template.dateFormat}
                      </code>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {formatDate(Number(template.createdAt))}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          type={ButtonType.SECONDARY}
                          onClick={() => handleDeleteClick(template)}
                          className="text-sm px-3 py-1"
                        >
                          {t("deleteConfirm")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BaseCard>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <ConfirmationDialog
          onCancel={() => {
            setShowDeleteConfirm(false);
            setSelectedTemplate(null);
          }}
          onConfirm={handleConfirmDelete}
          title={t("deleteTitle")}
          message={t("deleteMessage", { name: selectedTemplate?.name || "" })}
          confirmText={t("deleteConfirm")}
          variant="danger"
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
