/**
 * useRealtimeSync Hook
 * Supabase Realtime üzerinden belirli bir tablo için canlı güncellemeler alır.
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeSyncOptions<T> {
  table: string;
  familyId: string | null;
  event?: ChangeEvent;
  onInsert?: (record: T) => void;
  onUpdate?: (record: T) => void;
  onDelete?: (record: Partial<T>) => void;
  enabled?: boolean;
}

export function useRealtimeSync<T>({
  table,
  familyId,
  event = '*',
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeSyncOptions<T>): void {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Callback ref'leri: her render'da yeniden abone olmayı önler
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!familyId || !enabled) return;

    const channelName = `realtime:${table}:${familyId}`;

    const setupChannel = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channelRef.current = (supabase.channel(channelName) as any)
        .on(
          'postgres_changes',
          { event, schema: 'public', table, filter: `family_id=eq.${familyId}` },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => {
            const eventType = payload.eventType;
            if (eventType === 'INSERT' && payload.new) {
              onInsertRef.current?.(payload.new as T);
            } else if (eventType === 'UPDATE' && payload.new) {
              onUpdateRef.current?.(payload.new as T);
            } else if (eventType === 'DELETE' && payload.old) {
              onDeleteRef.current?.(payload.old as Partial<T>);
            }
          }
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .subscribe((status: any) => {
          if (status === 'CHANNEL_ERROR') {
            setTimeout(setupChannel, 3000);
          }
        });
    };

    setupChannel();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [familyId, enabled, table, event]);
}

// ── Çoklu Tablo Dinleme ───────────────────────────────────────────────────────

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = supabase.channel(`multi:${familyId}`);

    for (const handler of handlers) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: handler.table, filter: `family_id=eq.${familyId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
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
