/**
 * NotificationPanel — Bildirim çanı + açılır panel
 */

import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import type { AppNotification } from '@/types';

interface NotificationPanelProps {
  userId: string | null;
  familyId: string | null;
}

const TYPE_LABELS: Record<AppNotification['type'], string> = {
  task_assigned:   '📋 Görev',
  task_due:        '⏰ Hatırlatıcı',
  event_reminder:  '📅 Etkinlik',
  shopping_added:  '🛒 Alışveriş',
  member_joined:   '👤 Aile',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins}dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa önce`;
  return `${Math.floor(hrs / 24)}g önce`;
}

export default function NotificationPanel({ userId, familyId }: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, clearAll } =
    useNotifications(userId, familyId);

  // Dışarı tıkla → kapat
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Escape → kapat
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  return (
    <div ref={panelRef} className="relative">
      {/* Zil butonu */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={`Bildirimler${unreadCount > 0 ? `, ${unreadCount} okunmamış` : ''}`}
        aria-expanded={isOpen}
        className="relative rounded-full p-2 hover:bg-accent transition-colors"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Bildirimler"
          className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border bg-background shadow-lg flex flex-col max-h-[480px]"
        >
          {/* Başlık */}
          <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
            <h2 className="text-sm font-semibold">
              Bildirimler {unreadCount > 0 && <span className="ml-1 text-primary">({unreadCount})</span>}
            </h2>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} title="Tümünü okundu işaretle"
                  className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} title="Tümünü sil"
                  className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-accent transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} aria-label="Kapat"
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Liste */}
          <ul className="flex-1 overflow-y-auto divide-y" aria-live="polite">
            {isLoading && (
              <li className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                Yükleniyor…
              </li>
            )}
            {!isLoading && notifications.length === 0 && (
              <li className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <span className="text-sm">Bildirim yok</span>
              </li>
            )}
            {notifications.map((notif) => (
              <li key={notif.id}>
                <button
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-accent transition-colors',
                    !notif.is_read && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', !notif.is_read ? 'bg-primary' : 'bg-transparent')} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted-foreground mb-0.5">
                        {TYPE_LABELS[notif.type] ?? notif.type}
                      </p>
                      <p className="text-sm font-semibold leading-snug">{notif.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">{timeAgo(notif.created_at)}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
