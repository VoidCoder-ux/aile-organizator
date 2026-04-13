/**
 * useRealtimeSync Hook
 * Supabase Realtime üzerinden belirli bir tablo için canlı güncellemeler alır.
 * Bağlantı kesilince otomatik yeniden abone olur.
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeSyncOptions<T extends Record<string, unknown>> {
  table: string;
  familyId: string | null;
  event?: ChangeEvent;
  onInsert?: (record: T) => void;
  onUpdate?: (record: T) => void;
  onDelete?: (record: Partial<T>) => void;
  enabled?: boolean;
}

export function useRealtimeSync<T extends Record<string, unknown>>({
  table,
  familyId,
  event = '*',
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeSyncOptions<T>): void {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const subscribe = useCallback(() => {
    if (!familyId || !enabled) return;

    // Önceki kanalı temizle
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `realtime:${table}:${familyId}:${Date.now()}`;

    channelRef.current = supabase
      .channel(channelName)
      .on<T>(
        'postgres_changes' as Parameters<ReturnType<typeof supabase.channel>['on']>[0],
        {
          event,
          schema: 'public',
          table,
          filter: `family_id=eq.${familyId}`,
        } as Parameters<ReturnType<typeof supabase.channel>['on']>[1],
        (payload: RealtimePostgresChangesPayload<T>) => {
          const eventType = payload.eventType;
          if (eventType === 'INSERT' && onInsert && payload.new) {
            onInsert(payload.new as T);
          } else if (eventType === 'UPDATE' && onUpdate && payload.new) {
            onUpdate(payload.new as T);
          } else if (eventType === 'DELETE' && onDelete && payload.old) {
            onDelete(payload.old as Partial<T>);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          // 3 saniye sonra yeniden dene
          setTimeout(subscribe, 3000);
        }
      });
  }, [familyId, enabled, table, event, onInsert, onUpdate, onDelete]);

  useEffect(() => {
    subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribe]);
}

// ── Çoklu Tablo Dinleme ───────────────────────────────────────────────────────

/**
 * Birden fazla tablo için tek seferde realtime abonelik.
 * Büyük ailelerde connection sayısını azaltır.
 */
export function useMultiTableSync(
  familyId: string | null,
  handlers: {
    table: string;
    onInsert?: (record: Record<string, unknown>) => void;
    onUpdate?: (record: Record<string, unknown>) => void;
    onDelete?: (record: Record<string, unknown>) => void;
  }[]
): void {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!familyId || handlers.length === 0) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    let channel = supabase.channel(`multi:${familyId}`);

    for (const handler of handlers) {
      channel = channel.on(
        'postgres_changes' as Parameters<typeof channel.on>[0],
        {
          event: '*',
          schema: 'public',
          table: handler.table,
          filter: `family_id=eq.${familyId}`,
        } as Parameters<typeof channel.on>[1],
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const rec = (payload.new ?? payload.old) as Record<string, unknown>;
          if (payload.eventType === 'INSERT') handler.onInsert?.(rec);
          else if (payload.eventType === 'UPDATE') handler.onUpdate?.(rec);
          else if (payload.eventType === 'DELETE') handler.onDelete?.(rec);
        }
      );
    }

    channelRef.current = channel.subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [familyId, handlers]);
}
