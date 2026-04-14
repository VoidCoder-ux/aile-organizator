-- families tablosu için eksik INSERT policy
CREATE POLICY IF NOT EXISTS "families_insert_authenticated"
    ON public.families FOR INSERT
    WITH CHECK (created_by = auth.uid());
