"use client";

import { useQueryGetNotifications, useMutationMarkNotificationsRead } from "@/utils/generated/hooks";
import {
  useMarkAllRead,
  useMarkOneReadOptimistic,
} from "@/features/community/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import type { NotificationItem as NotificationItemType } from "@/gen/protobuf/v1/community";
import { useRouter } from "@/lib/navigation";
import { routes } from "@/app/constants";

interface NotificationPanelProps {
  onClose?: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const router = useRouter();
  const { data, isLoading } = useQueryGetNotifications(
    { pagination: { page: 1, pageSize: 20, orderBy: "", order: "" } },
    { refetchOnMount: "always" }
  );

  const { markAllRead, isLoading: isMarkingRead } = useMarkAllRead();
  const markOneRead = useMarkOneReadOptimistic();
  const markReadMutation = useMutationMarkNotificationsRead();

  const notifications = data?.notifications ?? [];

  const handleNotificationClick = (notif: NotificationItemType) => {
    // Mark this notification as read in the cache immediately.
    if (!notif.isRead) {
      markOneRead(notif.id);
      // Fire-and-forget the API call to persist on the server.
      markReadMutation.mutate({});
    }
    // Navigate to the community page. Close the panel first so it doesn't
    // stay open while the navigation animation plays.
    onClose?.();
    router.push(routes.community as Parameters<typeof router.push>[0]);
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-v2-border-light">
        <h3 className="font-vietnam font-semibold text-v2-text-primary">Thông báo</h3>
        {notifications.some((n) => !n.isRead) && (
          <button
            onClick={markAllRead}
            disabled={isMarkingRead}
            className="font-vietnam text-xs text-bg hover:underline disabled:opacity-50"
          >
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      <div className="overflow-y-auto max-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-bg border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <p className="font-vietnam text-sm text-v2-text-tertiary">Chưa có thông báo</p>
          </div>
        ) : (
          <div className="divide-y divide-v2-border-light">
            {notifications.map((notif) => (
              <NotificationItem
                key={notif.id}
                notification={notif}
                onClick={handleNotificationClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
