"use server";

import { revalidatePath } from "next/cache";

import { canDelete, canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { diffPayload, logEntityUpdate } from "@/lib/activity-log";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type CompanyType = Database["public"]["Enums"]["company_type"];
const COMPANY_TYPES: readonly CompanyType[] = [
  "prospect",
  "client",
  "partner",
] as const;

function normalizeTime(value: string): string | null {
  // Accept "HH:MM" from <input type="time"> and store as "HH:MM:SS" to match
  // the create path. Postgres `time` accepts either, but we keep parity.
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  return `${value}:00`;
}

export type UpdateCompanyResult = { ok: true } | { ok: false; error: string };

export async function updateCompany(input: {
  id: string;
  name: string;
  type: string;
  timezone: string;
  businessHoursStart: string;
  businessHoursEnd: string;
}): Promise<UpdateCompanyResult> {
  const role = await getCurrentRole();
  if (!canEdit(role, "company")) {
    return { ok: false, error: "You don't have permission to edit companies." };
  }
  if (!input.id) return { ok: false, error: "Missing company id." };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Company name is required." };
  const type = (COMPANY_TYPES as readonly string[]).includes(input.type)
    ? (input.type as CompanyType)
    : null;
  if (!type) return { ok: false, error: "Invalid company type." };

  const businessHoursStart = normalizeTime(input.businessHoursStart);
  const businessHoursEnd = normalizeTime(input.businessHoursEnd);
  if (!businessHoursStart || !businessHoursEnd) {
    return { ok: false, error: "Business hours must be in HH:MM format." };
  }
  const timezone = input.timezone.trim() || "Asia/Kolkata";

  const supabase = await createClient();

  // Snapshot the editable fields BEFORE the update so the audit row can
  // record what actually changed. Using a fixed key set so we don't ship
  // unrelated columns into the log.
  const { data: before } = await supabase
    .from("companies")
    .select("id, name, type, timezone, business_hours_start, business_hours_end")
    .eq("id", input.id)
    .maybeSingle();
  if (!before) {
    return { ok: false, error: "Company not found." };
  }

  const after = {
    name,
    type,
    timezone,
    business_hours_start: businessHoursStart,
    business_hours_end: businessHoursEnd,
  };

  const { error } = await supabase
    .from("companies")
    .update(after)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  await logEntityUpdate(supabase, {
    entityType: "company",
    entityId: input.id,
    actorId: actor?.id ?? null,
    diff: diffPayload(before, after, [
      "name",
      "type",
      "timezone",
      "business_hours_start",
      "business_hours_end",
    ]),
  });

  revalidatePath("/dashboard/companies");
  revalidatePath(`/dashboard/companies/${input.id}`);
  return { ok: true };
}

export type DeleteCompanyResult = { ok: true } | { ok: false; error: string };

// Companies often have dependent rows (contacts, deals, projects). The
// underlying FKs are NO ACTION / RESTRICT — Postgres will refuse the
// DELETE rather than silently cascade. Surface that as a clean error.
export async function deleteCompany(id: string): Promise<DeleteCompanyResult> {
  const role = await getCurrentRole();
  if (!canDelete(role, "company")) {
    return {
      ok: false,
      error: "You don't have permission to delete companies.",
    };
  }
  if (!id) return { ok: false, error: "Missing company id." };

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "This company has contacts, deals, or projects attached. Detach or delete those first.",
      };
    }
    return { ok: false, error: error.message };
  }

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "company",
      entity_id: id,
      action: "deleted",
      actor_id: actor?.id ?? null,
    })
    .then(() => undefined, () => undefined);

  revalidatePath("/dashboard/companies");
  return { ok: true };
}
