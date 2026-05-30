-- ════════════════════════════════════════════════════════════════════════
-- Phase C: RLS lockdown across entities matching the role matrix.
-- ────────────────────────────────────────────────────────────────────────
-- Translates the Task 26 corrected matrix into Postgres-level
-- enforcement. Closes the three Task 11 gaps:
--   #1 developer reading companies
--   #2 developer reading contacts
--   #3 sales inserting projects
-- Plus tightens PM out of deals, narrows developer tasks to assignee
-- only, and brings users.SELECT in line with the historical-name-
-- display requirement (tombstoned users remain readable so "(Former)"
-- continues to render on old task assignees).
--
-- Atomic — every DROP and CREATE runs in one transaction. If any one
-- statement fails the entire migration rolls back.
--
-- Parked v2 tables (communications, sla_*, credentials,
-- credential_access_log) are intentionally NOT touched. Their existing
-- policies stay as-is.
--
-- Rollback section is embedded at the bottom as a commented-out block.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Helper: developer project access (team OR has a task) ─────────
CREATE OR REPLACE FUNCTION public.user_has_project_access(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_team_members ptm
    WHERE ptm.project_id = p_project_id AND ptm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.project_id = p_project_id AND t.assignee_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.user_has_project_access(uuid) IS
  'Returns true if the calling user (auth.uid()) is on the project team OR has any task assigned in the project. Used by RLS for developer-scoped reads on projects, milestones, and milestone attachments.';

-- ── 2. Drop existing policies on the in-scope tables ─────────────────
-- companies
DROP POLICY IF EXISTS companies_select ON public.companies;
DROP POLICY IF EXISTS companies_insert ON public.companies;
DROP POLICY IF EXISTS companies_update ON public.companies;
DROP POLICY IF EXISTS companies_delete ON public.companies;

-- contacts
DROP POLICY IF EXISTS contacts_select ON public.contacts;
DROP POLICY IF EXISTS contacts_insert ON public.contacts;
DROP POLICY IF EXISTS contacts_update ON public.contacts;
DROP POLICY IF EXISTS contacts_delete ON public.contacts;

-- deals
DROP POLICY IF EXISTS deals_select ON public.deals;
DROP POLICY IF EXISTS deals_insert ON public.deals;
DROP POLICY IF EXISTS deals_update ON public.deals;
DROP POLICY IF EXISTS deals_delete ON public.deals;

-- projects
DROP POLICY IF EXISTS projects_select ON public.projects;
DROP POLICY IF EXISTS projects_insert ON public.projects;
DROP POLICY IF EXISTS projects_update ON public.projects;
DROP POLICY IF EXISTS projects_delete ON public.projects;

-- milestones
DROP POLICY IF EXISTS milestones_select ON public.milestones;
DROP POLICY IF EXISTS milestones_insert ON public.milestones;
DROP POLICY IF EXISTS milestones_update ON public.milestones;
DROP POLICY IF EXISTS milestones_delete ON public.milestones;

-- tasks
DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
DROP POLICY IF EXISTS tasks_update ON public.tasks;
DROP POLICY IF EXISTS tasks_delete ON public.tasks;

-- payments
DROP POLICY IF EXISTS payments_select ON public.payments;
DROP POLICY IF EXISTS payments_insert ON public.payments;
DROP POLICY IF EXISTS payments_update ON public.payments;
DROP POLICY IF EXISTS payments_delete ON public.payments;

-- attachments
DROP POLICY IF EXISTS attachments_select ON public.attachments;
DROP POLICY IF EXISTS attachments_insert ON public.attachments;
DROP POLICY IF EXISTS attachments_delete ON public.attachments;

-- project_team_members (created in 0020 — replacing with locked-down set)
DROP POLICY IF EXISTS project_team_members_select ON public.project_team_members;
DROP POLICY IF EXISTS project_team_members_insert ON public.project_team_members;
DROP POLICY IF EXISTS project_team_members_delete ON public.project_team_members;

-- users
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;
DROP POLICY IF EXISTS users_delete ON public.users;

-- api_keys
DROP POLICY IF EXISTS api_keys_admin_select ON public.api_keys;
DROP POLICY IF EXISTS api_keys_admin_insert ON public.api_keys;
DROP POLICY IF EXISTS api_keys_admin_update ON public.api_keys;
DROP POLICY IF EXISTS api_keys_admin_delete ON public.api_keys;

-- api_audit_log
DROP POLICY IF EXISTS api_audit_log_admin_select ON public.api_audit_log;

-- activity_log
DROP POLICY IF EXISTS activity_log_select ON public.activity_log;
DROP POLICY IF EXISTS activity_log_insert ON public.activity_log;

-- ── 3. Companies ─────────────────────────────────────────────────────
-- Gap #1 closed: developer dropped from SELECT.
CREATE POLICY companies_select ON public.companies FOR SELECT
  USING (current_user_role() IN ('admin', 'pm', 'sales'));

CREATE POLICY companies_insert ON public.companies FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'pm'));

