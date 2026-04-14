-- ============================================================
-- 006_complete_rls_reset.sql
-- TÜM TABLOLARDA TÜM POLİTİKALARI SİL VE SIFIRDAN OLUŞTUR
--
-- Kural: family_members SELECT → SADECE user_id = auth.uid()
--        Diğer tablolar → family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
--        Döngü riski SIFIR.
-- ============================================================

-- ── 0. Tüm mevcut policy'leri sil ────────────────────────────────────────────
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END;
$$;

-- ── 1. RLS aktif ──────────────────────────────────────────────────────────────
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals          ENABLE ROW LEVEL SECURITY;

-- ── 2. Yardımcı fonksiyonlar ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_family_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_family_member(p_family_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = p_family_id AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.get_my_family_role(p_family_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role FROM public.family_members
    WHERE family_id = p_family_id AND user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_family_parent(p_family_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = p_family_id AND user_id = auth.uid() AND role = 'parent'
    );
$$;

-- Aile üyelerinin profile id'leri (profiles policy'si için)
CREATE OR REPLACE FUNCTION public.get_my_family_member_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
SET row_security = off AS $$
    SELECT DISTINCT fm2.user_id
    FROM public.family_members fm1
    JOIN public.family_members fm2 ON fm2.family_id = fm1.family_id
    WHERE fm1.user_id = auth.uid();
$$;

-- Aile üyelerini profilleriyle getiren RPC
CREATE OR REPLACE FUNCTION public.get_family_members_list(p_family_id UUID)
RETURNS TABLE (
    id UUID, family_id UUID, user_id UUID,
    role TEXT, joined_at TIMESTAMPTZ, profiles JSONB
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
SET row_security = off AS $$
    SELECT fm.id, fm.family_id, fm.user_id, fm.role, fm.joined_at,
           to_jsonb(p) AS profiles
    FROM public.family_members fm
    LEFT JOIN public.profiles p ON p.id = fm.user_id
    WHERE fm.family_id = p_family_id
      AND EXISTS (SELECT 1 FROM public.family_members WHERE family_id = p_family_id AND user_id = auth.uid())
    ORDER BY fm.joined_at ASC;
$$;

-- ══════════════════════════════════════════════════════════════
-- PROFILES
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "profiles_select_family"
    ON public.profiles FOR SELECT
    USING (id IN (SELECT public.get_my_family_member_ids()));

CREATE POLICY "profiles_insert_own"
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- FAMILIES
-- ══════════════════════════════════════════════════════════════

-- Herhangi bir authenticated kullanıcı aileler arasında arama yapabilir (davet kodu)
CREATE POLICY "families_select"
    ON public.families FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Authenticated kullanıcı aile oluşturabilir
CREATE POLICY "families_insert"
    ON public.families FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "families_update_parent"
    ON public.families FOR UPDATE
    USING (public.is_family_parent(id))
    WITH CHECK (public.is_family_parent(id));

CREATE POLICY "families_delete_creator"
    ON public.families FOR DELETE
    USING (created_by = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- FAMILY_MEMBERS  ⚠️ SELECT sadece user_id = auth.uid()
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "fm_select_own"
    ON public.family_members FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "fm_insert_self"
    ON public.family_members FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "fm_update_parent"
    ON public.family_members FOR UPDATE
    USING (public.is_family_parent(family_id))
    WITH CHECK (public.is_family_parent(family_id));

CREATE POLICY "fm_delete"
    ON public.family_members FOR DELETE
    USING (user_id = auth.uid() OR public.is_family_parent(family_id));

-- ══════════════════════════════════════════════════════════════
-- EVENTS
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "events_select"
    ON public.events FOR SELECT
    USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "events_insert"
    ON public.events FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND public.get_my_family_role(family_id) IN ('parent', 'child')
    );

CREATE POLICY "events_update"
    ON public.events FOR UPDATE
    USING (
        public.is_family_parent(family_id)
        OR (created_by = auth.uid() AND public.get_my_family_role(family_id) = 'child')
    )
    WITH CHECK (
        public.is_family_parent(family_id)
        OR (created_by = auth.uid() AND public.get_my_family_role(family_id) = 'child')
    );

CREATE POLICY "events_delete"
    ON public.events FOR DELETE
    USING (
        public.is_family_parent(family_id)
        OR (created_by = auth.uid() AND public.get_my_family_role(family_id) = 'child')
    );

-- ══════════════════════════════════════════════════════════════
-- TASKS
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "tasks_select"
    ON public.tasks FOR SELECT
    USING (
        family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
        AND (
            public.is_family_parent(family_id)
            OR assigned_to = auth.uid()
            OR created_by = auth.uid()
        )
    );

CREATE POLICY "tasks_insert"
    ON public.tasks FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND public.get_my_family_role(family_id) IN ('parent', 'child')
    );

CREATE POLICY "tasks_update"
    ON public.tasks FOR UPDATE
    USING (
        public.is_family_parent(family_id)
        OR (assigned_to = auth.uid() AND public.get_my_family_role(family_id) = 'child')
    )
    WITH CHECK (
        public.is_family_parent(family_id)
        OR (assigned_to = auth.uid() AND public.get_my_family_role(family_id) = 'child')
    );

CREATE POLICY "tasks_delete"
    ON public.tasks FOR DELETE
    USING (public.is_family_parent(family_id) OR created_by = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- SHOPPING_ITEMS
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "shopping_select"
    ON public.shopping_items FOR SELECT
    USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "shopping_insert"
    ON public.shopping_items FOR INSERT
    WITH CHECK (
        added_by = auth.uid()
        AND public.get_my_family_role(family_id) IN ('parent', 'child')
    );

CREATE POLICY "shopping_update"
    ON public.shopping_items FOR UPDATE
    USING (
        family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
        AND public.get_my_family_role(family_id) IN ('parent', 'child')
    )
    WITH CHECK (
        family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
        AND public.get_my_family_role(family_id) IN ('parent', 'child')
    );

CREATE POLICY "shopping_delete"
    ON public.shopping_items FOR DELETE
    USING (public.is_family_parent(family_id) OR added_by = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- RECIPES
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "recipes_select"
    ON public.recipes FOR SELECT
    USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "recipes_insert"
    ON public.recipes FOR INSERT
    WITH CHECK (created_by = auth.uid() AND public.is_family_parent(family_id));

CREATE POLICY "recipes_update"
    ON public.recipes FOR UPDATE
    USING (public.is_family_parent(family_id))
    WITH CHECK (public.is_family_parent(family_id));

CREATE POLICY "recipes_delete"
    ON public.recipes FOR DELETE
    USING (public.is_family_parent(family_id));

-- ══════════════════════════════════════════════════════════════
-- MEALS
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "meals_select"
    ON public.meals FOR SELECT
    USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "meals_insert"
    ON public.meals FOR INSERT
    WITH CHECK (created_by = auth.uid() AND public.is_family_parent(family_id));

CREATE POLICY "meals_update"
    ON public.meals FOR UPDATE
    USING (public.is_family_parent(family_id))
    WITH CHECK (public.is_family_parent(family_id));

CREATE POLICY "meals_delete"
    ON public.meals FOR DELETE
    USING (public.is_family_parent(family_id));

-- ══════════════════════════════════════════════════════════════
SELECT 'TÜM RLS POLİTİKALARI BAŞARIYLA OLUŞTURULDU' AS durum;
