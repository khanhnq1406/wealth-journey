"use client";

import { useState, useEffect } from "react";
import { usePushSubscription } from "@/features/community/hooks/usePushSubscription";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const DISMISS_KEY = "push_banner_dismissed_at";
const PERMANENT_DISMISS_KEY = "push_banner_permanent_dismiss";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  if (localStorage.getItem(PERMANENT_DISMISS_KEY) === "true") return true;
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (dismissedAt && Date.now() - Number(dismissedAt) < SEVEN_DAYS_MS) return true;
  return false;
}

export function PushPermissionBanner() {
  const { isSubscribed, subscribe, isLoading, error, permissionState } = usePushSubscription();
  const { isInstalled, platform } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(isDismissed());
  }, []);

  // Auto-subscribe if permission already granted but not subscribed (skip if errored)
  useEffect(() => {
    if (permissionState === "granted" && !isSubscribed && !isLoading && !error) {
      subscribe();
    }
  }, [permissionState, isSubscribed, isLoading, error, subscribe]);

  // Hide conditions
  if (dismissed) return null;
  if (isSubscribed) return null;
  if (permissionState === "denied") return null;
  if (permissionState === "unsupported") return null;

  // iOS not installed → show install banner
  const isIosNotInstalled = platform === "ios" && !isInstalled;

  const handleDismissTemporary = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleDismissPermanent = () => {
    localStorage.setItem(PERMANENT_DISMISS_KEY, "true");
    setDismissed(true);
  };

  const handleEnable = async () => {
    await subscribe();
  };

  if (isIosNotInstalled) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mx-4 mt-3 mb-1">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm">
            !
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-vietnam text-sm font-medium text-v2-text-primary">
              Cài đặt ứng dụng
            </p>
            <p className="font-vietnam text-xs text-v2-text-secondary mt-0.5">
              Cài đặt ứng dụng để nhận thông báo giá vàng và bạc ngay trên iPhone
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleDismissTemporary}
                className="font-vietnam text-xs text-v2-text-tertiary hover:text-v2-text-secondary"
              >
                Để sau
              </button>
              <button
                onClick={handleDismissPermanent}
                className="font-vietnam text-xs text-v2-text-tertiary hover:text-v2-text-secondary"
              >
                Không hiển thị lại
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: ask to enable push
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mx-4 mt-3 mb-1">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm">
          !
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-vietnam text-sm font-medium text-v2-text-primary">
            Bật thông báo
          </p>
          <p className="font-vietnam text-xs text-v2-text-secondary mt-0.5">
            Bật thông báo để nhận cảnh báo giá vàng và bạc ngay trên điện thoại
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleEnable}
              disabled={isLoading}
              className="font-vietnam text-xs font-medium text-white bg-bg px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50"
            >
              {isLoading ? "Đang xử lý..." : "Bật"}
            </button>
            <button
              onClick={handleDismissTemporary}
              className="font-vietnam text-xs text-v2-text-tertiary hover:text-v2-text-secondary"
            >
              Để sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