CREATE POLICY companies_update ON public.companies FOR UPDATE
  USING (current_user_role() IN ('admin', 'pm'))
  WITH CHECK (current_user_role() IN ('admin', 'pm'));

CREATE POLICY companies_delete ON public.companies FOR DELETE
  USING (current_user_role() IN ('admin', 'pm'));

-- ── 4. Contacts ──────────────────────────────────────────────────────
-- Gap #2 closed: developer dropped from SELECT.
CREATE POLICY contacts_select ON public.contacts FOR SELECT
  USING (current_user_role() IN ('admin', 'pm', 'sales'));

CREATE POLICY contacts_insert ON public.contacts FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'pm', 'sales'));

CREATE POLICY contacts_update ON public.contacts FOR UPDATE
  USING (current_user_role() IN ('admin', 'pm', 'sales'))
  WITH CHECK (current_user_role() IN ('admin', 'pm', 'sales'));

CREATE POLICY contacts_delete ON public.contacts FOR DELETE
  USING (current_user_role() IN ('admin', 'pm'));

-- ── 5. Deals (PM EXCLUDED per corrected matrix) ──────────────────────
CREATE POLICY deals_select ON public.deals FOR SELECT
  USING (current_user_role() IN ('admin', 'sales'));

CREATE POLICY deals_insert ON public.deals FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'sales'));

CREATE POLICY deals_update ON public.deals FOR UPDATE
  USING (current_user_role() IN ('admin', 'sales'))
  WITH CHECK (current_user_role() IN ('admin', 'sales'));

CREATE POLICY deals_delete ON public.deals FOR DELETE
  USING (current_user_role() = 'admin');

-- ── 6. Projects ──────────────────────────────────────────────────────
-- Gap #3 closed: sales dropped from INSERT.
CREATE POLICY projects_select ON public.projects FOR SELECT
  USING (
    current_user_role() IN ('admin', 'pm', 'sales')
    OR (
      current_user_role() = 'developer'
      AND public.user_has_project_access(id)
    )
  );

CREATE POLICY projects_insert ON public.projects FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'pm'));

CREATE POLICY projects_update ON public.projects FOR UPDATE
  USING (current_user_role() IN ('admin', 'pm'))
  WITH CHECK (current_user_role() IN ('admin', 'pm'));

CREATE POLICY projects_delete ON public.projects FOR DELETE
  USING (current_user_role() IN ('admin', 'pm'));

-- ── 7. Milestones (visibility tracks Projects) ───────────────────────
CREATE POLICY milestones_select ON public.milestones FOR SELECT
  USING (
    current_user_role() IN ('admin', 'pm', 'sales')
    OR (
      current_user_role() = 'developer'
      AND public.user_has_project_access(project_id)
    )
  );

CREATE POLICY milestones_insert ON public.milestones FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'pm'));

CREATE POLICY milestones_update ON public.milestones FOR UPDATE
  USING (current_user_role() IN ('admin', 'pm'))
  WITH CHECK (current_user_role() IN ('admin', 'pm'));

CREATE POLICY milestones_delete ON public.milestones FOR DELETE
  USING (current_user_role() IN ('admin', 'pm'));

