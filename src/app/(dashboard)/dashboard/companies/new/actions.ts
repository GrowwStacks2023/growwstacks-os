"use server";

import { redirect } from "next/navigation";

import { canCreate } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type CompanyType = Database["public"]["Enums"]["company_type"];

const COMPANY_TYPES: readonly CompanyType[] = [
  "prospect",
  "client",
  "partner",
] as const;

export type CreateCompanyState = {
  error: string | null;
};

function normalizeTime(value: string): string | null {
  // Accept "HH:MM" from <input type="time"> and store as "HH:MM:SS".
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  return `${value}:00`;
}

export async function createCompany(
  _prevState: CreateCompanyState,
  formData: FormData
): Promise<CreateCompanyState> {
  const role = await getCurrentRole();
  if (!canCreate(role, "company")) {
    return { error: "You don't have permission to create companies." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const typeRaw = String(formData.get("type") ?? "prospect");
  const timezone = String(formData.get("timezone") ?? "").trim() || "Asia/Kolkata";
  const startRaw = String(formData.get("business_hours_start") ?? "09:00");
  const endRaw = String(formData.get("business_hours_end") ?? "19:00");

  if (!name) {
    return { error: "Company name is required." };
  }

  const type = (COMPANY_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as CompanyType)
    : "prospect";

  const businessHoursStart = normalizeTime(startRaw);
  const businessHoursEnd = normalizeTime(endRaw);

  if (!businessHoursStart || !businessHoursEnd) {
    return { error: "Business hours must be in HH:MM format." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("companies")
    .insert({
      name,
      type,
      timezone,
      business_hours_start: businessHoursStart,
      business_hours_end: businessHoursEnd,
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      error: insertError?.message ?? "Couldn't create the company.",
    };
  }

  const { error: logError } = await supabase.from("activity_log").insert({
    entity_type: "company",
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

  redirect("/dashboard/companies");
}
