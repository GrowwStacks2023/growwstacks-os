-- ════════════════════════════════════════════════════════════════════════
-- 0016_api_keys
-- ────────────────────────────────────────────────────────────────────────
-- API keys for the public /api/v1/* endpoints. Plaintext keys are never
-- stored: we keep a SHA-256 hash of the key plus a short prefix used in
-- the UI for identification ("gks_a1b2c3…"). Plaintext is shown to the
-- creator exactly once and then forgotten.
--
-- RLS: admin-only across all operations. Sales/PM/dev/client never see
-- the table. The API authenticator reads this table via the service-role
-- client (bypasses RLS) because incoming HTTP requests have no
-- auth.uid().
--
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.api_keys (
  id           uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name         text NOT NULL,
  -- SHA-256 hex digest of the plaintext key. 64 chars but text covers it.
  key_hash     text NOT NULL,
  -- First few visible chars (e.g. "gks_a1b2") used for at-a-glance
  -- identification in the integrations list and audit log. Not sensitive.
  key_prefix   text NOT NULL,
  scope        text NOT NULL,
  created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

-- Enforce known scope values + non-empty name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_scope_check'
  ) THEN
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_scope_check
      CHECK (scope IN ('read', 'read_write'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_name_not_blank'
  ) THEN
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_name_not_blank
      CHECK (length(trim(name)) > 0);
  END IF;
END $$;

-- key_hash must be globally unique — two keys cannot collide. Doubles as
-- the lookup index for the authenticator (single equality scan).
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_idx
  ON public.api_keys (key_hash);

-- Partial index on active (non-revoked) keys so the authenticator's
-- common path stays cheap.
CREATE INDEX IF NOT EXISTS api_keys_active_idx
  ON public.api_keys (key_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Admin-only policies. The four are separate so revocations explicit:
DROP POLICY IF EXISTS api_keys_admin_select ON public.api_keys;
CREATE POLICY api_keys_admin_select ON public.api_keys
FOR SELECT TO authenticated
USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS api_keys_admin_insert ON public.api_keys;
CREATE POLICY api_keys_admin_insert ON public.api_keys
FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS api_keys_admin_update ON public.api_keys;
CREATE POLICY api_keys_admin_update ON public.api_keys
FOR UPDATE TO authenticated
USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS api_keys_admin_delete ON public.api_keys;
CREATE POLICY api_keys_admin_delete ON public.api_keys
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');