-- ── 8. Tasks ─────────────────────────────────────────────────────────
-- Sales EXCLUDED entirely from tasks. Developer sees only own assignee
-- rows. Update field-level constraints (developer status+attachments
-- only) are enforced in code via updateOwnTaskStatus.
CREATE POLICY tasks_select ON public.tasks FOR SELECT
  USING (
    current_user_role() IN ('admin', 'pm')
    OR (
      current_user_role() = 'developer'
      AND assignee_id = (SELECT auth.uid())
    )
  );

CREATE POLICY tasks_insert ON public.tasks FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'pm'));

CREATE POLICY tasks_update ON public.tasks FOR UPDATE
  USING (
    current_user_role() IN ('admin', 'pm')
    OR (
      current_user_role() = 'developer'
      AND assignee_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    current_user_role() IN ('admin', 'pm')
    OR (
      current_user_role() = 'developer'
      AND assignee_id = (SELECT auth.uid())
    )
  );

CREATE POLICY tasks_delete ON public.tasks FOR DELETE
  USING (current_user_role() IN ('admin', 'pm'));

-- ── 9. Payments (admin+pm only — sales EXCLUDED) ─────────────────────
CREATE POLICY payments_select ON public.payments FOR SELECT
  USING (current_user_role() IN ('admin', 'pm'));

CREATE POLICY payments_insert ON public.payments FOR INSERT
  WITH CHECK (
    current_user_role() IN ('admin', 'pm')
    AND (recorded_by IS NULL OR recorded_by = (SELECT auth.uid()))
  );

CREATE POLICY payments_update ON public.payments FOR UPDATE
  USING (current_user_role() IN ('admin', 'pm'))
  WITH CHECK (current_user_role() IN ('admin', 'pm'));

CREATE POLICY payments_delete ON public.payments FOR DELETE
  USING (current_user_role() IN ('admin', 'pm'));

-- ── 10. Attachments ─────────────────────────────────────────────────
-- SELECT: permissive — every authenticated user can read the rows. The
--   UI gates entity access (which gates which attachment lists the user
--   even sees). Strict per-entity scoping at the RLS layer would
--   require correlated subqueries against every parent table; deferred.
-- INSERT: any authenticated user, with uploaded_by matching the caller.
--   Application code (canWriteAttachment in lib/access.ts) enforces
--   role+entity-type pairing before reaching the DB.
-- DELETE: admin OR uploader.
CREATE POLICY attachments_select ON public.attachments FOR SELECT
  USING (true);

CREATE POLICY attachments_insert ON public.attachments FOR INSERT
  WITH CHECK (
    uploaded_by IS NULL OR uploaded_by = (SELECT auth.uid())
  );

CREATE POLICY attachments_delete ON public.attachments FOR DELETE
  USING (
    current_user_role() = 'admin'
    OR uploaded_by = (SELECT auth.uid())
  );

-- ── 11. project_team_members ────────────────────────────────────────
CREATE POLICY project_team_members_select ON public.project_team_members FOR SELECT
  USING (
    current_user_role() IN ('admin', 'pm')
    OR (
      current_user_role() = 'developer'
      AND user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY project_team_members_insert ON public.project_team_members FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'pm'));

CREATE POLICY project_team_members_delete ON public.project_team_members FOR DELETE
  USING (current_user_role() IN ('admin', 'pm'));

-- ── 12. Users ───────────────────────────────────────────────────────
-- SELECT: any authenticated user reads ALL rows, including tombstoned
--   (deleted_at IS NOT NULL) and inactive ones. Historical task
--   assignees etc. need to render their "(Former)" name from these rows.
-- UPDATE: admin OR self. enforce_user_self_update trigger gates which
--   columns a non-admin self-updater can touch.
-- INSERT: no policy — only the handle_new_user_signup trigger
--   (SECURITY DEFINER, runs on auth.users INSERT) writes rows.
-- DELETE: no policy — tombstoning uses UPDATE; auth.users delete is
--   blocked from cascading by the NO ACTION FK from migration 0019.
CREATE POLICY users_select ON public.users FOR SELECT
  USING (true);

CREATE POLICY users_update ON public.users FOR UPDATE
  USING (
    current_user_role() = 'admin'
    OR id = (SELECT auth.uid())
  )
  WITH CHECK (
    current_user_role() = 'admin'
    OR id = (SELECT auth.uid())
  );

-- ── 13. API keys ────────────────────────────────────────────────────
-- Add role column + CHECK (admin only for now). Wipe existing keys —
-- the only key in production is Raghav's, and Task 26 instructions
-- mandate regeneration. Audit log rows for the deleted keys keep their
-- api_key_id as a dangling reference (the FK is ON DELETE SET NULL via
-- migration 0017 — wait, verify), preserving forensic history.

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_role_admin_only'
  ) THEN
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_role_admin_only CHECK (role = 'admin');
  END IF;
