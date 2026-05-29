-- ════════════════════════════════════════════════════════════════════════
-- 0015_payments_contact_id
-- ────────────────────────────────────────────────────────────────────────
-- Adds a nullable contact_id to payments so a payment row carries the
-- contact derived from its parent project/deal at the time it was
-- recorded. UI never picks this directly — recordPayment derives it
-- server-side. Backfill of existing rows is intentionally skipped; old
-- rows continue to work with contact_id NULL.
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS contact_id uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_contact_id_idx
  ON public.payments (contact_id) WHERE contact_id IS NOT NULL;
