/**
 * useNotifications — Bildirim hook'u
 * - Bildirimleri Supabase'den çeker
 * - user_id filtreli realtime subscription
 * - Browser Notification API ile OS bildirimi gösterir
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, TABLES } from '@/lib/supabaseClient';
import type { AppNotification } from '@/types';

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useNotifications(
  userId: string | null,
  _familyId?: string | null
): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Browser Notification izni ──────────────────────────────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showOsNotification = useCallback((notif: AppNotification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notif.title, {
        body: notif.body,
        icon: '/aile-organizator/icons/icon-192x192.png',
        tag: notif.id,
      });
    }
  }, []);

  // ── İlk yükleme ────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) setNotifications(data as AppNotification[]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channelRef.current = (supabase.channel(`notif:${userId}`) as any)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLES.NOTIFICATIONS, filter: `user_id=eq.${userId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const n = payload.new as AppNotification;
            setNotifications((prev) => [n, ...prev]);
            showOsNotification(n);
          } else if (payload.eventType === 'UPDATE') {
            const n = payload.new as AppNotification;
            setNotifications((prev) => prev.map((x) => (x.id === n.id ? n : x)));
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<AppNotification>;
            setNotifications((prev) => prev.filter((x) => x.id !== old.id));
          }
        }
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .subscribe((status: any) => {
        if (status === 'CHANNEL_ERROR') setTimeout(() => fetchNotifications(), 3000);
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, showOsNotification, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await supabase.from(TABLES.NOTIFICATIONS).update({ is_read: true }).eq('id', id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase.from(TABLES.NOTIFICATIONS).update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
  }, [userId]);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    setNotifications([]);
    await supabase.from(TABLES.NOTIFICATIONS).delete().eq('user_id', userId);
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, clearAll };
}
