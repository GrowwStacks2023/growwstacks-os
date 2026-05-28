"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

// Six entity buckets, matching the CHECK constraint in 0007_attachments.sql.
const ENTITY_TYPES = [
  "company",
  "contact",
  "deal",
  "project",
  "milestone",
  "task",
] as const;

export type AttachmentEntityType = (typeof ENTITY_TYPES)[number];

function isEntityType(value: string): value is AttachmentEntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

export type RecordFileInput = {
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  label: string | null;
  // The detail page path to revalidate so the new row shows up after the
  // client redirects/re-renders. Caller knows its own route, so it passes it
  // in rather than us guessing from entityType. Optional — create-time uploads
  // don't have a path to revalidate yet (the page doesn't exist until redirect).
  revalidate?: string;
};

export type RecordLinkInput = {
  entityType: AttachmentEntityType;
  entityId: string;
  url: string;
  label: string | null;
  revalidate?: string;
};

export type RecordAttachmentResult =
  | { ok: true }
  | { ok: false; error: string };

// Server action: after the browser has uploaded the file to Storage, insert
// the metadata row. RLS guarantees uploaded_by = auth.uid().
export async function recordFileAttachment(
  input: RecordFileInput
): Promise<RecordAttachmentResult> {
  if (!isEntityType(input.entityType)) {
    return { ok: false, error: "Invalid entity type." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("attachments")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      kind: "file",
      file_name: input.fileName,
      storage_path: input.storagePath,
      public_url: input.publicUrl,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      label: input.label,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Couldn't record the attachment.",
    };
  }

  const { error: logError } = await supabase.from("activity_log").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: "attachment_added",
    actor_id: user.id,
    after_state: {
      attachment_id: inserted.id,
      kind: "file",
      file_name: inserted.file_name,
    },
  });
  if (logError) {
    console.error("activity_log insert failed:", logError);
  }

  if (input.revalidate) revalidatePath(input.revalidate);
  return { ok: true };
}

// Server action: insert a kind='link' row. No Storage involvement.
export async function recordLinkAttachment(
  input: RecordLinkInput
): Promise<RecordAttachmentResult> {
  if (!isEntityType(input.entityType)) {
    return { ok: false, error: "Invalid entity type." };
  }
  const url = input.url.trim();
  if (!url) {
    return { ok: false, error: "Link URL is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  // file_name is NOT NULL on the table, so reuse the label or the URL itself
  // as a human-readable fallback. This keeps the column meaningful for both
  // shapes without adding a second optional name field.
  const fileName = (input.label?.trim() || url).slice(0, 255);

  const { data: inserted, error: insertError } = await supabase
    .from("attachments")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      kind: "link",
      file_name: fileName,
      url,
      label: input.label?.trim() ? input.label.trim() : null,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Couldn't add the link.",
    };
  }

  const { error: logError } = await supabase.from("activity_log").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: "attachment_added",
    actor_id: user.id,
    after_state: { attachment_id: inserted.id, kind: "link", url },
  });
  if (logError) {
    console.error("activity_log insert failed:", logError);
  }

  if (input.revalidate) revalidatePath(input.revalidate);
  return { ok: true };
}

export type DeleteAttachmentResult =
  | { ok: true }
  | { ok: false; error: string };

// Server action: remove the row AND (for kind='file') the Storage object.
// RLS on attachments (admin OR uploaded_by = auth.uid()) gates who can
// delete the row; the matching storage.objects policy gates the file delete.
export async function deleteAttachment(
  attachmentId: string,
  revalidate: string
): Promise<DeleteAttachmentResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  // Read first so we know what shape we're deleting. Also lets us return a
  // clean error if RLS hides the row from the caller.
  const { data: existing, error: readError } = await supabase
    .from("attachments")
    .select("id, kind, entity_type, entity_id, storage_path, file_name, url")
    .eq("id", attachmentId)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: readError.message };
  }
  if (!existing) {
    return { ok: false, error: "Attachment not found or not visible to you." };
  }

  // Delete the row first; if RLS rejects, we haven't orphaned a storage file.
  const { error: deleteRowError } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId);

  if (deleteRowError) {
    return { ok: false, error: deleteRowError.message };
  }

  // For files, also drop the Storage object. Links don't have one. If the
  // storage delete fails after the row is gone we log but don't surface —
  // a stray blob is the lesser evil compared to stale metadata.
  if (existing.kind === "file" && existing.storage_path) {
    const { error: deleteObjectError } = await supabase.storage
      .from("attachments")
      .remove([existing.storage_path]);
    if (deleteObjectError) {
      console.error("storage delete failed:", deleteObjectError);
    }
  }

  const { error: logError } = await supabase.from("activity_log").insert({
    entity_type: existing.entity_type,
    entity_id: existing.entity_id,
    action: "attachment_removed",
    actor_id: user.id,
    before_state: {
      attachment_id: existing.id,
      kind: existing.kind,
      file_name: existing.file_name,
      storage_path: existing.storage_path,
      url: existing.url,
    },
  });
  if (logError) {
    console.error("activity_log insert failed:", logError);
  }

  revalidatePath(revalidate);
  return { ok: true };
}
