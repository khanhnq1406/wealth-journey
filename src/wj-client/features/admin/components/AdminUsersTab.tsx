"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { useTranslations } from "next-intl";
import { apiClient } from "@/utils/api-client";
import { MobileTable } from "@/components/table/MobileTable";
import type { MobileColumnDef } from "@/components/table/MobileTable";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { useNotification } from "@/contexts/NotificationContext";
import { Pagination } from "./Pagination";

interface AdminUserItem {
  id: number;
  name: string;
  email: string;
  username: string;
  picture: string;
  authProvider: string;
  isAdmin: boolean;
  createdAt: number;
}

interface AdminListUsersResponse {
  success: boolean;
  users: AdminUserItem[];
  pagination: {
    totalCount: number;
    totalPages: number;
    page: number;
    pageSize: number;
  };
}

export function AdminUsersTab() {
  const { toast } = useNotification();
  const auth = useSelector((state: any) => state.setAuthReducer);
  const t = useTranslations("admin.users");

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [toggleTarget, setToggleTarget] = useState<AdminUserItem | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "10",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const response = (await apiClient.get(
        `/api/v1/admin/users?${params}`
      )) as unknown as AdminListUsersResponse;
      if (response.success) {
        setUsers(response.users || []);
        setTotalPages(response.pagination?.totalPages || 0);
      }
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, toast, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleRole = async () => {
    if (!toggleTarget) return;
    setIsToggling(true);
    try {
      const response = await apiClient.put(
        `/api/v1/admin/users/${toggleTarget.id}/role`,
        { isAdmin: !toggleTarget.isAdmin }
      );
      if (response.success) {
        toast.success(
          toggleTarget.isAdmin
            ? t("toast.revokeSuccess", { name: toggleTarget.name })
            : t("toast.grantSuccess", { name: toggleTarget.name })
        );
        fetchUsers();
      } else {
        toast.error(response.message || t("toast.toggleFailed"));
      }
    } catch (error: any) {
      toast.error(error.message || t("toast.toggleFailed"));
    } finally {
      setIsToggling(false);
      setToggleTarget(null);
    }
  };

  const columns: MobileColumnDef<AdminUserItem>[] = [
    {
      id: "name",
      header: t("columns.name"),
      accessorKey: "name",
      showInCollapsed: true,
    },
    {
      id: "email",
      header: t("columns.email"),
      showInCollapsed: true,
      cell: ({ row }) => (
 <span className="text-neutral-600 text-sm truncate max-w-[200px] inline-block">
          {row.email || row.username || "—"}
        </span>
      ),
    },
    {
      id: "authProvider",
      header: t("columns.provider"),
      accessorKey: "authProvider",
      showInCollapsed: false,
    },
    {
      id: "isAdmin",
      header: t("columns.admin"),
      showInCollapsed: true,
      cell: ({ row }) => {
        const isSelf = auth?.email === row.email;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isSelf) setToggleTarget(row);
            }}
            disabled={isSelf}
            className={`px-2 py-0.5 text-xs font-medium rounded-full transition-colors ${
              row.isAdmin
 ? "bg-green-100 text-green-700"
 : "bg-neutral-100 text-neutral-500"
            } ${isSelf ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
            title={
              isSelf
                ? t("roleTooltip.cannotSelf")
                : row.isAdmin
                  ? t("roleTooltip.revoke")
                  : t("roleTooltip.grant")
            }
          >
            {row.isAdmin ? t("roleBadge.admin") : t("roleBadge.user")}
          </button>
        );
      },
    },
    {
      id: "createdAt",
      header: t("columns.created"),
      showInCollapsed: false,
      cell: ({ row }) => {
        const date = new Date(row.createdAt * 1000);
        return (
 <span className="text-sm text-neutral-500">
            {date.toLocaleDateString()}
          </span>
        );
      },
    },
  ];

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner text={t("loading")} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
 className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-bg/50"
      />

      {/* Table */}
      <MobileTable
        data={users}
        columns={columns}
        getKey={(item) => item.id}
        isLoading={isLoading}
        emptyMessage={t("noUsers")}
        expandable
      />

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Confirmation Dialog */}
      {toggleTarget && (
        <ConfirmationDialog
          title={toggleTarget.isAdmin ? t("dialog.revokeTitle") : t("dialog.grantTitle")}
          message={
            toggleTarget.isAdmin
              ? t("dialog.revokeMessage", { name: toggleTarget.name })
              : t("dialog.grantMessage", { name: toggleTarget.name })
          }
          confirmText={toggleTarget.isAdmin ? t("dialog.revokeConfirm") : t("dialog.grantConfirm")}
          onConfirm={handleToggleRole}
          onCancel={() => setToggleTarget(null)}
          isLoading={isToggling}
          variant={toggleTarget.isAdmin ? "danger" : "default"}
        />
      )}
    </div>
  );
}
