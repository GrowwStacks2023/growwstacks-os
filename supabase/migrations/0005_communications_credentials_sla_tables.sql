-- ============================================================================
-- 0005 Communications, Credentials, and SLA Tables
-- ----------------------------------------------------------------------------
-- Final v1 schema migration. Builds on 0001-0004. Adds five tables:
--   * communications      — unified inbound/outbound across all channels
--   * sla_rules           — per-company SLA tiers (with a system default row)
--   * sla_breaches        — instances where an inbound message went unanswered
--   * credentials         — client logins, encrypted at the app layer
--   * credential_access_log — append-only audit of every credential read/edit
--
-- Idempotent (DROP POLICY IF EXISTS, CREATE TABLE IF NOT EXISTS, etc.) so this
-- file can safely re-run on a partially-applied database.
--
-- ============================================================================
-- SECURITY MODEL for `credentials` (READ THIS BEFORE TOUCHING THIS TABLE)
-- ----------------------------------------------------------------------------
-- 1. The `encrypted_value` and `notes_encrypted` columns are OPAQUE TEXT to
--    Postgres. This migration deliberately performs NO encryption: no pgcrypto
--    calls, no pgsodium, no `encrypt()` / `decrypt()` triggers. Encryption and
--    decryption happen entirely in the application layer (Cloudflare Worker
--    runtime, key in Cloudflare secrets) before INSERT and after SELECT.
--    Rationale: keeping the key out of the database keeps it out of dumps,
--    backups, advisor logs, and pg_stat_activity.
--
-- 2. `encryption_version` (smallint, default 1) exists so we can support key
--    rotation later without altering schema. The app reads this column on
--    SELECT to choose which key to decrypt with.
--
-- 3. Postgres has NO SELECT triggers. Therefore every credential READ must be
--    logged to `credential_access_log` by the APPLICATION code immediately
--    after a successful decrypt. There is no database-side enforcement of
--    this. Treat any code path that reads `credentials.encrypted_value`
--    without also INSERTing to `credential_access_log` as a security bug.
--
-- 4. UPDATE / DELETE on credentials are likewise expected to be accompanied
--    by an app-layer INSERT into credential_access_log. We intentionally did
--    NOT add AFTER UPDATE / AFTER DELETE triggers that auto-log, because the
--    `access_type` taxonomy ('reveal', 'update', 'delete', 'copy') needs
--    user-intent context (e.g. 'copy' vs 'reveal') that the DB can't infer.
--    Adding such triggers as a belt-and-suspenders measure is a future
--    consideration once the app-layer flow is shipped and proven.
--
-- 5. RLS on credentials is intentionally narrow: only admin and pm can SELECT.
--    Developers and sales NEVER read credentials directly. The future "request
--    a reveal" flow (v2) will mediate developer access via a server action
--    that elevates with the service role and writes an access_log row.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- ENUMs
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.comm_channel AS ENUM
    ('outlook','whatsapp','upwork','slack','email','sms','phone');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.comm_direction AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sla_state AS ENUM
    ('none','pending','breached_l1','breached_l2','breached_l3','resolved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.credential_type AS ENUM
    ('cms','hosting','social_media','email','analytics','database','api_key','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- Table: public.communications
-- ---------------------------------------------------------------------------
-- Unified ledger of every inbound and outbound message, across every channel
-- the agency uses (Outlook, WhatsApp, Upwork, Slack, email, SMS, phone calls).
-- Most rows are written by n8n flows pulling from external platforms; the app
-- also writes outbound rows when a team member sends a reply.
--
-- thread_id is the EXTERNAL thread/conversation identifier from the source
-- platform (e.g. Slack thread_ts, WhatsApp conversation id). external_id is
-- the source platform's per-message ID, used for dedup via a partial UNIQUE.
--
-- requires_reply, reply_due_at, sla_state are filled in by the SLA engine
-- (v3) — they default to false / NULL / 'none' so non-SLA flows don't break.
CREATE TABLE IF NOT EXISTS public.communications (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  channel         public.comm_channel NOT NULL,
  direction       public.comm_direction NOT NULL,
  thread_id       text,
  external_id     text,
  company_id      uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id      uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  deal_id         uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  sender          text NOT NULL,
  recipient       text,
  subject         text,
  body            text,
  requires_reply  boolean NOT NULL DEFAULT false,
  reply_due_at    timestamptz,
  sla_state       public.sla_state NOT NULL DEFAULT 'none',
  replied_at      timestamptz,
  replied_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  received_at     timestamptz NOT NULL,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS communications_updated_at ON public.communications;
CREATE TRIGGER communications_updated_at
BEFORE UPDATE ON public.communications
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ---------------------------------------------------------------------------
-- Table: public.sla_rules
-- ---------------------------------------------------------------------------
-- Per-company SLA configuration. company_id IS NULL marks the SYSTEM DEFAULT
-- rule applied to any company without a custom one. The partial unique index
-- below uses NULLS NOT DISTINCT (Postgres 15+) so only ONE active system
-- default can exist at a time.
--
-- Tiers are minutes from received_at:
--   tier_1 → ping the assignee
--   tier_2 → ping the PM
--   tier_3 → ping Manish / admin
-- The app applies business-hours math (respect_business_hours) on top.
CREATE TABLE IF NOT EXISTS public.sla_rules (
  id                       uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  company_id               uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  tier_1_minutes           integer NOT NULL DEFAULT 60,
  tier_2_minutes           integer NOT NULL DEFAULT 240,
  tier_3_minutes           integer NOT NULL DEFAULT 1440,
  respect_business_hours   boolean NOT NULL DEFAULT true,
  is_active                boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS sla_rules_updated_at ON public.sla_rules;
CREATE TRIGGER sla_rules_updated_at
BEFORE UPDATE ON public.sla_rules
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ---------------------------------------------------------------------------
-- Table: public.sla_breaches
-- ---------------------------------------------------------------------------
-- One row per (communication, tier) that the SLA engine flagged. Append-only
-- in spirit, but UPDATE is allowed for admin/PM to record resolution.
-- notified_user_ids is the list of users we actually paged for this breach.
CREATE TABLE IF NOT EXISTS public.sla_breaches (
  id                 uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  communication_id   uuid NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
  tier               smallint NOT NULL CHECK (tier IN (1, 2, 3)),
  notified_user_ids  uuid[] NOT NULL DEFAULT '{}',
  notified_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz,
  resolution_note    text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
-- No updated_at on sla_breaches: resolution is the only mutation we expect,
-- and the resolved_at column itself records when it happened.


-- ---------------------------------------------------------------------------
-- Table: public.credentials
-- ---------------------------------------------------------------------------
-- Client logins (CMS, hosting, social media, etc.). See the SECURITY MODEL
-- block at the top of this file for the encryption contract — TL;DR:
-- encrypted_value and notes_encrypted are opaque ciphertext, encrypted in the
-- application layer using a key kept in Cloudflare secrets. This migration
-- adds no encrypt/decrypt functions.
CREATE TABLE IF NOT EXISTS public.credentials (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id          uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  label               text NOT NULL,
  credential_type     public.credential_type NOT NULL,
  username            text,
  encrypted_value     text NOT NULL,
  encryption_version  smallint NOT NULL DEFAULT 1,
  notes_encrypted     text,
  url                 text,
  last_rotated_at     timestamptz,
  expires_at          timestamptz,
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS credentials_updated_at ON public.credentials;
CREATE TRIGGER credentials_updated_at
BEFORE UPDATE ON public.credentials
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ---------------------------------------------------------------------------
-- Table: public.credential_access_log
-- ---------------------------------------------------------------------------
-- Append-only audit trail. INSERTed by app code on every credential read,
-- update, delete, or copy. No updated_at, no UPDATE / DELETE policies — the
-- DB enforces append-only by simply not granting those rights via RLS.
CREATE TABLE IF NOT EXISTS public.credential_access_log (
  id             uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  credential_id  uuid NOT NULL REFERENCES public.credentials(id) ON DELETE CASCADE,
  accessed_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  access_type    text NOT NULL,
  reason         text,
  ip_address     inet,
  user_agent     text,
  accessed_at    timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- communications
CREATE INDEX IF NOT EXISTS communications_company_received_idx
  ON public.communications (company_id, received_at DESC);

CREATE INDEX IF NOT EXISTS communications_open_sla_idx
  ON public.communications (sla_state, reply_due_at)
  WHERE sla_state IN ('pending', 'breached_l1', 'breached_l2');

CREATE INDEX IF NOT EXISTS communications_project_received_idx
  ON public.communications (project_id, received_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS communications_deal_received_idx
  ON public.communications (deal_id, received_at DESC)
  WHERE deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS communications_thread_id_idx
  ON public.communications (thread_id)
  WHERE thread_id IS NOT NULL;

-- Dedup constraint AND lookup index for (channel, external_id). Partial so
-- NULL external_ids (outbound messages we originated, no source-platform id)
-- are not subject to the unique constraint.
CREATE UNIQUE INDEX IF NOT EXISTS communications_channel_external_id_uniq
  ON public.communications (channel, external_id)
  WHERE external_id IS NOT NULL;

-- FK-covering indexes (avoid lint 0001 like we did in 0004).
CREATE INDEX IF NOT EXISTS communications_contact_id_idx
  ON public.communications (contact_id) WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS communications_replied_by_idx
  ON public.communications (replied_by) WHERE replied_by IS NOT NULL;


-- sla_rules
-- Partial UNIQUE index. NULLS NOT DISTINCT (Postgres 15+) ensures only ONE
-- active row with company_id IS NULL — the global system default.
CREATE UNIQUE INDEX IF NOT EXISTS sla_rules_company_active_uniq
  ON public.sla_rules (company_id) NULLS NOT DISTINCT
  WHERE is_active = true;

-- FK-covering index for ON DELETE CASCADE from companies. The unique index
-- above is too narrow (it filters is_active = true) to serve cascade lookups
-- for inactive rows, so we add a non-is_active-filtered companion.
CREATE INDEX IF NOT EXISTS sla_rules_company_id_idx
  ON public.sla_rules (company_id) WHERE company_id IS NOT NULL;


-- sla_breaches
CREATE INDEX IF NOT EXISTS sla_breaches_communication_idx
  ON public.sla_breaches (communication_id);

CREATE INDEX IF NOT EXISTS sla_breaches_open_idx
  ON public.sla_breaches (resolved_at) WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS sla_breaches_tier_notified_idx
  ON public.sla_breaches (tier, notified_at DESC);


-- credentials
CREATE INDEX IF NOT EXISTS credentials_company_active_idx
  ON public.credentials (company_id, is_active);

CREATE INDEX IF NOT EXISTS credentials_project_idx
  ON public.credentials (project_id) WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS credentials_expiring_idx
  ON public.credentials (expires_at)
  WHERE expires_at IS NOT NULL AND is_active = true;

-- FK-covering for credentials.created_by.
CREATE INDEX IF NOT EXISTS credentials_created_by_idx
  ON public.credentials (created_by) WHERE created_by IS NOT NULL;


-- credential_access_log
CREATE INDEX IF NOT EXISTS credential_access_log_credential_idx
  ON public.credential_access_log (credential_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS credential_access_log_user_idx
  ON public.credential_access_log (accessed_by, accessed_at DESC);


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.communications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_rules              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_breaches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credential_access_log  ENABLE ROW LEVEL SECURITY;


-- -------- public.communications policies --------
-- SELECT: admin/sales/pm see everything; developers see ONLY communications
-- that are attached to a project they have a task on. Comms without a
-- project_id (e.g. lead emails before a project exists) are sales/pm-only.
DROP POLICY IF EXISTS communications_select ON public.communications;
CREATE POLICY communications_select ON public.communications
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
  OR (
    public.current_user_role() = 'developer'
    AND project_id IS NOT NULL
    AND public.user_has_task_in_project(project_id)
  )
);

-- INSERT: any authenticated user (app and n8n both write here). Per-channel
-- scoping is the app's job; the DB just makes sure the row is well-formed.
DROP POLICY IF EXISTS communications_insert ON public.communications;
CREATE POLICY communications_insert ON public.communications
FOR INSERT TO authenticated
WITH CHECK (true);

-- UPDATE: admin/sales/pm. Developers cannot edit communications (e.g. cannot
-- mark a message as replied on behalf of someone else).
DROP POLICY IF EXISTS communications_update ON public.communications;
CREATE POLICY communications_update ON public.communications
FOR UPDATE TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
)
WITH CHECK (
  public.current_user_role() IN ('admin','sales','pm')
);

DROP POLICY IF EXISTS communications_delete ON public.communications;
CREATE POLICY communications_delete ON public.communications
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');


-- -------- public.sla_rules policies --------
-- Developers never need SLA rules — they're an ops/sales concern.
DROP POLICY IF EXISTS sla_rules_select ON public.sla_rules;
CREATE POLICY sla_rules_select ON public.sla_rules
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
);

DROP POLICY IF EXISTS sla_rules_insert ON public.sla_rules;
CREATE POLICY sla_rules_insert ON public.sla_rules
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin','pm')
);

DROP POLICY IF EXISTS sla_rules_update ON public.sla_rules;
CREATE POLICY sla_rules_update ON public.sla_rules
FOR UPDATE TO authenticated
USING (
  public.current_user_role() IN ('admin','pm')
)
WITH CHECK (
  public.current_user_role() IN ('admin','pm')
);

DROP POLICY IF EXISTS sla_rules_delete ON public.sla_rules;
CREATE POLICY sla_rules_delete ON public.sla_rules
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');


-- -------- public.sla_breaches policies --------
-- SELECT: admin/pm always. Developers see only breaches on communications
-- attached to a project they have a task on. Sales sees nothing here (the
-- SLA queue is owned by delivery).
DROP POLICY IF EXISTS sla_breaches_select ON public.sla_breaches;
CREATE POLICY sla_breaches_select ON public.sla_breaches
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','pm')
  OR (
    public.current_user_role() = 'developer'
    AND EXISTS (
      SELECT 1 FROM public.communications c
      WHERE c.id = sla_breaches.communication_id
        AND c.project_id IS NOT NULL
        AND public.user_has_task_in_project(c.project_id)
    )
  )
);

-- INSERT: any authenticated user. The SLA engine (v3) and any backfill jobs
-- write breaches; the actual decision logic lives upstream.
DROP POLICY IF EXISTS sla_breaches_insert ON public.sla_breaches;
CREATE POLICY sla_breaches_insert ON public.sla_breaches
FOR INSERT TO authenticated
WITH CHECK (true);

-- UPDATE: admin/pm only, to set resolved_at and resolution_note.
DROP POLICY IF EXISTS sla_breaches_update ON public.sla_breaches;
CREATE POLICY sla_breaches_update ON public.sla_breaches
FOR UPDATE TO authenticated
USING (
  public.current_user_role() IN ('admin','pm')
)
WITH CHECK (
  public.current_user_role() IN ('admin','pm')
);

DROP POLICY IF EXISTS sla_breaches_delete ON public.sla_breaches;
CREATE POLICY sla_breaches_delete ON public.sla_breaches
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');


-- -------- public.credentials policies --------
-- 3c SIMPLIFICATION (matches 3a / 3b pattern): any user with role 'pm' sees
-- all credentials. The eventual scoping is "PM sees credentials for projects
-- and companies they manage" — but we don't yet have a rich PM-to-company
-- assignment table, and walking through projects.pm_id would let a PM lose
-- visibility the moment a project changes hands. Revisit this once
-- pm_assignments (or equivalent) lands.
DROP POLICY IF EXISTS credentials_select ON public.credentials;
CREATE POLICY credentials_select ON public.credentials
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','pm')
);

DROP POLICY IF EXISTS credentials_insert ON public.credentials;
CREATE POLICY credentials_insert ON public.credentials
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin','pm')
);

DROP POLICY IF EXISTS credentials_update ON public.credentials;
CREATE POLICY credentials_update ON public.credentials
FOR UPDATE TO authenticated
USING (
  public.current_user_role() IN ('admin','pm')
)
WITH CHECK (
  public.current_user_role() IN ('admin','pm')
);

DROP POLICY IF EXISTS credentials_delete ON public.credentials;
CREATE POLICY credentials_delete ON public.credentials
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');


-- -------- public.credential_access_log policies --------
-- SELECT: same audience as credentials SELECT (admin and pm). Tightening
-- this is the same deferred-work item flagged on credentials above.
DROP POLICY IF EXISTS credential_access_log_select ON public.credential_access_log;
CREATE POLICY credential_access_log_select ON public.credential_access_log
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','pm')
);

-- INSERT: any authenticated user. The app writes a row whenever it decrypts
-- a credential (or performs a credential UPDATE / DELETE / COPY action). We
-- only require that a forged accessed_by claim matches the caller — mirrors
-- activity_log_insert from 0001.
DROP POLICY IF EXISTS credential_access_log_insert ON public.credential_access_log;
CREATE POLICY credential_access_log_insert ON public.credential_access_log
FOR INSERT TO authenticated
WITH CHECK (
  accessed_by IS NULL OR accessed_by = (SELECT auth.uid())
);

-- No UPDATE or DELETE policies on credential_access_log — the absence of an
-- ALL/UPDATE/DELETE policy under RLS = "deny" for non-superuser roles. This
-- is what makes the log append-only.
