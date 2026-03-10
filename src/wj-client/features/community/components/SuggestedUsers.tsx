"use client";

import { useState } from "react";
import { useQueryGetSuggestedUsers } from "@/utils/generated/hooks";
import { SuggestedUserCard } from "./SuggestedUserCard";
import { Users } from "lucide-react";

export function SuggestedUsers() {
  const { data, isLoading } = useQueryGetSuggestedUsers({}, { refetchOnMount: "always" });
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  const users = (data?.users ?? []).filter((u) => !dismissedIds.has(u.userId)).slice(0, 5);

  const handleDismiss = (userId: number) => {
    setDismissedIds((prev) => new Set(prev).add(userId));
  };

  return (
    <div className="bg-white rounded-2xl border border-v2-border-light p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-v2-text-tertiary" />
        <p className="font-vietnam text-xs font-semibold text-v2-text-tertiary uppercase tracking-wider">
          Gợi ý theo dõi
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <p className="font-vietnam text-sm text-v2-text-tertiary text-center py-4">
          Chưa có gợi ý
        </p>
      ) : (
        <div className="divide-y divide-v2-border-light/50">
          {users.map((user) => (
            <SuggestedUserCard key={user.userId} user={user} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}
