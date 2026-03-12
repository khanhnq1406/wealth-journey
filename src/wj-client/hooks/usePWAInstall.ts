"use client";

import { useState, useEffect } from "react";

/**
 * Platform types for PWA installation
 */
export type Platform = "ios" | "android" | "other";

/**
 * PWA installation state interface
 */
export interface PWAInstallState {
  isInstalled: boolean;
  canInstall: boolean;
  platform: Platform;
  promptInstall: () => Promise<void>;
}

/**
 * BeforeInstallPromptEvent interface for TypeScript
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Custom hook for PWA installation detection and management
 *
 * Detects:
 * - Whether the app is already installed (iOS standalone mode, Android display-mode)
 * - User's platform (iOS, Android, or other)
 * - Whether the install prompt is available (Android)
 *
 * Provides:
 * - promptInstall() function to trigger the installation prompt
 *
 * @returns PWAInstallState object with installation state and controls
 */
export function usePWAInstall(): PWAInstallState {
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Detect platform based on user agent
    const detectPlatform = (): Platform => {
      const userAgent = window.navigator.userAgent.toLowerCase();

      if (/iphone|ipad|ipod/.test(userAgent)) {
        return "ios";
      } else if (/android/.test(userAgent)) {
        return "android";
      }

      return "other";
    };

    // Check if app is installed
    const checkInstalled = (): boolean => {
      // iOS standalone mode
      if ((window.navigator as any).standalone === true) {
        return true;
      }

      // Android display-mode: standalone or fullscreen
      if (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches
      ) {
        return true;
      }

      return false;
    };

    // Set initial platform
    const detectedPlatform = detectPlatform();
    queueMicrotask(() => setPlatform(detectedPlatform));

    // Set initial installation status
    const installed = checkInstalled();
    queueMicrotask(() => setIsInstalled(installed));

    // For iOS, set canInstall to true if not already installed
    // (iOS doesn't fire beforeinstallprompt, so we need to enable it manually)
    if (detectedPlatform === "ios" && !installed) {
      queueMicrotask(() => setCanInstall(true));
    }

    // Listen for beforeinstallprompt event (Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setCanInstall(true);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Cleanup
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Function to trigger install prompt
  const promptInstall = async (): Promise<void> => {
    if (!deferredPrompt) {
      console.warn("Install prompt not available");
      return;
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for user choice
      const choiceResult = await deferredPrompt.userChoice;

      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the install prompt");
      } else {
        console.log("User dismissed the install prompt");
      }

      // Clear the deferred prompt
      setDeferredPrompt(null);
      setCanInstall(false);
    } catch (error) {
      console.error("Error showing install prompt:", error);
    }
  };

  return {
    isInstalled,
    canInstall,
    platform,
    promptInstall,
  };
}
