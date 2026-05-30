"use server";

import { revalidatePath } from "next/cache";

import { canDelete, canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { diffPayload, logEntityUpdate } from "@/lib/activity-log";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type DealSource = Database["public"]["Enums"]["deal_source"];
const STAGES: ReadonlyArray<DealStage> = [
  "new",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
];
const SOURCES: ReadonlyArray<DealSource> = [
  "upwork",
  "linkedin",
  "referral",
  "inbound",
  "other",
];

export type UpdateDealResult = { ok: true } | { ok: false; error: string };

export async function updateDeal(input: {
  id: string;
  title: string;
  description: string | null;
  stage: string;
  source: string;
  ownerId: string | null;
  contactId: string | null;
  companyId: string;
  valueInr: number | null;
  valueUsd: number | null;
}): Promise<UpdateDealResult> {
  const role = await getCurrentRole();
  if (!canEdit(role, "deal")) {
    return { ok: false, error: "You don't have permission to edit deals." };
  }
  if (!input.id) return { ok: false, error: "Missing deal id." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Deal title is required." };
  if (!input.companyId) return { ok: false, error: "Company is required." };
  const stage = (STAGES as readonly string[]).includes(input.stage)
    ? (input.stage as DealStage)
    : null;
  if (!stage) return { ok: false, error: "Invalid deal stage." };
  const source = (SOURCES as readonly string[]).includes(input.source)
    ? (input.source as DealSource)
    : null;
  if (!source) return { ok: false, error: "Invalid deal source." };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("deals")
    .select(
      "id, title, description, stage, source, owner_id, contact_id, company_id, value_inr, value_usd"
    )
    .eq("id", input.id)
    .maybeSingle();
  if (!before) {
    return { ok: false, error: "Deal not found." };
  }

  const after = {
    title,
    description: input.description,
    stage,
    source,
    owner_id: input.ownerId,
    contact_id: input.contactId,
    company_id: input.companyId,
    value_inr: input.valueInr,
    value_usd: input.valueUsd,
  };

  const { error } = await supabase.from("deals").update(after).eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  await logEntityUpdate(supabase, {
    entityType: "deal",
    entityId: input.id,
    actorId: actor?.id ?? null,
    diff: diffPayload(before, after, [
      "title",
      "description",
      "stage",
      "source",
      "owner_id",
      "contact_id",
      "company_id",
      "value_inr",
      "value_usd",
    ]),
  });

  revalidatePath("/dashboard/deals");
  revalidatePath(`/dashboard/deals/${input.id}`);
  return { ok: true };
}

export type DeleteDealResult = { ok: true } | { ok: false; error: string };

export async function deleteDeal(id: string): Promise<DeleteDealResult> {
  const role = await getCurrentRole();
  if (!canDelete(role, "deal")) {
    return { ok: false, error: "You don't have permission to delete deals." };
  }
  if (!id) return { ok: false, error: "Missing deal id." };

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        error:
          "This deal has projects or payments attached. Delete or detach those first.",
      };
    }
    return { ok: false, error: error.message };
  }

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "deal",
      entity_id: id,
      action: "deleted",
      actor_id: actor?.id ?? null,
    })
    .then(() => undefined, () => undefined);

  revalidatePath("/dashboard/deals");
  return { ok: true };
}
