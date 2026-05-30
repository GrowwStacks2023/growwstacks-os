"use server";

import { revalidatePath } from "next/cache";

import { canDelete, canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { diffPayload, logEntityUpdate } from "@/lib/activity-log";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type MilestoneStatus = Database["public"]["Enums"]["milestone_status"];
const STATUSES: readonly MilestoneStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "blocked",
] as const;

export type UpdateMilestoneResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateMilestone(input: {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: string;
  sequence: number;
  targetDate: string | null;
}): Promise<UpdateMilestoneResult> {
  const role = await getCurrentRole();
  if (!canEdit(role, "milestone")) {
    return {
      ok: false,
      error: "You don't have permission to edit milestones.",
    };
  }
  if (!input.id) return { ok: false, error: "Missing milestone id." };
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Milestone name is required." };
  if (!Number.isFinite(input.sequence) || input.sequence < 1) {
    return { ok: false, error: "Sequence must be 1 or higher." };
  }
  const status = (STATUSES as readonly string[]).includes(input.status)
    ? (input.status as MilestoneStatus)
    : null;
  if (!status) return { ok: false, error: "Invalid status." };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("milestones")
    .select("id, name, description, status, sequence, target_date")
    .eq("id", input.id)
    .maybeSingle();
  if (!before) {
    return { ok: false, error: "Milestone not found." };
  }

  const after = {
    name,
    description: input.description,
    status,
    sequence: input.sequence,
    target_date: input.targetDate,
  };

  const { error } = await supabase
    .from("milestones")
    .update(after)
    .eq("id", input.id);
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: `Sequence ${input.sequence} is already used by another milestone in this project. Pick a different number.`,
      };
    }
    return { ok: false, error: error.message };
  }

  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  await logEntityUpdate(supabase, {
    entityType: "milestone",
    entityId: input.id,
    actorId: actor?.id ?? null,
    diff: diffPayload(before, after, [
      "name",
      "description",
      "status",
      "sequence",
      "target_date",
    ]),
  });

  revalidatePath(`/dashboard/projects/${input.projectId}`);
  revalidatePath(`/dashboard/projects/${input.projectId}/milestones/${input.id}`);
  return { ok: true };
}

export type DeleteMilestoneResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteMilestone(
  id: string,
  projectId: string
): Promise<DeleteMilestoneResult> {
  const role = await getCurrentRole();
  if (!canDelete(role, "milestone")) {
    return {
      ok: false,
      error: "You don't have permission to delete milestones.",
    };
  }
  if (!id) return { ok: false, error: "Missing milestone id." };

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("milestones").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "milestone",
      entity_id: id,
      action: "deleted",
      actor_id: actor?.id ?? null,
    })
    .then(() => undefined, () => undefined);

  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}
