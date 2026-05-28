"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const KINDS = ["advance", "installment", "final", "other"] as const;
const STATUSES = ["expected", "received", "refunded"] as const;
const CURRENCIES = ["INR", "USD"] as const;

export type RecordPaymentInput = {
  projectId: string | null;
  dealId: string | null;
  companyId: string;
  amount: number;
  currency: string;
  kind: string;
  status: string;
  receivedAt: string | null;
  reference: string | null;
  note: string | null;
  // Detail-page path so the new row shows up on next render.
  revalidate: string;
};

export type RecordPaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: string };

// Insert a payment row from the project/deal detail page. RLS enforces that
// only admin/sales/pm can write; this action layer adds defensive validation
// so a malformed enum value isn't blindly forwarded.
export async function recordPayment(
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  if (!input.companyId) {
    return { ok: false, error: "company_id is required." };
  }
  if (!input.projectId && !input.dealId) {
    return {
      ok: false,
      error: "A payment must attach to a project or a deal.",
    };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Amount must be a positive number." };
  }
  if (!(CURRENCIES as readonly string[]).includes(input.currency)) {
    return { ok: false, error: "Currency must be INR or USD." };
  }
  if (!(KINDS as readonly string[]).includes(input.kind)) {
    return { ok: false, error: "Unknown payment kind." };
  }
  if (!(STATUSES as readonly string[]).includes(input.status)) {
    return { ok: false, error: "Unknown payment status." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("payments")
    .insert({
      project_id: input.projectId,
      deal_id: input.dealId,
      company_id: input.companyId,
      amount: input.amount,
      currency: input.currency,
      kind: input.kind,
      status: input.status,
      // Only carry received_at for actually-landed payments. "Expected" rows
      // intentionally leave it null so the finance view can sort outstanding
      // separately.
      received_at: input.status === "received" ? input.receivedAt : null,
      reference: input.reference,
      note: input.note,
      recorded_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Couldn't record the payment.",
    };
  }

  // Audit row mirrors the pattern used elsewhere; non-fatal.
  const { error: logError } = await supabase.from("activity_log").insert({
    entity_type: input.projectId ? "project" : "deal",
    entity_id: (input.projectId ?? input.dealId) as string,
    action: "payment_recorded",
    actor_id: user.id,
    after_state: {
      payment_id: inserted.id,
      amount: input.amount,
      currency: input.currency,
      kind: input.kind,
      status: input.status,
    },
  });
  if (logError) {
    console.error("activity_log insert failed:", logError);
  }

  revalidatePath(input.revalidate);
  return { ok: true, paymentId: inserted.id };
}
