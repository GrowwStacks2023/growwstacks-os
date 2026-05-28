-- ============================================================================
-- 0007 Attachments
-- ----------------------------------------------------------------------------
-- Polymorphic attachments table backing the file-upload panel that ships on
-- every entity detail page (company / contact / deal / project / milestone /
-- task). Mirrors the activity_log pattern: (entity_type, entity_id) with no
-- FK, so a single table covers all six entities without ON DELETE plumbing.
--
-- Files themselves live in the PUBLIC Supabase Storage bucket "attachments".
-- The decision to keep the bucket public was made by Raghav: anyone with a
-- file URL can read it without auth. This table only stores metadata + the
-- public URL; the bucket-level policies live alongside this migration but
-- are managed via the Storage API (see PART 2 of task 6).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Table: public.attachments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attachments (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  file_name     text NOT NULL,
  storage_path  text NOT NULL,
  public_url    text NOT NULL,
  mime_type     text,
  size_bytes    bigint,
  label         text,
  uploaded_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- entity_type check kept separate so re-running the migration with an
-- already-existing table still installs the constraint. Idempotent.
DO $$ BEGIN
  ALTER TABLE public.attachments
    ADD CONSTRAINT attachments_entity_type_check
    CHECK (entity_type IN ('company','contact','deal','project','milestone','task'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Primary lookup pattern: "give me all attachments for entity X". Mirrors the
-- activity_log_entity_idx shape.
CREATE INDEX IF NOT EXISTS attachments_entity_idx
  ON public.attachments (entity_type, entity_id, created_at DESC);

-- FK lookup index — keeps cascading-update plans cheap and silences the
-- "unindexed FK" performance advisor.
CREATE INDEX IF NOT EXISTS attachments_uploaded_by_idx
  ON public.attachments (uploaded_by);


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user. The underlying Storage bucket is public
-- anyway, so this matches the actual access model rather than pretending
-- the metadata is more guarded than the files.
DROP POLICY IF EXISTS attachments_select ON public.attachments;
CREATE POLICY attachments_select ON public.attachments
FOR SELECT TO authenticated
USING (true);

-- INSERT: any authenticated user; uploaded_by must equal the caller. The
-- WITH CHECK on uploaded_by means a user can't impersonate someone else as
-- the uploader.
DROP POLICY IF EXISTS attachments_insert ON public.attachments;
CREATE POLICY attachments_insert ON public.attachments
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = (SELECT auth.uid())
);

-- DELETE: admin OR the original uploader.
DROP POLICY IF EXISTS attachments_delete ON public.attachments;
CREATE POLICY attachments_delete ON public.attachments
FOR DELETE TO authenticated
USING (
  public.current_user_role() = 'admin'
  OR uploaded_by = (SELECT auth.uid())
);

-- No UPDATE policy: attachments are immutable metadata. To "edit" you delete
-- and re-upload.
