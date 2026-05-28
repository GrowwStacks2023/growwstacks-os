import { createClient } from "@/lib/supabase/server";

import type { PaymentKind, PaymentStatus } from "@/lib/status-colors";

export type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  kind: PaymentKind;
  status: PaymentStatus;
  received_at: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
  recorded_by: string | null;
  recorder: { name: string | null; email: string } | null;
};

type FetchResult = {
  payments: PaymentRow[];
  currentUserRole: string | null;
  currentUserId: string | null;
};

// Server helper: list payments for a project (the must-have view).
// Also returns the current user's role so the calling page can role-gate the
// UI without an extra round-trip. RLS will independently block dev reads.
export async function fetchProjectPayments(
  projectId: string
): Promise<FetchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserRole: string | null = null;
  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    currentUserRole = userRow?.role ?? null;
  }

  // RLS blocks devs at the DB layer; we still skip the round-trip when we
  // already know the caller has no access.
  if (!user || currentUserRole === "developer" || currentUserRole === null) {
    return {
      payments: [],
      currentUserRole,
      currentUserId: user?.id ?? null,
    };
  }

  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, amount, currency, kind, status, received_at, reference, note, created_at, recorded_by, recorder:users(name, email)"
    )
    .eq("project_id", projectId)
    .order("received_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchProjectPayments failed:", error);
    return {
      payments: [],
      currentUserRole,
      currentUserId: user.id,
    };
  }

  // The DB stores kind/status as text with a CHECK; TypeScript sees them as
  // `string` from the generated row type. Cast through unknown because we
  // know the union is enforced at the DB layer.
  return {
    payments: (data ?? []) as unknown as PaymentRow[],
    currentUserRole,
    currentUserId: user.id,
  };
}

// Sibling helper for the deal detail page. Same shape as fetchProjectPayments
// but filters by deal_id. Deal-level rows are advances / mobilisations against
// a not-yet-converted opportunity.
export async function fetchDealPayments(dealId: string): Promise<FetchResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserRole: string | null = null;
  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    currentUserRole = userRow?.role ?? null;
  }

  if (!user || currentUserRole === "developer" || currentUserRole === null) {
    return {
      payments: [],
      currentUserRole,
      currentUserId: user?.id ?? null,
    };
  }

  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, amount, currency, kind, status, received_at, reference, note, created_at, recorded_by, recorder:users(name, email)"
    )
    .eq("deal_id", dealId)
    .order("received_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchDealPayments failed:", error);
    return { payments: [], currentUserRole, currentUserId: user.id };
  }

  return {
    payments: (data ?? []) as unknown as PaymentRow[],
    currentUserRole,
    currentUserId: user.id,
  };
}
