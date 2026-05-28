-- ============================================================================
-- 0011 Independent Tasks
-- ----------------------------------------------------------------------------
-- Lets a task attach to a deal, a contact, or a PM directly instead of always
-- being scoped to a project → milestone. Raghav's framing: tasks are work
-- units; not all work is project delivery. A sales follow-up, a discovery
-- call, or "remind me to invoice X" are all tasks — they just don't belong
-- to a milestone.
--
-- Changes:
--   - tasks.milestone_id and tasks.project_id are now NULLABLE.
--   - New nullable FKs: pm_id, deal_id, contact_id.
--   - The task → project consistency trigger is now CONDITIONAL: if
--     milestone_id IS NULL it skips. If milestone_id IS NOT NULL the
--     existing strict check applies (project_id must match milestone's
--     project_id; "match" is checked with IS DISTINCT FROM so a NULL
--     project_id is also rejected when a milestone is set).
--   - CHECK: a task must attach to at least one context
--     (milestone OR project OR deal OR contact). No floating tasks.
--   - RLS extended: a developer can also see standalone tasks where
--     they're the assignee or the pm_id (the assignment IS the grant —
--     a dev sees a task on a deal they otherwise couldn't access, but
--     only because they're directly attached to that task).
--
-- IMPORTANT for the future capacity-AI agent: it counts ONLY tasks with
-- project_id IS NOT NULL as delivery load. Standalone tasks (deal/contact
-- only) are excluded from capacity math.
--
-- Idempotent — safe to re-run.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Nullability + new columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.tasks ALTER COLUMN milestone_id DROP NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN project_id   DROP NOT NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS pm_id      uuid REFERENCES public.users(id)    ON DELETE SET NULL;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deal_id    uuid REFERENCES public.deals(id)    ON DELETE SET NULL;
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;


-- ---------------------------------------------------------------------------
-- A task must attach somewhere
-- ---------------------------------------------------------------------------
-- The existing rows (Task 5c+) all have milestone+project set so they pass
-- without a backfill. New seed rows in 0011's companion seed exercise the
-- deal-only and contact-only shapes.
DO $$ BEGIN
  ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_must_have_context_check
    CHECK (
      milestone_id IS NOT NULL
      OR project_id IS NOT NULL
      OR deal_id    IS NOT NULL
      OR contact_id IS NOT NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- Trigger: conditional task → project consistency
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE swaps the body atomically; the trigger row in
-- pg_trigger keeps pointing at the function, so no drop-and-recreate dance.
CREATE OR REPLACE FUNCTION public.enforce_task_project_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_project uuid;
BEGIN
  -- Standalone task: no milestone, no consistency to enforce.
  IF NEW.milestone_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT m.project_id INTO parent_project
  FROM public.milestones m
  WHERE m.id = NEW.milestone_id;

  IF parent_project IS NULL THEN
    RAISE EXCEPTION 'milestone % does not exist', NEW.milestone_id;
  END IF;

  -- IS DISTINCT FROM treats null and uuid as different — so a milestone-tied
  -- task with NULL project_id is also rejected, not silently allowed.
  IF NEW.project_id IS DISTINCT FROM parent_project THEN
    RAISE EXCEPTION
      'tasks.project_id (%) must match milestone.project_id (%)',
      NEW.project_id, parent_project;
  END IF;

  RETURN NEW;
END;
$$;

-- Same lockdown as 0003: not callable as an RPC.
REVOKE ALL ON FUNCTION public.enforce_task_project_consistency() FROM PUBLIC, anon, authenticated;


-- ---------------------------------------------------------------------------
-- FK covering indexes for the new columns
-- ---------------------------------------------------------------------------
-- Partial indexes — most tasks won't have these set, so we only index the
-- ones that do. Matches the partial-index pattern used elsewhere.
CREATE INDEX IF NOT EXISTS tasks_pm_id_idx
  ON public.tasks (pm_id) WHERE pm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_deal_id_idx
  ON public.tasks (deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_contact_id_idx
  ON public.tasks (contact_id) WHERE contact_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- RLS — updated for the standalone-task shape
-- ---------------------------------------------------------------------------
-- SELECT logic (developer branch):
--   - Project-tied task (project_id IS NOT NULL): unchanged behaviour —
--     dev sees it if they're the assignee OR they have any task in the same
--     project (project teammates can see each other's work).
--   - Standalone task (project_id IS NULL): dev sees it ONLY if they're
--     the assignee_id or the pm_id of the task. The assignment IS the
--     grant. There's no project to gather a team around, so we don't
--     leak across deals/contacts to other devs.
-- Admin / sales / pm keep broad access.
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
  OR (
    public.current_user_role() = 'developer'
    AND (
      assignee_id = (SELECT auth.uid())
      OR pm_id     = (SELECT auth.uid())
      OR (
        project_id IS NOT NULL
        AND public.user_has_task_in_project(project_id)
      )
    )
  )
);

-- INSERT: admin always; PM either when (a) the row's project_id is one
-- they PM, or (b) the row is standalone (project_id IS NULL) and they're
-- naming themselves as pm_id. The second branch lets a PM create a
-- pre-project / discovery task that lives only on a deal or contact.
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND (
      (
        tasks.project_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = tasks.project_id
            AND p.pm_id = (SELECT auth.uid())
        )
      )
      OR (
        tasks.project_id IS NULL
        AND tasks.pm_id = (SELECT auth.uid())
      )
    )
  )
);

-- UPDATE / DELETE: mirror the INSERT shape. PMs can update a standalone
-- task when they're its pm_id; devs can still update tasks they're
-- assigned to (status, hours, etc.).
DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND (
      (
        project_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = tasks.project_id
            AND p.pm_id = (SELECT auth.uid())
        )
      )
      OR (
        project_id IS NULL
        AND pm_id = (SELECT auth.uid())
      )
    )
  )
  OR (
    public.current_user_role() = 'developer'
    AND assignee_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND (
      (
        project_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = tasks.project_id
            AND p.pm_id = (SELECT auth.uid())
        )
      )
      OR (
        project_id IS NULL
        AND pm_id = (SELECT auth.uid())
      )
    )
  )
  OR (
    public.current_user_role() = 'developer'
    AND assignee_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
FOR DELETE TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND (
      (
        project_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = tasks.project_id
            AND p.pm_id = (SELECT auth.uid())
        )
      )
      OR (
        project_id IS NULL
        AND pm_id = (SELECT auth.uid())
      )
    )
  )
);
