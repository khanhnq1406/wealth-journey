"use client";

import { useState, useEffect, useRef } from "react";
import { usePushSubscription } from "@/features/community/hooks/usePushSubscription";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { InstallSteps } from "@/components/pwa/InstallSteps";
import { BaseModal } from "@/components/modals/BaseModal";

const DISMISS_KEY = "push_banner_dismissed_at";
const PERMANENT_DISMISS_KEY = "push_banner_permanent_dismiss";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AUTO_SUBSCRIBE_ATTEMPTS = 3;

function getInitialDismissed(): boolean {
  if (typeof window === "undefined") return true;
  if (localStorage.getItem(PERMANENT_DISMISS_KEY) === "true") return true;
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (dismissedAt && Date.now() - Number(dismissedAt) < SEVEN_DAYS_MS)
    return true;
  return false;
}

export function PushPermissionBanner() {
  const { isSubscribed, subscribe, isLoading, error, permissionState } =
    usePushSubscription();
  const { isInstalled, platform, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(getInitialDismissed);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const autoSubscribeAttempts = useRef(0);

  // Auto-subscribe if permission already granted but not subscribed (retry up to 3 times)
  useEffect(() => {
    if (
      permissionState === "granted" &&
      !isSubscribed &&
      !isLoading &&
      autoSubscribeAttempts.current < MAX_AUTO_SUBSCRIBE_ATTEMPTS
    ) {
      autoSubscribeAttempts.current += 1;
      subscribe();
    }
  }, [permissionState, isSubscribed, isLoading, subscribe]);

  // Hide conditions
  if (dismissed) return null;
  if (isSubscribed) return null;
  if (permissionState === "denied") return null;

  // iOS not installed → show install banner (before unsupported check,
  // because iOS Safari doesn't support push but we still want to show
  // the "install as PWA" prompt)
  const isIosNotInstalled = platform === "ios" && !isInstalled;
  if (!isIosNotInstalled && permissionState === "unsupported") return null;

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

  const handleInstall = () => {
    if (platform === "android") {
      promptInstall();
    } else {
      setShowInstallModal(true);
    }
  };

  if (isIosNotInstalled) {
    return (
      <>
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
                Cài đặt ứng dụng để nhận thông báo giá vàng và bạc ngay trên
                iPhone
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleInstall}
                  className="font-vietnam text-xs font-medium text-white bg-bg px-3 py-1.5 rounded-md hover:opacity-90"
                >
                  Cài đặt
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

        <BaseModal
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
          title="Cài đặt ứng dụng"
        >
          <div className="p-4">
            <p className="font-vietnam text-sm text-v2-text-secondary mb-4">
              Làm theo các bước sau để cài đặt ứng dụng trên iPhone:
            </p>
            <InstallSteps platform={platform} />
          </div>
        </BaseModal>
      </>
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
