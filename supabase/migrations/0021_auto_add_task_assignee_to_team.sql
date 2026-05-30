-- ════════════════════════════════════════════════════════════════════════
-- 0021_auto_add_task_assignee_to_team
-- ────────────────────────────────────────────────────────────────────────
-- Bridges the "team" and "assigned a task" paths to project visibility
-- for developers. When a task is created OR its assignee_id changes,
-- and the new assignee is a developer, ensure they have a corresponding
-- project_team_members row. One-way add only — admins/PMs remove
-- manually when the developer rolls off.
--
-- After this migration, "is on the team" and "has a task on this
-- project" converge in normal operation for developers. The
-- application-layer union (team OR has-task) becomes a safety net
-- against historical drift, not the primary path.
--
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_add_task_assignee_to_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  assignee_role public.user_role;
BEGIN
  -- Standalone tasks (no project) and unassigned tasks: nothing to do.
  IF NEW.assignee_id IS NULL OR NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only auto-add developers. Admins/PMs/sales don't need explicit
  -- team rows — they reach the project via canAccess/canEdit.
  SELECT role INTO assignee_role
  FROM public.users
  WHERE id = NEW.assignee_id;

  IF assignee_role IS DISTINCT FROM 'developer' THEN
    RETURN NEW;
  END IF;

  -- Idempotent: re-assigning to the same person is a no-op.
  -- added_by is set to the assignee themselves — the trigger can't
  -- know which admin/PM actually performed the assignment without
  -- session-var plumbing. The activity_log row for the task create/
  -- update has the actual actor and timestamps if needed for audit.
  INSERT INTO public.project_team_members (project_id, user_id, added_by)
  VALUES (NEW.project_id, NEW.assignee_id, NEW.assignee_id)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.auto_add_task_assignee_to_team()
  SET search_path = pg_catalog, public;

COMMENT ON FUNCTION public.auto_add_task_assignee_to_team() IS
  'When a task assignee_id is set to a developer, ensure they are also on the project team. Idempotent. Never removes from team — PM/admin remove manually.';

DROP TRIGGER IF EXISTS tasks_auto_add_assignee_to_team ON public.tasks;
CREATE TRIGGER tasks_auto_add_assignee_to_team
  AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_task_assignee_to_team();

-- ── Backfill ─────────────────────────────────────────────────────────
-- Every existing developer task-assignee gets a corresponding team-
-- member row. After this runs, the team_members filter and the
-- has-task filter agree for all current data.
INSERT INTO public.project_team_members (project_id, user_id, added_by)
SELECT DISTINCT t.project_id, t.assignee_id, t.assignee_id
FROM public.tasks t
JOIN public.users u ON u.id = t.assignee_id
WHERE t.assignee_id IS NOT NULL
  AND t.project_id IS NOT NULL
  AND u.role = 'developer'
ON CONFLICT (project_id, user_id) DO NOTHING;
