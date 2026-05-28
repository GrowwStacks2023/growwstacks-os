-- ============================================================================
-- 0013 Project ↔ Contact
-- ----------------------------------------------------------------------------
-- Adds a nullable contact_id to projects so a project can name its primary
-- client-side contact (the person the PM talks to). Matches deals.contact_id
-- semantically — independent from company_id, no auto-link.
--
-- Why a new column instead of inferring from deal_id → contact: a project
-- doesn't always have a deal (ad-hoc engagements), and even when it does, the
-- delivery-side primary contact often differs from the sales-side one.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contact_id uuid
    REFERENCES public.contacts(id) ON DELETE SET NULL;

-- FK covering index — keeps the unindexed-FK advisor happy and supports
-- "all projects where this contact is the primary" lookups.
CREATE INDEX IF NOT EXISTS projects_contact_id_idx
  ON public.projects (contact_id) WHERE contact_id IS NOT NULL;
