"use client";

import {
  useQueryGetUnreadNotificationCount,
  useMutationMarkNotificationsRead,
  EVENT_CommunityGetNotifications,
  EVENT_CommunityGetUnreadNotificationCount,
} from "@/utils/generated/hooks";
import { useQueryClient } from "@tanstack/react-query";

export function useNotificationCount() {
  const { data, isLoading } = useQueryGetUnreadNotificationCount({});

  return {
    count: data?.count ?? 0,
    isLoading,
  };
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const mutation = useMutationMarkNotificationsRead({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetNotifications] });
      queryClient.invalidateQueries({ queryKey: [EVENT_CommunityGetUnreadNotificationCount] });
    },
  });

  return {
    markAllRead: () => mutation.mutate({}),
    isLoading: mutation.isPending,
  };
}
