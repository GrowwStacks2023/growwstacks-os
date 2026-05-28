-- ============================================================================
-- 0010 Contact-Company Optional
-- ----------------------------------------------------------------------------
-- Drops the NOT NULL on public.contacts.company_id. A contact can now exist
-- without belonging to a company. The FK still references public.companies
-- (so a non-null value is still validated) and the ON DELETE CASCADE behaviour
-- from 0001 is preserved.
--
-- Why: Raghav clarified the contact is the central entity. Treating it as
-- company-required forced bogus "personal" company rows for individuals (an
-- accountant, a freelancer, a referral source) who don't represent an org.
--
-- Idempotent — dropping NOT NULL on an already-nullable column is a no-op.
-- ============================================================================

ALTER TABLE public.contacts
  ALTER COLUMN company_id DROP NOT NULL;
