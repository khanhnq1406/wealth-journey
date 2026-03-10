"use client";

import {
  useQueryGetUnreadNotificationCount,
  useMutationMarkNotificationsRead,
  EVENT_CommunityGetNotifications,
  EVENT_CommunityGetUnreadNotificationCount,
} from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";
import type { GetNotificationsResponse, GetUnreadNotificationCountResponse } from "@/gen/protobuf/v1/community";

export function useNotificationCount() {
  const { data, isLoading } = useQueryGetUnreadNotificationCount(
    {},
    { refetchInterval: 30_000, refetchOnMount: "always" },
  );

  return {
    count: data?.count ?? 0,
    isLoading,
  };
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const mutation = useMutationMarkNotificationsRead({
    onSuccess: () => {
      // Optimistically update all cached notification lists so the UI reflects
      // "read" state immediately (global staleTime of 5min would otherwise
      // delay the background refetch from becoming visible).
      queryClient.setQueriesData<GetNotificationsResponse>(
        { queryKey: [EVENT_CommunityGetNotifications] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            notifications: old.notifications?.map((n) => ({ ...n, isRead: true })) ?? [],
          };
        },
      );
      // Reset the unread badge to 0 immediately.
      queryClient.setQueriesData<GetUnreadNotificationCountResponse>(
        { queryKey: [EVENT_CommunityGetUnreadNotificationCount] },
        (old) => (old ? { ...old, count: 0 } : old),
      );
      // Also invalidate both queries so the next mount/focus fetches fresh data.
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetNotifications] });
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetUnreadNotificationCount] });
    },
  });

  return {
    markAllRead: () => mutation.mutate({}),
    isLoading: mutation.isPending,
  };
}
