-- ============================================================================
-- seed_dummy_data.sql — dev-only test data for GrowwStacks OS
-- ----------------------------------------------------------------------------
-- Run with the Supabase service role (e.g. via the MCP execute_sql tool or
-- `supabase db query`). This file is NOT a migration: it lives outside the
-- migrations/ folder so it never runs as part of schema deploys.
--
-- Idempotent: every row uses a stable UUID and ON CONFLICT (id) DO NOTHING,
-- so re-running this script will not create duplicates and will not modify
-- existing rows (so any manual edits you make to seeded data are preserved).
--
-- Respects:
--   * The project -> milestones -> tasks hierarchy
--   * milestones (project_id, sequence) unique constraint
--   * tasks consistency trigger: tasks.project_id == milestone.project_id
--   * RLS is bypassed by the service role; running as a normal user would
--     also work for an admin, but seed data is dev-only so service role is
--     the intended path.
--
-- Prerequisite: a row in public.users with email
--   raghav.joshi@growwstacks.com
-- (admin). The seed errors out if that row is missing.
-- ============================================================================

BEGIN;

-- Sanity check on the prerequisite user. Use \gset-free PL/pgSQL so this can
-- be pasted directly into psql / MCP without client-side variables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'
  ) THEN
    RAISE EXCEPTION
      'seed_dummy_data.sql: user raghav.joshi@growwstacks.com is missing — sign in once via the app to provision the row, then re-run.';
  END IF;
END
$$;


