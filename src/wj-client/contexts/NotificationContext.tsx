"use client";

import React, { createContext, useContext, useCallback, useState, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Toast, ToastContainer, type ToastProps, type ToastVariant, type ToastPosition } from "@/components/notifications/Toast";

interface ToastOptions {
  variant?: ToastVariant;
  title?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

interface NotificationContextType {
  toast: {
    success: (message: string, options?: Omit<ToastOptions, "variant">) => void;
    error: (message: string, options?: Omit<ToastOptions, "variant">) => void;
    warning: (message: string, options?: Omit<ToastOptions, "variant">) => void;
    info: (message: string, options?: Omit<ToastOptions, "variant">) => void;
    show: (message: string, options?: ToastOptions) => void;
    dismiss: (id: string) => void;
    dismissAll: () => void;
  };
  position: ToastPosition;
  setPosition: (position: ToastPosition) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface ToastItem extends ToastProps {
  id: string;
}

let toastIdCounter = 0;

const generateToastId = (): string => `toast-${++toastIdCounter}`;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [position, setPosition] = useState<ToastPosition>("top-right");
  const [isClient, setIsClient] = useState(false);

  // Handle hydration
  useEffect(() => {
    queueMicrotask(() => setIsClient(true));
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((toast) =>
      toast.id === id ? { ...toast, isClosing: true } : toast
    ));

    // Remove from DOM after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 300);
  }, []);

  const dismissAll = useCallback(() => {
    setToasts((prev) => prev.map((toast) => ({ ...toast, isClosing: true })));

    setTimeout(() => {
      setToasts([]);
    }, 300);
  }, []);

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    const id = generateToastId();

    const newToast: ToastItem = {
      id,
      message,
      variant: options.variant,
      title: options.title,
      duration: options.duration ?? 5000,
      action: options.action,
      icon: options.icon,
      position,
      onClose: () => dismiss(id),
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, newToast.duration);
    }

    return id;
  }, [position, dismiss]);

  const success = useCallback((message: string, options: Omit<ToastOptions, "variant"> = {}) => {
    return show(message, { ...options, variant: "success" });
  }, [show]);

  const error = useCallback((message: string, options: Omit<ToastOptions, "variant"> = {}) => {
    return show(message, { ...options, variant: "error", duration: options.duration ?? 7000 });
  }, [show]);

  const warning = useCallback((message: string, options: Omit<ToastOptions, "variant"> = {}) => {
    return show(message, { ...options, variant: "warning" });
  }, [show]);

  const info = useCallback((message: string, options: Omit<ToastOptions, "variant"> = {}) => {
    return show(message, { ...options, variant: "info" });
  }, [show]);

  const value: NotificationContextType = {
    toast: {
      success,
      error,
      warning,
      info,
      show,
      dismiss,
      dismissAll,
    },
    position,
    setPosition,
  };

  // Group toasts by position for multiple container support
  const toastsByPosition = toasts.reduce((acc, toast) => {
    const pos = toast.position ?? "top-right";
    if (!acc[pos]) {
      acc[pos] = [];
    }
    acc[pos].push(toast);
    return acc;
  }, {} as Record<ToastPosition, ToastItem[]>);

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {/* Render toasts */}
      {isClient && typeof document !== "undefined" && (
        <>
          {Object.entries(toastsByPosition).map(([pos, positionToasts]) => (
            <ToastContainer key={pos} position={pos as ToastPosition}>
              {positionToasts.map((toast) => (
                <Toast key={toast.id} {...toast} />
              ))}
            </ToastContainer>
          ))}
        </>
      )}
    </NotificationContext.Provider>
  );
}

/**
 * Hook to access toast notifications
 *
 * @example
 * ```tsx
 * const { toast } = useNotification();
 *
 * // Show success toast
 * toast.success("Changes saved successfully!");
 *
 * // Show error toast with action
 * toast.error("Failed to save changes", {
 *   title: "Error",
 *   action: { label: "Retry", onClick: () => retry() }
 * });
 *
 * // Show custom toast
 * toast.show("Custom message", {
 *   variant: "info",
 *   title: "Information",
 *   duration: 10000,
 * });
 * ```
 */
export function useNotification() {
  const context = useContext(NotificationContext);

  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }

  return context;
}

/**
 * HOC to add notification support to a component
 */
export function withNotification<P extends object>(
  Component: React.ComponentType<P & { notification: NotificationContextType["toast"] }>
) {
  return function WithNotification(props: P) {
    const { toast } = useNotification();

    return <Component {...props} notification={toast} />;
  };
}
