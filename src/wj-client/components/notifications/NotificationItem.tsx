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

interface PriceAlertMetadata {
  category: string;
  title?: string;
  body?: string;
  movers: Array<{
    typeCode: string;
    name: string;
    direction: string;
    changePct: number;
    priceDiff: number;
  }>;
}

interface BroadcastMetadata {
  message: string;
  adminName?: string;
  broadcastTitle?: string;
}

interface UserPriceAlertMetadata {
  alertId: number;
  symbol: string;
  name: string;
  direction: string;
  targetPrice: number;
  currentPrice: number;
  priceSide: string;
  currency: string;
}

function parseMetadata<T>(metadata?: string): T | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata) as T;
  } catch {
    return null;
  }
}

interface NotificationItemProps {
  notification: NotificationItemType;
  onClick?: (notification: NotificationItemType) => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const timeAgo = formatTimeAgo(notification.createdAt);

  // Price alert notification
  if (notification.type === "price_alert") {
    const meta = parseMetadata<PriceAlertMetadata>(notification.metadata);
    const isGold = meta?.category?.startsWith("gold");
    const topMover = meta?.movers?.[0];

    // Use resolved title/body from metadata (admin-configured templates),
    // falling back to hardcoded defaults for older notifications without them
    const title = meta?.title || (isGold ? "Giá vàng biến động mạnh" : "Giá bạc biến động mạnh");
    const body = meta?.body;

    return (
      <button
        onClick={() => onClick?.(notification)}
        className={cn(
          "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
          notification.isRead
            ? "hover:bg-v2-maroon-900"
            : "bg-v2-maroon-900/80 hover:bg-v2-maroon-900"
        )}
      >
        <div className="relative flex-shrink-0">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm",
            isGold ? "bg-v2-gold-primary/20 text-v2-gold-accent" : "bg-v2-cream-100/15 text-v2-cream-100"
          )}>
            {topMover?.direction === "up" ? "↑" : "↓"}
          </div>
          {!notification.isRead && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-v2-gold-primary rounded-full ring-2 ring-v2-maroon-800" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-roboto text-sm text-v2-gold-accent leading-snug font-medium">
            {title}
          </p>
          {body ? (
            <p className="mt-0.5 font-roboto text-xs text-v2-text-secondary leading-snug">
              {body}
            </p>
          ) : topMover ? (
            <p className="mt-0.5 font-roboto text-xs leading-snug">
              <span className="text-v2-text-secondary">{topMover.name}</span>
              {" "}
              <span className={topMover.direction === "up" ? "text-v2-green-positive" : "text-v2-red-negative"}>
                {topMover.direction === "up" ? "↑" : "↓"} {topMover.changePct.toFixed(1)}%
              </span>
            </p>
          ) : null}
          <p className="mt-1 font-roboto text-xs text-v2-text-tertiary">{timeAgo}</p>
        </div>
      </button>
    );
  }

  // User price alert notification
  if (notification.type === "user_price_alert") {
    const meta = parseMetadata<UserPriceAlertMetadata>(notification.metadata);
    const isAbove = meta?.direction === "above";

    return (
      <button
        onClick={() => onClick?.(notification)}
        className={cn(
          "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
          notification.isRead
            ? "hover:bg-v2-maroon-900"
            : "bg-v2-maroon-900/80 hover:bg-v2-maroon-900"
        )}
      >
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-v2-gold-primary/20 text-v2-gold-accent">
            {isAbove ? "↑" : "↓"}
          </div>
          {!notification.isRead && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-v2-gold-primary rounded-full ring-2 ring-v2-maroon-800" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-roboto text-sm text-v2-gold-accent leading-snug font-medium">
            {meta?.symbol ?? "Price alert"} triggered
          </p>
          {meta && (
            <p className="mt-0.5 font-roboto text-xs text-v2-text-secondary leading-snug">
              {isAbove ? "↑ Above" : "↓ Below"} {meta.targetPrice.toLocaleString()} — now {meta.currentPrice.toLocaleString()} {meta.currency}
            </p>
          )}
          <p className="mt-1 font-roboto text-xs text-v2-text-tertiary">{timeAgo}</p>
        </div>
      </button>
    );
  }

  // Admin broadcast notification
  if (notification.type === "admin_broadcast") {
    const meta = parseMetadata<BroadcastMetadata>(notification.metadata);

    return (
      <button
        onClick={() => onClick?.(notification)}
        className={cn(
          "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
          notification.isRead
            ? "hover:bg-v2-maroon-900"
            : "bg-v2-maroon-900/80 hover:bg-v2-maroon-900"
        )}
      >
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-v2-red-primary/20 text-v2-red-negative">
            !
          </div>
          {!notification.isRead && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-v2-gold-primary rounded-full ring-2 ring-v2-maroon-800" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-roboto text-sm text-v2-gold-accent leading-snug font-medium">
            {meta?.broadcastTitle || "Thông báo từ hệ thống"}
          </p>
          {meta?.message && (
            <p className="mt-0.5 font-roboto text-xs text-v2-text-secondary truncate">
              {meta.message}
            </p>
          )}
          <p className="mt-1 font-roboto text-xs text-v2-text-tertiary">{timeAgo}</p>
        </div>
      </button>
    );
  }

  // Default community notification (like, comment, follow, share)
  const getMessage = notificationMessages[notification.type];
  const message = getMessage
    ? getMessage(notification.actorName)
    : `${notification.actorName} đã tương tác với bạn`;

  return (
    <button
      onClick={() => onClick?.(notification)}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
        notification.isRead
          ? "hover:bg-v2-maroon-900"
          : "bg-v2-maroon-900/80 hover:bg-v2-maroon-900"
      )}
    >
      <div className="relative flex-shrink-0">
        <Avatar
          name={notification.actorName}
          imageUrl={notification.actorPicture}
          size="sm"
        />
        {!notification.isRead && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-v2-gold-primary rounded-full ring-2 ring-v2-maroon-800" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-roboto text-sm text-v2-text-primary leading-snug">
          {message}
        </p>
        {notification.postPreview && (
          <p className="mt-0.5 font-roboto text-xs text-v2-text-tertiary truncate">
            {notification.postPreview}
          </p>
        )}
        <p className="mt-1 font-roboto text-xs text-v2-text-tertiary">{timeAgo}</p>
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
