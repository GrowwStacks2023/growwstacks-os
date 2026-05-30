"use server";

import { revalidatePath } from "next/cache";

import { canDelete, canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type CompanyType = Database["public"]["Enums"]["company_type"];
const COMPANY_TYPES: readonly CompanyType[] = [
  "prospect",
  "client",
  "partner",
] as const;

export type UpdateCompanyResult = { ok: true } | { ok: false; error: string };

export async function updateCompany(input: {
  id: string;
  name: string;
  type: string;
  timezone: string;
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

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ name, type, timezone: input.timezone })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

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
