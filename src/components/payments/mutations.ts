"use server";

import { revalidatePath } from "next/cache";

import { canDelete, canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

const KINDS = ["advance", "installment", "final", "other"] as const;
const STATUSES = ["expected", "received", "refunded"] as const;
const CURRENCIES = ["INR", "USD"] as const;

export type UpdatePaymentResult = { ok: true } | { ok: false; error: string };

export async function updatePayment(input: {
  id: string;
  amount: number;
  currency: string;
  kind: string;
  status: string;
  receivedAt: string | null;
  reference: string | null;
  note: string | null;
  revalidate: string;
}): Promise<UpdatePaymentResult> {
  const role = await getCurrentRole();
  if (!canEdit(role, "payment")) {
    return { ok: false, error: "You don't have permission to edit payments." };
  }
  if (!input.id) return { ok: false, error: "Missing payment id." };
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
  const { error } = await supabase
    .from("payments")
    .update({
      amount: input.amount,
      currency: input.currency,
      kind: input.kind,
      status: input.status,
      received_at: input.status === "received" ? input.receivedAt : null,
      reference: input.reference,
      note: input.note,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(input.revalidate);
  return { ok: true };
}

export type DeletePaymentResult = { ok: true } | { ok: false; error: string };

export async function deletePayment(
  paymentId: string,
  revalidate: string
): Promise<DeletePaymentResult> {
  const role = await getCurrentRole();
  if (!canDelete(role, "payment")) {
    return {
      ok: false,
      error: "You don't have permission to delete payments.",
    };
  }
  if (!paymentId) return { ok: false, error: "Missing payment id." };

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "payment",
      entity_id: paymentId,
      action: "deleted",
      actor_id: actor?.id ?? null,
    })
    .then(() => undefined, () => undefined);

  revalidatePath(revalidate);
  return { ok: true };
}
