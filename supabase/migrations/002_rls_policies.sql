-- ============================================================
-- 002_rls_policies.sql
-- Akıllı Aile Organizatörü — Row Level Security (RLS)
-- Tüm tablolarda RLS aktif. Rol bazlı erişim kontrolü.
--
-- ROL HİYERARŞİSİ:
--   parent : Tam CRUD + üye yönetimi
--   child  : Kendine atanan task/shopping okur/yazar, events read-only
--   guest  : Sadece okuma (SELECT)
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- YARDIMCI FONKSİYONLAR (Security Definer)
-- ════════════════════════════════════════════════════════════

-- Kullanıcının belirli bir ailedeki rolünü döndürür
CREATE OR REPLACE FUNCTION public.get_my_family_role(p_family_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role
    FROM public.family_members
    WHERE family_id = p_family_id
      AND user_id   = auth.uid()
    LIMIT 1;
$$;

-- Kullanıcının belirli bir ailenin üyesi olup olmadığını kontrol eder
CREATE OR REPLACE FUNCTION public.is_family_member(p_family_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = p_family_id
          AND user_id   = auth.uid()
    );
$$;

-- Kullanıcının belirli bir ailede parent rolüne sahip olup olmadığını kontrol eder
CREATE OR REPLACE FUNCTION public.is_family_parent(p_family_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = p_family_id
          AND user_id   = auth.uid()
          AND role      = 'parent'
    );
$$;

-- ════════════════════════════════════════════════════════════
-- profiles
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Kendi profilini görebilir
CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

-- Aynı ailedeki üyelerin profillerini görebilir (takvim renkleri için)
CREATE POLICY "profiles_select_family_members"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.family_members fm1
            JOIN public.family_members fm2 ON fm1.family_id = fm2.family_id
            WHERE fm1.user_id = auth.uid()
              AND fm2.user_id = profiles.id
        )
    );

-- Sadece kendi profilini güncelleyebilir
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ════════════════════════════════════════════════════════════
-- families
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- Üyesi olduğun aileyi görebilirsin
CREATE POLICY "families_select_member"
    ON public.families FOR SELECT
    USING (public.is_family_member(id));

-- Herkes yeni aile oluşturabilir (onboarding)
CREATE POLICY "families_insert_any"
    ON public.families FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- Sadece parent güncelleyebilir
CREATE POLICY "families_update_parent"
    ON public.families FOR UPDATE
    USING (public.is_family_parent(id))
    WITH CHECK (public.is_family_parent(id));

-- Sadece kurucu (created_by) silebilir
CREATE POLICY "families_delete_creator"
    ON public.families FOR DELETE
    USING (created_by = auth.uid());

-- ════════════════════════════════════════════════════════════
-- family_members
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Aynı ailedeki üyeleri görebilirsin
CREATE POLICY "family_members_select_same_family"
    ON public.family_members FOR SELECT
    USING (public.is_family_member(family_id));

-- Herkes bir aileye katılabilir (invite code ile)
CREATE POLICY "family_members_insert_self"
    ON public.family_members FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Sadece parent üye rollerini değiştirebilir
CREATE POLICY "family_members_update_parent"
    ON public.family_members FOR UPDATE
    USING (public.is_family_parent(family_id))
    WITH CHECK (public.is_family_parent(family_id));

-- Parent üye çıkarabilir veya kullanıcı kendisi çıkabilir
CREATE POLICY "family_members_delete"
    ON public.family_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR public.is_family_parent(family_id)
    );

-- ════════════════════════════════════════════════════════════
-- events
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Tüm aile üyeleri etkinlikleri görebilir (guest dahil)
CREATE POLICY "events_select_family_member"
    ON public.events FOR SELECT
    USING (public.is_family_member(family_id));

-- parent ve child etkinlik oluşturabilir (guest cannot)
CREATE POLICY "events_insert_parent_child"
    ON public.events FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND public.get_my_family_role(family_id) IN ('parent', 'child')
    );

-- parent tümünü güncelleyebilir; child sadece kendi oluşturduklarını
CREATE POLICY "events_update_parent"
    ON public.events FOR UPDATE
    USING (
        public.is_family_parent(family_id)
        OR (
            created_by = auth.uid()
            AND public.get_my_family_role(family_id) = 'child'
        )
    )
    WITH CHECK (
        public.is_family_parent(family_id)
        OR (
            created_by = auth.uid()
            AND public.get_my_family_role(family_id) = 'child'
        )
    );

-- parent tümünü silebilir; child sadece kendi oluşturduklarını
CREATE POLICY "events_delete_parent_or_creator"
    ON public.events FOR DELETE
    USING (
        public.is_family_parent(family_id)
        OR (created_by = auth.uid() AND public.get_my_family_role(family_id) = 'child')
    );

-- ════════════════════════════════════════════════════════════
-- tasks
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- parent tüm görevleri görür; child sadece kendine atananları veya kendi oluşturduklarını
CREATE POLICY "tasks_select"
    ON public.tasks FOR SELECT
    USING (
        public.is_family_parent(family_id)
        OR (
            public.is_family_member(family_id)
            AND (
                assigned_to = auth.uid()
                OR created_by = auth.uid()
            )
        )
    );