-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
-- Stable UUIDs deliberately chosen with a recognisable prefix so they are
-- easy to spot in logs. Existing "test" company (created via the app) is
-- left untouched.
INSERT INTO public.companies (id, name, type, timezone, created_by)
VALUES
  ('11111111-1111-1111-1111-000000000001',
   'Acme Robotics',
   'client',
   'America/Los_Angeles',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com')),
  ('11111111-1111-1111-1111-000000000002',
   'Northwind Labs',
   'client',
   'Europe/London',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com')),
  ('11111111-1111-1111-1111-000000000003',
   'Vertex Health',
   'prospect',
   'Asia/Kolkata',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'))
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------
INSERT INTO public.contacts (id, company_id, name, email, phone, role, is_primary)
VALUES
  ('22222222-2222-2222-2222-000000000001',
   '11111111-1111-1111-1111-000000000001',
   'Dana Chen', 'dana.chen@acmerobotics.example', '+1-415-555-0101',
   'VP Engineering', true),
  ('22222222-2222-2222-2222-000000000002',
   '11111111-1111-1111-1111-000000000001',
   'Miguel Torres', 'miguel@acmerobotics.example', '+1-415-555-0102',
   'Product Manager', false),
  ('22222222-2222-2222-2222-000000000003',
   '11111111-1111-1111-1111-000000000002',
   'Priya Sharma', 'priya@northwindlabs.example', '+44-20-7946-0001',
   'Head of Data', true),
  ('22222222-2222-2222-2222-000000000004',
   '11111111-1111-1111-1111-000000000002',
   'Oliver Bennett', 'oliver@northwindlabs.example', '+44-20-7946-0002',
   'Operations Lead', false),
  ('22222222-2222-2222-2222-000000000005',
   '11111111-1111-1111-1111-000000000003',
   'Anita Rao', 'anita.rao@vertexhealth.example', '+91-80-4000-0001',
   'Marketing Director', true)
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
-- The "Acme Customer Portal" is the marquee 13-phase project mirroring the
-- real agency workflow Manish described. The other two have lighter coverage.
INSERT INTO public.projects (
  id, company_id, pm_id, name, description, status,
  started_at, expected_end_at
)
VALUES
  ('33333333-3333-3333-3333-000000000001',
   '11111111-1111-1111-1111-000000000001',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'Acme Customer Portal',
   'Self-serve portal for Acme''s industrial customers — order tracking, ticketing, and analytics.',
   'active',
   '2026-02-01T00:00:00Z',
   '2026-08-15T00:00:00Z'),
  ('33333333-3333-3333-3333-000000000002',
   '11111111-1111-1111-1111-000000000002',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'Northwind Data Migration',
   'Move analytics warehouse from on-prem Postgres to a managed cloud setup with zero-downtime cutover.',
   'planning',
   '2026-06-01T00:00:00Z',
   '2026-09-30T00:00:00Z'),
  ('33333333-3333-3333-3333-000000000003',
   '11111111-1111-1111-1111-000000000003',
   NULL,
   'Vertex Brand Refresh',
   'Refreshed brand system + new marketing site. Paused while client finalises legal review of brand assets.',
   'on_hold',
   '2026-04-10T00:00:00Z',
   '2026-07-20T00:00:00Z')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- Milestones
-- ---------------------------------------------------------------------------
-- Acme Customer Portal: 13 phases (the marquee use case). Sequence is 1..13
-- and is enforced unique per project.
INSERT INTO public.milestones (id, project_id, sequence, name, status, target_date)
VALUES
  ('44444444-3333-0001-0001-000000000001', '33333333-3333-3333-3333-000000000001',  1, 'Discovery & Requirements', 'completed',   '2026-02-14'),
  ('44444444-3333-0001-0001-000000000002', '33333333-3333-3333-3333-000000000001',  2, 'Information Architecture','completed',   '2026-02-28'),
  ('44444444-3333-0001-0001-000000000003', '33333333-3333-3333-3333-000000000001',  3, 'UX Wireframes',           'completed',   '2026-03-14'),
  ('44444444-3333-0001-0001-000000000004', '33333333-3333-3333-3333-000000000001',  4, 'Visual Design System',    'completed',   '2026-03-28'),
  ('44444444-3333-0001-0001-000000000005', '33333333-3333-3333-3333-000000000001',  5, 'High-Fidelity Mockups',   'in_progress', '2026-04-18'),
  ('44444444-3333-0001-0001-000000000006', '33333333-3333-3333-3333-000000000001',  6, 'Frontend Scaffold',       'in_progress', '2026-05-02'),
  ('44444444-3333-0001-0001-000000000007', '33333333-3333-3333-3333-000000000001',  7, 'Authentication & Roles',  'blocked',     '2026-05-16'),
  ('44444444-3333-0001-0001-000000000008', '33333333-3333-3333-3333-000000000001',  8, 'Core CRUD Modules',       'not_started', '2026-06-06'),
  ('44444444-3333-0001-0001-000000000009', '33333333-3333-3333-3333-000000000001',  9, 'Reporting Dashboards',    'not_started', '2026-06-27'),
  ('44444444-3333-0001-0001-000000000010', '33333333-3333-3333-3333-000000000001', 10, 'Notifications & SLA Engine','not_started','2026-07-11'),
  ('44444444-3333-0001-0001-000000000011', '33333333-3333-3333-3333-000000000001', 11, 'QA & Hardening',          'not_started', '2026-07-25'),
  ('44444444-3333-0001-0001-000000000012', '33333333-3333-3333-3333-000000000001', 12, 'UAT & Client Training',   'not_started', '2026-08-08'),
  ('44444444-3333-0001-0001-000000000013', '33333333-3333-3333-3333-000000000001', 13, 'Go-Live & Handover',      'not_started', '2026-08-15'),

  -- Northwind Data Migration (planning phase) — 3 milestones.
  ('44444444-3333-0002-0002-000000000001', '33333333-3333-3333-3333-000000000002', 1, 'Audit & Risk Assessment', 'in_progress','2026-06-20'),
  ('44444444-3333-0002-0002-000000000002', '33333333-3333-3333-3333-000000000002', 2, 'Schema & ETL Design',     'not_started','2026-07-25'),
  ('44444444-3333-0002-0002-000000000003', '33333333-3333-3333-3333-000000000002', 3, 'Cutover Rehearsal',       'not_started','2026-09-15'),

  -- Vertex Brand Refresh (on hold) — 2 milestones.
  ('44444444-3333-0003-0003-000000000001', '33333333-3333-3333-3333-000000000003', 1, 'Brand Strategy Workshop', 'completed', '2026-04-25'),
  ('44444444-3333-0003-0003-000000000002', '33333333-3333-3333-3333-000000000003', 2, 'Visual Identity v1',      'blocked',   '2026-05-30')
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
-- IMPORTANT: every row's project_id MUST match its milestone's project_id, or
-- the enforce_task_project_consistency trigger will reject the row.
INSERT INTO public.tasks (
  id, milestone_id, project_id, assignee_id,
  title, status, priority, estimate_hours, due_at
)
VALUES
  -- Acme · M5 High-Fidelity Mockups
  ('55555555-0005-0000-0000-000000000001',
   '44444444-3333-0001-0001-000000000005', '33333333-3333-3333-3333-000000000001',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'Dashboard mockups — happy path',  'done',        'high',   6.0,  '2026-04-10T18:00:00Z'),
  ('55555555-0005-0000-0000-000000000002',
   '44444444-3333-0001-0001-000000000005', '33333333-3333-3333-3333-000000000001',
   NULL,
   'Empty + error states pass',       'in_progress', 'medium', 4.0,  '2026-04-17T18:00:00Z'),

  -- Acme · M6 Frontend Scaffold
  ('55555555-0006-0000-0000-000000000001',
   '44444444-3333-0001-0001-000000000006', '33333333-3333-3333-3333-000000000001',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'Next.js app router skeleton',     'done',        'medium', 5.0,  '2026-04-22T18:00:00Z'),
  ('55555555-0006-0000-0000-000000000002',
   '44444444-3333-0001-0001-000000000006', '33333333-3333-3333-3333-000000000001',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'Shared layout + sidebar',         'review',      'medium', 3.5,  '2026-04-29T18:00:00Z'),
  ('55555555-0006-0000-0000-000000000003',
   '44444444-3333-0001-0001-000000000006', '33333333-3333-3333-3333-000000000001',
   NULL,
   'Supabase SSR client wiring',      'todo',        'high',   4.0,  '2026-05-01T18:00:00Z'),

  -- Acme · M7 Authentication & Roles (blocked)
  ('55555555-0007-0000-0000-000000000001',
   '44444444-3333-0001-0001-000000000007', '33333333-3333-3333-3333-000000000001',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'Pick SSO provider with client',   'blocked',     'urgent', 2.0,  '2026-05-09T18:00:00Z'),
  ('55555555-0007-0000-0000-000000000002',
   '44444444-3333-0001-0001-000000000007', '33333333-3333-3333-3333-000000000001',
   NULL,
   'Role matrix sign-off',            'blocked',     'high',   1.5,  '2026-05-09T18:00:00Z'),

  -- Acme · M8 Core CRUD Modules (upcoming)
  ('55555555-0008-0000-0000-000000000001',
   '44444444-3333-0001-0001-000000000008', '33333333-3333-3333-3333-000000000001',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'Orders module — list + detail',   'todo',        'medium', 8.0,  '2026-05-23T18:00:00Z'),
  ('55555555-0008-0000-0000-000000000002',
   '44444444-3333-0001-0001-000000000008', '33333333-3333-3333-3333-000000000001',
   NULL,
   'Tickets module — list + detail',  'todo',        'medium', 8.0,  '2026-05-30T18:00:00Z'),

  -- Northwind · M1 Audit & Risk Assessment
  ('55555555-0009-0000-0000-000000000001',
   '44444444-3333-0002-0002-000000000001', '33333333-3333-3333-3333-000000000002',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'Catalog every downstream consumer','in_progress','high',   6.0,  '2026-06-10T18:00:00Z'),
  ('55555555-0009-0000-0000-000000000002',
   '44444444-3333-0002-0002-000000000001', '33333333-3333-3333-3333-000000000002',
   NULL,
   'Sizing estimate for new cluster', 'todo',        'medium', 3.0,  '2026-06-15T18:00:00Z'),

  -- Northwind · M2 Schema & ETL Design
  ('55555555-0010-0000-0000-000000000001',
   '44444444-3333-0002-0002-000000000002', '33333333-3333-3333-3333-000000000002',
   NULL,
   'Draft target schema',             'todo',        'medium', 5.0,  '2026-07-05T18:00:00Z'),

  -- Vertex · M1 Brand Strategy Workshop
  ('55555555-0011-0000-0000-000000000001',
   '44444444-3333-0003-0003-000000000001', '33333333-3333-3333-3333-000000000003',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'Workshop notes write-up',         'done',        'low',    2.0,  '2026-04-26T18:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------------
-- Spread across stages so the pipeline page has something to render in each
-- bucket. Mix of INR and USD values, varied sources, owner is Raghav where
-- one is assigned (some intentionally left unassigned).
INSERT INTO public.deals (
  id, company_id, contact_id, owner_id,
  source, stage, title, description,
  value_inr, value_usd,
  won_at, lost_at, lost_reason
)
VALUES
  -- new
  ('66666666-0001-0000-0000-000000000001',
   '11111111-1111-1111-1111-000000000003',
   '22222222-2222-2222-2222-000000000005',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'inbound', 'new',
   'Vertex Health — chatbot pilot',
   'Inbound from website contact form. Wants a HIPAA-aware patient triage bot.',
   NULL, 18000.00, NULL, NULL, NULL),

  -- qualified
  ('66666666-0002-0000-0000-000000000001',
   '11111111-1111-1111-1111-000000000001',
   '22222222-2222-2222-2222-000000000002',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'referral', 'qualified',
   'Acme Robotics — analytics revamp',
   'Referral from Acme VP Eng. Discovery call done, budget confirmed.',
   2500000.00, NULL, NULL, NULL, NULL),

  -- proposal_sent
  ('66666666-0003-0000-0000-000000000001',
   '11111111-1111-1111-1111-000000000002',
   '22222222-2222-2222-2222-000000000003',
   NULL,
   'linkedin', 'proposal_sent',
   'Northwind Labs — ML ops platform',
   'Multi-phase ML platform engagement. Proposal sent on 2026-05-15, awaiting feedback.',
   NULL, 95000.00, NULL, NULL, NULL),

  -- negotiation
  ('66666666-0004-0000-0000-000000000001',
   '11111111-1111-1111-1111-000000000001',
   NULL,
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'upwork', 'negotiation',
   'Acme Robotics — internal tooling addon',
   'Add-on for the customer portal project. Negotiating scope vs. timeline.',
   850000.00, NULL, NULL, NULL, NULL),

  -- won (this is the deal the seeded Acme Customer Portal would have come from
  -- — symbolic only, no FK linking the seeded project to it)
  ('66666666-0005-0000-0000-000000000001',
   '11111111-1111-1111-1111-000000000001',
   '22222222-2222-2222-2222-000000000001',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'referral', 'won',
   'Acme Robotics — customer portal',
   'Won. Now in delivery as the Acme Customer Portal project.',
   NULL, 140000.00, '2026-01-22T10:00:00Z', NULL, NULL),

  ('66666666-0005-0000-0000-000000000002',
   '11111111-1111-1111-1111-000000000002',
   '22222222-2222-2222-2222-000000000004',
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'inbound', 'won',
   'Northwind Labs — warehouse migration',
   'Won. Kicking off as the Northwind Data Migration project.',
   NULL, 72000.00, '2026-05-12T09:30:00Z', NULL, NULL),

  -- lost
  ('66666666-0006-0000-0000-000000000001',
   '11111111-1111-1111-1111-000000000003',
   NULL,
   (SELECT id FROM public.users WHERE email = 'raghav.joshi@growwstacks.com'),
   'other', 'lost',
   'Vertex Health — brand video series',
   'Out-of-scope for us; client wanted in-house video production.',
   NULL, 22000.00, NULL, '2026-04-30T16:00:00Z',
   'Scope mismatch — client needed full-service video, not our strength.')
ON CONFLICT (id) DO NOTHING;


COMMIT;


-- ---------------------------------------------------------------------------
-- Summary report (informational; runs outside the transaction).
-- ---------------------------------------------------------------------------
SELECT 'companies'  AS table_name, COUNT(*) AS rows FROM public.companies
UNION ALL SELECT 'contacts',  COUNT(*) FROM public.contacts
UNION ALL SELECT 'deals',     COUNT(*) FROM public.deals
UNION ALL SELECT 'projects',  COUNT(*) FROM public.projects
UNION ALL SELECT 'milestones',COUNT(*) FROM public.milestones
UNION ALL SELECT 'tasks',     COUNT(*) FROM public.tasks
ORDER BY table_name;
