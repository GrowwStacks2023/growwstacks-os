-- ============================================================================
-- 0003 Sales + Delivery Tables
-- ----------------------------------------------------------------------------
-- Adds the sales pipeline (deals) and the delivery hierarchy
-- (projects -> milestones -> tasks). Builds on foundation tables from 0001
-- and the hardening tweaks from 0002. Idempotent where reasonable.
--
-- Hierarchy invariant: every task belongs to a milestone, every milestone
-- belongs to a project. tasks.project_id is denormalized for fast project-
-- level reads and indexes; a BEFORE trigger keeps it consistent with the
-- parent milestone.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- ENUMs
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.deal_source AS ENUM ('upwork','linkedin','referral','inbound','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.deal_stage AS ENUM ('new','qualified','proposal_sent','negotiation','won','lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.project_status AS ENUM ('planning','active','on_hold','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.milestone_status AS ENUM ('not_started','in_progress','completed','blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('todo','in_progress','review','done','blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- Table: public.deals
-- ---------------------------------------------------------------------------
-- Sales pipeline. One row per opportunity. external_ghl_id lets us keep
-- legacy GHL records in sync during the migration period.
CREATE TABLE IF NOT EXISTS public.deals (
  id                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  contact_id        uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  owner_id          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source            public.deal_source NOT NULL DEFAULT 'other',
  stage             public.deal_stage NOT NULL DEFAULT 'new',
  title             text NOT NULL,
  description       text,
  value_inr         numeric(12,2),
  value_usd         numeric(12,2),
  external_ghl_id   text,
  won_at            timestamptz,
  lost_at           timestamptz,
  lost_reason       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS deals_updated_at ON public.deals;
CREATE TRIGGER deals_updated_at
BEFORE UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ---------------------------------------------------------------------------
-- Table: public.projects
-- ---------------------------------------------------------------------------
-- Won deals (and the occasional ad-hoc engagement) become projects. company_id
-- is denormalized so the most common filter ("all projects for client X")
-- doesn't have to join through deals (which may even be NULL).
CREATE TABLE IF NOT EXISTS public.projects (
  id               uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  deal_id          uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  pm_id            uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name             text NOT NULL,
  description      text,
  status           public.project_status NOT NULL DEFAULT 'planning',
  started_at       timestamptz,
  expected_end_at  timestamptz,
  actual_end_at    timestamptz,
  client_visible   boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ---------------------------------------------------------------------------
-- Table: public.milestones
-- ---------------------------------------------------------------------------
-- A phase within a project. `sequence` is per-project (1, 2, 3, ...) and is
-- enforced unique within the parent project. Cascades on project deletion.
CREATE TABLE IF NOT EXISTS public.milestones (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sequence        integer NOT NULL,
  name            text NOT NULL,
  description     text,
  status          public.milestone_status NOT NULL DEFAULT 'not_started',
  target_date     date,
  completed_at    timestamptz,
  client_visible  boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT milestones_project_sequence_key UNIQUE (project_id, sequence)
);

DROP TRIGGER IF EXISTS milestones_updated_at ON public.milestones;
CREATE TRIGGER milestones_updated_at
BEFORE UPDATE ON public.milestones
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ---------------------------------------------------------------------------
-- Table: public.tasks
-- ---------------------------------------------------------------------------
-- Smallest unit of work. milestone_id is NOT NULL: no orphan tasks. project_id
-- is denormalized for fast project-level reads and indexes; a BEFORE trigger
-- (enforce_task_project_consistency) keeps it in sync with the milestone's
-- project_id. Alternative considered: composite FK (milestone_id, project_id)
-- referencing milestones (id, project_id) with a UNIQUE on milestones; chosen
-- against in favour of an explicit, self-documenting trigger.
--
-- client_visible defaults to false because most internal tasks (debugging,
-- internal QA, etc.) should not be exposed in the future client portal.
CREATE TABLE IF NOT EXISTS public.tasks (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  milestone_id    uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assignee_id     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  status          public.task_status NOT NULL DEFAULT 'todo',
  priority        public.task_priority NOT NULL DEFAULT 'medium',
  estimate_hours  numeric(6,2),
  actual_hours    numeric(6,2),
  due_at          timestamptz,
  completed_at    timestamptz,
  client_visible  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ---------------------------------------------------------------------------
-- Trigger: enforce tasks.project_id == tasks.milestone -> project_id
-- ---------------------------------------------------------------------------
-- search_path is pinned so the lookup of public.milestones can't be hijacked
-- by a caller-supplied search_path. Not SECURITY DEFINER: the function reads
-- the same table the caller is mutating, so the caller's RLS context is fine.
CREATE OR REPLACE FUNCTION public.enforce_task_project_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_project uuid;
BEGIN
  SELECT m.project_id INTO parent_project
  FROM public.milestones m
  WHERE m.id = NEW.milestone_id;

  IF parent_project IS NULL THEN
    RAISE EXCEPTION 'milestone % does not exist', NEW.milestone_id;
  END IF;

  IF NEW.project_id <> parent_project THEN
    RAISE EXCEPTION
      'tasks.project_id (%) must match milestone.project_id (%)',
      NEW.project_id, parent_project;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions in the public schema are RPC-callable by default. Block
-- that (same pattern as 0002).
REVOKE ALL ON FUNCTION public.enforce_task_project_consistency() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tasks_enforce_project_consistency ON public.tasks;
CREATE TRIGGER tasks_enforce_project_consistency
BEFORE INSERT OR UPDATE OF milestone_id, project_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_project_consistency();


-- ---------------------------------------------------------------------------
-- Helper: user_has_task_in_project
-- ---------------------------------------------------------------------------
-- Returns true if the calling user is the assignee on at least one task in
-- the given project. Used by RLS to scope developer reads to the projects
-- they actually work on.
--
-- SECURITY DEFINER so policies on tasks don't recurse when checking project
-- membership. STABLE because the result depends only on the row state at the
-- start of the statement; auth.uid() is constant per call.
CREATE OR REPLACE FUNCTION public.user_has_task_in_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.project_id = target_project_id
      AND t.assignee_id = (SELECT auth.uid())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_has_task_in_project(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.user_has_task_in_project(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- deals
CREATE INDEX IF NOT EXISTS deals_stage_owner_idx
  ON public.deals (stage, owner_id);
CREATE INDEX IF NOT EXISTS deals_company_idx
  ON public.deals (company_id);
CREATE INDEX IF NOT EXISTS deals_created_at_idx
  ON public.deals (created_at DESC);
CREATE INDEX IF NOT EXISTS deals_external_ghl_id_idx
  ON public.deals (external_ghl_id) WHERE external_ghl_id IS NOT NULL;

-- projects
CREATE INDEX IF NOT EXISTS projects_pm_status_idx
  ON public.projects (pm_id, status);
CREATE INDEX IF NOT EXISTS projects_company_idx
  ON public.projects (company_id);
CREATE INDEX IF NOT EXISTS projects_status_idx
  ON public.projects (status);
CREATE INDEX IF NOT EXISTS projects_deal_id_idx
  ON public.projects (deal_id) WHERE deal_id IS NOT NULL;

-- milestones
-- The UNIQUE constraint on (project_id, sequence) already creates an index;
-- no need to add a separate one.
CREATE INDEX IF NOT EXISTS milestones_open_status_idx
  ON public.milestones (status) WHERE status <> 'completed';

-- tasks
CREATE INDEX IF NOT EXISTS tasks_assignee_status_idx
  ON public.tasks (assignee_id, status);
CREATE INDEX IF NOT EXISTS tasks_milestone_idx
  ON public.tasks (milestone_id);
CREATE INDEX IF NOT EXISTS tasks_project_status_idx
  ON public.tasks (project_id, status);
CREATE INDEX IF NOT EXISTS tasks_due_open_idx
  ON public.tasks (due_at) WHERE status NOT IN ('done','blocked');


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.deals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks      ENABLE ROW LEVEL SECURITY;


-- -------- public.deals policies --------
-- Developers are intentionally excluded from the sales pipeline: they should
-- not see prospect lists, deal values, or lost reasons.
DROP POLICY IF EXISTS deals_select ON public.deals;
CREATE POLICY deals_select ON public.deals
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
);

DROP POLICY IF EXISTS deals_insert ON public.deals;
CREATE POLICY deals_insert ON public.deals
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin','sales')
);

-- Sales can update their own deals; admin can update anything. The owner_id
-- check means an unassigned-to-anyone deal is admin-only to update.
DROP POLICY IF EXISTS deals_update ON public.deals;
CREATE POLICY deals_update ON public.deals
FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'sales'
    AND owner_id = auth.uid()
  )
)
WITH CHECK (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'sales'
    AND owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS deals_delete ON public.deals;
CREATE POLICY deals_delete ON public.deals
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');


-- -------- public.projects policies --------
-- Developers see only projects where they are an assignee on at least one
-- task. Sales/pm see everything for cross-team coordination.
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
  OR (
    public.current_user_role() = 'developer'
    AND public.user_has_task_in_project(id)
  )
);

DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin','sales','pm')
);

-- PMs can update only their own projects. Sales may update a project only if
-- no PM is assigned yet (rare hand-off window between won-deal and project-
-- kickoff). Admin can update anything.
DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects
FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND pm_id = auth.uid()
  )
  OR (
    public.current_user_role() = 'sales'
    AND pm_id IS NULL
  )
)
WITH CHECK (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND pm_id = auth.uid()
  )
  OR (
    public.current_user_role() = 'sales'
    AND pm_id IS NULL
  )
);

DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_delete ON public.projects
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');


-- -------- public.milestones policies --------
DROP POLICY IF EXISTS milestones_select ON public.milestones;
CREATE POLICY milestones_select ON public.milestones
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
  OR (
    public.current_user_role() = 'developer'
    AND public.user_has_task_in_project(project_id)
  )
);

-- Admin or the PM of the parent project may insert milestones.
DROP POLICY IF EXISTS milestones_insert ON public.milestones;
CREATE POLICY milestones_insert ON public.milestones
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = milestones.project_id
        AND p.pm_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS milestones_update ON public.milestones;
CREATE POLICY milestones_update ON public.milestones
FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = milestones.project_id
        AND p.pm_id = auth.uid()
    )
  )
)
WITH CHECK (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = milestones.project_id
        AND p.pm_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS milestones_delete ON public.milestones;
CREATE POLICY milestones_delete ON public.milestones
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');


-- -------- public.tasks policies --------
-- Developers see their own tasks AND their teammates' tasks on projects they
-- are working on. This supports the "I'm a dev and I want to know what my
-- co-workers on this project are up to" use case without exposing every task
-- in the company.
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
  OR (
    public.current_user_role() = 'developer'
    AND (
      assignee_id = auth.uid()
      OR public.user_has_task_in_project(project_id)
    )
  )
);

-- Admin or the PM of the parent project may insert tasks.
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
        AND p.pm_id = auth.uid()
    )
  )
);

-- PM (of the parent project) can update any task in their project. Developers
-- can update only the tasks they are assigned to (so they can mark status,
-- log actual_hours, set completed_at). The trigger enforces project_id
-- consistency on UPDATE.
DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
        AND p.pm_id = auth.uid()
    )
  )
  OR (
    public.current_user_role() = 'developer'
    AND assignee_id = auth.uid()
  )
)
WITH CHECK (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
        AND p.pm_id = auth.uid()
    )
  )
  OR (
    public.current_user_role() = 'developer'
    AND assignee_id = auth.uid()
  )
);

DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
FOR DELETE TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
        AND p.pm_id = auth.uid()
    )
  )
);
