-- ============================================================
-- 008_notifications.sql
-- Bildirim sistemi: Tablo + RLS + tetikleyici fonksiyonlar
-- ============================================================

-- ── 0. Tabloyu oluştur ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    family_id  UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN (
                   'task_assigned','task_due','event_reminder',
                   'shopping_added','member_joined'
               )),
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    data       JSONB,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON public.notifications(user_id, is_read, created_at DESC);

-- ── 1. RLS aktif ──────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ── 2. RLS Policies ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notif_select_own"   ON public.notifications;
DROP POLICY IF EXISTS "notif_update_own"   ON public.notifications;
DROP POLICY IF EXISTS "notif_delete_own"   ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_system" ON public.notifications;

CREATE POLICY "notif_select_own"
    ON public.notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "notif_update_own"
    ON public.notifications FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "notif_delete_own"
    ON public.notifications FOR DELETE
    USING (user_id = auth.uid());

-- Trigger fonksiyonları SECURITY DEFINER ile çalışır, auth.uid() NULL olur
-- Bu nedenle INSERT için WITH CHECK (true) kullanıyoruz
CREATE POLICY "notif_insert_system"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

-- ── 3. İndex ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON public.notifications(user_id, is_read, created_at DESC);

-- ── 4. Alışveriş bildirim tetikleyicisi ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_shopping_added()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
BEGIN
    INSERT INTO public.notifications (id, user_id, family_id, type, title, body, data, is_read)
    SELECT
        uuid_generate_v4(), fm.user_id, NEW.family_id,
        'shopping_added', 'Alışveriş Listesi',
        NEW.name || ' listeye eklendi.',
        jsonb_build_object('item_id', NEW.id, 'item_name', NEW.name, 'added_by', NEW.added_by),
        false
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id AND fm.user_id <> NEW.added_by;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_shopping ON public.shopping_items;
CREATE TRIGGER trg_notify_shopping
    AFTER INSERT ON public.shopping_items
    FOR EACH ROW EXECUTE FUNCTION public.notify_shopping_added();

-- ── 5. Görev bildirim tetikleyicisi ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_task_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
BEGIN
    INSERT INTO public.notifications (id, user_id, family_id, type, title, body, data, is_read)
    SELECT
        uuid_generate_v4(), fm.user_id, NEW.family_id,
        'task_assigned', 'Yeni Görev',
        NEW.title || ' görevi oluşturuldu.',
        jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title, 'created_by', NEW.created_by),
        false
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id AND fm.user_id <> NEW.created_by;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task ON public.tasks;
CREATE TRIGGER trg_notify_task
    AFTER INSERT ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.notify_task_created();

-- ── 6. Etkinlik bildirim tetikleyicisi ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_event_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
BEGIN
    INSERT INTO public.notifications (id, user_id, family_id, type, title, body, data, is_read)
    SELECT
        uuid_generate_v4(), fm.user_id, NEW.family_id,
        'event_reminder', 'Yeni Etkinlik',
        NEW.title || ' takvime eklendi.',
        jsonb_build_object('event_id', NEW.id, 'event_title', NEW.title, 'start_at', NEW.start_at),
        false
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id AND fm.user_id <> NEW.created_by;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event ON public.events;
CREATE TRIGGER trg_notify_event
    AFTER INSERT ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.notify_event_created();

-- ── 7. Üye katılım bildirim tetikleyicisi ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_member_joined()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
DECLARE v_name TEXT;
BEGIN
    SELECT full_name INTO v_name FROM public.profiles WHERE id = NEW.user_id;
    INSERT INTO public.notifications (id, user_id, family_id, type, title, body, data, is_read)
    SELECT
        uuid_generate_v4(), fm.user_id, NEW.family_id,
        'member_joined', 'Yeni Üye',
        COALESCE(v_name, 'Birisi') || ' aileye katıldı!',
        jsonb_build_object('new_member_id', NEW.user_id, 'new_member_name', v_name, 'role', NEW.role),
        false
    FROM public.family_members fm
    WHERE fm.family_id = NEW.family_id AND fm.user_id <> NEW.user_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_member ON public.family_members;
CREATE TRIGGER trg_notify_member
    AFTER INSERT ON public.family_members
    FOR EACH ROW EXECUTE FUNCTION public.notify_member_joined();

SELECT 'Bildirim sistemi kuruldu' AS durum;
