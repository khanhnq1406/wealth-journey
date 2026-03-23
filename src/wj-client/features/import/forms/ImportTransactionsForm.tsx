"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { BaseModal } from "@/components/modals/BaseModal";
import { FileUploadStep } from "@/features/import/components/FileUploadStep";
import { WalletSelectionStep } from "@/features/import/components/WalletSelectionStep";
import { StepProgress } from "@/features/import/components/StepProgress";
// Bank Template and Column Mapping temporarily disabled for auto-parse
// import { BankTemplateStep } from "@/features/import/components/BankTemplateStep";
// import {
//   ColumnMappingStep,
//   ColumnMapping,
// } from "@/features/import/components/ColumnMappingStep";
import { ReviewStepWrapper } from "@/features/import/components/ReviewStepWrapper";
import { ImportSuccess } from "@/features/import/components/ImportSuccess";
import { ImportSummary } from "@/gen/protobuf/v1/import";
import {
  EVENT_WalletGetTotalBalance,
  useMutationUploadStatementFile,
} from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { EVENT_TransactionListTransactions } from "@/utils/generated/hooks";
import { getTranslatedError } from "@/lib/utils/error-translator";

// Import step definitions
const IMPORT_STEPS = [
  {
    number: 1,
    label: "Upload",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
    ),
  },
  {
    number: 2,
    label: "Select Wallet",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
        />
      </svg>
    ),
  },
  {
    number: 5,
    label: "Review",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
        />
      </svg>
    ),
  },
  {
    number: 6,
    label: "Complete",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
];

interface ImportTransactionsFormProps {
  onSuccess?: () => void;
}

/**
 * Import Transactions Form - Multi-step wizard for importing bank/credit card statements
 *
 * Simplified implementation with 4 steps (CSV temporarily disabled):
 * - Step 1: File Upload (FileUploadStep) ✓
 * - Step 2: Wallet Selection (WalletSelectionStep) ✓
 * - Step 3: Preview, Review & Execute Import (ReviewStepWrapper) ✓
 * - Step 4: Success Summary with Undo Option (ImportSuccess) ✓
 *
 * Features:
 * - Multi-format support (Excel, PDF) - Auto-parse enabled
 * - Category suggestions based on transaction description
 * - Duplicate detection
 * - Wallet balance updates
 * - Import undo functionality (24-hour window)
 *
 * Note: Bank Template and Column Mapping steps are temporarily disabled
 * as we use auto-parse for Excel and PDF files.
 */
