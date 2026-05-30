"use server";

import { revalidatePath } from "next/cache";

import { canDelete, canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { diffPayload, logEntityUpdate } from "@/lib/activity-log";
import { createClient } from "@/lib/supabase/server";

const KINDS = ["advance", "installment", "final", "other"] as const;
const STATUSES = ["expected", "received", "refunded"] as const;
const CURRENCIES = ["INR", "USD"] as const;

export type UpdatePaymentResult = { ok: true } | { ok: false; error: string };

// Edit an existing payment. Per Task 27 flags:
//   - project_id / deal_id reassignment is OUT OF SCOPE (would also require
//     re-deriving company_id + contact_id and updating the partner row,
//     and a payment moving between projects is a finance-significant
//     event that probably wants a void+recreate audit trail, not a
//     silent column swap). Both stay read-only on this edit pass.
//   - recorded_by stays untouched. The payments_insert RLS clause
//     enforces self-attribution; letting edit rewrite it would break
//     the integrity that lets the audit log answer "who logged this
//     money?". Edits don't change the original recorder.
//
// Editable: amount, currency, kind, status, received_at, reference, note.
export async function updatePayment(input: {
  id: string;
  amount: number;
  currency: string;
  kind: string;
  status: string;
  receivedAt: string | null;
  reference: string | null;
  note: string | null;
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

  const { data: before } = await supabase
    .from("payments")
    .select(
      "id, amount, currency, kind, status, received_at, reference, note"
    )
    .eq("id", input.id)
    .maybeSingle();
  if (!before) {
    return { ok: false, error: "Payment not found." };
  }

  // Mirror the create path: "expected" rows null out received_at so the
  // finance view can cleanly split landed vs outstanding.
  const receivedAt = input.status === "received" ? input.receivedAt : null;

  const after = {
    amount: input.amount,
    currency: input.currency,
    kind: input.kind,
    status: input.status,
    received_at: receivedAt,
    reference: input.reference,
    note: input.note,
  };

  const { error } = await supabase
    .from("payments")
    .update(after)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  await logEntityUpdate(supabase, {
    entityType: "payment",
    entityId: input.id,
    actorId: actor?.id ?? null,
    diff: diffPayload(before, after, [
      "amount",
      "currency",
      "kind",
      "status",
      "received_at",
      "reference",
      "note",
    ]),
  });

  revalidatePath("/dashboard/payments");
  revalidatePath(`/dashboard/payments/${input.id}`);
  return { ok: true };
}

export type DeletePaymentResult = { ok: true } | { ok: false; error: string };

export async function deletePayment(id: string): Promise<DeletePaymentResult> {
  const role = await getCurrentRole();
  if (!canDelete(role, "payment")) {
    return {
      ok: false,
      error: "You don't have permission to delete payments.",
    };
  }
  if (!id) return { ok: false, error: "Missing payment id." };

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "payment",
      entity_id: id,
      action: "deleted",
      actor_id: actor?.id ?? null,
    })
    .then(() => undefined, () => undefined);

  revalidatePath("/dashboard/payments");
  return { ok: true };
}
