"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/utils/api-client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PermissionState = "default" | "granted" | "denied" | "unsupported";

interface UsePushSubscriptionReturn {
  isSubscribed: boolean;
  isLoading: boolean;
  permissionState: PermissionState;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>("default");
  const vapidKeyRef = useRef<string | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Check if push is supported
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // Initialize: register SW, check existing subscription
  useEffect(() => {
    if (!isSupported) {
      setPermissionState("unsupported");
      return;
    }

    setPermissionState(
      Notification.permission as PermissionState
    );

    let cancelled = false;

    async function init() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        if (cancelled) return;
        registrationRef.current = reg;

        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setIsSubscribed(!!sub);
      } catch {
        // SW registration failed — non-fatal
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  // Fetch VAPID key lazily
  const getVapidKey = useCallback(async (): Promise<string> => {
    if (vapidKeyRef.current) return vapidKeyRef.current;
    const res = await apiClient.get<{ publicKey: string }>("/api/v1/push/vapid-key");
    const key = (res as unknown as { publicKey: string }).publicKey;
    if (!key) throw new Error("No VAPID public key returned");
    vapidKeyRef.current = key;
    return key;
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported || isLoading) return;
    setIsLoading(true);

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission as PermissionState);

      if (permission !== "granted") {
        return;
      }

      // Ensure SW is ready
      const reg = registrationRef.current ?? await navigator.serviceWorker.ready;
      registrationRef.current = reg;

      const vapidKey = await getVapidKey();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = sub.toJSON();
      const p256dh = subJson.keys?.p256dh ?? "";
      const auth = subJson.keys?.auth ?? "";

      await apiClient.post("/api/v1/push/subscribe", {
        endpoint: sub.endpoint,
        p256dh,
        auth,
      });

      setIsSubscribed(true);
    } catch {
      // Subscription failed — user can retry
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isLoading, getVapidKey]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || isLoading) return;
    setIsLoading(true);

    try {
      const reg = registrationRef.current ?? await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        // apiClient.delete doesn't support body — use manual fetch
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        await fetch(`${baseUrl}/api/v1/push/subscribe`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }

      setIsSubscribed(false);
    } catch {
      // Unsubscribe failed — non-fatal
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isLoading]);

  return { isSubscribed, isLoading, permissionState, subscribe, unsubscribe };
}
