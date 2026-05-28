"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type DealSource = Database["public"]["Enums"]["deal_source"];

const DEAL_STAGES: readonly DealStage[] = [
  "new",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
] as const;

const DEAL_SOURCES: readonly DealSource[] = [
  "upwork",
  "linkedin",
  "referral",
  "inbound",
  "other",
] as const;

export type CreateDealState = {
  error: string | null;
};

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function numericOrNull(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function createDeal(
  _prevState: CreateDealState,
  formData: FormData
): Promise<CreateDealState> {
  const title = String(formData.get("title") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "").trim();
  const description = nullIfBlank(String(formData.get("description") ?? ""));
  const stageRaw = String(formData.get("stage") ?? "new");
  const sourceRaw = String(formData.get("source") ?? "other");
  const ownerId = nullIfBlank(String(formData.get("owner_id") ?? ""));
  const contactId = nullIfBlank(String(formData.get("contact_id") ?? ""));
  const valueInr = numericOrNull(String(formData.get("value_inr") ?? ""));
  const valueUsd = numericOrNull(String(formData.get("value_usd") ?? ""));

  if (!title) {
    return { error: "Deal title is required." };
  }

  if (!companyId) {
    return { error: "Please pick a company for this deal." };
  }

  const stage = (DEAL_STAGES as readonly string[]).includes(stageRaw)
    ? (stageRaw as DealStage)
    : "new";
  const source = (DEAL_SOURCES as readonly string[]).includes(sourceRaw)
    ? (sourceRaw as DealSource)
    : "other";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("deals")
    .insert({
      company_id: companyId,
      contact_id: contactId,
      owner_id: ownerId,
      title,
      description,
      stage,
      source,
      value_inr: valueInr,
      value_usd: valueUsd,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      error: insertError?.message ?? "Couldn't create the deal.",
    };
  }

  const { error: logError } = await supabase.from("activity_log").insert({
    entity_type: "deal",
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

  redirect("/dashboard/deals");
}
