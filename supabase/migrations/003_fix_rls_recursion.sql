-- ============================================================
-- 003_fix_rls_recursion.sql
-- family_members tablosundaki sonsuz döngü düzeltmesi
--
-- SORUN: family_members SELECT policy → is_family_member() →
--        family_members sorgula → policy tekrar tetiklenir → ∞
--
-- ÇÖZÜM: Yardımcı fonksiyonlara SET row_security = off ekle
--        family_members politikasını basit user_id kontrolüne indir
-- ============================================================

-- ── 1. Eski politikaları sil ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "family_members_select_same_family"  ON public.family_members;
DROP POLICY IF EXISTS "family_members_insert_self"         ON public.family_members;
DROP POLICY IF EXISTS "family_members_update_parent"       ON public.family_members;
DROP POLICY IF EXISTS "family_members_delete"              ON public.family_members;

-- Diğer tablolardaki eski politikaları da sil (fonksiyon değiştiği için)
DROP POLICY IF EXISTS "families_select_member"             ON public.families;
DROP POLICY IF EXISTS "families_update_parent"             ON public.families;
DROP POLICY IF EXISTS "families_delete_creator"            ON public.families;
DROP POLICY IF EXISTS "events_select_family_member"        ON public.events;
DROP POLICY IF EXISTS "events_insert_parent_child"         ON public.events;
DROP POLICY IF EXISTS "events_update_parent"               ON public.events;
DROP POLICY IF EXISTS "events_delete_parent_or_creator"    ON public.events;
DROP POLICY IF EXISTS "tasks_select"                       ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_parent_child"          ON public.tasks;
DROP POLICY IF EXISTS "tasks_update"                       ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete"                       ON public.tasks;
DROP POLICY IF EXISTS "shopping_select_family_member"      ON public.shopping_items;
DROP POLICY IF EXISTS "shopping_insert_parent_child"       ON public.shopping_items;
DROP POLICY IF EXISTS "shopping_update_parent"             ON public.shopping_items;
DROP POLICY IF EXISTS "shopping_delete"                    ON public.shopping_items;
DROP POLICY IF EXISTS "recipes_select_family_member"       ON public.recipes;
DROP POLICY IF EXISTS "recipes_insert_parent"              ON public.recipes;
DROP POLICY IF EXISTS "recipes_update_parent"              ON public.recipes;
DROP POLICY IF EXISTS "recipes_delete_parent"              ON public.recipes;
DROP POLICY IF EXISTS "meals_select_family_member"         ON public.meals;
DROP POLICY IF EXISTS "meals_insert_parent"                ON public.meals;
DROP POLICY IF EXISTS "meals_update_parent"                ON public.meals;
DROP POLICY IF EXISTS "meals_delete_parent"                ON public.meals;

-- ── 2. Yardımcı fonksiyonları row_security = off ile yeniden oluştur ─────────
--       SECURITY DEFINER + SET row_security = off → RLS bypass, döngü yok