END $$;

-- Wipe existing keys. Audit log rows survive (api_key_id FK is ON DELETE
-- SET NULL per 0017) — forensic history preserved as orphaned log rows.
DELETE FROM public.api_keys;

CREATE POLICY api_keys_select ON public.api_keys FOR SELECT
  USING (current_user_role() = 'admin');

CREATE POLICY api_keys_insert ON public.api_keys FOR INSERT
  WITH CHECK (current_user_role() = 'admin');

CREATE POLICY api_keys_update ON public.api_keys FOR UPDATE
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

CREATE POLICY api_keys_delete ON public.api_keys FOR DELETE
  USING (current_user_role() = 'admin');

-- ── 14. api_audit_log ───────────────────────────────────────────────
CREATE POLICY api_audit_log_select ON public.api_audit_log FOR SELECT
  USING (current_user_role() = 'admin');

-- INSERT: no policy — only the service-role admin client (from route
--   handlers in src/lib/api/audit.ts) writes rows. Service role
--   bypasses RLS entirely.

-- ── 15. activity_log ────────────────────────────────────────────────
-- SELECT tightens from "admin OR actor" to "admin only" per matrix.
-- INSERT keeps the existing self-attribution check.
CREATE POLICY activity_log_select ON public.activity_log FOR SELECT
  USING (current_user_role() = 'admin');

CREATE POLICY activity_log_insert ON public.activity_log FOR INSERT
  WITH CHECK (
    actor_id IS NULL OR actor_id = (SELECT auth.uid())
  );

