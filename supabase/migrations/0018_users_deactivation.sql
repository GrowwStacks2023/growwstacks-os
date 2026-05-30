-- ════════════════════════════════════════════════════════════════════════
-- 0018_users_deactivation
-- ────────────────────────────────────────────────────────────────────────
-- Soft-deactivate columns for public.users. `is_active` already exists
-- (added in 0001 with NOT NULL DEFAULT true), so this migration adds
-- only the audit columns:
--
--   deactivated_at  — when, NULL while active
--   deactivated_by  — admin id who flipped the switch
--
-- Plus a partial index for "find inactive users" queries (cheap; most
-- rows stay active).
--
-- No backfill. Existing rows have is_active=true and NULL deactivation
-- audit fields, which is the correct steady state for an active user.
--
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_inactive_idx
  ON public.users (is_active) WHERE is_active = false;

-- The existing enforce_user_self_update trigger already locks `is_active`
-- to admins-only, which is exactly the behaviour deactivate/reactivate
-- need. No trigger change.
