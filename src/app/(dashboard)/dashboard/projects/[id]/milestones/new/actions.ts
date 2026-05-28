"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type MilestoneStatus = Database["public"]["Enums"]["milestone_status"];

const MILESTONE_STATUSES: readonly MilestoneStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "blocked",
] as const;

export type CreateMilestoneState = {
  error: string | null;
};

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function dateOnlyOrNull(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  // target_date column is `date`, so keep it in YYYY-MM-DD form.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

export async function createMilestone(
  projectId: string,
  _prevState: CreateMilestoneState,
  formData: FormData
): Promise<CreateMilestoneState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = nullIfBlank(String(formData.get("description") ?? ""));
  const statusRaw = String(formData.get("status") ?? "not_started");
  const targetDate = dateOnlyOrNull(String(formData.get("target_date") ?? ""));
  const sequenceRaw = String(formData.get("sequence") ?? "").trim();

  if (!name) {
    return { error: "Milestone name is required." };
  }

  const sequence = Number.parseInt(sequenceRaw, 10);
  if (!Number.isFinite(sequence) || sequence < 1) {
    return { error: "Sequence must be a positive integer." };
  }

  const status = (MILESTONE_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as MilestoneStatus)
    : "not_started";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("milestones")
    .insert({
      project_id: projectId,
      name,
      description,
      status,
      target_date: targetDate,
      sequence,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    // 23505 = unique_violation. The only unique constraint on this table is
    // (project_id, sequence) — translate to a human message.
    if (insertError?.code === "23505") {
      return {
        error: `Sequence ${sequence} is already used by another milestone in this project. Pick a different number.`,
      };
    }
    return {
      error: insertError?.message ?? "Couldn't create the milestone.",
    };
  }

  const { error: logError } = await supabase.from("activity_log").insert({
    entity_type: "milestone",
    entity_id: inserted.id,
    action: "created",
    actor_id: user.id,
    after_state: inserted,
  });

  if (logError) {
    console.error("activity_log insert failed:", logError);
  }

  redirect(`/dashboard/projects/${projectId}`);
}