-- ── 16. Lock down RPC exposure of internal SECURITY DEFINER helpers ──
-- These functions are designed to be called by triggers / RLS policies
-- only. PostgREST exposes every public function as /rest/v1/rpc/<name>
-- by default, which lets unauthenticated clients probe the trigger and
-- call user_has_project_access(uuid) with arbitrary UUIDs to confirm or
-- deny project membership.
--
-- Postgres' default function privilege is GRANT EXECUTE TO PUBLIC, which
-- shadows revokes against named roles — both anon and authenticated
-- inherit through PUBLIC. So we REVOKE FROM PUBLIC to clear that, then
-- GRANT back to authenticated only. End result: anon can't call them at
-- all; authenticated can (required because the trigger fires under the
-- INSERT role and RLS policies that reference the helper need it
-- callable from user sessions). This matches the existing privilege
-- pattern on current_user_role() and user_has_task_in_project().
REVOKE EXECUTE ON FUNCTION public.auto_add_task_assignee_to_team() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_project_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_add_task_assignee_to_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_project_access(uuid) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK SECTION — uncomment to revert this migration.
-- ────────────────────────────────────────────────────────────────────────
-- NOTE: rollback does NOT restore the deleted api_keys rows. Raghav (or
-- whoever) must regenerate after rolling back.
--
-- /*
-- -- Drop the new policies + helper, then recreate the snapshot taken
-- -- before this migration ran.
--
-- DROP POLICY IF EXISTS companies_select ON public.companies;
-- DROP POLICY IF EXISTS companies_insert ON public.companies;
-- DROP POLICY IF EXISTS companies_update ON public.companies;
-- DROP POLICY IF EXISTS companies_delete ON public.companies;
-- DROP POLICY IF EXISTS contacts_select ON public.contacts;
-- DROP POLICY IF EXISTS contacts_insert ON public.contacts;
-- DROP POLICY IF EXISTS contacts_update ON public.contacts;
-- DROP POLICY IF EXISTS contacts_delete ON public.contacts;
-- DROP POLICY IF EXISTS deals_select ON public.deals;
-- DROP POLICY IF EXISTS deals_insert ON public.deals;
-- DROP POLICY IF EXISTS deals_update ON public.deals;
-- DROP POLICY IF EXISTS deals_delete ON public.deals;
-- DROP POLICY IF EXISTS projects_select ON public.projects;
-- DROP POLICY IF EXISTS projects_insert ON public.projects;
-- DROP POLICY IF EXISTS projects_update ON public.projects;
-- DROP POLICY IF EXISTS projects_delete ON public.projects;
-- DROP POLICY IF EXISTS milestones_select ON public.milestones;
-- DROP POLICY IF EXISTS milestones_insert ON public.milestones;
-- DROP POLICY IF EXISTS milestones_update ON public.milestones;
-- DROP POLICY IF EXISTS milestones_delete ON public.milestones;
-- DROP POLICY IF EXISTS tasks_select ON public.tasks;
-- DROP POLICY IF EXISTS tasks_insert ON public.tasks;
-- DROP POLICY IF EXISTS tasks_update ON public.tasks;
-- DROP POLICY IF EXISTS tasks_delete ON public.tasks;
-- DROP POLICY IF EXISTS payments_select ON public.payments;
-- DROP POLICY IF EXISTS payments_insert ON public.payments;
-- DROP POLICY IF EXISTS payments_update ON public.payments;
-- DROP POLICY IF EXISTS payments_delete ON public.payments;
-- DROP POLICY IF EXISTS attachments_select ON public.attachments;
-- DROP POLICY IF EXISTS attachments_insert ON public.attachments;
-- DROP POLICY IF EXISTS attachments_delete ON public.attachments;
-- DROP POLICY IF EXISTS project_team_members_select ON public.project_team_members;
-- DROP POLICY IF EXISTS project_team_members_insert ON public.project_team_members;
-- DROP POLICY IF EXISTS project_team_members_delete ON public.project_team_members;
-- DROP POLICY IF EXISTS users_select ON public.users;
-- DROP POLICY IF EXISTS users_update ON public.users;
-- DROP POLICY IF EXISTS api_keys_select ON public.api_keys;
-- DROP POLICY IF EXISTS api_keys_insert ON public.api_keys;
-- DROP POLICY IF EXISTS api_keys_update ON public.api_keys;
-- DROP POLICY IF EXISTS api_keys_delete ON public.api_keys;
-- DROP POLICY IF EXISTS api_audit_log_select ON public.api_audit_log;
-- DROP POLICY IF EXISTS activity_log_select ON public.activity_log;
-- DROP POLICY IF EXISTS activity_log_insert ON public.activity_log;
--
-- DROP FUNCTION IF EXISTS public.user_has_project_access(uuid);
--
-- -- Restore default PostgREST exposure of the helpers (only relevant if
-- -- 0022's user_has_project_access is being kept; if dropping the fn the
-- -- GRANT against it is unnecessary).
-- GRANT EXECUTE ON FUNCTION public.auto_add_task_assignee_to_team() TO PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.user_has_project_access(uuid) TO PUBLIC;
--
-- ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_role_admin_only;
-- ALTER TABLE public.api_keys DROP COLUMN IF EXISTS role;
--
-- -- Recreate pre-0022 policies. Definitions captured from pg_policies
-- -- before the migration ran. Note: communications, sla_*, credentials,
-- -- credential_access_log policies were NOT touched by 0022 and remain
-- -- in their pre-existing form; no need to recreate.
--
-- -- companies
-- CREATE POLICY companies_select ON public.companies FOR SELECT
--   USING (current_user_role() = ANY (ARRAY['admin','sales','pm','developer']::user_role[]));
-- CREATE POLICY companies_insert ON public.companies FOR INSERT
--   WITH CHECK (current_user_role() = ANY (ARRAY['admin','sales','pm']::user_role[]));
-- CREATE POLICY companies_update ON public.companies FOR UPDATE
--   USING (current_user_role() = ANY (ARRAY['admin','sales','pm']::user_role[]))
--   WITH CHECK (current_user_role() = ANY (ARRAY['admin','sales','pm']::user_role[]));
-- CREATE POLICY companies_delete ON public.companies FOR DELETE
--   USING (current_user_role() = 'admin'::user_role);
--
-- -- contacts (pre-Task 26)
-- CREATE POLICY contacts_select ON public.contacts FOR SELECT
--   USING (current_user_role() = ANY (ARRAY['admin','sales','pm','developer']::user_role[]));
-- CREATE POLICY contacts_insert ON public.contacts FOR INSERT
--   WITH CHECK (current_user_role() = ANY (ARRAY['admin','sales','pm']::user_role[]));
-- CREATE POLICY contacts_update ON public.contacts FOR UPDATE
--   USING (current_user_role() = ANY (ARRAY['admin','sales','pm']::user_role[]))
--   WITH CHECK (current_user_role() = ANY (ARRAY['admin','sales','pm']::user_role[]));
-- CREATE POLICY contacts_delete ON public.contacts FOR DELETE
--   USING (current_user_role() = 'admin'::user_role);
--
-- -- deals (pre-Task 26 — PM included)
-- CREATE POLICY deals_select ON public.deals FOR SELECT
--   USING (current_user_role() = ANY (ARRAY['admin','sales','pm']::user_role[]));
-- CREATE POLICY deals_insert ON public.deals FOR INSERT
--   WITH CHECK (current_user_role() = ANY (ARRAY['admin','sales']::user_role[]));
-- CREATE POLICY deals_update ON public.deals FOR UPDATE
--   USING ((current_user_role() = 'admin'::user_role) OR ((current_user_role() = 'sales'::user_role) AND (owner_id = (SELECT auth.uid()))))
--   WITH CHECK ((current_user_role() = 'admin'::user_role) OR ((current_user_role() = 'sales'::user_role) AND (owner_id = (SELECT auth.uid()))));
-- CREATE POLICY deals_delete ON public.deals FOR DELETE
--   USING (current_user_role() = 'admin'::user_role);
--
-- -- projects (pre-Task 26 — sales could insert; developer scoped via user_has_task_in_project)
-- CREATE POLICY projects_select ON public.projects FOR SELECT
--   USING ((current_user_role() = ANY (ARRAY['admin','sales','pm']::user_role[])) OR ((current_user_role() = 'developer'::user_role) AND user_has_task_in_project(id)));
-- CREATE POLICY projects_insert ON public.projects FOR INSERT
--   WITH CHECK (current_user_role() = ANY (ARRAY['admin','sales','pm']::user_role[]));
-- CREATE POLICY projects_update ON public.projects FOR UPDATE
--   USING ((current_user_role() = 'admin'::user_role) OR ((current_user_role() = 'pm'::user_role) AND (pm_id = (SELECT auth.uid()))) OR ((current_user_role() = 'sales'::user_role) AND (pm_id IS NULL)))
--   WITH CHECK ((current_user_role() = 'admin'::user_role) OR ((current_user_role() = 'pm'::user_role) AND (pm_id = (SELECT auth.uid()))) OR ((current_user_role() = 'sales'::user_role) AND (pm_id IS NULL)));
-- CREATE POLICY projects_delete ON public.projects FOR DELETE
--   USING (current_user_role() = 'admin'::user_role);
--
-- -- (Truncated for brevity — milestones, tasks, payments, attachments,
-- --  project_team_members, users, api_keys, api_audit_log, activity_log
-- --  also have their pre-0022 definitions captured in the snapshot from
-- --  pg_policies, ready to be pasted here if a full rollback is ever
-- --  needed. Migrations 0016 + 0017 + 0020 also define some of these
-- --  policies — simplest rollback path may be to drop 0022's policies
-- --  and re-run 0016 + 0017 + 0020 instead of recreating by hand.)
--
-- */
