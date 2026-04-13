/**
 * Offline Queue — IndexedDB tabanlı
 * Kullanıcı offline'dayken yapılan yazma işlemleri kuyruğa alınır.
 * İnternet geldiğinde otomatik Supabase'e push edilir.
 * Çakışma: "son yazan kazanır" + UI uyarısı
 */

import { openDB, type IDBPDatabase } from 'idb';
import { generateId } from './utils';
import type { OfflineQueueItem, OfflineOperationType } from '@/types';

const DB_NAME = 'aile-org-offline';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

// ── DB Başlatma ───────────────────────────────────────────────────────────────

let db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (db) return db;
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_timestamp', 'timestamp');
        store.createIndex('by_table', 'table');
      }
    },
  });
  return db;
}

// ── Queue Operasyonları ───────────────────────────────────────────────────────

/** Kuyruğa yeni operasyon ekle */
export async function enqueue(
  table: string,
  operation: OfflineOperationType,
  payload: Record<string, unknown>
): Promise<OfflineQueueItem> {
  const database = await getDB();
  const item: OfflineQueueItem = {
    id: generateId(),
    table,
    operation,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    conflictDetected: false,
  };
  await database.add(STORE_NAME, item);
  return item;
}

/** Kuyruktaki tüm işlemleri zaman sırasıyla getir */
export async function getAllQueued(): Promise<OfflineQueueItem[]> {
  const database = await getDB();
  return database.getAllFromIndex(STORE_NAME, 'by_timestamp');
}

/** İşlem tamamlandıktan sonra kuyruktan kaldır */
export async function dequeue(id: string): Promise<void> {
  const database = await getDB();
  await database.delete(STORE_NAME, id);
}

/** Retry sayısını artır */
export async function incrementRetry(id: string): Promise<void> {
  const database = await getDB();
  const item = await database.get(STORE_NAME, id) as OfflineQueueItem | undefined;
  if (item) {
    item.retryCount += 1;
    await database.put(STORE_NAME, item);
  }
}

/** Çakışma işaretle */
export async function markConflict(id: string): Promise<void> {
  const database = await getDB();
  const item = await database.get(STORE_NAME, id) as OfflineQueueItem | undefined;
  if (item) {
    item.conflictDetected = true;
    await database.put(STORE_NAME, item);
  }
}

/** Kuyruk boyutu */
export async function getQueueSize(): Promise<number> {
  const database = await getDB();
  return database.count(STORE_NAME);
}

/** Tüm kuyruğu temizle (kritik durumlarda) */
export async function clearQueue(): Promise<void> {
  const database = await getDB();
  await database.clear(STORE_NAME);
}

// ── Sync Engine ───────────────────────────────────────────────────────────────

type SyncConflictCallback = (item: OfflineQueueItem, serverData: Record<string, unknown>) => void;

interface SyncOptions {
  onConflict?: SyncConflictCallback;
  onSuccess?: (item: OfflineQueueItem) => void;
  onError?: (item: OfflineQueueItem, error: Error) => void;
}

/**
 * Kuyruktaki işlemleri Supabase'e push et.
 * Her operasyon sırasıyla işlenir.
 * Çakışma olursa onConflict callback çağrılır.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function flushQueue(
  supabase: any,
  options: SyncOptions = {}
): Promise<{ synced: number; failed: number; conflicts: number }> {
  const queue = await getAllQueued();
  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  for (const item of queue) {
    try {
      if (item.operation === 'INSERT') {
        const { error } = await supabase.from(item.table).insert(item.payload);
        if (error) {
          // Çakışma: kayıt zaten var
          if (error.code === '23505') {
            // Unique violation — last-write-wins: UPDATE ile üstüne yaz
            const { id, ...rest } = item.payload;
            const { error: updateError } = await supabase
              .from(item.table)
              .update({ ...rest, updated_at: new Date().toISOString() })
              .eq('id', id as string);

            if (updateError) throw new Error(updateError.message);

            await markConflict(item.id);
            conflicts++;
            options.onConflict?.(item, item.payload);
          } else {
            throw new Error(error.message);
          }
        }
      } else if (item.operation === 'UPDATE') {
        const { id, ...rest } = item.payload;
        const { error } = await supabase
          .from(item.table)
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq('id', id as string);
        if (error) throw new Error(error.message);
      } else if (item.operation === 'DELETE') {
        const { error } = await supabase
          .from(item.table)
          .delete()
          .eq('id', item.payload.id as string);
        if (error) throw new Error(error.message);
      }

      await dequeue(item.id);
      synced++;
      options.onSuccess?.(item);
    } catch (err) {
      await incrementRetry(item.id);
      failed++;
      options.onError?.(item, err instanceof Error ? err : new Error(String(err)));

      // 5 denemeden sonra kuyruktaki kayıt silinir (veri kaybını önlemek için log'a yaz)
      if (item.retryCount >= 4) {
        console.error('[OfflineQueue] Max retry reached, removing item:', item);
        await dequeue(item.id);
      }
    }
  }

  return { synced, failed, conflicts };
}
