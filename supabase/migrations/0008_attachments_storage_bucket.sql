-- ============================================================================
-- 0008 Attachments Storage Bucket
-- ----------------------------------------------------------------------------
-- Provisions the "attachments" Storage bucket and the object-level RLS
-- policies needed for upload + delete from a signed-in browser.
--
-- DECISION (Raghav, task 6):
--   - The bucket is PUBLIC. Anyone with a file URL can read the file without
--     auth. This is intentional — flagged in the task report.
--   - No file-type allowlist, no size cap.
--
-- Why this lives in a migration: bucket rows and storage.objects policies
-- are part of the database state Supabase ships, so keeping them next to
-- the table migration means a fresh project can be brought to parity by
-- replaying migrations alone.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------
-- ON CONFLICT keeps the migration idempotent. If the bucket already exists
-- we still re-assert public = true so a manual flip in the UI doesn't drift.
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      name   = EXCLUDED.name;


-- ---------------------------------------------------------------------------
-- storage.objects policies (scoped to the "attachments" bucket)
-- ---------------------------------------------------------------------------
-- RLS is enabled on storage.objects by default in Supabase. We add narrow
-- policies that only touch our bucket so nothing here can leak into other
-- buckets a future task might add.
--
-- SELECT: the bucket is public, so anon reads go through the public storage
-- endpoint without consulting RLS. We still add an explicit authenticated
-- SELECT policy so signed-in clients that hit the regular API also see
-- listings.
DROP POLICY IF EXISTS attachments_objects_select ON storage.objects;
CREATE POLICY attachments_objects_select ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'attachments');

-- INSERT: any signed-in user can upload to the attachments bucket. The
-- owner column is set automatically by Storage to auth.uid().
DROP POLICY IF EXISTS attachments_objects_insert ON storage.objects;
CREATE POLICY attachments_objects_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments');

-- DELETE: admin (per public.users.role) or the original uploader. Storage
-- writes the uploader's auth.uid() to storage.objects.owner. owner is
-- nullable on legacy rows but every upload from our app is authenticated,
-- so owner will be set.
DROP POLICY IF EXISTS attachments_objects_delete ON storage.objects;
CREATE POLICY attachments_objects_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    public.current_user_role() = 'admin'
    OR owner = (SELECT auth.uid())
  )
);

-- No UPDATE policy: re-upload to replace.
