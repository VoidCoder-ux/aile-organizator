/**
 * Supabase Client — Singleton
 * VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY env değişkenlerinden okur.
 * Anon key frontend için güvenlidir — RLS tüm erişimi filtreler.
 * Service role key ASLA bu dosyada kullanılmaz.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials eksik!\n' +
    '.env dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlayın.\n' +
    'Bakın: .env.example'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Token'ları localStorage'da sakla (PWA uyumlu)
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Magic link yönlendirmesi için
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  // Offline durumunda queue için headers
  global: {
    headers: {
      'x-client-info': 'aile-organizator/1.0.0',
    },
  },
});

// DB tablo adları — typo'yu önlemek için sabitler
export const TABLES = {
  PROFILES: 'profiles',
  FAMILIES: 'families',
  FAMILY_MEMBERS: 'family_members',
  EVENTS: 'events',
  TASKS: 'tasks',
  SHOPPING_ITEMS: 'shopping_items',
  MEALS: 'meals',
  RECIPES: 'recipes',
  NOTIFICATIONS: 'notifications',
} as const;

// Realtime channel adları
export const CHANNELS = {
  FAMILY: (familyId: string) => `family:${familyId}`,
  TASKS: (familyId: string) => `tasks:${familyId}`,
  SHOPPING: (familyId: string) => `shopping:${familyId}`,
  EVENTS: (familyId: string) => `events:${familyId}`,
} as const;
