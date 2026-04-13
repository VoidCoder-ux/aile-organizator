/**
 * Onboarding — <30 saniye kurulum akışı
 * Adımlar: Hoş geldin → Hesap Oluştur → Aile Kur/Katıl → Rol Seç → Demo
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, LogIn, ChevronRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { signUpWithEmail, signInWithEmail, createFamily, joinFamily } from '@/lib/auth';
import type { FamilyRole } from '@/types';

type OnboardingStep = 'welcome' | 'auth' | 'family' | 'role' | 'demo';
type AuthMode = 'signup' | 'signin';
type FamilyMode = 'create' | 'join';

const ROLE_OPTIONS: { role: FamilyRole; label: string; desc: string; emoji: string }[] = [
  { role: 'parent', label: 'Ebeveyn', desc: 'Tam yönetim yetkisi', emoji: '👨‍👩‍👧' },
  { role: 'child', label: 'Çocuk', desc: 'Görevler ve alışveriş', emoji: '🧒' },
  { role: 'guest', label: 'Misafir', desc: 'Sadece görüntüleme', emoji: '👀' },
];

interface OnboardingProps {
  onComplete: (userId: string) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [familyMode, setFamilyMode] = useState<FamilyMode>('create');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form alanları
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [selectedRole, setSelectedRole] = useState<FamilyRole>('parent');
  const [userId, setUserId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);

  const clearError = () => setError(null);

  // ── Adım: Auth ────────────────────────────────────────────────────────────

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();

    try {
      if (authMode === 'signup') {
        const { error: err } = await signUpWithEmail(email, password, fullName);
        if (err) throw new Error(err);
      } else {
        const { error: err } = await signInWithEmail(email, password);
        if (err) throw new Error(err);
      }

      // Auth başarılı — user id'yi al
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Kullanıcı bilgisi alınamadı');

      setUserId(user.id);
      setStep('family');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Adım: Aile ───────────────────────────────────────────────────────────

  const handleFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setIsLoading(true);
    clearError();

    try {
      if (familyMode === 'create') {
        const { family, error: err } = await createFamily(userId, familyName);
        if (err || !family) throw new Error(err ?? 'Aile oluşturulamadı');
        setFamilyId(family.id);
      } else {
        const { family, error: err } = await joinFamily(userId, inviteCode, selectedRole);
        if (err || !family) throw new Error(err ?? 'Aileye katılınamadı');
        setFamilyId(family.id);
      }
      setStep('role');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Adım: Rol ────────────────────────────────────────────────────────────

  const handleRoleSelect = async () => {
    if (!userId || !familyId) return;
    setIsLoading(true);
    // joinFamily sırasında rol zaten ayarlandı, burada ek işlem gerekmez
    setIsLoading(false);
    setStep('demo');
  };

  // ── Adım: Demo Tamamlandı ─────────────────────────────────────────────────

  const handleComplete = () => {
    if (userId) {
      onComplete(userId);
      navigate('/calendar');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const steps: OnboardingStep[] = ['welcome', 'auth', 'family', 'role', 'demo'];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white text-3xl mb-3 shadow-lg">
            🏠
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Akıllı Aile Organizatörü</h1>
          <p className="text-muted-foreground text-sm mt-1">Ailenizi düzenli tutun</p>
        </div>

        {/* İlerleme çubuğu */}
        {step !== 'welcome' && (
          <div className="flex gap-1 mb-6" role="progressbar" aria-valuenow={stepIndex} aria-valuemax={4}>
            {steps.slice(1).map((s, i) => (
              <div
                key={s}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  i < stepIndex ? 'bg-primary' : 'bg-gray-200'
                )}
              />
            ))}
          </div>
        )}

        {/* ── Hoş Geldin ── */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div className="grid grid-cols-2 gap-4 text-left">
              {[
                { emoji: '🗓️', title: 'Takvim', desc: 'Aile etkinlikleri' },
                { emoji: '✅', title: 'Görevler', desc: 'Paylaşımlı liste' },
                { emoji: '🛒', title: 'Alışveriş', desc: 'Gerçek zamanlı' },
                { emoji: '🍽️', title: 'Yemekler', desc: 'Haftalık plan' },
              ].map((f) => (
                <div key={f.title} className="rounded-xl bg-white p-4 shadow-sm border">
                  <div className="text-2xl mb-1">{f.emoji}</div>
                  <div className="font-semibold text-sm">{f.title}</div>
                  <div className="text-xs text-muted-foreground">{f.desc}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep('auth')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-white font-semibold text-lg shadow-lg hover:bg-primary/90 transition-colors"
              aria-label="Başla"
            >
              Hemen Başla
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* ── Auth ── */}
        {step === 'auth' && (
          <div className="bg-white rounded-2xl p-6 shadow-md border">
            <div className="flex gap-2 mb-6">
              {(['signup', 'signin'] as AuthMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setAuthMode(m); clearError(); }}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                    authMode === m ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {m === 'signup' ? 'Kayıt Ol' : 'Giriş Yap'}
                </button>
              ))}
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium mb-1">Ad Soyad</label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Ahmet Yılmaz"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    autoComplete="name"
                  />
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">E-posta</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ornek@mail.com"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">Şifre</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="En az 6 karakter"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-lg p-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-white font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {authMode === 'signup' ? 'Kayıt Ol' : 'Giriş Yap'}
              </button>
            </form>
          </div>
        )}

        {/* ── Aile ── */}
        {step === 'family' && (
          <div className="bg-white rounded-2xl p-6 shadow-md border">
            <h2 className="font-bold text-lg mb-4">Ailenizi Kurun</h2>
            <div className="flex gap-2 mb-6">
              {(['create', 'join'] as FamilyMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setFamilyMode(m); clearError(); }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
                    familyMode === m ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {m === 'create' ? <><Home className="h-4 w-4" /> Yeni Aile</> : <><LogIn className="h-4 w-4" /> Katıl</>}
                </button>
              ))}
            </div>

            <form onSubmit={handleFamily} className="space-y-4">
              {familyMode === 'create' ? (
                <div>
                  <label htmlFor="familyName" className="block text-sm font-medium mb-1">Aile Adı</label>
                  <input
                    id="familyName"
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    required
                    placeholder="Yılmaz Ailesi"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="inviteCode" className="block text-sm font-medium mb-1">Davet Kodu</label>
                  <input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    required
                    maxLength={6}
                    placeholder="ABC123"
                    className="w-full rounded-lg border px-3 py-2 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Aile üyenizden 6 haneli kodu alın</p>
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-lg p-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-white font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {familyMode === 'create' ? 'Aile Oluştur' : 'Aileye Katıl'}
              </button>
            </form>
          </div>
        )}

        {/* ── Rol Seçimi ── */}
        {step === 'role' && (
          <div className="bg-white rounded-2xl p-6 shadow-md border">
            <h2 className="font-bold text-lg mb-4">Rolünüzü Seçin</h2>
            <div className="space-y-3 mb-6">
              {ROLE_OPTIONS.map(({ role, label, desc, emoji }) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={cn(
                    'w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all',
                    selectedRole === role
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                  aria-pressed={selectedRole === role}
                >
                  <span className="text-3xl" aria-hidden="true">{emoji}</span>
                  <div>
                    <div className="font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={handleRoleSelect}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-white font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Devam Et
            </button>
          </div>
        )}

        {/* ── Demo / Hazır ── */}
        {step === 'demo' && (
          <div className="bg-white rounded-2xl p-8 shadow-md border text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <h2 className="font-bold text-xl">Hazırsınız!</h2>
            <p className="text-muted-foreground text-sm">
              Ailenizle birlikte organize olmaya hazırsınız. Takvim, görevler ve alışveriş listeniz sizi bekliyor.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-indigo-50 p-3">
                <div className="font-semibold text-indigo-700">Çevrimdışı Mod</div>
                <div className="text-xs text-indigo-600">İnternetsiz de çalışır</div>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <div className="font-semibold text-green-700">Anlık Senkron</div>
                <div className="text-xs text-green-600">Tüm cihazlarda güncellenir</div>
              </div>
            </div>
            <button
              onClick={handleComplete}
              className="w-full rounded-lg bg-primary py-3 text-white font-semibold hover:bg-primary/90 transition-colors"
            >
              Uygulamayı Aç
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
