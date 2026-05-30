"use server";

import { redirect } from "next/navigation";

import { canCreate } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
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
  dealId: string | null;
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

// Direct (non-form-action) entry point used by the create form so the client
// can do post-create work before navigating.
export async function createDealDirect(input: {
  title: string;
  companyId: string;
  description: string | null;
  stage: string;
  source: string;
  ownerId: string | null;
  contactId: string | null;
  valueInr: number | null;
  valueUsd: number | null;
}): Promise<CreateDealState> {
  const callerRole = await getCurrentRole();
  if (!canCreate(callerRole, "deal")) {
    return {
      error: "You don't have permission to create deals.",
      dealId: null,
    };
  }

  const title = input.title.trim();
  if (!title) {
    return { error: "Deal title is required.", dealId: null };
  }
  if (!input.contactId) {
    return { error: "Please pick a contact for this deal.", dealId: null };
  }
  if (!input.companyId) {
    // companyId is derived in the UI from the chosen contact. It can be
    // empty when the contact has no company — but the deals schema
    // requires NOT NULL company_id, so we reject here with a clear
    // message rather than letting Postgres bounce it with a generic
    // not-null violation.
    return {
      error:
        "Contact has no company. Add a company to the contact before logging the deal.",
      dealId: null,
    };
  }

  const stage = (DEAL_STAGES as readonly string[]).includes(input.stage)
    ? (input.stage as DealStage)
    : "new";
  const source = (DEAL_SOURCES as readonly string[]).includes(input.source)
    ? (input.source as DealSource)
    : "other";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", dealId: null };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("deals")
    .insert({
      company_id: input.companyId,
      contact_id: input.contactId,
      owner_id: input.ownerId,
      title,
      description: input.description,
      stage,
      source,
      value_inr: input.valueInr,
      value_usd: input.valueUsd,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      error: insertError?.message ?? "Couldn't create the deal.",
      dealId: null,
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
    console.error("activity_log insert failed:", logError);
  }

  return { error: null, dealId: inserted.id };
}

// FormData wrapper kept so the action remains usable as a form action if
// needed. The new-deal-form uses createDealDirect so it can stage attachments.
export async function createDeal(
  _prevState: CreateDealState,
  formData: FormData
): Promise<CreateDealState> {
  const result = await createDealDirect({
    title: String(formData.get("title") ?? ""),
    companyId: String(formData.get("company_id") ?? "").trim(),
    description: nullIfBlank(String(formData.get("description") ?? "")),
    stage: String(formData.get("stage") ?? "new"),
    source: String(formData.get("source") ?? "other"),
    ownerId: nullIfBlank(String(formData.get("owner_id") ?? "")),
    contactId: nullIfBlank(String(formData.get("contact_id") ?? "")),
    valueInr: numericOrNull(String(formData.get("value_inr") ?? "")),
    valueUsd: numericOrNull(String(formData.get("value_usd") ?? "")),
  });

  if (result.error || !result.dealId) {
    return result;
  }

  redirect(`/dashboard/deals/${result.dealId}`);
}
