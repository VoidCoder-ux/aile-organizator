-- ============================================================
-- 007_inline_policies.sql
-- SECURITY DEFINER fonksiyon çağrısı yerine inline subquery kullan.
-- auth.uid() SECURITY DEFINER içinde güvenilir çalışmayabilir.
-- Inline subquery: family_members SELECT policy sadece user_id = auth.uid()
-- olduğundan döngü YOK.
-- ============================================================

-- ── shopping_items ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "shopping_insert" ON public.shopping_items;
DROP POLICY IF EXISTS "shopping_update" ON public.shopping_items;
DROP POLICY IF EXISTS "shopping_delete" ON public.shopping_items;
DROP POLICY IF EXISTS "shopping_select" ON public.shopping_items;

CREATE POLICY "shopping_select"
    ON public.shopping_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = shopping_items.family_id
              AND user_id = auth.uid()
        )
    );

CREATE POLICY "shopping_insert"
    ON public.shopping_items FOR INSERT
    WITH CHECK (
        added_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = shopping_items.family_id
              AND user_id = auth.uid()
              AND role IN ('parent', 'child')
        )
    );

CREATE POLICY "shopping_update"
    ON public.shopping_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = shopping_items.family_id
              AND user_id = auth.uid()
              AND role IN ('parent', 'child')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = shopping_items.family_id
              AND user_id = auth.uid()
              AND role IN ('parent', 'child')
        )
    );

CREATE POLICY "shopping_delete"
    ON public.shopping_items FOR DELETE
    USING (
        added_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = shopping_items.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    );

-- ── events ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_select" ON public.events;
DROP POLICY IF EXISTS "events_insert" ON public.events;
DROP POLICY IF EXISTS "events_update" ON public.events;
DROP POLICY IF EXISTS "events_delete" ON public.events;

CREATE POLICY "events_select"
    ON public.events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = events.family_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "events_insert"
    ON public.events FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = events.family_id
              AND user_id = auth.uid()
              AND role IN ('parent', 'child')
        )
    );

CREATE POLICY "events_update"
    ON public.events FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = events.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
        OR (created_by = auth.uid())
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = events.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
        OR (created_by = auth.uid())
    );

CREATE POLICY "events_delete"
    ON public.events FOR DELETE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = events.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    );

-- ── tasks ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

CREATE POLICY "tasks_select"
    ON public.tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = tasks.family_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "tasks_insert"
    ON public.tasks FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = tasks.family_id
              AND user_id = auth.uid()
              AND role IN ('parent', 'child')
        )
    );

CREATE POLICY "tasks_update"
    ON public.tasks FOR UPDATE
    USING (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = tasks.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    )
    WITH CHECK (
        assigned_to = auth.uid()
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = tasks.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    );

CREATE POLICY "tasks_delete"
    ON public.tasks FOR DELETE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = tasks.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    );

-- ── recipes ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "recipes_select" ON public.recipes;
DROP POLICY IF EXISTS "recipes_insert" ON public.recipes;
DROP POLICY IF EXISTS "recipes_update" ON public.recipes;
DROP POLICY IF EXISTS "recipes_delete" ON public.recipes;

CREATE POLICY "recipes_select"
    ON public.recipes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = recipes.family_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "recipes_insert"
    ON public.recipes FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = recipes.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    );

CREATE POLICY "recipes_update"
    ON public.recipes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = recipes.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = recipes.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    );

CREATE POLICY "recipes_delete"
    ON public.recipes FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = recipes.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    );

-- ── meals ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "meals_select" ON public.meals;
DROP POLICY IF EXISTS "meals_insert" ON public.meals;
DROP POLICY IF EXISTS "meals_update" ON public.meals;
DROP POLICY IF EXISTS "meals_delete" ON public.meals;

CREATE POLICY "meals_select"
    ON public.meals FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = meals.family_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "meals_insert"
    ON public.meals FOR INSERT
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = meals.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    );

CREATE POLICY "meals_update"
    ON public.meals FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = meals.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = meals.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    );

CREATE POLICY "meals_delete"
    ON public.meals FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = meals.family_id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    );

-- ── families update/delete ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "families_update_parent" ON public.families;
DROP POLICY IF EXISTS "families_delete_creator" ON public.families;

CREATE POLICY "families_update_parent"
    ON public.families FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = families.id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = families.id
              AND user_id = auth.uid()
              AND role = 'parent'
        )
    );

CREATE POLICY "families_delete_creator"
    ON public.families FOR DELETE
    USING (created_by = auth.uid());

-- ── family_members update/delete ──────────────────────────────────────────────
DROP POLICY IF EXISTS "fm_update_parent" ON public.family_members;
DROP POLICY IF EXISTS "fm_delete" ON public.family_members;

CREATE POLICY "fm_update_parent"
    ON public.family_members FOR UPDATE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.family_members fm2
            WHERE fm2.family_id = family_members.family_id
              AND fm2.user_id = auth.uid()
              AND fm2.role = 'parent'
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.family_members fm2
            WHERE fm2.family_id = family_members.family_id
              AND fm2.user_id = auth.uid()
              AND fm2.role = 'parent'
        )
    );

CREATE POLICY "fm_delete"
    ON public.family_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.family_members fm2
            WHERE fm2.family_id = family_members.family_id
              AND fm2.user_id = auth.uid()
              AND fm2.role = 'parent'
        )
    );

SELECT 'Tüm policy''ler inline subquery ile güncellendi' AS durum;
