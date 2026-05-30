"use server";

import { revalidatePath } from "next/cache";

import { canWriteAttachment } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
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

// ─── Webhook upload ────────────────────────────────────────────────────
// File uploads now go through an n8n webhook that puts the file on Google
// Drive and returns a share link. We store ONLY the link (in the existing
// `url` column on attachments, with kind='file' and storage_path/public_url
// null — see migration 0014 which relaxed the shape check to allow this).
//
// The server hides the webhook URL from the client and validates the
// response shape before inserting anything.

function readWebhookUrl(): string | null {
  const v = process.env.N8N_FILE_UPLOAD_WEBHOOK_URL?.trim();
  return v && v.length > 0 ? v : null;
}

// Talks to the n8n webhook. Returns the Drive link on success, or a
// human-readable error string on failure. NO database write happens here —
// the caller decides whether to insert based on the result.
async function postFileToWebhook(
  file: File
): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const webhookUrl = readWebhookUrl();
  if (!webhookUrl) {
    return {
      ok: false,
      error: "File upload is not configured (missing N8N_FILE_UPLOAD_WEBHOOK_URL).",
    };
  }

  // multipart/form-data with the file under field name "file". If n8n is
  // configured to read a different field name, this is the first thing to
  // adjust — we surface a clear error from the webhook rather than
  // retrying with a different shape.
  const body = new FormData();
  body.append("file", file, file.name);

  let res: Response;
  try {
    res = await fetch(webhookUrl, { method: "POST", body });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Upload failed — webhook unreachable: ${msg}` };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `Upload failed — webhook returned ${res.status} ${res.statusText}.`,
    };
  }

  // Expecting JSON { link: "<url>" }. We accept text/plain too as a defensive
  // fallback if the webhook is misconfigured to not set Content-Type.
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    return {
      ok: false,
      error: "Upload failed — webhook response was not valid JSON.",
    };
  }

  const link =
    parsed && typeof parsed === "object" && "link" in parsed
      ? (parsed as { link: unknown }).link
      : null;
  if (typeof link !== "string" || link.trim().length === 0) {
    return {
      ok: false,
      error: "Upload failed — webhook returned no link.",
    };
  }

  return { ok: true, link: link.trim() };
}

// Insert a kind='file' attachment row whose url is the Drive link.
// storage_path and public_url stay null. RLS enforces uploaded_by =
// auth.uid().
async function insertFileAttachmentRow(args: {
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  label: string | null;
  driveLink: string;
  revalidate?: string;
}): Promise<RecordAttachmentResult> {
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
      entity_type: args.entityType,
      entity_id: args.entityId,
      kind: "file",
      file_name: args.fileName,
      url: args.driveLink,
      mime_type: args.mimeType,
      size_bytes: args.sizeBytes,
      label: args.label,
      uploaded_by: user.id,
      // storage_path + public_url intentionally left null — Drive-backed
      // file. Migration 0014 relaxed the shape check to allow this.
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
    entity_type: args.entityType,
    entity_id: args.entityId,
    action: "attachment_added",
    actor_id: user.id,
    after_state: {
      attachment_id: inserted.id,
      kind: "file",
      file_name: inserted.file_name,
      storage: "drive",
    },
  });
  if (logError) {
    console.error("activity_log insert failed:", logError);
  }

  if (args.revalidate) revalidatePath(args.revalidate);
  return { ok: true };
}

// Combined server action: takes a FormData carrying the file + metadata,
// uploads it to the n8n webhook, then records the attachment row. ONE
// round-trip from the client.
//
// FormData fields (set by the client):
//   - file:        the File
//   - entityType:  one of ENTITY_TYPES
//   - entityId:    uuid
//   - label:       optional human label
//   - revalidate:  optional path to revalidate after insert
//
// On failure (webhook unreachable, webhook returns non-200, empty link,
// or DB insert fails): NO row is inserted, error string is returned.
export async function uploadAndRecordFile(
  formData: FormData
): Promise<RecordAttachmentResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file provided." };
  }

  const entityType = String(formData.get("entityType") ?? "");
  const entityId = String(formData.get("entityId") ?? "");
  const rawLabel = String(formData.get("label") ?? "").trim();
  const revalidate = formData.get("revalidate");
  const revalidatePath = revalidate ? String(revalidate) : undefined;

  if (!isEntityType(entityType)) {
    return { ok: false, error: "Invalid entity type." };
  }
  if (!entityId) {
    return { ok: false, error: "Missing entity id." };
  }

  const role = await getCurrentRole();
  if (!canWriteAttachment(role, entityType)) {
    return {
      ok: false,
      error: "You don't have permission to attach files to this entity.",
    };
  }

  // POST to webhook. If anything goes wrong here we bail before touching
  // the DB — partial state would be worse than a clean failure.
  const upload = await postFileToWebhook(file);
  if (!upload.ok) {
    return upload;
  }

  return insertFileAttachmentRow({
    entityType,
    entityId,
    fileName: file.name,
    mimeType: file.type || null,
    sizeBytes: file.size,
    label: rawLabel.length > 0 ? rawLabel : null,
    driveLink: upload.link,
    revalidate: revalidatePath,
  });
}

// Server action: insert a kind='link' row. No webhook involvement —
// the user pasted a URL (Loom etc.).
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

  const role = await getCurrentRole();
  if (!canWriteAttachment(role, input.entityType)) {
    return {
      ok: false,
      error: "You don't have permission to attach links to this entity.",
    };
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

// Remove the row. For LEGACY bucket-backed rows (storage_path set) we also
// drop the Storage object. For Drive-backed rows (storage_path null) we
// don't try to delete anything on Drive — the n8n side doesn't expose a
// delete webhook today; the row going away is what counts for the app.
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

  // Only legacy bucket-backed rows have a storage object to clean up.
  // Drive-backed rows have storage_path = null and we don't (yet) call out
  // to n8n to delete from Drive — a stray Drive file is a finance/IT
  // problem we'll solve when there's a delete-via-webhook contract.
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