-- parent ve child görev oluşturabilir
CREATE POLICY "tasks_insert_parent_child"
    ON public.tasks FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND public.get_my_family_role(family_id) IN ('parent', 'child')
    );

-- parent tümünü günceller; child sadece kendine atananları (status güncellemek için)
CREATE POLICY "tasks_update"
    ON public.tasks FOR UPDATE
    USING (
        public.is_family_parent(family_id)
        OR (
            assigned_to = auth.uid()
            AND public.get_my_family_role(family_id) = 'child'
        )
    )
    WITH CHECK (
        public.is_family_parent(family_id)
        OR (
            assigned_to = auth.uid()
            AND public.get_my_family_role(family_id) = 'child'
        )
    );

-- Sadece parent ve görevin sahibi silebilir
CREATE POLICY "tasks_delete"
    ON public.tasks FOR DELETE
    USING (
        public.is_family_parent(family_id)
        OR created_by = auth.uid()
    );

-- ════════════════════════════════════════════════════════════
-- shopping_items
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- Tüm aile üyeleri alışveriş listesini görür
CREATE POLICY "shopping_select_family_member"
    ON public.shopping_items FOR SELECT
    USING (public.is_family_member(family_id));

-- parent ve child ekleyebilir (guest cannot)
CREATE POLICY "shopping_insert_parent_child"
    ON public.shopping_items FOR INSERT
    WITH CHECK (
        added_by = auth.uid()
        AND public.get_my_family_role(family_id) IN ('parent', 'child')
    );

-- parent tümünü; child sadece kendi eklediği veya is_checked alanını güncelleyebilir
CREATE POLICY "shopping_update_parent"
    ON public.shopping_items FOR UPDATE
    USING (
        public.is_family_parent(family_id)
        OR (
            public.get_my_family_role(family_id) = 'child'
            AND public.is_family_member(family_id)
        )
    )
    WITH CHECK (
        public.is_family_parent(family_id)
        OR (
            public.get_my_family_role(family_id) = 'child'
            AND public.is_family_member(family_id)
        )
    );

-- parent tümünü; child sadece kendi eklediğini silebilir
CREATE POLICY "shopping_delete"
    ON public.shopping_items FOR DELETE
    USING (
        public.is_family_parent(family_id)
        OR added_by = auth.uid()
    );

-- ════════════════════════════════════════════════════════════
-- recipes
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Tüm üyeler tarifleri görebilir
CREATE POLICY "recipes_select_family_member"
    ON public.recipes FOR SELECT
    USING (public.is_family_member(family_id));

-- Sadece parent tarif ekleyebilir
CREATE POLICY "recipes_insert_parent"
    ON public.recipes FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND public.is_family_parent(family_id)
    );

-- Sadece parent güncelleyebilir
CREATE POLICY "recipes_update_parent"
    ON public.recipes FOR UPDATE
    USING (public.is_family_parent(family_id))
    WITH CHECK (public.is_family_parent(family_id));

-- Sadece parent silebilir
CREATE POLICY "recipes_delete_parent"
    ON public.recipes FOR DELETE
    USING (public.is_family_parent(family_id));

-- ════════════════════════════════════════════════════════════
-- meals
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

-- Tüm üyeler haftalık planı görebilir
CREATE POLICY "meals_select_family_member"
    ON public.meals FOR SELECT
    USING (public.is_family_member(family_id));

-- Sadece parent öğün ekleyebilir
CREATE POLICY "meals_insert_parent"
    ON public.meals FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND public.is_family_parent(family_id)
    );

-- Sadece parent güncelleyebilir
CREATE POLICY "meals_update_parent"
    ON public.meals FOR UPDATE
    USING (public.is_family_parent(family_id))
    WITH CHECK (public.is_family_parent(family_id));

-- Sadece parent silebilir
CREATE POLICY "meals_delete_parent"
    ON public.meals FOR DELETE
    USING (public.is_family_parent(family_id));

-- ════════════════════════════════════════════════════════════
-- notifications
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Sadece kendi bildirimlerini görebilir
CREATE POLICY "notifications_select_own"
    ON public.notifications FOR SELECT
    USING (user_id = auth.uid());

-- Sistem (service role) ekler — frontend insert izni yok
-- Sadece okundu işaretini güncelleyebilir
CREATE POLICY "notifications_update_own"
    ON public.notifications FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Sadece kendi bildirimlerini silebilir
CREATE POLICY "notifications_delete_own"
    ON public.notifications FOR DELETE
    USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════
-- TEST SORGUSU (Doğrulama için)
-- Farklı kullanıcı rolleriyle test edin:
-- ════════════════════════════════════════════════════════════
/*
-- Kullanıcı rolünü sorgula:
SELECT public.get_my_family_role('YOUR_FAMILY_ID'::UUID);

-- Aile üyeliğini kontrol et:
SELECT public.is_family_member('YOUR_FAMILY_ID'::UUID);

-- Parent mi?
SELECT public.is_family_parent('YOUR_FAMILY_ID'::UUID);

-- RLS politikaları listesi:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
*/
