"use client";

import { MessageCircle } from "lucide-react";

export function FeedEmpty() {
  return (
    <div className="bg-v2-maroon-800 rounded-2xl border border-v2-border-light p-8 text-center">
      <div className="flex justify-center mb-3">
        <div className="w-12 h-12 rounded-full bg-v2-red-light flex items-center justify-center">
          <MessageCircle size={24} className="text-v2-red-primary" />
        </div>
      </div>
      <p className="font-vietnam text-lg font-semibold text-v2-text-primary mb-1">
        Chưa có bài viết nào
      </p>
      <p className="font-vietnam text-sm text-v2-text-tertiary">
        Hãy là người đầu tiên chia sẻ với cộng đồng!
      </p>
    </div>
  );
}
