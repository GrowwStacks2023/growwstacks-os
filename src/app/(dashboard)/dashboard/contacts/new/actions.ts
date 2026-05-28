"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CreateContactState = {
  error: string | null;
  contactId: string | null;
};

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

// Direct (non-form-action) entry point used by the create form so the client
// can do post-create work (uploading staged attachments) before navigating.
// The form layer is responsible for redirecting on success.
export async function createContactDirect(
  input: {
    name: string;
    companyId: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    role: string | null;
    isPrimary: boolean;
  }
): Promise<CreateContactState> {
  const name = input.name.trim();
  if (!name) {
    return { error: "Contact name is required.", contactId: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", contactId: null };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("contacts")
    .insert({
      company_id: input.companyId,
      name,
      email: input.email,
      phone: input.phone,
      whatsapp: input.whatsapp,
      role: input.role,
      is_primary: input.isPrimary,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      error: insertError?.message ?? "Couldn't create the contact.",
      contactId: null,
    };
  }

  const { error: logError } = await supabase.from("activity_log").insert({
    entity_type: "contact",
    entity_id: inserted.id,
    action: "created",
    actor_id: user.id,
    after_state: inserted,
  });
  if (logError) {
    console.error("activity_log insert failed:", logError);
  }

  return { error: null, contactId: inserted.id };
}

// FormData wrapper kept for any legacy callers; the new-contact-form uses the
// direct version so it can stage attachments. Parses the FormData and hands
// off to createContactDirect.
export async function createContact(
  _prev: CreateContactState,
  formData: FormData
): Promise<CreateContactState> {
  const rawCompany = String(formData.get("company_id") ?? "").trim();
  const result = await createContactDirect({
    name: String(formData.get("name") ?? ""),
    // Empty string from the Select placeholder is treated as "no company".
    companyId: rawCompany ? rawCompany : null,
    email: nullIfBlank(String(formData.get("email") ?? "")),
    phone: nullIfBlank(String(formData.get("phone") ?? "")),
    whatsapp: nullIfBlank(String(formData.get("whatsapp") ?? "")),
    role: nullIfBlank(String(formData.get("role") ?? "")),
    isPrimary: formData.get("is_primary") != null,
  });

  if (result.error || !result.contactId) {
    return result;
  }

  // Redirect throws — control doesn't return from here on success. The
  // direct-callable path (createContactDirect) returns instead so the
  // client can stage attachment commits before navigating.
  redirect(`/dashboard/contacts/${result.contactId}`);
}
