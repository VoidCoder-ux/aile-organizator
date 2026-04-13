/**
 * Yardımcı Fonksiyonlar
 * shadcn/ui cn helper + uygulama geneli utils
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { ShoppingCategory, FamilyRole, TaskPriority } from '@/types';

// ── shadcn/ui cn utility ──────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── UUID Üretici (crypto.randomUUID desteklemeyen tarayıcılar için) ────────────

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Aile Davet Kodu Üretici (6 haneli alfanumerik) ────────────────────────────

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Karıştırılabilecek karakterler çıkarıldı
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── Tarih Formatlama ──────────────────────────────────────────────────────────

export function formatDate(dateStr: string, formatStr = 'PPP'): string {
  try {
    const date = parseISO(dateStr);
    return format(date, formatStr, { locale: tr });
  } catch {
    return dateStr;
  }
}

export function formatRelativeDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Bugün';
    if (isTomorrow(date)) return 'Yarın';
    if (isYesterday(date)) return 'Dün';
    return format(date, 'd MMMM', { locale: tr });
  } catch {
    return dateStr;
  }
}

export function formatTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'HH:mm', { locale: tr });
  } catch {
    return '';
  }
}

// ── Renk Yardımcıları ─────────────────────────────────────────────────────────

/** Hex rengin luminance'ına göre beyaz/siyah yazı rengi döndür */
export function getContrastColor(hexColor: string): 'white' | 'black' {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? 'black' : 'white';
}

/** Varsayılan kullanıcı renkleri paleti */
export const USER_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
] as const;

// ── Kategori Etiketleri ───────────────────────────────────────────────────────

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  produce: 'Meyve & Sebze',
  dairy: 'Süt Ürünleri',
  meat: 'Et & Tavuk',
  bakery: 'Fırın',
  frozen: 'Dondurulmuş',
  beverages: 'İçecekler',
  snacks: 'Atıştırmalık',
  household: 'Ev Ürünleri',
  personal_care: 'Kişisel Bakım',
  other: 'Diğer',
};

export const SHOPPING_CATEGORY_ICONS: Record<ShoppingCategory, string> = {
  produce: '🥦',
  dairy: '🥛',
  meat: '🥩',
  bakery: '🍞',
  frozen: '🧊',
  beverages: '🧃',
  snacks: '🍿',
  household: '🧹',
  personal_care: '🧴',
  other: '📦',
};

export const ROLE_LABELS: Record<FamilyRole, string> = {
  parent: 'Ebeveyn',
  child: 'Çocuk',
  guest: 'Misafir',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};

// ── Network Yardımcıları ──────────────────────────────────────────────────────

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// ── Debounce ──────────────────────────────────────────────────────────────────

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Güvenli JSON Parse ────────────────────────────────────────────────────────

export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
