"use client";

import { NotificationCode } from "@/app/constants";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { memo } from "react";

interface Notification {
  status: NotificationCode;
  message: string;
  submessage?: string;
  button?: string;
  navigate?: string;
}

interface NotificationProps {
  notification: Notification;
}

const SuccessIcon = () => (
  <svg
    className="w-16 h-16 text-accent-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const ErrorIcon = () => (
  <svg
    className="w-16 h-16 text-danger-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const Notification = memo(function Notification({ notification }: NotificationProps) {
  const router = useRouter();
  const isSuccess = notification.status === NotificationCode.SUCCESS;

  const handleNavigate = () => {
    if (notification.navigate) {
      router.push(notification.navigate);
    }
  };

  return (
    <div className="flex w-full h-full justify-center items-center p-6">
      <div className="flex flex-col items-center max-w-md text-center space-y-4">
        {/* Icon */}
        <div className="animate-scale-in">
          {isSuccess ? <SuccessIcon /> : <ErrorIcon />}
        </div>

        {/* Status */}
        <h2
          className={cn(
            "text-display-xl font-bold",
            isSuccess ? "text-accent-500" : "text-danger-500"
          )}
        >
          {notification.status}
        </h2>

        {/* Message */}
        <p className="text-neutral-900 dark:text-dark-text text-base font-medium">
          {notification.message}
        </p>

        {/* Sub-message */}
        {notification.submessage && (
          <p className="text-neutral-600 dark:text-neutral-400 text-sm">
            {notification.submessage}
          </p>
        )}

        {/* Action button */}
        {notification.button && notification.navigate && (
          <button
            onClick={handleNavigate}
            className={cn(
              "mt-4 px-6 py-3 min-h-[44px] rounded-lg font-medium",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              isSuccess
                ? "bg-accent-500 hover:bg-accent-600 text-white focus:ring-accent-500"
                : "bg-v2-red-primary hover:bg-v2-red-dark text-white focus:ring-v2-red-primary",
              "active:scale-95"
            )}
          >
            {notification.button}
          </button>
        )}
      </div>
    </div>
  );
});

export default Notification;
