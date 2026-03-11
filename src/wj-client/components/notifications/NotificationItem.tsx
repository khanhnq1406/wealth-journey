"use client";

import type { NotificationItem as NotificationItemType } from "@/gen/protobuf/v1/community";
import { Avatar } from "@/features/community/components/Avatar";
import { cn } from "@/lib/utils/cn";

const notificationMessages: Record<string, (actorName: string) => string> = {
  like: (actor) => `${actor} đã thích bài viết của bạn`,
  comment: (actor) => `${actor} đã bình luận bài viết của bạn`,
  follow: (actor) => `${actor} đã theo dõi bạn`,
  share: (actor) => `${actor} đã chia sẻ bài viết của bạn`,
};

interface NotificationItemProps {
  notification: NotificationItemType;
  onClick?: (notification: NotificationItemType) => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const getMessage = notificationMessages[notification.type];
  const message = getMessage
    ? getMessage(notification.actorName)
    : `${notification.actorName} đã tương tác với bạn`;

  const timeAgo = formatTimeAgo(notification.createdAt);

  return (
    <button
      onClick={() => onClick?.(notification)}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
        notification.isRead
          ? "hover:bg-v2-bg-primary"
          : "bg-green-50 hover:bg-green-100"
      )}
    >
      <div className="relative flex-shrink-0">
        <Avatar
          name={notification.actorName}
          imageUrl={notification.actorPicture}
          size="sm"
        />
        {!notification.isRead && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-bg rounded-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-vietnam text-sm text-v2-text-primary leading-snug">
          {message}
        </p>
        {notification.postPreview && (
          <p className="mt-0.5 font-vietnam text-xs text-v2-text-tertiary truncate">
            {notification.postPreview}
          </p>
        )}
        <p className="mt-1 font-vietnam text-xs text-v2-text-tertiary">{timeAgo}</p>
      </div>
    </button>
  );
}

function formatTimeAgo(ts: number): string {
  const now = Date.now();
  const diffMs = now - ts * 1000;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return new Date(ts * 1000).toLocaleDateString("vi-VN");
}
