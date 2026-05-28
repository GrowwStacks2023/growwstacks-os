-- ============================================================================
-- 0012 Payments
-- ----------------------------------------------------------------------------
-- Tracks money in (and the occasional out, via refunds). A payment is
-- attached to a project (the common case once delivery is underway) OR to
-- a deal (advance / mobilisation against a pending engagement), with
-- company_id denormalised so the finance view ("everything from Acme this
-- year") doesn't have to join through deal-or-project alternation.
--
-- Currency is text-coded against a known list (INR/USD) — we deliberately
-- don't use a numeric currency enum because the set will grow when GBP /
-- AED engagements arrive and we don't want a migration for that.
--
-- Status:
--   - expected:  scheduled / invoiced but money hasn't landed.
--   - received:  money in the bank.
--   - refunded:  was received, then refunded — left as a row for audit
--     rather than deleting.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  project_id  uuid REFERENCES public.projects(id)  ON DELETE CASCADE,
  deal_id     uuid REFERENCES public.deals(id)     ON DELETE SET NULL,
  -- Denormalised company; NOT NULL so finance queries can group by company
  -- without checking which of {project, deal} the payment hangs off.
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  amount      numeric(12,2) NOT NULL,
  currency    text NOT NULL DEFAULT 'INR',
  kind        text NOT NULL DEFAULT 'installment',
  status      text NOT NULL DEFAULT 'received',
  reference   text,
  note        text,
  -- NULL while status='expected'; set when the payment lands.
  received_at timestamptz,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_amount_check
    CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_currency_check
    CHECK (currency IN ('INR','USD'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_kind_check
    CHECK (kind IN ('advance','installment','final','other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_status_check
    CHECK (status IN ('expected','received','refunded'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A payment must hang off a project OR a deal. company_id is required but
-- isn't enough on its own — we'd lose all engagement context otherwise.
DO $$ BEGIN
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_must_have_context_check
    CHECK (project_id IS NOT NULL OR deal_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Project-scoped lookup ("payments for this project, oldest first").
CREATE INDEX IF NOT EXISTS payments_project_idx
  ON public.payments (project_id) WHERE project_id IS NOT NULL;

-- Deal-scoped lookup, partial because most rows will be project-tied once
-- delivery starts.
CREATE INDEX IF NOT EXISTS payments_deal_idx
  ON public.payments (deal_id) WHERE deal_id IS NOT NULL;

-- Finance view: everything for a company in date order.
CREATE INDEX IF NOT EXISTS payments_company_received_idx
  ON public.payments (company_id, received_at DESC);

-- "What's outstanding": small partial index for the expected-payments query.
CREATE INDEX IF NOT EXISTS payments_expected_idx
  ON public.payments (status) WHERE status = 'expected';

-- FK covering index for recorded_by — keeps the unindexed-FK advisor happy.
CREATE INDEX IF NOT EXISTS payments_recorded_by_idx
  ON public.payments (recorded_by);


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Developers DO NOT see payments. Sales, PM, admin only. This matches the
-- existing principle that money figures aren't visible on the delivery side.
DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments
FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
);

DROP POLICY IF EXISTS payments_insert ON public.payments;
CREATE POLICY payments_insert ON public.payments
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin','sales','pm')
  AND (recorded_by IS NULL OR recorded_by = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS payments_update ON public.payments;
CREATE POLICY payments_update ON public.payments
FOR UPDATE TO authenticated
USING (
  public.current_user_role() IN ('admin','sales','pm')
)
WITH CHECK (
  public.current_user_role() IN ('admin','sales','pm')
);

-- Hard delete is admin-only; non-admins move money out via status='refunded'
-- so the audit trail survives.
DROP POLICY IF EXISTS payments_delete ON public.payments;
CREATE POLICY payments_delete ON public.payments
FOR DELETE TO authenticated
USING (public.current_user_role() = 'admin');
