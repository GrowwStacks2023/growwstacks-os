-- ============================================================================
-- 0009 Attachment Links
-- ----------------------------------------------------------------------------
-- Extends public.attachments so a row can be EITHER an uploaded file (existing
-- behaviour) OR an external URL (e.g. a Loom video link a developer pastes
-- when work is done). Link rows have no Storage object.
--
-- Shape:
--   kind = 'file'  → storage_path NOT NULL, public_url NOT NULL, url NULL
--   kind = 'link'  → url NOT NULL (storage_path / public_url may be NULL)
--
-- The CHECK constraint enforces this. The original NOT NULL constraints on
-- storage_path and public_url are dropped because link rows don't carry them.
-- Idempotent — re-running is safe.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'file';

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS url text;


-- ---------------------------------------------------------------------------
-- Drop the now-conditional NOT NULLs on the file-only columns
-- ---------------------------------------------------------------------------
-- DROP NOT NULL is idempotent; calling it on an already-nullable column is
-- a no-op.
ALTER TABLE public.attachments ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE public.attachments ALTER COLUMN public_url   DROP NOT NULL;


-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
-- kind must be one of the two known values.
DO $$ BEGIN
  ALTER TABLE public.attachments
    ADD CONSTRAINT attachments_kind_check
    CHECK (kind IN ('file','link'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Shape constraint: per-kind required columns.
DO $$ BEGIN
  ALTER TABLE public.attachments
    ADD CONSTRAINT attachments_shape_check
    CHECK (
      (kind = 'file' AND storage_path IS NOT NULL AND public_url IS NOT NULL)
      OR
      (kind = 'link' AND url IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- Tighten storage.objects access for the (public) attachments bucket
-- ---------------------------------------------------------------------------
-- The advisor "public_bucket_allows_listing" flagged that the broad SELECT
-- policy added in 0008 lets any authenticated client enumerate the bucket.
-- Public buckets bypass RLS for direct URL reads anyway, so the policy is
-- only useful for listing — which we never do from the app (we list rows
-- from public.attachments). Dropping it removes the enumeration vector.
DROP POLICY IF EXISTS attachments_objects_select ON storage.objects;
