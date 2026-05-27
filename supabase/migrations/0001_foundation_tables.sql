-- ============================================================================
-- 0001 Foundation Tables
-- ----------------------------------------------------------------------------
-- Creates the four foundation tables (users, companies, contacts,
-- activity_log) along with the supporting ENUMs, helper functions, triggers,
-- indexes, and RLS policies. Idempotent where reasonable so re-running the
-- migration on a partially-applied database is safe.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
-- uuid-ossp gives us uuid_generate_v4() for table defaults.
-- pgcrypto will be used by the credentials table (task 3c) for at-rest
-- encryption of stored secrets.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;


-- ---------------------------------------------------------------------------
-- ENUMs
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin','sales','pm','developer','client');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.company_type AS ENUM ('client','prospect','partner');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger
-- ---------------------------------------------------------------------------
-- Re-usable trigger function. Every table with an updated_at column wires a
-- BEFORE UPDATE trigger to this function.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- Table: public.users
-- ---------------------------------------------------------------------------
-- Mirrors auth.users 1:1. Rows are created by the on_auth_user_created
-- trigger; direct INSERTs are blocked by RLS. The role enum is the source of
-- truth for our RBAC.
CREATE TABLE IF NOT EXISTS public.users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL UNIQUE,
  name       text,
  role       public.user_role NOT NULL DEFAULT 'developer',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ---------------------------------------------------------------------------
-- Table: public.companies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id                    uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name                  text NOT NULL,
  type                  public.company_type NOT NULL DEFAULT 'prospect',
  business_hours_start  time NOT NULL DEFAULT '09:00',
  business_hours_end    time NOT NULL DEFAULT '19:00',
  timezone              text NOT NULL DEFAULT 'Asia/Kolkata',
  created_by            uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS companies_updated_at ON public.companies;
CREATE TRIGGER companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ---------------------------------------------------------------------------
-- Table: public.contacts
-- ---------------------------------------------------------------------------
-- contacts.role is the contact's role at their company (e.g. "CTO"). It is
-- NOT related to public.user_role.
CREATE TABLE IF NOT EXISTS public.contacts (
  id         uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name       text NOT NULL,
  email      text,
  phone      text,
  whatsapp   text,
  role       text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS contacts_updated_at ON public.contacts;
CREATE TRIGGER contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ---------------------------------------------------------------------------
-- Table: public.activity_log
-- ---------------------------------------------------------------------------
-- Append-only audit table. No updated_at, no UPDATE/DELETE policies.
CREATE TABLE IF NOT EXISTS public.activity_log (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  action        text NOT NULL,
  actor_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  before_state  jsonb,
  after_state   jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS users_role_active_idx
  ON public.users (role) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS companies_type_idx
  ON public.companies (type);
CREATE INDEX IF NOT EXISTS companies_created_at_idx
  ON public.companies (created_at DESC);

CREATE INDEX IF NOT EXISTS contacts_company_id_idx
  ON public.contacts (company_id);
CREATE INDEX IF NOT EXISTS contacts_email_idx
  ON public.contacts (email);

CREATE INDEX IF NOT EXISTS activity_log_entity_idx
  ON public.activity_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_actor_idx
  ON public.activity_log (actor_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- Auth -> public.users sync
-- ---------------------------------------------------------------------------
-- When someone signs up via Supabase Auth, mirror them into public.users.
-- SECURITY DEFINER so the trigger can write to public.users regardless of
-- the calling role. New users always start as 'developer'; an admin must
-- manually upgrade their role afterwards.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'developer',
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------------------
-- Role helper for RLS
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so policies on public.users don't recurse when checking
-- the caller's own role. Returns NULL for unauthenticated callers.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;


-- ---------------------------------------------------------------------------
-- Column-level guard for self-updates on public.users
-- ---------------------------------------------------------------------------
-- RLS controls row visibility, not which columns a user may change. We use a
-- BEFORE UPDATE trigger to enforce that non-admins can only change their own
-- `name` (not role / is_active / email).
CREATE OR REPLACE FUNCTION public.enforce_user_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  caller_role := public.current_user_role();

  -- Admins may modify any column on any row.
  IF caller_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Non-admins may only modify their own row.
  IF NEW.id <> OLD.id OR NEW.id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized to modify this user row';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role can only be changed by an admin';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'is_active can only be changed by an admin';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'email is managed by Supabase Auth and cannot be changed here';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_enforce_self_update ON public.users;
CREATE TRIGGER users_enforce_self_update
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_user_self_update();


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;


-- -------- public.users policies --------
-- SELECT: admin sees everyone; sales/pm/developer see all active users so
-- the team directory works. Clients (v2) see nothing here.
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users
FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR (
    is_active = true
    AND public.current_user_role() IN ('sales','pm','developer')
  )
);

-- No INSERT policy: rows are inserted only by the on_auth_user_created
-- SECURITY DEFINER trigger.

-- UPDATE: admin can update any row; everyone else only their own. The
-- column-level guard trigger enforces which columns may change.
DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users
FOR UPDATE TO authenticated
USING (
  public.current_user_role() = 'admin' OR id = auth.uid()
)
WITH CHECK (
  public.current_user_role() = 'admin' OR id = auth.uid()
);

-- DELETE: admin only. In practice we soft-delete via is_active.
DROP POLICY IF EXISTS users_delete ON public.users;
CREATE POLICY users_delete ON public.users
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');


-- -------- public.companies policies --------
-- 3a simplification: developer can SELECT all companies. We'll tighten this
-- in 3c once projects/tasks exist and we can scope by assignment.
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm','developer')
);

DROP POLICY IF EXISTS companies_insert ON public.companies;
CREATE POLICY companies_insert ON public.companies
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin','sales','pm')
);

-- 3a simplification: pm can update any company. Tightened in 3c.
DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_update ON public.companies
FOR UPDATE TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
)
WITH CHECK (
  public.current_user_role() IN ('admin','sales','pm')
);

DROP POLICY IF EXISTS companies_delete ON public.companies;
CREATE POLICY companies_delete ON public.companies
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');


-- -------- public.contacts policies --------
DROP POLICY IF EXISTS contacts_select ON public.contacts;
CREATE POLICY contacts_select ON public.contacts
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm','developer')
);

DROP POLICY IF EXISTS contacts_insert ON public.contacts;
CREATE POLICY contacts_insert ON public.contacts
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin','sales','pm')
);

DROP POLICY IF EXISTS contacts_update ON public.contacts;
CREATE POLICY contacts_update ON public.contacts
FOR UPDATE TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
)
WITH CHECK (
  public.current_user_role() IN ('admin','sales','pm')
);

DROP POLICY IF EXISTS contacts_delete ON public.contacts;
CREATE POLICY contacts_delete ON public.contacts
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');


-- -------- public.activity_log policies --------
-- Append-only: SELECT and INSERT only. No UPDATE / DELETE policies.
DROP POLICY IF EXISTS activity_log_select ON public.activity_log;
CREATE POLICY activity_log_select ON public.activity_log
FOR SELECT TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR actor_id = auth.uid()
);

DROP POLICY IF EXISTS activity_log_insert ON public.activity_log;
CREATE POLICY activity_log_insert ON public.activity_log
FOR INSERT TO authenticated
WITH CHECK (
  actor_id IS NULL OR actor_id = auth.uid()
);
