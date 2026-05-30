"use server";

import { revalidatePath } from "next/cache";

import { canDelete, canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { diffPayload, logEntityUpdate } from "@/lib/activity-log";
import { createClient } from "@/lib/supabase/server";

export type UpdateContactResult = { ok: true } | { ok: false; error: string };

export async function updateContact(input: {
  id: string;
  name: string;
  companyId: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  role: string | null;
  isPrimary: boolean;
}): Promise<UpdateContactResult> {
  const callerRole = await getCurrentRole();
  if (!canEdit(callerRole, "contact")) {
    return { ok: false, error: "You don't have permission to edit contacts." };
  }
  if (!input.id) return { ok: false, error: "Missing contact id." };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Contact name is required." };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("contacts")
    .select("id, name, company_id, email, phone, whatsapp, role, is_primary")
    .eq("id", input.id)
    .maybeSingle();
  if (!before) {
    return { ok: false, error: "Contact not found." };
  }

  const after = {
    name,
    company_id: input.companyId,
    email: input.email,
    phone: input.phone,
    whatsapp: input.whatsapp,
    role: input.role,
    is_primary: input.isPrimary,
  };

  const { error } = await supabase
    .from("contacts")
    .update(after)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  await logEntityUpdate(supabase, {
    entityType: "contact",
    entityId: input.id,
    actorId: actor?.id ?? null,
    diff: diffPayload(before, after, [
      "name",
      "company_id",
      "email",
      "phone",
      "whatsapp",
      "role",
      "is_primary",
    ]),
  });

  revalidatePath("/dashboard/contacts");
  revalidatePath(`/dashboard/contacts/${input.id}`);
  return { ok: true };
}

export type DeleteContactResult = { ok: true } | { ok: false; error: string };

export async function deleteContact(id: string): Promise<DeleteContactResult> {
  const callerRole = await getCurrentRole();
  if (!canDelete(callerRole, "contact")) {
    return {
      ok: false,
      error: "You don't have permission to delete contacts.",
    };
  }
  if (!id) return { ok: false, error: "Missing contact id." };

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "This contact is referenced by deals, projects, or tasks. Detach those first.",
      };
    }
    return { ok: false, error: error.message };
  }

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "contact",
      entity_id: id,
      action: "deleted",
      actor_id: actor?.id ?? null,
    })
    .then(() => undefined, () => undefined);

  revalidatePath("/dashboard/contacts");
  return { ok: true };
}
