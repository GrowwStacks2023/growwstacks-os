-- ============================================================================
-- 0014 Attachments: Drive-backed Files
-- ----------------------------------------------------------------------------
-- We're moving file uploads off Supabase Storage onto Google Drive (via the
-- n8n webhook the team owns). A Drive-backed file is still conceptually a
-- "file" the user uploaded — it has a filename, a MIME type, a size — but
-- it's STORED as a URL, the same as a plain link attachment.
--
-- Shape decision: keep kind='file'. Drive-backed rows have url set and the
-- legacy storage_path / public_url columns null. The UI continues to render
-- file-vs-link distinction off `kind`, and "open" reads `url ?? public_url`
-- so legacy bucket-backed rows continue to work.
--
-- The old shape check (added in 0009) FORCED kind='file' rows to carry
-- storage_path AND public_url. We relax that: a file row is valid if it
-- has EITHER (storage_path AND public_url) for legacy bucket-backed rows
-- OR url for Drive-backed rows.
--
-- We do not touch existing rows. We do not delete the Storage bucket or its
-- objects — those continue to be served by their public_url.
--
-- Idempotent — drop and re-create the shape check.
-- ============================================================================

-- DROP CONSTRAINT IF EXISTS is the simplest idempotent path here. Re-running
-- this migration after a partial apply will just re-create the constraint.
ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_shape_check;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_shape_check
  CHECK (
    -- Legacy bucket-backed file rows (Tasks 6–7 era).
    (kind = 'file'
       AND storage_path IS NOT NULL
       AND public_url   IS NOT NULL)
    OR
    -- New Drive-backed file rows: only `url` is required. storage_path
    -- and public_url stay null.
    (kind = 'file'
       AND url IS NOT NULL)
    OR
    -- Plain link rows (Loom, etc.) — unchanged from 0009.
    (kind = 'link'
       AND url IS NOT NULL)
  );
