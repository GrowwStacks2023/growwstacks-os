-- ============================================================================
-- 0002 Harden SECURITY DEFINER + trigger functions
-- ----------------------------------------------------------------------------
-- Addresses Supabase linter warnings raised after 0001:
--   * lint 0011: handle_updated_at had a mutable search_path
--   * lint 0028/0029: SECURITY DEFINER functions in the public schema are
--     RPC-callable by default. Trigger functions should never be callable
--     via /rest/v1/rpc; helper functions should only be callable by the
--     roles that actually need them.
-- ============================================================================

-- Pin search_path on the trigger function so the linter is happy and so the
-- function can never be subverted by a malicious search_path on the caller.
ALTER FUNCTION public.handle_updated_at() SET search_path = '';

-- Trigger functions: revoke EXECUTE from all client-facing roles. Triggers
-- fire regardless of EXECUTE grants, so this only blocks RPC abuse.
REVOKE ALL ON FUNCTION public.handle_new_user()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_user_self_update()  FROM PUBLIC, anon, authenticated;

-- current_user_role() is intentionally callable by signed-in users (apps may
-- want to read the caller's role) but should not be reachable by anon.
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
