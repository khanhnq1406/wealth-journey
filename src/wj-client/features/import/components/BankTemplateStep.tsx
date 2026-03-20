"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  useQueryListBankTemplates,
  useQueryListUserTemplates,
} from "@/utils/generated/hooks";
import { Button } from "@/components/Button";
import { cn } from "@/lib/utils/cn";

export interface BankTemplateStepProps {
  onTemplateSelected: (templateId: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}

const CUSTOM_TEMPLATE_ID = "custom" as const;

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn(
 "w-6 h-6 text-primary-600 flex-shrink-0 ml-3",
        className,
      )}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function BankTemplateStep({
  onTemplateSelected,
  onNext,
  onBack,
}: BankTemplateStepProps) {
  const t = useTranslations("import.bankTemplate");
  const tCommon = useTranslations("common");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Fetch bank templates
  const {
    data: templatesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQueryListBankTemplates({});

  // Fetch user templates
  const {
    data: userTemplatesData,
    isLoading: isLoadingUserTemplates,
  } = useQueryListUserTemplates({});

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    onTemplateSelected(templateId);
  };

  const handleCustomFormat = () => {
    setSelectedTemplate(CUSTOM_TEMPLATE_ID);
    onTemplateSelected(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Instructions */}
 <div className="text-sm sm:text-base text-neutral-600">
        <p className="mb-2">
          {t("selectBankInstructions")}
        </p>
 <p className="text-xs sm:text-sm text-neutral-500">
          {t("customFormatHint")}
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
 className="h-16 bg-neutral-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
 <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
 <p className="text-red-700 mb-3">
            {t("loadError")}{" "}
            {error?.message || "Please try again."}
          </p>
          <Button
            variant="secondary"
            onClick={() => refetch()}
            className="text-sm"
          >
            {t("retry")}
          </Button>
        </div>
      )}

      {/* Bank Templates */}
      {!isLoading && !isError && (
        <div className="space-y-4">
          {/* User Templates Section */}
          {userTemplatesData?.templates &&
            userTemplatesData.templates.length > 0 && (
              <div>
 <h3 className="text-sm font-semibold text-neutral-700 mb-2 px-1">
                  {t("yourTemplates")}
                </h3>
                <div className="space-y-2 max-h-[25vh] overflow-y-auto -mx-1 px-1">
                  {userTemplatesData.templates.map((template) => (
                    <button
                      key={`user-${template.id}`}
                      onClick={() => handleSelectTemplate(`user-${template.id}`)}
                      className={cn(
                        "w-full p-4 rounded-lg border-2 text-left transition-all duration-200",
 "hover:border-primary-400 hover:bg-neutral-50",
                        "active:scale-[0.99]",
                        selectedTemplate === `user-${template.id}`
 ? "border-primary-600 bg-primary-50"
 : "border-neutral-200 bg-white",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
 <h3 className="font-semibold text-base text-neutral-900">
                            {template.name}
                          </h3>
 <p className="text-sm text-neutral-600 mt-1">
                            {template.currency} • {template.dateFormat} •{" "}
                            {template.fileFormats?.join(", ") || "CSV"}
                          </p>
                        </div>
                        {selectedTemplate === `user-${template.id}` && (
                          <CheckIcon />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* Bank Templates Section */}
          <div>
 <h3 className="text-sm font-semibold text-neutral-700 mb-2 px-1">
              {t("bankTemplates")}
            </h3>
            <div className="space-y-2 max-h-[25vh] overflow-y-auto -mx-1 px-1">
              {templatesData?.templates?.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template.id)}
                  className={cn(
                    "w-full p-4 rounded-lg border-2 text-left transition-all duration-200",
 "hover:border-primary-400 hover:bg-neutral-50",
                    "active:scale-[0.99]",
                    selectedTemplate === template.id
 ? "border-primary-600 bg-primary-50"
 : "border-neutral-200 bg-white",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
 <h3 className="font-semibold text-base text-neutral-900">
                        {template.name}
                      </h3>
 <p className="text-sm text-neutral-600 mt-1">
                        {template.bankCode} • {template.statementType} •{" "}
                        {template.fileFormats.join(", ")}
                      </p>
                    </div>
                    {selectedTemplate === template.id && <CheckIcon />}
                  </div>
                </button>
              ))}

              {/* Empty State */}
              {templatesData?.templates?.length === 0 && (
 <div className="text-center py-8 px-4 text-neutral-500">
                  <p className="text-base mb-2">
                    {t("noTemplatesAvailable")}
                  </p>
                  <p className="text-sm">
                    {t("useCustomFormat")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Custom Format Option */}
          <button
            onClick={handleCustomFormat}
            className={cn(
              "w-full p-4 rounded-lg border-2 text-left transition-all duration-200",
 "hover:border-primary-400 hover:bg-neutral-50",
              "active:scale-[0.99]",
              selectedTemplate === CUSTOM_TEMPLATE_ID
 ? "border-primary-600 bg-primary-50"
 : "border-neutral-200 bg-white",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
 <h3 className="font-semibold text-base text-neutral-900">
                  {t("customFormat")}
                </h3>
 <p className="text-sm text-neutral-600 mt-1">
                  {t("customFormatDesc")}
                </p>
              </div>
              {selectedTemplate === CUSTOM_TEMPLATE_ID && <CheckIcon />}
            </div>
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={onBack}>
          {t("back")}
        </Button>
        <Button variant="primary" onClick={onNext} disabled={!selectedTemplate}>
          {t("nextPreview")}
        </Button>
      </div>
    </div>
  );
}
