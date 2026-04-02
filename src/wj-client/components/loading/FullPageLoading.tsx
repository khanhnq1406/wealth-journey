"use client";

import Image from "next/image";

type FullPageLoadingProps = {
  text?: string;
};

export const FullPageLoading = ({ text }: FullPageLoadingProps) => {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-v2-bg-primary"
      role="status"
      aria-label="Loading"
    >
      <div className="relative flex h-32 w-32 items-center justify-center">
        <Image
          src="/logo.svg"
          alt="congdongvang.com"
          width={80}
          height={80}
          priority
        />
        <svg
          className="absolute inset-0 h-full w-full animate-spin text-v2-gold-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeOpacity="0.25"
          />
          <circle
            cx="12"
            cy="12"
            r="11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="17.28 51.84"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        {text && (
          <span className="max-w-xs px-4 text-sm text-v2-text-tertiary">
            {text}
          </span>
        )}
        <span className="text-xl font-bold tracking-wide text-v2-gold-accent">
          congdongvang.com
        </span>
        <span className="max-w-xs px-4 text-sm text-v2-text-tertiary">
          Sân chơi giao lưu, trao đổi, kiến thức về thị trường đầu tư tài chính
        </span>
        <span className="mt-1 text-xs text-v2-text-placeholder">
          Liên hệ quảng cáo: 076.897.2512
        </span>
      </div>
    </div>
  );
};
