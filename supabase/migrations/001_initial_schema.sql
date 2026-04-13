-- ============================================================
-- 001_initial_schema.sql
-- Akıllı Aile Organizatörü — Temel Şema
-- Supabase Dashboard → SQL Editor'da çalıştırın
-- veya: supabase db push
-- ============================================================

-- UUID uzantısı (Supabase'de zaten aktif)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── profiles ──────────────────────────────────────────────────────────────
-- auth.users ile 1:1 ilişki. Trigger ile otomatik oluşturulur.
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    full_name   TEXT NOT NULL DEFAULT '',
    avatar_url  TEXT,
    color       TEXT NOT NULL DEFAULT '#6366f1',  -- Takvimde kullanıcı rengi
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── families ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.families (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,              -- 6 haneli davet kodu
    created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Davet kodu index (hızlı arama)
CREATE INDEX IF NOT EXISTS idx_families_invite_code ON public.families(invite_code);

-- ── family_members ────────────────────────────────────────────────────────
-- Her kullanıcı sadece bir aileye ait olabilir.
CREATE TABLE IF NOT EXISTS public.family_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'child'
                    CHECK (role IN ('parent', 'child', 'guest')),
    nickname    TEXT,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Bir kullanıcı bir ailede tek kez yer alabilir
    UNIQUE (family_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_members_user_id   ON public.family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON public.family_members(family_id);

-- ── events ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id             UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    created_by            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title                 TEXT NOT NULL,
    description           TEXT,
    start_at              TIMESTAMPTZ NOT NULL,
    end_at                TIMESTAMPTZ NOT NULL,
    all_day               BOOLEAN NOT NULL DEFAULT FALSE,
    color                 TEXT NOT NULL DEFAULT '#6366f1',
    recurrence            TEXT NOT NULL DEFAULT 'none'
                              CHECK (recurrence IN ('none','daily','weekly','monthly','yearly')),
    recurrence_end_date   DATE,
    assigned_to           UUID[] NOT NULL DEFAULT '{}',   -- Profil ID dizisi
    location              TEXT,
    reminder_minutes      INTEGER,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Bitiş, başlangıçtan önce olamaz
    CONSTRAINT events_end_after_start CHECK (end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_events_family_id ON public.events(family_id);
CREATE INDEX IF NOT EXISTS idx_events_start_at  ON public.events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_family_date
    ON public.events(family_id, start_at, end_at);

-- ── tasks ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id    UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    created_by   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title        TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'todo'
                     CHECK (status IN ('todo', 'in_progress', 'done')),
    priority     TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('low', 'medium', 'high')),
    due_date     DATE,
    completed_at TIMESTAMPTZ,
    points       INTEGER NOT NULL DEFAULT 10 CHECK (points >= 0 AND points <= 1000),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_family_id   ON public.tasks(family_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON public.tasks(status);

-- ── shopping_items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shopping_items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    added_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    quantity    NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit        TEXT,
    category    TEXT NOT NULL DEFAULT 'other'
                    CHECK (category IN (
                        'produce','dairy','meat','bakery','frozen',
                        'beverages','snacks','household','personal_care','other'
                    )),
    is_checked  BOOLEAN NOT NULL DEFAULT FALSE,
    checked_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    checked_at  TIMESTAMPTZ,
    note        TEXT,
    image_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_items_family_id  ON public.shopping_items(family_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_is_checked ON public.shopping_items(family_id, is_checked);

-- ── recipes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recipes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id           UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    description         TEXT,
    ingredients         JSONB NOT NULL DEFAULT '[]'::JSONB,
    -- [{"name": "Tavuk", "quantity": 500, "unit": "gr"}, ...]
    instructions        TEXT,
    prep_time_minutes   INTEGER,
    servings            INTEGER,
    image_url           TEXT,
    tags                TEXT[] NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipes_family_id ON public.recipes(family_id);

-- ── meals ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meals (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipe_id   UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
    meal_date   DATE NOT NULL,
    meal_type   TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
    custom_name TEXT,  -- Tarif bağlı değilse serbest metin
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meals_family_id ON public.meals(family_id);
CREATE INDEX IF NOT EXISTS idx_meals_date      ON public.meals(family_id, meal_date);

-- ── notifications ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN (
                    'task_assigned','task_due','event_reminder',
                    'shopping_added','member_joined'
                )),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    data        JSONB,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, is_read);

-- ════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════

-- ── updated_at otomatik güncelle ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Her tablo için trigger
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'profiles','families','family_members','events','tasks',
        'shopping_items','recipes','meals'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s;
             CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON public.%s
             FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();',
            t, t, t, t
        );
    END LOOP;
END;
$$;

-- ── Yeni kullanıcı profili otomatik oluştur ───────────────────────────────
-- auth.users'a yeni kayıt gelince profiles'a otomatik ekle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, color)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        '#6366f1'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── family_id validasyonu — INSERT/UPDATE güvenlik trigger ───────────────
-- Herhangi bir tabloda family_id, kullanıcının üyesi olmadığı bir aileye
-- işaret edemez.
CREATE OR REPLACE FUNCTION public.validate_family_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- family_id varsa kontrol et
    IF NEW.family_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.family_members
            WHERE family_id = NEW.family_id
              AND user_id   = auth.uid()
        ) THEN
            RAISE EXCEPTION 'Erişim reddedildi: Bu aileye üye değilsiniz. (family_id: %)', NEW.family_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- family_id olan tüm tablolara güvenlik trigger ekle
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'events','tasks','shopping_items','recipes','meals'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%s_validate_family ON public.%s;
             CREATE TRIGGER trg_%s_validate_family
             BEFORE INSERT OR UPDATE ON public.%s
             FOR EACH ROW EXECUTE FUNCTION public.validate_family_membership();',
            t, t, t, t
        );
    END LOOP;
END;
$$;

-- Realtime yayın izinleri
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
