-- ════════════════════════════════════════════════════════════════════════
-- 0017_api_audit_log
-- ────────────────────────────────────────────────────────────────────────
-- Append-only audit of every /api/v1/* request. Written by the route
-- handlers via the SERVICE-ROLE client (which bypasses RLS), since the
-- callers are API-key-authenticated and have no auth.uid().
--
-- We considered exposing a SECURITY DEFINER function instead — that
-- would let anonymous callers spam the audit table, since the function
-- would have to be EXECUTE-grantable to anon for the route handler's
-- session to use it. Service-role-from-trusted-server is the smaller
-- attack surface: no SQL function reachable from outside our server.
--
-- RLS: SELECT admin-only. No INSERT/UPDATE/DELETE policies — the only
-- writer is the service-role client which doesn't go through RLS.
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.api_audit_log (
  id          bigserial PRIMARY KEY,
  api_key_id  uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  method      text NOT NULL,
  path        text NOT NULL,
  status      integer NOT NULL,
  ip          text,
  user_agent  text,
  at          timestamptz NOT NULL DEFAULT now()
);

-- Per-key timeline: most common query is "show recent requests for key X".
CREATE INDEX IF NOT EXISTS api_audit_log_key_at_idx
  ON public.api_audit_log (api_key_id, at DESC);

-- Recent activity across all keys (for a future dashboard or quick
-- "who's hammering us right now").
CREATE INDEX IF NOT EXISTS api_audit_log_at_idx
  ON public.api_audit_log (at DESC);

ALTER TABLE public.api_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_audit_log_admin_select ON public.api_audit_log;
CREATE POLICY api_audit_log_admin_select ON public.api_audit_log
FOR SELECT TO authenticated
USING (public.current_user_role() = 'admin');
