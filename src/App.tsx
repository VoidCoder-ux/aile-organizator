/**
 * App.tsx — Ana Uygulama Router'ı
 * Auth guard, lazy loading, PWA update prompt, settings provider.
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { supabase } from '@/lib/supabaseClient';
import { useFamilyRole } from '@/hooks/useFamilyRole';
import Layout from '@/components/Layout';
import type { Profile, AppSettings } from '@/types';

// Lazy loaded route bileşenleri
const Onboarding = lazy(() => import('@/components/Onboarding'));
const Calendar = lazy(() => import('@/components/Calendar'));
const TaskBoard = lazy(() => import('@/components/TaskBoard'));
const ShoppingList = lazy(() => import('@/components/ShoppingList'));
const MealPlanner = lazy(() => import('@/components/MealPlanner'));
const ChildMode = lazy(() => import('@/components/ChildMode'));

// ── Yükleme Placeholder ───────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-label="Yükleniyor..." aria-busy="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-24 rounded-xl" />
      ))}
    </div>
  );
}

// ── PWA Güncelleme Banner ──────────────────────────────────────────────────────

function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl bg-primary p-4 text-white shadow-xl pwa-banner"
    >
      <p className="text-sm font-medium mb-2">Yeni sürüm hazır!</p>
      <div className="flex gap-2">
        <button
          onClick={() => updateServiceWorker(true)}
          className="flex-1 rounded-lg bg-white text-primary py-1.5 text-sm font-semibold hover:bg-white/90 transition-colors"
        >
          Güncelle
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="flex-1 rounded-lg border border-white/30 py-1.5 text-sm hover:bg-white/10 transition-colors"
        >
          Sonra
        </button>
      </div>
    </div>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────

function SettingsPage({
  settings,
  onSettingsChange,
  profile,
  onSignOut,
  inviteCode,
}: {
  settings: AppSettings;
  onSettingsChange: (s: Partial<AppSettings>) => void;
  profile: Profile | null;
  onSignOut: () => void;
  inviteCode: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const copyInviteCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="font-bold text-xl">Ayarlar</h2>

      {/* Profil */}
      {profile && (
        <section className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold mb-3">Profil</h3>
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
              style={{ backgroundColor: profile.color ?? '#6366f1' }}
              aria-label={`${profile.full_name} avatarı`}
            >
              {profile.full_name?.charAt(0)}
            </div>
            <div>
              <p className="font-medium">{profile.full_name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>
        </section>
      )}

      {/* Aile Davet Kodu */}
      {inviteCode && (
        <section className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold mb-3">Aile Davet Kodu</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Bu kodu aile üyeleriyle paylaşarak onları davet edin.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-muted px-4 py-2 text-xl font-bold font-mono tracking-widest text-center">
              {inviteCode}
            </code>
            <button
              onClick={copyInviteCode}
              aria-label="Davet kodunu kopyala"
              className="rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              {copied ? '✅ Kopyalandı' : '📋 Kopyala'}
            </button>
          </div>
        </section>
      )}

      {/* Erişilebilirlik */}
      <section className="rounded-xl border bg-card p-4 space-y-4">
        <h3 className="font-semibold">Erişilebilirlik</h3>
        {(
          [
            { key: 'largeFontMode', label: 'Büyük Yazı', desc: 'Daha büyük font boyutu' },
            { key: 'highContrast', label: 'Yüksek Kontrast', desc: 'Daha belirgin renkler' },
            { key: 'notifications', label: 'Bildirimler', desc: 'Görev ve etkinlik hatırlatmaları' },
          ] as { key: keyof AppSettings; label: string; desc: string }[]
        ).map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <button
              role="switch"
              aria-checked={settings[key] as boolean}
              onClick={() => onSettingsChange({ [key]: !settings[key] })}
              className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                settings[key] ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-1 ml-1 ${
                  settings[key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </section>

      {/* Çıkış */}
      <button
        onClick={onSignOut}
        className="w-full rounded-xl border border-destructive py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        aria-label="Hesaptan çıkış yap"
      >
        Çıkış Yap
      </button>
    </div>
  );
}

// ── Ana App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>({
    largeFontMode: false,
    highContrast: false,
    colorBlindMode: false,
    notifications: true,
    language: 'tr',
  });

  const { role, family, members } = useFamilyRole(profile?.id ?? null);

  // Auth durumunu dinle
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) setProfile(data as Profile);
    setIsAuthLoading(false);
  };

  // Ayarları localStorage'dan yükle
  useEffect(() => {
    const saved = localStorage.getItem('app-settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, []);

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem('app-settings', JSON.stringify(next));
      return next;
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  // Auth yükleniyor
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-bounce">🏠</div>
          <p className="text-muted-foreground text-sm">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Giriş yapmamış: Onboarding
  if (!profile) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Onboarding onComplete={(uid) => fetchProfile(uid)} />
      </Suspense>
    );
  }

  const sharedProps = {
    familyId: family?.id ?? '',
    userId: profile.id,
  };

  return (
    <HashRouter>
      <PWAUpdatePrompt />
      <Routes>
        <Route
          path="/"
          element={
            <Layout
              largeFontMode={settings.largeFontMode}
              highContrast={settings.highContrast}
            />
          }
        >
          {/* Default: Takvim */}
          <Route index element={<Navigate to="calendar" replace />} />

          <Route
            path="calendar"
            element={
              <Suspense fallback={<PageSkeleton />}>
                {sharedProps.familyId ? (
                  <Calendar
                    {...sharedProps}
                    members={members}
                    canCreate={role === 'parent' || role === 'child'}
                  />
                ) : (
                  <PageSkeleton />
                )}
              </Suspense>
            }
          />

          <Route
            path="tasks"
            element={
              <Suspense fallback={<PageSkeleton />}>
                {sharedProps.familyId && role ? (
                  role === 'child' && settings.largeFontMode ? (
                    <ChildMode
                      {...sharedProps}
                      userName={profile.full_name}
                      userColor={profile.color ?? '#6366f1'}
                    />
                  ) : (
                    <TaskBoard
                      {...sharedProps}
                      userRole={role}
                      members={members}
                    />
                  )
                ) : (
                  <PageSkeleton />
                )}
              </Suspense>
            }
          />

          <Route
            path="shopping"
            element={
              <Suspense fallback={<PageSkeleton />}>
                {sharedProps.familyId ? (
                  <ShoppingList
                    {...sharedProps}
                    canEdit={role !== 'guest'}
                  />
                ) : (
                  <PageSkeleton />
                )}
              </Suspense>
            }
          />

          <Route
            path="meals"
            element={
              <Suspense fallback={<PageSkeleton />}>
                {sharedProps.familyId ? (
                  <MealPlanner
                    {...sharedProps}
                    canEdit={role === 'parent'}
                  />
                ) : (
                  <PageSkeleton />
                )}
              </Suspense>
            }
          />

          <Route
            path="settings"
            element={
              <SettingsPage
                settings={settings}
                onSettingsChange={updateSettings}
                profile={profile}
                onSignOut={handleSignOut}
                inviteCode={family?.invite_code ?? null}
              />
            }
          />

          {/* 404 */}
          <Route path="*" element={<Navigate to="calendar" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
