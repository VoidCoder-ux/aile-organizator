/**
 * useFamilyRole Hook
 * Mevcut kullanıcının aile rolünü ve izinlerini sağlar.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase, TABLES } from '@/lib/supabaseClient';
import { getUserFamily } from '@/lib/auth';
import type { FamilyRole, Family, FamilyMember, Profile } from '@/types';

interface FamilyRoleState {
  role: FamilyRole | null;
  family: Family | null;
  member: FamilyMember | null;
  members: FamilyMember[];
  isLoading: boolean;
  // İzin sorgu metodları
  canManageMembers: boolean;
  canCreateEvents: boolean;
  canEditTasks: boolean;
  canViewAll: boolean;
  refresh: () => Promise<void>;
}

export function useFamilyRole(userId: string | null): FamilyRoleState {
  const [role, setRole] = useState<FamilyRole | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFamilyData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { family: fam, member: mem } = await getUserFamily(userId);
      setFamily(fam);
      setMember(mem);
      setRole(mem?.role ?? null);

      if (fam) {
        // Tüm aile üyelerini RPC ile getir (direkt sorgu RLS döngüsüne yol açar)
        const { data } = await supabase.rpc('get_family_members_list', {
          p_family_id: fam.id,
        });
        setMembers((data as FamilyMember[]) ?? []);
      }
    } catch (err) {
      console.error('[useFamilyRole] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFamilyData();
  }, [fetchFamilyData]);

  // Realtime: üye ekleme/değişikliklerini dinle
  useEffect(() => {
    if (!family?.id) return;

    const channel = supabase
      .channel(`family-members:${family.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.FAMILY_MEMBERS,
          filter: `family_id=eq.${family.id}`,
        },
        () => {
          fetchFamilyData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [family?.id, fetchFamilyData]);

  // İzin hesaplamaları
  const canManageMembers = role === 'parent';
  const canCreateEvents = role === 'parent' || role === 'child';
  const canEditTasks = role === 'parent' || role === 'child';
  const canViewAll = role === 'parent';

  return {
    role,
    family,
    member,
    members,
    isLoading,
    canManageMembers,
    canCreateEvents,
    canEditTasks,
    canViewAll,
    refresh: fetchFamilyData,
  };
}

// Rol bazlı filtreleme için yardımcı
export function filterByRole<T extends { assigned_to?: string | null; created_by?: string }>(
  items: T[],
  role: FamilyRole | null,
  userId: string | null
): T[] {
  if (!role || !userId) return [];
  if (role === 'parent') return items; // parent hepsini görür
  if (role === 'guest') return items; // guest okuyabilir
  // child: sadece kendine atanan veya kendinin oluşturduğu
  return items.filter(
    (item) =>
      item.assigned_to === userId || item.created_by === userId
  );
}

// Profil bilgisini members listesinden çek
export function getMemberProfile(
  members: FamilyMember[],
  userId: string
): Profile | undefined {
  return members.find((m) => m.user_id === userId)?.profiles;
}
