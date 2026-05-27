-- ============================================================================
-- 0004 RLS init-plan wrapping + FK covering indexes
-- ----------------------------------------------------------------------------
-- Addresses Supabase linter findings raised after 0003:
--   * lint 0003 (auth_rls_initplan): replace bare auth.uid() with
--     (SELECT auth.uid()) so the call is evaluated once per query rather
--     than once per row.
--   * lint 0001 (unindexed_foreign_keys): add covering indexes for
--     companies.created_by, deals.contact_id, deals.owner_id. Cascades and
--     joins through these columns will use the new indexes.
--
-- The two remaining advisor WARNs (SECURITY DEFINER + EXECUTE-to-authenticated
-- on current_user_role() and user_has_task_in_project()) are intentional:
-- those helpers exist specifically to be called from RLS by signed-in users.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Foreign-key covering indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS companies_created_by_idx
  ON public.companies (created_by) WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS deals_contact_id_idx
  ON public.deals (contact_id) WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS deals_owner_id_idx
  ON public.deals (owner_id) WHERE owner_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- Re-create RLS policies with (SELECT auth.uid())
-- ---------------------------------------------------------------------------
-- Every policy body below is identical to its 0001/0003 version EXCEPT that
-- direct calls to auth.uid() are wrapped in (SELECT auth.uid()).

-- -------- public.users --------
DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users
FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'admin' OR id = (SELECT auth.uid())
)
WITH CHECK (
  public.current_user_role() = 'admin' OR id = (SELECT auth.uid())
);


-- -------- public.activity_log --------
DROP POLICY IF EXISTS activity_log_select ON public.activity_log;
CREATE POLICY activity_log_select ON public.activity_log
FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR actor_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS activity_log_insert ON public.activity_log;
CREATE POLICY activity_log_insert ON public.activity_log
FOR INSERT TO authenticated
WITH CHECK (
  actor_id IS NULL OR actor_id = (SELECT auth.uid())
);


-- -------- public.deals --------
DROP POLICY IF EXISTS deals_update ON public.deals;
CREATE POLICY deals_update ON public.deals
FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'sales'
    AND owner_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'sales'
    AND owner_id = (SELECT auth.uid())
  )
);


-- -------- public.projects --------
DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects
FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR (
    public.current_user_role() = 'pm'
    AND pm_id = (SELECT auth.uid())
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
    AND pm_id = (SELECT auth.uid())
  )
  OR (
    public.current_user_role() = 'sales'
    AND pm_id IS NULL
  )
);


-- -------- public.milestones --------
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
        AND p.pm_id = (SELECT auth.uid())
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
        AND p.pm_id = (SELECT auth.uid())
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
        AND p.pm_id = (SELECT auth.uid())
    )
  )
);


-- -------- public.tasks --------
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
  OR (
    public.current_user_role() = 'developer'
    AND (
      assignee_id = (SELECT auth.uid())
      OR public.user_has_task_in_project(project_id)
    )
  )
);

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
        AND p.pm_id = (SELECT auth.uid())
    )
  )
);

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
        AND p.pm_id = (SELECT auth.uid())
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
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
        AND p.pm_id = (SELECT auth.uid())
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
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = tasks.project_id
        AND p.pm_id = (SELECT auth.uid())
    )
  )
);
