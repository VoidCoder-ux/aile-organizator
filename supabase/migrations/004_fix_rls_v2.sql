-- ============================================================
-- 004_fix_rls_v2.sql
-- GERÇEK DÜZELTME: family_members_select_same_family kaldır
--
-- SORUN:
--   family_members SELECT policy → get_my_family_ids() çağırır
--   get_my_family_ids() → family_members sorgular
--   → aynı SELECT policy tekrar tetiklenir → sonsuz döngü
--   PostgreSQL bu döngüyü PLAN aşamasında tespit eder.
--   SET row_security = off bile plan-time recursion'ı kurtaramaz.
--
-- ÇÖZÜM:
--   family_members için SADECE "user_id = auth.uid()" policy'si tut.
--   Aile üyelerini görüntülemek için SECURITY DEFINER RPC kullan.
-- ============================================================

-- ── 1. Döngüye yol açan policy'yi sil ────────────────────────────────────────
DROP POLICY IF EXISTS "family_members_select_same_family" ON public.family_members;

-- family_members_select_own zaten var, yeniden oluşturmaya gerek yok
-- ama eksikse güvenle oluştur:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'family_members'
      AND policyname = 'family_members_select_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "family_members_select_own"
          ON public.family_members FOR SELECT
          USING (user_id = auth.uid())
    $p$;
  END IF;
END;
$$;

-- ── 2. Yardımcı fonksiyonları SET row_security = off OLMADAN yeniden oluştur ──
--       family_members'ın tek SELECT policy'si "user_id = auth.uid()" olduğundan
--       bu fonksiyonlar artık güvenle çalışır (döngü oluşturacak policy yok).

CREATE OR REPLACE FUNCTION public.get_my_family_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT family_id
    FROM public.family_members
    WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_family_member(p_family_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
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
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.family_members
        WHERE family_id = p_family_id
          AND user_id   = auth.uid()
          AND role      = 'parent'
    );
$$;

-- ── 3. profiles policy düzelt ─────────────────────────────────────────────────
--       Eski policy family_members üzerinde çift JOIN yapıyordu.
--       Yeni: SECURITY DEFINER fonksiyon üzerinden (RLS bypass ile güvenli).

DROP POLICY IF EXISTS "profiles_select_family_members" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_my_family_member_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off   -- profiles policy'sinden family_members sorgulanıyor,
                          -- family_members kendi policy'si değil → döngü yok
AS $$
    SELECT DISTINCT fm2.user_id
    FROM   public.family_members fm1
    JOIN   public.family_members fm2 ON fm2.family_id = fm1.family_id
    WHERE  fm1.user_id = auth.uid();
$$;

CREATE POLICY "profiles_select_family_members"
    ON public.profiles FOR SELECT
    USING (id IN (SELECT public.get_my_family_member_ids()));

-- ── 4. Tüm aile üyelerini getiren RPC ────────────────────────────────────────
--       Uygulama bu RPC'yi kullanacak; direkt family_members sorgusu yerine.

CREATE OR REPLACE FUNCTION public.get_family_members_list(p_family_id UUID)
RETURNS TABLE (
    id        UUID,
    family_id UUID,
    user_id   UUID,
    role      TEXT,
    nickname  TEXT,
    joined_at TIMESTAMPTZ,
    profiles  JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
    SELECT
        fm.id,
        fm.family_id,
        fm.user_id,
        fm.role,
        fm.nickname,
        fm.joined_at,
        to_jsonb(p) AS profiles
    FROM   public.family_members fm
    LEFT JOIN public.profiles p ON p.id = fm.user_id
    WHERE  fm.family_id = p_family_id
      AND EXISTS (
              SELECT 1 FROM public.family_members
              WHERE  family_id = p_family_id
                AND  user_id   = auth.uid()
          )
    ORDER BY fm.joined_at ASC;
$$;

-- ── Doğrulama ─────────────────────────────────────────────────────────────────
-- SELECT * FROM pg_policies WHERE tablename = 'family_members';
-- SELECT public.get_my_family_ids();
-- SELECT * FROM public.get_family_members_list('<family_id_buraya>');
