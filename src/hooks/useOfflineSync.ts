/**
 * useOfflineSync Hook
 * Online/offline durumunu izler, bağlantı gelince kuyruğu flush eder.
 * UI'a sync durumu (pending count, conflict count) döndürür.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  enqueue,
  flushQueue,
  getQueueSize,
  getAllQueued,
  dequeue,
  clearConflict,
} from '@/lib/offlineQueue';
import type { OfflineOperationType, SyncStatus, OfflineQueueItem } from '@/types';

interface UseOfflineSyncReturn extends SyncStatus {
  // Offline-first yazma: online'sa direkt, offline'sa queue'ya
  writeOfflineFirst: (
    table: string,
    operation: OfflineOperationType,
    payload: Record<string, unknown>
  ) => Promise<{ queued: boolean; error: string | null }>;
  // Manuel sync tetikle
  triggerSync: () => Promise<void>;
  // Çakışma listesi
  conflicts: OfflineQueueItem[];
  // Çakışmayı çöz (manuel merge)
  resolveConflict: (itemId: string, resolution: 'keep_local' | 'discard') => Promise<void>;
}

export function useOfflineSync(
  onConflictDetected?: (count: number) => void
): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<OfflineQueueItem[]>([]);

  const isSyncingRef = useRef(false);
  // Stabil callback referansı — effect'lerde stale closure'ı önler
  const onConflictDetectedRef = useRef(onConflictDetected);
  useEffect(() => {
    onConflictDetectedRef.current = onConflictDetected;
  }, [onConflictDetected]);

  // Kuyruk durumunu güncelle
  const refreshQueueStatus = useCallback(async () => {
    const size = await getQueueSize();
    setPendingCount(size);

    const all = await getAllQueued();
    const conflictItems = all.filter((i) => i.conflictDetected);
    setConflicts(conflictItems);
    setConflictCount(conflictItems.length);
  }, []);

  const triggerSync = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return;

    const size = await getQueueSize();
    if (size === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const result = await flushQueue(supabase as unknown, {
        onConflict: (item) => {
          console.warn('[OfflineSync] Conflict detected for item:', item.id);
        },
        onError: (item, error) => {
          console.error('[OfflineSync] Failed to sync item:', item.id, error.message);
        },
      });

      setLastSyncAt(new Date().toISOString());
      await refreshQueueStatus();

      if (result.conflicts > 0) {
        onConflictDetectedRef.current?.(result.conflicts);
      }
    } catch (err) {
      console.error('[OfflineSync] Sync error:', err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshQueueStatus]);

  // Online/offline event listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Bağlantı gelince otomatik sync
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // İlk yüklemede kuyruk durumunu çek
    refreshQueueStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshQueueStatus, triggerSync]);

  // Periyodik sync: 30 saniyede bir (online'sa)
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      triggerSync();
    }, 30_000);
    return () => clearInterval(interval);
  }, [isOnline, triggerSync]);

  const writeOfflineFirst = useCallback(
    async (
      table: string,
      operation: OfflineOperationType,
      payload: Record<string, unknown>
    ): Promise<{ queued: boolean; error: string | null }> => {
      if (navigator.onLine) {
        // Online: direkt Supabase'e yaz
        try {
          if (operation === 'INSERT') {
            const { error } = await supabase.from(table).insert(payload);
            if (error) throw new Error(error.message);
          } else if (operation === 'UPDATE') {
            const { id, ...rest } = payload;
            const { error } = await supabase
              .from(table)
              .update({ ...rest, updated_at: new Date().toISOString() })
              .eq('id', id as string);
            if (error) throw new Error(error.message);
          } else if (operation === 'DELETE') {
            const { error } = await supabase
              .from(table)
              .delete()
              .eq('id', payload.id as string);
            if (error) throw new Error(error.message);
          }
          return { queued: false, error: null };
        } catch (err) {
          // Online yazma başarısız olursa queue'ya al
          await enqueue(table, operation, payload);
          await refreshQueueStatus();
          return { queued: true, error: (err as Error).message };
        }
      } else {
        // Offline: kuyruğa ekle
        await enqueue(table, operation, payload);
        await refreshQueueStatus();
        return { queued: true, error: null };
      }
    },
    [refreshQueueStatus]
  );

  const resolveConflict = useCallback(
    async (itemId: string, resolution: 'keep_local' | 'discard') => {
      if (resolution === 'discard') {
        await dequeue(itemId);
      } else {
        // keep_local: çakışma işaretini kaldır, retry count'u sıfırla, tekrar dene
        await clearConflict(itemId);
        await triggerSync();
      }

      await refreshQueueStatus();
    },
    [refreshQueueStatus, triggerSync]
  );

  return {
    isOnline,
    isSyncing,
    lastSyncAt,
    pendingCount,
    conflictCount,
    conflicts,
    writeOfflineFirst,
    triggerSync,
    resolveConflict,
  };
}
