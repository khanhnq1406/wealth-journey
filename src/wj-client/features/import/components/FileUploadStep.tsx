"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/Button";

// File type icons mapping
const FILE_TYPE_ICONS = {
  excel: (
    <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#1D6F42"
      />
      <polyline
        points="14,2 14,8 20,8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="16"
        fontSize="6"
        fill="white"
        textAnchor="middle"
        fontWeight="bold"
      >
        XLS
      </text>
    </svg>
  ),
  pdf: (
    <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#DC3545"
      />
      <polyline
        points="14,2 14,8 20,8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="16"
        fontSize="6"
        fill="white"
        textAnchor="middle"
        fontWeight="bold"
      >
        PDF
      </text>
    </svg>
  ),
};

const ACCEPTED_FILE_TYPES = {
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/pdf": [".pdf"],
};

const MAX_FILE_SIZE = {
  excel: 10 * 1024 * 1024, // 10MB
  pdf: 20 * 1024 * 1024, // 20MB
};

export interface FileUploadStepProps {
  onFileSelected: (file: File) => void;
  onNext: () => void;
  isUploading: boolean;
}

export function FileUploadStep({
  onFileSelected,
  onNext,
  isUploading,
}: FileUploadStepProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = (file: File): string | null => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xls", "xlsx", "pdf"].includes(ext)) {
      return "Invalid file type. Please upload Excel (.xlsx, .xls) or PDF file.";
    }

    let maxSize = MAX_FILE_SIZE.excel;
    if (["xls", "xlsx"].includes(ext)) {
      maxSize = MAX_FILE_SIZE.excel;
    } else if (ext === "pdf") {
      maxSize = MAX_FILE_SIZE.pdf;
    }

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      return `File size exceeds maximum ${maxSizeMB}MB limit.`;
    }

    if (file.size === 0) {
      return "File is empty.";
    }

    return null;
  };

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (!file) {
        setSelectedFile(null);
        setError("");
        return;
      }

      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setSelectedFile(null);
        return;
      }

      setError("");
      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileChange(files[0]);
      }
    },
    [handleFileChange],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileChange(files[0]);
      }
    },
    [handleFileChange],
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileTypeIcon = () => {
    if (!selectedFile) return null;
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return FILE_TYPE_ICONS.pdf;
    if (ext === "xls" || ext === "xlsx") return FILE_TYPE_ICONS.excel;
    return null;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero Section */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 mb-3">
          <svg
            className="w-8 h-8 text-primary-600 dark:text-primary-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-dark-text">
          Upload Bank Statement
        </h2>
        <p className="text-sm sm:text-base text-neutral-600 dark:text-dark-text-secondary max-w-lg mx-auto">
          Import transactions automatically from your Excel or PDF statement
        </p>
      </div>

      {/* File Type Support Pills */}
      <div className="flex justify-center gap-2 flex-wrap">
        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300">
          <svg
            className="w-4 h-4 mr-1.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Excel (.xlsx, .xls)
        </span>
        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300">
          <svg
            className="w-4 h-4 mr-1.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          PDF
        </span>
      </div>

      {/* Drag & Drop Area with improved design */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload file area. Click or drag and drop to select a file."
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            document.getElementById("file-input")?.click();
          }
        }}
        className={cn(
          "relative border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out",
          "min-h-[280px] sm:min-h-[320px] flex flex-col items-center justify-center p-6 sm:p-10",
          isDragOver &&
            !selectedFile && [
              "border-primary-500 bg-primary-50 dark:bg-primary-950",
              "scale-[1.02] shadow-lg shadow-primary-200 dark:shadow-primary-900",
            ],
          selectedFile && [
            "border-success-400 bg-success-50 dark:bg-success-950",
            "shadow-md",
          ],
          error && ["border-danger-400 bg-danger-50 dark:bg-danger-950"],
          !selectedFile &&
            !error &&
            !isDragOver && [
              "border-neutral-300 dark:border-dark-border",
              "hover:border-primary-400 dark:hover:border-primary-600",
              "hover:bg-neutral-50 dark:hover:bg-dark-surface-hover",
              "hover:shadow-md",
            ],
          "cursor-pointer active:scale-[0.99]",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".xls,.xlsx,.pdf"
          onChange={handleInputChange}
          className="hidden"
          aria-label="Upload bank statement file (Excel or PDF)"
        />

        {/* Upload State */}
        {!selectedFile && (
          <div className="text-center space-y-4">
            {/* Animated upload icon */}
            <div
              className={cn(
                "transition-transform duration-300",
                isDragOver && "scale-110",
              )}
            >
              <svg
                className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-neutral-400 dark:text-dark-text-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>

            <div className="space-y-2">
              <p className="text-lg sm:text-xl font-semibold text-neutral-700 dark:text-dark-text">
                {isDragOver ? (
                  <span className="text-primary-600 dark:text-primary-400">
                    Drop your file here
                  </span>
                ) : (
                  <>
                    Drag & drop your file, or{" "}
                    <span className="text-primary-600 dark:text-primary-500 hover:text-primary-700 dark:hover:text-primary-400">
                      browse
                    </span>
                  </>
                )}
              </p>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-dark-text-tertiary">
                Maximum size: 10MB (Excel) • 20MB (PDF)
              </p>
            </div>
          </div>
        )}

        {/* Selected File State */}
        {selectedFile && (
          <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
            {/* File icon */}
            <div className="flex justify-center">{getFileTypeIcon()}</div>

            {/* File info */}
            <div className="space-y-1">
              <p className="text-base sm:text-lg font-semibold text-success-700 dark:text-success-400">
                {selectedFile.name}
              </p>
              <p className="text-sm text-neutral-600 dark:text-dark-text-secondary">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>

            {/* Success checkmark */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-success-100 dark:bg-success-900">
              <svg
                className="w-5 h-5 text-success-600 dark:text-success-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="ml-2 text-sm font-medium text-success-700 dark:text-success-300">
                Ready to upload
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error Message with improved design */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-danger-50 dark:bg-danger-950 border border-danger-300 dark:border-danger-700 rounded-xl animate-in slide-in-from-top duration-300">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-danger-600 dark:bg-danger-700 flex items-center justify-center mt-0.5">
            <svg
              className="w-3 h-3 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-danger-800 dark:text-danger-200">
              {error}
            </p>
          </div>
          <button
            onClick={() => setError("")}
            className="flex-shrink-0 p-1 rounded-lg text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-900 transition-colors"
            aria-label="Dismiss error"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Action Buttons with improved mobile touch targets */}
      <div className="flex gap-3 pt-2">
        {selectedFile && (
          <Button
            variant="secondary"
            onClick={() => handleFileChange(null)}
            className="min-h-[44px]"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Clear
          </Button>
        )}
        <Button
          variant="primary"
          onClick={onNext}
          disabled={!selectedFile || isUploading}
          loading={isUploading}
          className="min-h-[44px] text-base font-semibold"
        >
          {isUploading ? (
            <>Uploading...</>
          ) : (
            <>
              Continue
              <svg
                className="w-5 h-5 ml-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
