"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BaseCard } from "@/components/BaseCard";
import { Button } from "@/components/Button";
import { ButtonType } from "@/app/constants";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import {
  useQueryListSessions,
  useMutationRevokeSession,
  useMutationRevokeAllSessions,
} from "@/utils/generated/hooks";
import { ConfirmationDialog } from "@/components/modals/ConfirmationDialog";

interface SessionItemProps {
  session: any;
  onRevoke: (sessionId: string) => void;
  isRevoking: boolean;
  t: ReturnType<typeof useTranslations<"settings.sessions">>;
}

function SessionItem({ session, onRevoke, isRevoking, t }: SessionItemProps) {
  const locale = useLocale();
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString(locale);
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "mobile":
        return "📱";
      case "tablet":
        return "📲";
      case "desktop":
        return "💻";
      default:
        return "🔌";
    }
  };

  return (
    <div className="border rounded-lg p-4 mb-3">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{getDeviceIcon(session.deviceType)}</span>
            <div>
              <h3 className="font-semibold">
                {session.deviceName}
                {session.isCurrent && (
                  <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    {t("currentLabel")}
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500">{session.ipAddress}</p>
            </div>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p>{t("lastActive", { date: formatDate(session.lastActiveAt) })}</p>
            <p>{t("created", { date: formatDate(session.createdAt) })}</p>
            <p>{t("expires", { date: formatDate(session.expiresAt) })}</p>
          </div>
        </div>
        {!session.isCurrent && (
          <Button
            type={ButtonType.SECONDARY}
            onClick={() => onRevoke(session.sessionId)}
            loading={isRevoking}
            className="ml-4"
          >
            {t("revokeButton")}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const t = useTranslations("settings.sessions");
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);

  const { data, isLoading, refetch } = useQueryListSessions(
    {},
    { refetchOnMount: "always" }
  );

  const revokeSessionMutation = useMutationRevokeSession({
    onSuccess: () => {
      setRevokingSessionId(null);
      refetch();
    },
    onError: (error: any) => {
      console.error("Failed to revoke session:", error);
      setRevokingSessionId(null);
    },
  });

  const revokeAllMutation = useMutationRevokeAllSessions({
    onSuccess: () => {
      setShowRevokeAllConfirm(false);
      refetch();
    },
    onError: (error: any) => {
      console.error("Failed to revoke all sessions:", error);
    },
  });

  const handleRevokeSession = (sessionId: string) => {
    setRevokingSessionId(sessionId);
    revokeSessionMutation.mutate({ sessionId });
  };

  const handleRevokeAll = () => {
    const currentSession = data?.sessions?.find((s: any) => s.isCurrent);
    if (currentSession) {
      revokeAllMutation.mutate({ currentSessionId: currentSession.sessionId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  const sessions = data?.sessions || [];
  const otherSessionsCount = sessions.filter((s: any) => !s.isCurrent).length;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <BaseCard>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              <p className="text-gray-600 mt-1">
                {t("description")}
              </p>
            </div>
            {otherSessionsCount > 0 && (
              <Button
                type={ButtonType.SECONDARY}
                onClick={() => setShowRevokeAllConfirm(true)}
                loading={revokeAllMutation.isPending}
              >
                {t("revokeAllOthers")}
              </Button>
            )}
          </div>

          {sessions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t("noActiveSessions")}</p>
          ) : (
            <div>
              {sessions.map((session: any) => (
                <SessionItem
                  key={session.sessionId}
                  session={session}
                  onRevoke={handleRevokeSession}
                  isRevoking={
                    revokingSessionId === session.sessionId &&
                    revokeSessionMutation.isPending
                  }
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </BaseCard>

      {showRevokeAllConfirm && (
        <ConfirmationDialog
          onCancel={() => setShowRevokeAllConfirm(false)}
          onConfirm={handleRevokeAll}
          title={t("revokeAllTitle")}
          message={t("revokeAllMessage", { count: otherSessionsCount })}
          confirmText={t("revokeAllConfirm")}
          isLoading={revokeAllMutation.isPending}
        />
      )}
    </div>
  );
}
