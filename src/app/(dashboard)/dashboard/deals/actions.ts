"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type DealStage = Database["public"]["Enums"]["deal_stage"];

const STAGES: ReadonlyArray<DealStage> = [
  "new",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
];

function isDealStage(v: string): v is DealStage {
  return (STAGES as ReadonlyArray<string>).includes(v);
}

export type UpdateDealStageResult =
  | { ok: true }
  | { ok: false; error: string };

// Single server action for Kanban drag-end. Uses the server Supabase client
// — trust RLS to block unauthorized callers. We never use the service role
// here, and we never bypass RLS. If the caller can't write the row, the
// UPDATE returns 0 affected rows + no error, which we treat as "denied".
//
// The deals schema is unchanged — we touch only the existing `stage` column.
export async function updateDealStage(
  dealId: string,
  nextStage: string
): Promise<UpdateDealStageResult> {
  if (typeof dealId !== "string" || dealId.length === 0) {
    return { ok: false, error: "Missing deal id." };
  }
  if (typeof nextStage !== "string" || !isDealStage(nextStage)) {
    return { ok: false, error: "Invalid stage." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("deals")
    .update({ stage: nextStage })
    .eq("id", dealId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    // RLS or row-not-found. Don't leak which to the client.
    return { ok: false, error: "Couldn't update this deal." };
  }

  revalidatePath("/dashboard/deals");
  revalidatePath(`/dashboard/deals/${dealId}`);
  revalidatePath("/dashboard");

  return { ok: true };
}