export function ImportTransactionsForm({
  onSuccess,
}: ImportTransactionsFormProps) {
  const t = useTranslations("import.steps");
  const tErrors = useTranslations();
  const queryClient = useQueryClient();
  const translatedSteps = useMemo(() => IMPORT_STEPS.map((step, i) => {
    const labels = [t("upload"), t("selectWallet"), t("review"), t("complete")];
    return { ...step, label: labels[i] ?? step.label };
  }), [t]);
  const [isOpen, setIsOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<number | null>(null);
  // Template and column mapping temporarily disabled for auto-parse
  // const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
  //   null,
  // );
  // const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(
  //   null,
  // );
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(
    null,
  );
  const [importBatchId, setImportBatchId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // File upload mutation
  const uploadFileMutation = useMutationUploadStatementFile({
    onSuccess: (response) => {
      if (response.success && response.fileId) {
        setUploadedFileId(response.fileId);
        setCurrentStep(2); // Move to wallet selection
      } else {
        setError(response.message || "Failed to upload file");
      }
    },
    onError: (err: any) => {
      setError(getTranslatedError(err, tErrors));
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    onSuccess?.();
  };

  const getModalTitle = () => {
    switch (currentStep) {
      case 1:
        return "Import Transactions - Upload File";
      case 2:
        return "Import Transactions - Select Wallet";
      case 5:
        return "Import Transactions - Review";
      case 6:
        return "Import Complete";
      default:
        return "Import Transactions";
    }
  };

  /**
   * Handle import errors with user-friendly messages and recovery logic
   */
  const handleImportError = (error: any) => {
    // Clear any existing errors first
    setError(null);

    // Use translated error message
    const translatedMsg = getTranslatedError(error, tErrors);
    setError(translatedMsg);

    // Determine if we need to navigate back based on error type
    const errorMsg = error?.message || "";
    if (
      errorMsg.includes("exceeded maximum transactions per import") ||
      errorMsg.includes("transaction date cannot be in the future") ||
      errorMsg.includes("transaction date too old") ||
      errorMsg.includes("No valid transactions to import")
    ) {
      setCurrentStep(1); // Go back to file upload
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
  };

  const handleWalletSelected = (walletId: number) => {
    setSelectedWalletId(walletId);
  };

  // Template selection temporarily disabled for auto-parse
  // const handleTemplateSelected = (templateId: string | null) => {
  //   setSelectedTemplateId(templateId);
  // };

  const handleStep1Next = async () => {
    if (!selectedFile) return;

    // Upload file to backend - Use FileReader to read as base64 directly
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      // Result is in format: "data:<mimetype>;base64,<base64data>"
      // Extract just the base64 part
      const base64Data = result.split(",")[1];

      // Map file extension to backend-expected fileType
      // CSV temporarily disabled - only Excel and PDF supported
      const fileExt = selectedFile.name.split(".").pop()?.toLowerCase() || "";
      let fileType = "";
      if (fileExt === "xlsx" || fileExt === "xls") {
        fileType = "excel";
      } else if (fileExt === "pdf") {
        fileType = "pdf";
      }

      uploadFileMutation.mutate({
        fileData: base64Data as any, // Protobuf bytes field expects base64 string in JSON
        fileName: selectedFile.name,
        fileType: fileType,
        fileSize: selectedFile.size,
      });
    };
    reader.readAsDataURL(selectedFile); // Reads file as base64 data URL
  };

  const handleStep2Back = () => {
    setCurrentStep(1);
  };

  const handleStep2Next = () => {
    // Skip bank template and column mapping - go directly to review
    setCurrentStep(5); // Move directly to review step
  };

  // Steps 3 and 4 handlers temporarily disabled for auto-parse
  // const handleStep3Back = () => {
  //   setCurrentStep(2);
  // };

  // const handleStep3Next = () => {
  //   // Skip column mapping for Excel and PDF files (backend handles parsing automatically)
  //   if (selectedFile) {
  //     const fileExt = selectedFile.name.split(".").pop()?.toLowerCase();
  //     if (fileExt === "xlsx" || fileExt === "xls" || fileExt === "pdf") {
  //       // For Excel/PDF, skip column mapping and go directly to review
  //       setCurrentStep(5);
  //       return;
  //     }
  //   }
  //   // For CSV files, go to column mapping
  //   setCurrentStep(4);
  // };

  // const handleStep4Back = () => {
  //   setCurrentStep(3);
  // };

  // const handleColumnMappingComplete = (mapping: ColumnMapping) => {
  //   setColumnMapping(mapping);
  //   setCurrentStep(5); // Move to review
  // };

  const handleStep5Back = () => {
    // Go back to wallet selection (step 2) since we skip steps 3 and 4
    setCurrentStep(2);
  };

  const handleImportSuccess = (summary: ImportSummary, batchId: string) => {
    setImportSummary(summary);
    setImportBatchId(batchId);
    setCurrentStep(6); // Move to success screen
    queryClient.invalidateQueries({
      queryKey: [EVENT_TransactionListTransactions],
    });
    queryClient.invalidateQueries({
      queryKey: [EVENT_WalletGetTotalBalance],
    });
  };

  const handleDone = () => {
    // Refresh transaction list
    queryClient.invalidateQueries({
      queryKey: [EVENT_TransactionListTransactions],
    });
    queryClient.invalidateQueries({
      queryKey: [EVENT_WalletGetTotalBalance],
    });
    handleClose();
  };

  const handleUndoSuccess = () => {
    // Refresh and close
    queryClient.invalidateQueries({
      queryKey: [EVENT_TransactionListTransactions],
    });
    queryClient.invalidateQueries({
      queryKey: [EVENT_WalletGetTotalBalance],
    });
    handleClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={getModalTitle()}
      maxWidth="max-w-2xl"
    >
      {/* Step Progress Indicator - Show on steps 1, 2, 5 only */}
      {(currentStep === 1 || currentStep === 2 || currentStep === 5) && (
        <div className="mb-6 pb-6 border-b border-v2-gold-primary/20 pt-1">
          <StepProgress steps={translatedSteps} currentStep={currentStep} />
        </div>
      )}

      {/* Error Message Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-v2-red-negative/30 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-v2-gold-primary focus:ring-offset-2 focus:ring-offset-red-50"
              >
                <span className="sr-only">Dismiss</span>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: File Upload */}
      {currentStep === 1 && (
        <FileUploadStep
          onFileSelected={handleFileSelected}
          onNext={handleStep1Next}
          isUploading={uploadFileMutation.isPending}
        />
      )}

      {/* Step 2: Wallet Selection */}
      {currentStep === 2 && (
        <WalletSelectionStep
          onWalletSelected={handleWalletSelected}
          onNext={handleStep2Next}
          onBack={handleStep2Back}
        />
      )}

      {/* Steps 3 and 4 temporarily disabled for auto-parse */}
      {/* Step 3: Bank Template Selection */}
      {/* {currentStep === 3 && (
        <BankTemplateStep
          onTemplateSelected={handleTemplateSelected}
          onNext={handleStep3Next}
          onBack={handleStep3Back}
        />
      )} */}

      {/* Step 4: Column Mapping */}
      {/* {currentStep === 4 && selectedFile && (
        <ColumnMappingStep
          file={selectedFile}
          templateId={selectedTemplateId}
          onMappingComplete={handleColumnMappingComplete}
          onBack={handleStep4Back}
        />
      )} */}

      {/* Step 5: Review & Execute Import (auto-parse enabled) */}
      {currentStep === 5 &&
        selectedFile &&
        uploadedFileId &&
        selectedWalletId && (
          <ReviewStepWrapper
            file={selectedFile}
            fileId={uploadedFileId}
            walletId={selectedWalletId}
            columnMapping={null} // Auto-parse enabled, no manual mapping
            bankTemplateId={null} // Auto-parse enabled, no template
            onImportSuccess={handleImportSuccess}
            onBack={handleStep5Back}
            onError={handleImportError}
          />
        )}

      {/* Step 6: Success Summary */}
      {currentStep === 6 && importSummary && importBatchId && (
        <ImportSuccess
          summary={importSummary}
          importBatchId={importBatchId}
          onDone={handleDone}
          onUndoSuccess={handleUndoSuccess}
        />
      )}
    </BaseModal>
  );
}
