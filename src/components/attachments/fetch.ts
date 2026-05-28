import { createClient } from "@/lib/supabase/server";

import type { AttachmentEntityType } from "./actions";

export type AttachmentKind = "file" | "link";

export type AttachmentRow = {
  id: string;
  kind: AttachmentKind;
  file_name: string;
  storage_path: string | null;
  public_url: string | null;
  url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  label: string | null;
  uploaded_by: string | null;
  uploader: { name: string | null; email: string } | null;
  created_at: string;
};

// Fetch all attachments for (entity_type, entity_id) plus the current
// caller's user id (so the panel can show/hide the delete button without a
// separate round-trip). Newest-first because that matches "what did someone
// just attach" — the read pattern that drove this panel in the first place.
export async function fetchAttachments(
  entityType: AttachmentEntityType,
  entityId: string
): Promise<{
  attachments: AttachmentRow[];
  currentUserId: string | null;
  currentUserRole: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserRole: string | null = null;
  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    currentUserRole = userRow?.role ?? null;
  }

  const { data, error } = await supabase
    .from("attachments")
    .select(
      "id, kind, file_name, storage_path, public_url, url, mime_type, size_bytes, label, uploaded_by, created_at, uploader:users(name, email)"
    )
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchAttachments failed:", error);
    return {
      attachments: [],
      currentUserId: user?.id ?? null,
      currentUserRole,
    };
  }

  return {
    attachments: (data ?? []) as AttachmentRow[],
    currentUserId: user?.id ?? null,
    currentUserRole,
  };
}
