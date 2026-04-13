/**
 * Auth Yardımcı Fonksiyonları
 * Email/password + Magic link + Aile davet kodu sistemi
 */

import { supabase, TABLES } from './supabaseClient';
import { generateInviteCode, generateId } from './utils';
import type { Profile, Family, FamilyMember, FamilyRole } from '@/types';

// ── Kayıt & Giriş ─────────────────────────────────────────────────────────────

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/aile-organizator/auth/callback`,
    },
  });
  return { error: error?.message ?? null };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signInWithMagicLink(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/aile-organizator/auth/callback`,
    },
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ── Profil İşlemleri ──────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from(TABLES.PROFILES)
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'color'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(TABLES.PROFILES)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

// ── Aile İşlemleri ────────────────────────────────────────────────────────────

/** Yeni aile oluştur ve kurucu kullanıcıyı parent olarak ekle */
export async function createFamily(
  userId: string,
  familyName: string
): Promise<{ family: Family | null; error: string | null }> {
  const inviteCode = generateInviteCode();
  const familyId = generateId();

  const { data: family, error: familyError } = await supabase
    .from(TABLES.FAMILIES)
    .insert({
      id: familyId,
      name: familyName,
      invite_code: inviteCode,
      created_by: userId,
    })
    .select()
    .single();

  if (familyError || !family) {
    return { family: null, error: familyError?.message ?? 'Aile oluşturulamadı' };
  }

  // Kurucu kullanıcıyı parent olarak ekle
  const { error: memberError } = await supabase
    .from(TABLES.FAMILY_MEMBERS)
    .insert({
      family_id: familyId,
      user_id: userId,
      role: 'parent' as FamilyRole,
    });

  if (memberError) {
    return { family: null, error: memberError.message };
  }

  return { family: family as Family, error: null };
}

/** Davet koduyla aileye katıl */
export async function joinFamily(
  userId: string,
  inviteCode: string,
  role: FamilyRole = 'child'
): Promise<{ family: Family | null; error: string | null }> {
  // Aileyi davet koduyla bul
  const { data: family, error: findError } = await supabase
    .from(TABLES.FAMILIES)
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .single();

  if (findError || !family) {
    return { family: null, error: 'Geçersiz davet kodu. Tekrar kontrol edin.' };
  }

  // Zaten üye mi?
  const { data: existing } = await supabase
    .from(TABLES.FAMILY_MEMBERS)
    .select('id')
    .eq('family_id', family.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return { family: family as Family, error: null }; // Zaten üye, hata değil
  }

  // Üye ekle
  const { error: joinError } = await supabase
    .from(TABLES.FAMILY_MEMBERS)
    .insert({
      family_id: family.id,
      user_id: userId,
      role,
    });

  if (joinError) {
    return { family: null, error: joinError.message };
  }

  return { family: family as Family, error: null };
}

/** Kullanıcının aile bilgisini çek */
export async function getUserFamily(
  userId: string
): Promise<{ family: Family | null; member: FamilyMember | null }> {
  const { data: member } = await supabase
    .from(TABLES.FAMILY_MEMBERS)
    .select('*, families(*)')
    .eq('user_id', userId)
    .maybeSingle();

  if (!member) return { family: null, member: null };

  const typedMember = member as FamilyMember & { families: Family };
  return { family: typedMember.families, member: typedMember };
}

/** Aile davet kodunu yenile (sadece parent) */
export async function regenerateInviteCode(
  familyId: string
): Promise<{ code: string | null; error: string | null }> {
  const newCode = generateInviteCode();
  const { error } = await supabase
    .from(TABLES.FAMILIES)
    .update({ invite_code: newCode, updated_at: new Date().toISOString() })
    .eq('id', familyId);

  if (error) return { code: null, error: error.message };
  return { code: newCode, error: null };
}

/** Üye rolünü güncelle (sadece parent yapabilir) */
export async function updateMemberRole(
  memberId: string,
  role: FamilyRole
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(TABLES.FAMILY_MEMBERS)
    .update({ role })
    .eq('id', memberId);
  return { error: error?.message ?? null };
}
