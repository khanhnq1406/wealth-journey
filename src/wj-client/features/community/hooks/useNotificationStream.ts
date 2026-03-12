"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  EVENT_CommunityGetNotifications,
  EVENT_CommunityGetUnreadNotificationCount,
} from "@/utils/generated/hooks";
import { LOCAL_STORAGE_TOKEN_NAME } from "@/app/constants";
import type {
  GetNotificationsResponse,
  GetUnreadNotificationCountResponse,
} from "@/gen/protobuf/v1/community";

const SSE_URL = "/api/v1/community/notifications/stream";
const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function useNotificationStream() {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);
  const reconnectDelayRef = useRef(MIN_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const connectRef = useRef<(() => void) | null>(null);

  const getToken = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LOCAL_STORAGE_TOKEN_NAME);
  }, []);

  const handleNotification = useCallback(
    (data: Record<string, unknown>) => {
      // Increment unread count optimistically
      queryClient.setQueryData(
        [EVENT_CommunityGetUnreadNotificationCount, {}],
        (old: GetUnreadNotificationCountResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            count: (old.count || 0) + 1,
          };
        }
      );

      // Prepend to notification list cache
      queryClient.setQueriesData(
        { queryKey: [EVENT_CommunityGetNotifications] },
        (old: GetNotificationsResponse | undefined) => {
          if (!old) return old;
          const newNotification = {
            id: data.id || Date.now(),
            type: data.type || "unknown",
            actorId: data.actorId,
            postId: data.postId,
            isRead: false,
            createdAt: Math.floor(Date.now() / 1000),
            actor: data.actor,
          };
          return {
            ...old,
            notifications: [newNotification, ...(old.notifications || [])],
          };
        }
      );
    },
    [queryClient]
  );

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const token = getToken();
    if (!token) {
      // No token — skip SSE (user not authenticated)
      return;
    }

    // Close existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const url = `${SSE_URL}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("notification", (event) => {
      try {
        const data = JSON.parse(event.data);
        handleNotification(data);
        // Reset reconnect delay on successful message
        reconnectDelayRef.current = MIN_RECONNECT_DELAY;
      } catch {
        // Ignore parse errors
      }
    });

    es.onerror = () => {
      if (!mountedRef.current) return;
      es.close();
      esRef.current = null;

      // Exponential backoff reconnect
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);

      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connectRef.current?.();
      }, delay);
    };
  }, [getToken, handleNotification]);

  // Store connect in ref to avoid circular dependency
  useEffect(() => {
    connectRef.current = connect;
  });

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);
}