CREATE OR REPLACE FUNCTION public.get_my_family_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
    SELECT family_id
    FROM public.family_members
    WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_family_member(p_family_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = p_family_id
          AND user_id   = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.get_my_family_role(p_family_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
    SELECT role
    FROM public.family_members
    WHERE family_id = p_family_id
      AND user_id   = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_family_parent(p_family_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = p_family_id
          AND user_id   = auth.uid()
          AND role      = 'parent'
    );
$$;

-- ── 3. family_members politikaları (döngüsüz) ────────────────────────────────
--       SELECT: kullanıcı kendi satırını + aynı ailedeki üyeleri görebilir
--       Önemli: kendi satırını bulmak için user_id = auth.uid() kullan (döngü yok)

-- Kendi üyelik satırını her zaman görebilir
CREATE POLICY "family_members_select_own"
    ON public.family_members FOR SELECT
    USING (user_id = auth.uid());

-- Aynı ailedeki diğer üyeleri görebilir (get_my_family_ids RLS bypass'la çalışır)
CREATE POLICY "family_members_select_same_family"
    ON public.family_members FOR SELECT
    USING (family_id IN (SELECT public.get_my_family_ids()));

-- Herkes kendini ekleyebilir (davet koduyla katılma)
CREATE POLICY "family_members_insert_self"
    ON public.family_members FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Sadece parent rol değiştirebilir
CREATE POLICY "family_members_update_parent"
    ON public.family_members FOR UPDATE
    USING  (public.is_family_parent(family_id))
    WITH CHECK (public.is_family_parent(family_id));

-- Parent üye çıkarabilir veya kullanıcı kendisi çıkabilir
CREATE POLICY "family_members_delete"
    ON public.family_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR public.is_family_parent(family_id)
    );

-- ── 4. families politikaları ─────────────────────────────────────────────────

CREATE POLICY "families_select_member"
    ON public.families FOR SELECT
    USING (id IN (SELECT public.get_my_family_ids()));

CREATE POLICY "families_update_parent"
    ON public.families FOR UPDATE
    USING  (public.is_family_parent(id))
    WITH CHECK (public.is_family_parent(id));

CREATE POLICY "families_delete_creator"
    ON public.families FOR DELETE
    USING (created_by = auth.uid());

-- ── 5. events politikaları ───────────────────────────────────────────────────

CREATE POLICY "events_select_family_member"
    ON public.events FOR SELECT
    USING (family_id IN (SELECT public.get_my_family_ids()));

CREATE POLICY "events_insert_parent_child"
    ON public.events FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND public.get_my_family_role(family_id) IN ('parent', 'child')
    );

CREATE POLICY "events_update_parent_or_creator"
    ON public.events FOR UPDATE
    USING (
        public.is_family_parent(family_id)
        OR (created_by = auth.uid() AND public.get_my_family_role(family_id) = 'child')
    )
    WITH CHECK (
        public.is_family_parent(family_id)
        OR (created_by = auth.uid() AND public.get_my_family_role(family_id) = 'child')
    );

CREATE POLICY "events_delete_parent_or_creator"
    ON public.events FOR DELETE
    USING (
        public.is_family_parent(family_id)
        OR (created_by = auth.uid() AND public.get_my_family_role(family_id) = 'child')
    );

-- ── 6. tasks politikaları ────────────────────────────────────────────────────

CREATE POLICY "tasks_select"
    ON public.tasks FOR SELECT
    USING (
        public.is_family_parent(family_id)
        OR (
            family_id IN (SELECT public.get_my_family_ids())
            AND (assigned_to = auth.uid() OR created_by = auth.uid())
        )
    );

CREATE POLICY "tasks_insert_parent_child"
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
    USING (
        public.is_family_parent(family_id)
        OR created_by = auth.uid()
    );

-- ── 7. shopping_items politikaları ───────────────────────────────────────────

CREATE POLICY "shopping_select_family_member"
    ON public.shopping_items FOR SELECT
    USING (family_id IN (SELECT public.get_my_family_ids()));

CREATE POLICY "shopping_insert_parent_child"
    ON public.shopping_items FOR INSERT
    WITH CHECK (
        added_by = auth.uid()
        AND public.get_my_family_role(family_id) IN ('parent', 'child')
    );

CREATE POLICY "shopping_update"
    ON public.shopping_items FOR UPDATE
    USING  (family_id IN (SELECT public.get_my_family_ids())
            AND public.get_my_family_role(family_id) IN ('parent', 'child'))
    WITH CHECK (family_id IN (SELECT public.get_my_family_ids())
                AND public.get_my_family_role(family_id) IN ('parent', 'child'));

CREATE POLICY "shopping_delete"
    ON public.shopping_items FOR DELETE
    USING (
        public.is_family_parent(family_id)
        OR added_by = auth.uid()
    );

-- ── 8. recipes politikaları ──────────────────────────────────────────────────

CREATE POLICY "recipes_select_family_member"
    ON public.recipes FOR SELECT
    USING (family_id IN (SELECT public.get_my_family_ids()));

CREATE POLICY "recipes_insert_parent"
    ON public.recipes FOR INSERT
    WITH CHECK (created_by = auth.uid() AND public.is_family_parent(family_id));

CREATE POLICY "recipes_update_parent"
    ON public.recipes FOR UPDATE
    USING  (public.is_family_parent(family_id))
    WITH CHECK (public.is_family_parent(family_id));

CREATE POLICY "recipes_delete_parent"
    ON public.recipes FOR DELETE
    USING (public.is_family_parent(family_id));

-- ── 9. meals politikaları ────────────────────────────────────────────────────

CREATE POLICY "meals_select_family_member"
    ON public.meals FOR SELECT
    USING (family_id IN (SELECT public.get_my_family_ids()));

CREATE POLICY "meals_insert_parent"
    ON public.meals FOR INSERT
    WITH CHECK (created_by = auth.uid() AND public.is_family_parent(family_id));

CREATE POLICY "meals_update_parent"
    ON public.meals FOR UPDATE
    USING  (public.is_family_parent(family_id))
    WITH CHECK (public.is_family_parent(family_id));

CREATE POLICY "meals_delete_parent"
    ON public.meals FOR DELETE
    USING (public.is_family_parent(family_id));

-- ── Doğrulama ────────────────────────────────────────────────────────────────
-- Çalıştırdıktan sonra test edin:
-- SELECT public.get_my_family_ids();          -- kendi family_id'leriniz
-- SELECT public.is_family_member('...');      -- üye misiniz?
-- SELECT * FROM family_members;               -- döngü olmadan çalışmalı
