"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/utils/api-client";
import { MobileTable } from "@/components/table/MobileTable";
import type { MobileColumnDef } from "@/components/table/MobileTable";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { useNotification } from "@/contexts/NotificationContext";
import { BaseCard } from "@/components/BaseCard";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { Pagination } from "./Pagination";

interface AdminFeedbackItem {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  status: number;
  adminNote: string;
  createdAt: number;
  updatedAt: number;
}

interface AdminListFeedbackResponse {
  success: boolean;
  feedback: AdminFeedbackItem[];
  pagination: {
    totalCount: number;
    totalPages: number;
    page: number;
    pageSize: number;
  };
}

const STATUS_OPTIONS = [
  { value: 0, label: "All" },
  { value: 1, label: "Pending" },
  { value: 2, label: "Reviewed" },
  { value: 3, label: "Resolved" },
];

function StatusBadge({ status }: { status: number }) {
  const config: Record<number, { label: string; className: string }> = {
    1: {
      label: "Pending",
      className:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    2: {
      label: "Reviewed",
      className:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    3: {
      label: "Resolved",
      className:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
  };

  const { label, className } = config[status] || {
    label: "Unknown",
    className:
      "bg-neutral-100 text-neutral-500 dark:bg-dark-hover dark:text-dark-text-tertiary",
  };

  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full ${className}`}
    >
      {label}
    </span>
  );
}

interface EditPanelProps {
  item: AdminFeedbackItem;
  onSave: (id: number, status: number, adminNote: string) => void;
  onDelete: (item: AdminFeedbackItem) => void;
  onClose: () => void;
  isSaving: boolean;
}

function EditPanel({ item, onSave, onDelete, onClose, isSaving }: EditPanelProps) {
  const [note, setNote] = useState(item.adminNote || "");
  const [status, setStatus] = useState(item.status);

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-dark-text">
          Feedback #{item.id}
        </h3>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-dark-text-secondary transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        {/* Subject */}
        <div>
          <p className="text-xs font-medium text-neutral-500 dark:text-dark-text-tertiary mb-1">
            Subject
          </p>
          <p className="text-sm font-medium text-neutral-900 dark:text-dark-text">
            {item.subject}
          </p>
        </div>

        {/* User */}
        <div>
          <p className="text-xs font-medium text-neutral-500 dark:text-dark-text-tertiary mb-1">
            From
          </p>
          <p className="text-sm text-neutral-700 dark:text-dark-text-secondary">
            {item.userName} ({item.userEmail})
          </p>
        </div>

        {/* Message */}
        <div>
          <p className="text-xs font-medium text-neutral-500 dark:text-dark-text-tertiary mb-1">
            Message
          </p>
          <p className="text-sm text-neutral-700 dark:text-dark-text-secondary whitespace-pre-wrap bg-neutral-50 dark:bg-dark-hover rounded-lg p-3">
            {item.message}
          </p>
        </div>

        {/* Status dropdown */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 dark:text-dark-text-tertiary mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(Number(e.target.value))}
            className="w-full sm:w-48 px-3 py-1.5 text-sm border border-neutral-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-bg/50 dark:text-dark-text"
          >
            <option value={1}>Pending</option>
            <option value={2}>Reviewed</option>
            <option value={3}>Resolved</option>
          </select>
        </div>

        {/* Admin note */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 dark:text-dark-text-tertiary mb-1">
            Admin Note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Add a note..."
            className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-bg/50 dark:text-dark-text resize-none"
          />
          <p className="text-xs text-neutral-400 dark:text-dark-text-tertiary mt-0.5 text-right">
            {note.length}/2000
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            type={ButtonType.PRIMARY}
            onClick={() => onSave(item.id, status, note)}
            loading={isSaving}
            className="text-sm"
          >
            Save
          </Button>
          <button
            onClick={() => onDelete(item)}
            className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </BaseCard>
  );
}

export function AdminFeedbackTab() {
  const { toast } = useNotification();

  const [feedback, setFeedback] = useState<AdminFeedbackItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<AdminFeedbackItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminFeedbackItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "10",
      });
      if (statusFilter > 0) params.set("status", String(statusFilter));
      const response = (await apiClient.get(
        `/api/v1/admin/feedback?${params}`
      )) as unknown as AdminListFeedbackResponse;
      if (response.success) {
        setFeedback(response.feedback || []);
        setTotalPages(response.pagination?.totalPages || 0);
      }
    } catch {
      toast.error("Failed to load feedback");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, toast]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleStatusFilterChange = (value: number) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleSave = async (id: number, status: number, adminNote: string) => {
    setIsSaving(true);
    try {
      const response = await apiClient.put(`/api/v1/admin/feedback/${id}`, {
        status,
        adminNote,
      });
      if (response.success) {
        toast.success("Feedback updated");
        setSelectedItem(null);
        fetchFeedback();
      } else {
        toast.error(response.message || "Failed to update feedback");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update feedback");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await apiClient.delete(
        `/api/v1/admin/feedback/${deleteTarget.id}`
      );
      if (response.success) {
        toast.success("Feedback deleted");
        if (selectedItem?.id === deleteTarget.id) {
          setSelectedItem(null);
        }
        fetchFeedback();
      } else {
        toast.error("Failed to delete feedback");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete feedback");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const columns: MobileColumnDef<AdminFeedbackItem>[] = [
    {
      id: "subject",
      header: "Subject",
      showInCollapsed: true,
      cell: ({ row }) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedItem(row);
          }}
          className="text-sm font-medium text-bg hover:underline text-left"
        >
          {row.subject}
        </button>
      ),
    },
    {
      id: "userName",
      header: "User",
      showInCollapsed: true,
      cell: ({ row }) => (
        <span className="text-neutral-600 dark:text-dark-text-secondary text-sm truncate max-w-[150px] inline-block">
          {row.userName || "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      showInCollapsed: true,
      cell: ({ row }) => <StatusBadge status={row.status} />,
    },
    {
      id: "message",
      header: "Message",
      showInCollapsed: false,
      cell: ({ row }) => (
        <p className="text-sm text-neutral-600 dark:text-dark-text-secondary line-clamp-3">
          {row.message}
        </p>
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      showInCollapsed: false,
      cell: ({ row }) => {
        const date = new Date(row.createdAt * 1000);
        return (
          <span className="text-sm text-neutral-500 dark:text-dark-text-tertiary">
            {date.toLocaleDateString()}
          </span>
        );
      },
    },
  ];

  if (isLoading && feedback.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner text="Loading feedback..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-neutral-600 dark:text-dark-text-secondary">
          Status:
        </span>
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusFilterChange(option.value)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                statusFilter === option.value
                  ? "bg-bg text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-dark-hover dark:text-dark-text-secondary dark:hover:bg-dark-border"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Edit panel (shown when a feedback item is selected) */}
      {selectedItem && (
        <EditPanel
          key={selectedItem.id}
          item={selectedItem}
          onSave={handleSave}
          onDelete={setDeleteTarget}
          onClose={() => setSelectedItem(null)}
          isSaving={isSaving}
        />
      )}

      {/* Table */}
      <MobileTable
        data={feedback}
        columns={columns}
        getKey={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="No feedback found"
        expandable
      />

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmationDialog
          title="Delete Feedback"
          message={`Are you sure you want to delete feedback "${deleteTarget.subject}" from ${deleteTarget.userName}? This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={isDeleting}
          variant="danger"
        />
      )}
    </div>
  );
}
