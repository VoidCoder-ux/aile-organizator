/**
 * App.tsx — Ana Uygulama
 * HashRouter en dışta — Onboarding dahil tüm bileşenler Router context'i içinde.
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { supabase } from '@/lib/supabaseClient';
import { useFamilyRole } from '@/hooks/useFamilyRole';
import Layout from '@/components/Layout';
import type { Profile, AppSettings } from '@/types';

const OnboardingComponent = lazy(() => import('@/components/Onboarding'));
const Calendar      = lazy(() => import('@/components/Calendar'));
const TaskBoard     = lazy(() => import('@/components/TaskBoard'));
const ShoppingList  = lazy(() => import('@/components/ShoppingList'));
const MealPlanner   = lazy(() => import('@/components/MealPlanner'));
const ChildMode     = lazy(() => import('@/components/ChildMode'));

// ── Skeleton ─────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-label="Yükleniyor..." aria-busy="true">
      {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
    </div>
  );
}

// ── PWA Güncelleme Prompt ─────────────────────────────────────────────────────
function PWAUpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div role="alert" className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl bg-primary p-4 text-white shadow-xl">
      <p className="text-sm font-medium mb-2">Yeni sürüm hazır!</p>
      <div className="flex gap-2">
        <button onClick={() => updateServiceWorker(true)}
          className="flex-1 rounded-lg bg-white text-primary py-1.5 text-sm font-semibold hover:bg-white/90">
          Güncelle
        </button>
        <button onClick={() => setNeedRefresh(false)}
          className="flex-1 rounded-lg border border-white/30 py-1.5 text-sm hover:bg-white/10">
          Sonra
        </button>
      </div>
    </div>
  );
}

// ── Settings Sayfası ─────────────────────────────────────────────────────────
function SettingsPage({
  settings, onSettingsChange, profile, onSignOut, inviteCode,
}: {
  settings: AppSettings;
  onSettingsChange: (s: Partial<AppSettings>) => void;
  profile: Profile | null;
  onSignOut: () => void;
  inviteCode: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const copyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="font-bold text-xl">Ayarlar</h2>
      {profile && (
        <section className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold mb-3">Profil</h3>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full flex items-center justify-center text-xl font-bold text-white"
              style={{ backgroundColor: profile.color ?? '#6366f1' }}>
              {profile.full_name?.charAt(0)}
            </div>
            <div>
              <p className="font-medium">{profile.full_name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>
        </section>
      )}

      {inviteCode && (
        <section className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold mb-2">Aile Davet Kodu</h3>
          <p className="text-sm text-muted-foreground mb-2">Bu kodu aile üyeleriyle paylaşın.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-muted px-4 py-2 text-xl font-bold font-mono tracking-widest text-center">
              {inviteCode}
            </code>
            <button onClick={copyCode} className="rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors">
              {copied ? '✅ Kopyalandı' : '📋 Kopyala'}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card p-4 space-y-4">
        <h3 className="font-semibold">Erişilebilirlik</h3>
        {([
          { key: 'largeFontMode' as const, label: 'Büyük Yazı', desc: 'Daha büyük font boyutu' },
          { key: 'highContrast' as const, label: 'Yüksek Kontrast', desc: 'Daha belirgin renkler' },
          { key: 'notifications' as const, label: 'Bildirimler', desc: 'Hatırlatmalar' },
        ]).map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <button role="switch" aria-checked={settings[key] as boolean}
              onClick={() => onSettingsChange({ [key]: !settings[key] })}
              className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${settings[key] ? 'bg-primary' : 'bg-muted'}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-1 ml-1 ${settings[key] ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </section>

      <button onClick={onSignOut}
        className="w-full rounded-xl border border-destructive py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
        Çıkış Yap
      </button>
    </div>
  );
}

// ── Onboarding Wrapper (Router içinde navigate için) ──────────────────────────
function OnboardingRoute({ onComplete }: { onComplete: (uid: string) => void }) {
  const navigate = useNavigate();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OnboardingComponent onComplete={(uid) => {
        onComplete(uid);
        navigate('/calendar');
      }} />
    </Suspense>
  );
}

// ── Ana İçerik (auth sonrası) ─────────────────────────────────────────────────
function AppContent({
  profile,
  settings,
  onSettingsChange,
  onSignOut,
  onProfileLoaded,
}: {
  profile: Profile | null;
  settings: AppSettings;
  onSettingsChange: (s: Partial<AppSettings>) => void;
  onSignOut: () => void;
  onProfileLoaded: (uid: string) => void;
}) {
  const { role, family, members, isLoading: familyLoading } = useFamilyRole(profile?.id ?? null);

  // Aile + profil hazır değilse bileşenleri render etme (boş string familyId RLS sorgularını bozar)
  const isReady = !!family && !!profile;
  const sharedProps = { familyId: family?.id ?? '', userId: profile?.id ?? '' };

  // Profil var ama aile yok → onboarding'e geri yönlendir
  const noFamily = !familyLoading && profile && !family;

  return (
    <>
      <PWAUpdatePrompt />
      <Routes>
        {/* Onboarding — giriş yapılmamış veya aile kurulmamış */}
        <Route path="/onboarding" element={<OnboardingRoute onComplete={onProfileLoaded} />} />

        {/* Auth guard: profil yoksa veya aile yoksa onboarding'e */}
        <Route path="/" element={
          noFamily
            ? <Navigate to="/onboarding" replace />
            : profile
              ? <Layout largeFontMode={settings.largeFontMode} highContrast={settings.highContrast} userId={profile?.id ?? null} familyId={family?.id ?? null} />
              : <Navigate to="/onboarding" replace />
        }>
          <Route index element={<Navigate to="calendar" replace />} />

          <Route path="calendar" element={
            <Suspense fallback={<PageSkeleton />}>
              {!isReady
                ? <PageSkeleton />
                : <Calendar {...sharedProps} members={members} canCreate={role === 'parent' || role === 'child'} />}
            </Suspense>
          } />

          <Route path="tasks" element={
            <Suspense fallback={<PageSkeleton />}>
              {!isReady
                ? <PageSkeleton />
                : role === 'child' && settings.largeFontMode
                  ? <ChildMode {...sharedProps} userName={profile?.full_name ?? ''} userColor={profile?.color ?? '#6366f1'} />
                  : <TaskBoard {...sharedProps} userRole={role ?? 'guest'} members={members} />}
            </Suspense>
          } />

          <Route path="shopping" element={
            <Suspense fallback={<PageSkeleton />}>
              {!isReady
                ? <PageSkeleton />
                : <ShoppingList {...sharedProps} canEdit={role !== 'guest'} />}
            </Suspense>
          } />

          <Route path="meals" element={
            <Suspense fallback={<PageSkeleton />}>
              {!isReady
                ? <PageSkeleton />
                : <MealPlanner {...sharedProps} canEdit={role === 'parent'} />}
            </Suspense>
          } />

          <Route path="settings" element={
            <SettingsPage
              settings={settings}
              onSettingsChange={onSettingsChange}
              profile={profile}
              onSignOut={onSignOut}
              inviteCode={family?.invite_code ?? null}
            />
          } />

          <Route path="*" element={<Navigate to="calendar" replace />} />
        </Route>

        {/* Kök yönlendirme */}
        <Route path="*" element={<Navigate to={profile ? '/calendar' : '/onboarding'} replace />} />
      </Routes>
    </>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>({
    largeFontMode: false, highContrast: false,
    colorBlindMode: false, notifications: true, language: 'tr',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfile(session.user.id);
      else setIsAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setIsAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) setProfile(data as Profile);
    setIsAuthLoading(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem('app-settings');
    if (saved) { try { setSettings(JSON.parse(saved)); } catch { /* ignore */ } }
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

  return (
    <HashRouter>
      <AppContent
        profile={profile}
        settings={settings}
        onSettingsChange={updateSettings}
        onSignOut={handleSignOut}
        onProfileLoaded={(uid) => fetchProfile(uid)}
      />
    </HashRouter>
  );
}
