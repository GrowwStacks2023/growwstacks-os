-- ============================================================================
-- 0006 Tighten communications + sla_breaches INSERT policies
-- ----------------------------------------------------------------------------
-- Addresses Supabase linter findings raised after 0005:
--   * lint 0024 (rls_policy_always_true): communications_insert and
--     sla_breaches_insert were created with WITH CHECK (true). The linter
--     flags this as effectively bypassing RLS for authenticated.
--
-- The two remaining advisor WARNs (SECURITY DEFINER + EXECUTE-to-authenticated
-- on current_user_role() and user_has_task_in_project()) and the unrelated
-- auth-side "leaked password protection" notice are accepted by design and
-- already documented in 0004's preamble.
--
-- Notes on intent:
--   * n8n flows that ingest external messages run with the service role and
--     bypass RLS, so tightening these policies does not break automated
--     ingestion. The check only applies to app-level INSERTs from signed-in
--     users.
--   * For communications: any non-client role can write (devs may log phone
--     calls they took, sales writes outbound emails, etc.). We also forbid
--     forging `replied_by` to attribute a reply to someone else.
--   * For sla_breaches: only admin and PM can hand-create a breach record
--     from the app. The SLA engine (v3) writes via the service role.
-- ============================================================================


-- -------- public.communications --------
DROP POLICY IF EXISTS communications_insert ON public.communications;
CREATE POLICY communications_insert ON public.communications
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin','sales','pm','developer')
  AND (
    replied_by IS NULL
    OR replied_by = (SELECT auth.uid())
  )
);


-- -------- public.sla_breaches --------
DROP POLICY IF EXISTS sla_breaches_insert ON public.sla_breaches;
CREATE POLICY sla_breaches_insert ON public.sla_breaches
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin','pm')
);
