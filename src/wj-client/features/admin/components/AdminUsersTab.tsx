"use client";

import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
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
      const response = await apiClient.get<AdminListUsersResponse>(
        `/api/v1/admin/users?${params}`
      );
      if (response.data) {
        setUsers(response.data.users || []);
        setTotalPages(response.data.pagination?.totalPages || 0);
      }
    } catch {
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, toast]);

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
          `Admin role ${toggleTarget.isAdmin ? "revoked" : "granted"} for ${toggleTarget.name}`
        );
        fetchUsers();
      } else {
        toast.error(response.message || "Failed to toggle admin role");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to toggle admin role");
    } finally {
      setIsToggling(false);
      setToggleTarget(null);
    }
  };

  const columns: MobileColumnDef<AdminUserItem>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      showInCollapsed: true,
    },
    {
      id: "email",
      header: "Email",
      showInCollapsed: true,
      cell: ({ row }) => (
        <span className="text-neutral-600 dark:text-dark-text-secondary text-sm truncate max-w-[200px] inline-block">
          {row.email || row.username || "—"}
        </span>
      ),
    },
    {
      id: "authProvider",
      header: "Provider",
      accessorKey: "authProvider",
      showInCollapsed: false,
    },
    {
      id: "isAdmin",
      header: "Admin",
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
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-neutral-100 text-neutral-500 dark:bg-dark-hover dark:text-dark-text-tertiary"
            } ${isSelf ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
            title={isSelf ? "Cannot modify your own role" : `Click to ${row.isAdmin ? "revoke" : "grant"} admin`}
          >
            {row.isAdmin ? "Admin" : "User"}
          </button>
        );
      },
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

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner text="Loading users..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search by name, email, or username..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg focus:outline-none focus:ring-2 focus:ring-bg/50 dark:text-dark-text"
      />

      {/* Table */}
      <MobileTable
        data={users}
        columns={columns}
        getKey={(item) => item.id}
        isLoading={isLoading}
        emptyMessage="No users found"
        expandable
      />

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Confirmation Dialog */}
      {toggleTarget && (
        <ConfirmationDialog
          title={toggleTarget.isAdmin ? "Revoke Admin" : "Grant Admin"}
          message={`Are you sure you want to ${
            toggleTarget.isAdmin ? "revoke admin access from" : "grant admin access to"
          } ${toggleTarget.name}?`}
          confirmText={toggleTarget.isAdmin ? "Revoke" : "Grant"}
          onConfirm={handleToggleRole}
          onCancel={() => setToggleTarget(null)}
          isLoading={isToggling}
          variant={toggleTarget.isAdmin ? "danger" : "default"}
        />
      )}
    </div>
  );
}
