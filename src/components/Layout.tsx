/**
 * Layout — Ana Sayfa Düzeni
 * Alt navigasyon çubuğu, offline banner, bildirim ikonu içerir.
 * Erişilebilirlik: aria-labels, klavye navigasyonu, yüksek kontrast desteği.
 */

import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Calendar,
  CheckSquare,
  ShoppingCart,
  UtensilsCrossed,
  Bell,
  Settings,
  WifiOff,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOfflineSync } from '@/hooks/useOfflineSync';

interface LayoutProps {
  largeFontMode?: boolean;
  highContrast?: boolean;
}

const NAV_ITEMS = [
  { to: 'calendar', label: 'Takvim', icon: Calendar, ariaLabel: 'Takvim sayfasına git' },
  { to: 'tasks', label: 'Görevler', icon: CheckSquare, ariaLabel: 'Görevler sayfasına git' },
  { to: 'shopping', label: 'Alışveriş', icon: ShoppingCart, ariaLabel: 'Alışveriş sayfasına git' },
  { to: 'meals', label: 'Yemekler', icon: UtensilsCrossed, ariaLabel: 'Yemek planına git' },
] as const;

export default function Layout({ largeFontMode = false, highContrast = false }: LayoutProps) {
  const [showConflictBanner, setShowConflictBanner] = useState(false);

  const { isOnline, isSyncing, pendingCount, conflictCount, triggerSync } = useOfflineSync(
    (count) => {
      if (count > 0) setShowConflictBanner(true);
    }
  );

  return (
    <div
      className={cn(
        'flex flex-col min-h-screen bg-background',
        largeFontMode && 'text-large-base',
        highContrast && 'high-contrast'
      )}
    >
      {/* ── Offline Banner ────────────────────────────────────────────── */}
      {!isOnline && (
        <div
          role="alert"
          aria-live="assertive"
          className="sticky top-0 z-50 flex items-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white animate-offline-pulse"
        >
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Çevrimdışı moddasınız. Değişiklikler yerel olarak kaydediliyor.</span>
          {pendingCount > 0 && (
            <span className="ml-auto rounded-full bg-amber-700 px-2 py-0.5 text-xs">
              {pendingCount} bekliyor
            </span>
          )}
        </div>
      )}

      {/* ── Sync Conflict Banner ──────────────────────────────────────── */}
      {showConflictBanner && conflictCount > 0 && (
        <div
          role="alert"
          className="flex items-center gap-2 bg-orange-100 border-b border-orange-300 px-4 py-2 text-sm text-orange-800"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {conflictCount} çakışma tespit edildi. Son değişiklik kaydedildi.
          </span>
          <button
            onClick={() => setShowConflictBanner(false)}
            className="ml-auto text-xs underline hover:no-underline"
            aria-label="Çakışma uyarısını kapat"
          >
            Kapat
          </button>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <span className="font-bold text-primary text-lg">Aile Org</span>

          <div className="flex items-center gap-2">
            {/* Sync butonu */}
            {isOnline && pendingCount > 0 && (
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                aria-label={`${pendingCount} bekleyen değişikliği senkronize et`}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')}
                  aria-hidden="true"
                />
                {pendingCount}
              </button>
            )}

            {/* Bildirim ikonu */}
            <NavLink
              to="settings"
              aria-label="Bildirimler"
              className="relative rounded-full p-2 hover:bg-accent transition-colors"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
            </NavLink>

            {/* Ayarlar */}
            <NavLink
              to="settings"
              aria-label="Ayarlar"
              className="rounded-full p-2 hover:bg-accent transition-colors"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </NavLink>
          </div>
        </div>
      </header>

      {/* ── Ana İçerik ────────────────────────────────────────────────── */}
      <main className="flex-1 container py-4 pb-24" role="main">
        <Outlet />
      </main>

      {/* ── Alt Navigasyon ────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        aria-label="Ana navigasyon"
      >
        <div className="container flex h-16 items-center justify-around">
          {NAV_ITEMS.map(({ to, label, icon: Icon, ariaLabel }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={ariaLabel}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs transition-colors min-w-[60px]',
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
