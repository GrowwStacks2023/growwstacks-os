-- ════════════════════════════════════════════════════════════════════════
-- 0020_internal_projects_and_team
-- ────────────────────────────────────────────────────────────────────────
-- Two changes bundled:
--
--   1. projects.company_id becomes nullable. "Internal" projects (no
--      client company attached) are now first-class. The form lets you
--      pick a contact whose company is null and submit anyway. RLS on
--      payments still requires company_id, so internal projects can't
--      have payments — acceptable for v1 (they don't generate revenue).
--
--   2. project_team_members: developers see only projects they're a
--      member of. Admin and PM read and write the membership rows.
--      Phase C (RLS lockdown) will tighten this further; the policies
--      below are the preliminary shape.
--
-- Audit (run before applying): no trigger or function on public.projects
-- references company_id; no function uses a non-null assumption.
-- Confirmed via pg_proc scan.
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. projects.company_id nullable ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'company_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.projects ALTER COLUMN company_id DROP NOT NULL;
  END IF;
END $$;

-- ── 2. project_team_members ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_team_members (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  added_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  PRIMARY KEY (project_id, user_id)
);

-- Lookup hot path: "what projects am I on" → CASCADE-friendly index
-- keyed on user_id.
CREATE INDEX IF NOT EXISTS project_team_members_user_id_idx
  ON public.project_team_members (user_id);

ALTER TABLE public.project_team_members ENABLE ROW LEVEL SECURITY;

-- Preliminary policies (Phase C will integrate them with the rest of
-- the lockdown).
DROP POLICY IF EXISTS project_team_members_select ON public.project_team_members;
CREATE POLICY project_team_members_select ON public.project_team_members
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin', 'pm')
  OR (
    public.current_user_role() = 'developer'
    AND user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS project_team_members_insert ON public.project_team_members;
CREATE POLICY project_team_members_insert ON public.project_team_members
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin', 'pm')
);

DROP POLICY IF EXISTS project_team_members_delete ON public.project_team_members;
CREATE POLICY project_team_members_delete ON public.project_team_members
FOR DELETE TO authenticated
USING (
  public.current_user_role() IN ('admin', 'pm')
);

-- No UPDATE policy: to change a row, DELETE then INSERT.
