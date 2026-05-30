-- ════════════════════════════════════════════════════════════════════════
-- 0019_users_tombstone
-- ────────────────────────────────────────────────────────────────────────
-- Hard-delete-user support (admin only) via the "tombstone" pattern.
--
-- Why this isn't a straight `DELETE FROM public.users`:
--   Every entity table references public.users (assignee_id, pm_id,
--   recorded_by, created_by, actor_id, ...). A real DELETE would
--   either fail (NO ACTION FKs) or cascade and destroy history.
--
-- The tombstone:
--   1. Mark the row with `deleted_at = now()`. UI filters tombstoned
--      users out of pickers and surfaces a "Former" pill where they
--      still appear in historical records (task assignee on a closed
--      task, etc.).
--   2. Hard-delete the corresponding auth.users row so the user can
--      never sign in again. Re-inviting the same email creates a fresh
--      auth.users row but a NEW public.users row (the tombstoned row
--      is keyed on the old uuid, no collision).
--
-- The critical blocker found in audit: `public.users.id` was originally
-- `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`. With
-- CASCADE in place, deleting from auth.users would wipe the public.users
-- row too and break every FK pointing at it. This migration drops the
-- CASCADE FK and recreates the constraint as NO ACTION — auth.users
-- deletes no longer touch public.users.
--
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════════

-- Tombstone columns.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS users_deleted_at_idx
  ON public.users (deleted_at) WHERE deleted_at IS NOT NULL;

-- Drop the ON DELETE CASCADE FK from public.users.id → auth.users(id).
-- Recreate WITHOUT a delete action — the tombstone row must outlive
-- auth.users deletion. Without the FK present at all, an admin can
-- INSERT a public.users row with any UUID; we keep the constraint for
-- referential integrity at INSERT time but make the delete action
-- explicit (NO ACTION = "don't touch dependent rows on parent delete").
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_id_fkey'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_id_fkey;
  END IF;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE NO ACTION;

-- Tombstoned users are inactive by definition. Belt-and-braces: a CHECK
-- that says "if deleted_at is set, is_active must be false."
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_tombstone_inactive_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_tombstone_inactive_check
      CHECK (deleted_at IS NULL OR is_active = false);
  END IF;
END $$;
