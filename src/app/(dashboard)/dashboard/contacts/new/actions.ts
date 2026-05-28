"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CreateContactState = {
  error: string | null;
};

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function createContact(
  _prevState: CreateContactState,
  formData: FormData
): Promise<CreateContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "").trim();
  const email = nullIfBlank(String(formData.get("email") ?? ""));
  const phone = nullIfBlank(String(formData.get("phone") ?? ""));
  const whatsapp = nullIfBlank(String(formData.get("whatsapp") ?? ""));
  const role = nullIfBlank(String(formData.get("role") ?? ""));
  const isPrimary = formData.get("is_primary") != null;

  if (!name) {
    return { error: "Contact name is required." };
  }

  if (!companyId) {
    return { error: "Please pick a company for this contact." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("contacts")
    .insert({
      company_id: companyId,
      name,
      email,
      phone,
      whatsapp,
      role,
      is_primary: isPrimary,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      error: insertError?.message ?? "Couldn't create the contact.",
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
    // Don't fail the user-facing flow if the audit row is rejected, but surface
    // it to the server logs so we notice if RLS bites us.
    console.error("activity_log insert failed:", logError);
  }

  redirect("/dashboard/contacts");
}
